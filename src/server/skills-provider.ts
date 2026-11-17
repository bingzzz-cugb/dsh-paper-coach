import { existsSync } from 'node:fs'
import { mkdir, readdir, readFile, rm, writeFile } from 'node:fs/promises'
import { homedir } from 'node:os'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import type { PaperCoachStore } from './state-store'

const PROVIDER_NAME = 'dsh-paper-coach'
const PROVIDER_RANK = 200
const SKILL_NAMES = ['paper-reading-navigator', 'coaching-paper-reading'] as const
export const AGY_MANAGED_SKILL_MARKER = '<!-- dsh-paper-coach:managed -->'

export const PAPER_COACH_SYSTEM_PROMPT_LINES = [
  '## Academic Paper Sidebar & Reading Panel (dsh-paper-coach)',
  '- When starting or resuming close reading of a local cached PDF paper, call paper_reader_open to open it automatically in the right sidebar, and call paper_reading_plan to display agreed reading sections (e.g. §4.1, §5.2) and learning goals in the floating panel.',
  '- When answering questions about a specific section or sentence of the open paper, call paper_reader_navigate to scroll the sidebar PDF to that section/page and highlight 1-3 key verbatim sentences, and include clickable location badges like [📍 §8 · p.9](paper-coach://loc?section=8&page=9&q=first%20few%20words) in your explanation.',
  '- User messages starting with "# 论文原文定位引用 (Paper Excerpt)" come from the user selecting text directly inside the sidebar PDF reader with exact page and section coordinates.',
]

interface ParsedSkillFile {
  name: string
  description: string
  body: string
  raw: string
  filePath: string
  dirPath: string
}

function parseSkillMarkdown(raw: string, filePath: string): ParsedSkillFile {
  const normalized = raw.replace(/\r\n/g, '\n')
  let name = ''
  let description = ''
  let body = normalized

  if (normalized.startsWith('---\n')) {
    const endIdx = normalized.indexOf('\n---\n', 4)
    if (endIdx > 0) {
      const frontmatter = normalized.slice(4, endIdx)
      body = normalized.slice(endIdx + 5).trim()
      const nameMatch = frontmatter.match(/^name:\s*(.+)$/m)
      if (nameMatch) name = nameMatch[1]!.trim()

      const descMatch = frontmatter.match(/^description:\s*([\s\S]*?)(?=\n[a-zA-Z0-9_-]+:|$)/m)
      if (descMatch) {
        description = descMatch[1]!
          .split('\n')
          .map(l => l.trim())
          .filter(Boolean)
          .join(' ')
      }
    }
  }

  return { name, description, body, raw: normalized, filePath, dirPath: dirname(filePath) }
}

function resolveSkillsRoot(): string {
  const here = dirname(fileURLToPath(import.meta.url))
  const fromLib = join(here, '..', 'skills')
  return existsSync(fromLib) ? fromLib : join(here, '..', '..', 'skills')
}

export function buildDynamicSettingsBlock(settings: {
  archiveBackend?: string
  preferLocalZotero?: boolean
  researchFocusHint?: string
}): string {
  const dynamicNotes: string[] = []
  if (settings.archiveBackend === 'local') {
    dynamicNotes.push('- 当前插件设置强制使用本地工作区 .paper-reading/ 作为文献档案根目录。')
  } else if (settings.archiveBackend === 'openviking') {
    dynamicNotes.push('- 当前插件设置优先使用 OpenViking viking://~/resources/paper-reading/ 作为文献档案根目录。')
  }
  if (settings.preferLocalZotero) {
    dynamicNotes.push('- 当前用户启用了“优先核查本机 Zotero 文献库”：精读获取原文时请先检查本机 Zotero 是否已有该论文 PDF（Zotero 未打开时先提醒用户打开），确认无现成 PDF 后再联网检索。')
  } else {
    dynamicNotes.push('- 当前未强制要求预查本机 Zotero，可直接按用户提供的 PDF、工作区缓存或公开链接核验原文。')
  }
  if (settings.researchFocusHint && settings.researchFocusHint.trim()) {
    dynamicNotes.push('- 用户研究背景提示：' + settings.researchFocusHint.trim())
  }

  return dynamicNotes.length > 0
    ? '\n\n## 当前环境与用户配置提示\n\n' + dynamicNotes.join('\n')
    : ''
}

