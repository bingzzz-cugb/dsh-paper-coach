import { existsSync } from 'node:fs'
import { readFile } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import type { PaperCoachStore } from './state-store'

const PROVIDER_NAME = 'dsh-paper-coach'
const PROVIDER_RANK = 200

interface ParsedSkillFile {
  name: string
  description: string
  body: string
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

  return { name, description, body, filePath, dirPath: dirname(filePath) }
}

function resolveSkillsRoot(): string {
  const here = dirname(fileURLToPath(import.meta.url))
  const fromLib = join(here, '..', 'skills')
  return existsSync(fromLib) ? fromLib : join(here, '..', '..', 'skills')
}

export function registerBundledPaperSkills(ctx: any, store: PaperCoachStore): () => void {
  const skillsService = ctx.skills ?? ctx.get?.('skills')
  if (!skillsService || typeof skillsService.registerProvider !== 'function') {
    return () => {}
  }

  const root = resolveSkillsRoot()
  const skillNames = ['paper-reading-navigator', 'coaching-paper-reading'] as const

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
        for (const sName of skillNames) {
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

        const settings = store.getRedactedSettings()
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

        const extraBlock = dynamicNotes.length > 0
          ? '\n\n## 当前环境与用户配置提示\n\n' + dynamicNotes.join('\n')
          : ''

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