export function registerBundledPaperSkills(ctx: any, store: PaperCoachStore): () => void {
  const skillsService = ctx.skills ?? ctx.get?.('skills')
  if (!skillsService || typeof skillsService.registerProvider !== 'function') {
    return () => {}
  }

  const root = resolveSkillsRoot()

  const loadSkillFile = async (skillName: string): Promise<ParsedSkillFile | undefined> => {
    const filePath = join(root, skillName, 'SKILL.md')
    try {
      const raw = await readFile(filePath, 'utf8')
      const parsed = parseSkillMarkdown(raw, filePath)
      if (!parsed.name) parsed.name = skillName
      if (!parsed.description) parsed.description = 'Bundled ' + skillName + ' skill from dsh-paper-coach'
      return parsed
    } catch {
      return undefined
    }
  }

  let offSettings: (() => void) | undefined

  const offProvider = skillsService.registerProvider((control: { invalidate?: () => void }) => {
    offSettings = store.onSettingsChange(() => {
      control?.invalidate?.()
    })

    return {
      name: PROVIDER_NAME,
      async list() {
        const items: any[] = []
        for (const sName of SKILL_NAMES) {
          const parsed = await loadSkillFile(sName)
          if (!parsed) continue
          items.push({
            name: parsed.name,
            description: parsed.description,
            invocation: { modelInvocable: true, userInvocable: true },
            source: 'plugin:dsh-paper-coach',
            provider: PROVIDER_NAME,
            rank: PROVIDER_RANK,
            path: parsed.filePath,
            resourceBase: { kind: 'directory', path: parsed.dirPath.replace(/\\/g, '/') },
            locator: sName,
          })
        }
        return items
      },
      async get(candidate: any) {
        const parsed = await loadSkillFile(candidate.locator || candidate.name)
        if (!parsed) return undefined

        const extraBlock = buildDynamicSettingsBlock(store.getRedactedSettings())

        return {
          name: parsed.name,
          description: parsed.description,
          invocation: { modelInvocable: true, userInvocable: true },
          source: 'plugin:dsh-paper-coach',
          provider: PROVIDER_NAME,
          path: parsed.filePath,
          resourceBase: { kind: 'directory', path: parsed.dirPath },
          content: parsed.body + extraBlock,
        }
      },
    }
  })

  return () => {
    offSettings?.()
    if (typeof offProvider === 'function') offProvider()
  }
}

export async function registerAgySkillsSync(
  store: PaperCoachStore,
  options?: { agyConfigDir?: string }
): Promise<() => Promise<void>> {
  const targetConfigDir = options?.agyConfigDir ?? join(homedir(), '.gemini', 'config')
  if (!existsSync(targetConfigDir)) {
    return async () => {}
  }

  const root = resolveSkillsRoot()
  const agySkillsRoot = join(targetConfigDir, 'skills')
  let disposed = false
  let syncChain = Promise.resolve()

  const canManageTarget = (existingRaw: string | undefined, bundledRaw: string): boolean => {
    if (existingRaw === undefined) return true
    if (existingRaw.includes(AGY_MANAGED_SKILL_MARKER)) return true
    return existingRaw.replace(/\r\n/g, '\n').trim() === bundledRaw.replace(/\r\n/g, '\n').trim()
  }

  const syncOnce = async (): Promise<void> => {
    if (disposed || !existsSync(targetConfigDir)) return
    const settingsBlock = buildDynamicSettingsBlock(store.getRedactedSettings())
    const sidebarBlock = [
      ...PAPER_COACH_SYSTEM_PROMPT_LINES,
      '- On Antigravity (AGY) sessions where DSH tools are bridged lazily under `dsh-tools-*`, invoke `paper_reader_open`, `paper_reader_navigate`, `paper_reading_plan`, and `paper_reader_status` via `call_mcp_tool` on the `dsh-tools-*` MCP server.',
    ].join('\n')

    for (const sName of SKILL_NAMES) {
      if (disposed) return
      const srcPath = join(root, sName, 'SKILL.md')
      let bundledRaw: string
      try {
        bundledRaw = await readFile(srcPath, 'utf8')
      } catch {
        continue
      }

      const targetDir = join(agySkillsRoot, sName)
      const targetFile = join(targetDir, 'SKILL.md')
      let existingRaw: string | undefined
      try {
        existingRaw = await readFile(targetFile, 'utf8')
      } catch {
        existingRaw = undefined
      }

      if (!canManageTarget(existingRaw, bundledRaw)) {
        continue
      }

      const rendered =
        bundledRaw.replace(/\r\n/g, '\n').trimEnd() +
        '\n\n' +
        sidebarBlock +
        settingsBlock +
        '\n\n' +
        AGY_MANAGED_SKILL_MARKER +
        '\n'

      await mkdir(targetDir, { recursive: true })
      await writeFile(targetFile, rendered, 'utf8')
    }
  }

  const offSettings = store.onSettingsChange(() => {
    if (disposed) return
    syncChain = syncChain.then(() => syncOnce()).catch(() => {})
  })

  syncChain = syncChain.then(() => syncOnce())
  await syncChain

  return async () => {
    disposed = true
    offSettings()
    await syncChain.catch(() => {})

    for (const sName of SKILL_NAMES) {
      const targetDir = join(agySkillsRoot, sName)
      const targetFile = join(targetDir, 'SKILL.md')
      try {
        const existingRaw = await readFile(targetFile, 'utf8')
        if (!existingRaw.includes(AGY_MANAGED_SKILL_MARKER)) {
          continue
        }
        await rm(targetFile, { force: true })
        const remaining = await readdir(targetDir).catch(() => ['__non_empty__'])
        if (remaining.length === 0) {
          await rm(targetDir, { recursive: true, force: true })
        }
      } catch {
        // Ignore missing files on cleanup
      }
    }
  }
}
