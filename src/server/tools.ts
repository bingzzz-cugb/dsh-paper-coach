import { defineTool } from '@deepseek-ai/dsh-tools'
import { stat } from 'node:fs/promises'
import { isAbsolute, resolve } from 'node:path'
import type { PaperCoachStore } from './state-store'
import type { ReadingStage } from '../shared/protocol'

function sessionIdOf(exec: any): string {
  const id = exec?.agent?.session?.id
  if (typeof id !== 'string' || !id) {
    throw new Error('paper_reader tools require an active Agent session')
  }
  return id
}

async function resolveSessionCwd(ctx: any, sessionId: string): Promise<string> {
  const session = ctx.get?.('sessions')?.get?.(sessionId)
  if (session) {
    const cwd = ctx.get?.('workingDirectory')?.get?.(session) ?? session.header?.cwd
    if (typeof cwd === 'string' && cwd.length > 0) return cwd
  }
  const defDir = ctx.get?.('workingDirectory')?.defaultDirectory
  if (typeof defDir === 'string' && defDir.length > 0) return defDir
  return process.cwd()
}

async function resolvePdfFilePath(ctx: any, sessionId: string, rawPath: string): Promise<string> {
  const trimmed = rawPath.trim()
  if (!trimmed) throw new Error('PDF path must not be empty')
  const cwd = await resolveSessionCwd(ctx, sessionId)
  const abs = isAbsolute(trimmed) ? resolve(trimmed) : resolve(cwd, trimmed)
  const info = await stat(abs).catch(() => null)
  if (!info || !info.isFile()) {
    throw new Error('PDF file not found or not a regular file: ' + abs)
  }
  return abs
}

function textRender<T>(fn: (value: T) => string) {
  return (_args: unknown, value: T) => [{ type: 'text' as const, text: fn(value) }]
}

function cleanJson<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T
}

export function registerPaperCoachTools(ctx: any, store: PaperCoachStore): () => void {
  const tools = ctx.tools ?? ctx.get?.('tools')
  if (!tools || typeof tools.register !== 'function') return () => {}

  const disposers: Array<() => void> = []

  disposers.push(
    tools.register(defineTool({
      name: 'paper_reader_open',
      description: 'Open a local academic paper PDF in the calling conversation sidebar enhanced PDF reader (dsh-paper-coach), optionally jumping directly to a target page or section (e.g. "4.1" or "8"). Call this when guided close reading starts so the user immediately has the cached PDF open beside the chat.',
      parameters: {
        path: { type: 'string', required: true, description: 'Absolute or session-cwd-relative path to the local PDF file.' },
        title: { type: 'string', description: 'Optional short paper title displayed on the reader header and quote chips.' },
        page: { type: 'number', description: 'Optional 1-based page number to scroll to upon opening.' },
        section: { type: 'string', description: 'Optional section identifier to jump to upon opening (e.g. "4.1", "§5.2", "8").' },
      },
      output: {
        schema: {
          type: 'object',
          additionalProperties: false,
          properties: {
            pdfPath: { type: 'string', required: true },
            paperTitle: { type: 'string', required: true },
            delivered: { type: 'boolean', required: true },
          },
        },
        render: textRender((v: { pdfPath: string; paperTitle: string; delivered: boolean }) =>
          v.delivered
            ? 'Opened paper PDF "' + v.paperTitle + '" (' + v.pdfPath + ') in the sidebar reader.'
            : 'Queued opening paper PDF "' + v.paperTitle + '" (' + v.pdfPath + ') — will appear when the session view connects.'
        ),
      },
      execute: async (args: any, exec: any) => {
        exec.signal?.throwIfAborted?.()
        const sessionId = sessionIdOf(exec)
        const absPath = await resolvePdfFilePath(ctx, sessionId, String(args.path))
        const { state, delivered } = await store.openPaper(sessionId, {
          pdfPath: absPath,
          paperTitle: typeof args.title === 'string' ? args.title : undefined,
          page: typeof args.page === 'number' ? Math.max(1, Math.floor(args.page)) : undefined,
          section: typeof args.section === 'string' ? args.section : undefined,
        })
        return { pdfPath: absPath, paperTitle: state.activePaperTitle || 'Paper', delivered }
      },
    }))
  )

  disposers.push(
    tools.register(defineTool({
      name: 'paper_reader_navigate',
      description: 'Scroll the sidebar PDF reader to a specific section (e.g. "8", "4.1", "Conclusion") or 1-based page number, and optionally highlight 1-5 key verbatim sentences on the PDF page.',
      parameters: {
        section: { type: 'string', description: 'Target section number or heading (e.g. "8", "4.1", "§5.2", "Appendix A").' },
        page: { type: 'number', description: 'Target 1-based PDF page number.' },
        path: { type: 'string', description: 'Optional PDF path if switching papers; defaults to active paper.' },
        clearPreviousHighlights: { type: 'boolean', description: 'Whether to clear previous model highlights before applying new ones.' },
        highlights: {
          type: 'array',
          description: 'Key verbatim sentences/phrases from the paper to highlight in the PDF TextLayer.',
          items: {
            type: 'object',
            additionalProperties: false,
            properties: {
              text: { type: 'string', required: true, description: 'Exact verbatim sentence or clause from the PDF.' },
              page: { type: 'number', description: 'Optional 1-based page hint where this sentence appears.' },
              color: { type: 'string', enum: ['amber', 'blue', 'green', 'rose'], description: 'Highlight color theme (default: amber).' },
              label: { type: 'string', description: 'Short note badge shown beside the highlight.' },
            },
          },
        },
      },
      output: {
        schema: {
          type: 'object',
          additionalProperties: false,
          properties: {
            pdfPath: { type: 'string' },
            section: { type: 'string' },
            page: { type: 'number' },
            highlightCount: { type: 'number', required: true },
            delivered: { type: 'boolean', required: true },
          },
        },
        render: textRender((v: any) =>
          'Navigated PDF reader (section=' + (v.section ?? '-') + ', page=' + (v.page ?? '-') + ', highlights=' + v.highlightCount + ', delivered=' + v.delivered + ').'
        ),
      },
      execute: async (args: any, exec: any) => {
        exec.signal?.throwIfAborted?.()
        const sessionId = sessionIdOf(exec)
        const absPath = typeof args.path === 'string' && args.path.trim()
          ? await resolvePdfFilePath(ctx, sessionId, args.path)
          : undefined
        const { command, delivered } = await store.navigatePaper(sessionId, {
          pdfPath: absPath,
          page: typeof args.page === 'number' ? Math.max(1, Math.floor(args.page)) : undefined,
          section: typeof args.section === 'string' ? args.section : undefined,
          clearPreviousHighlights: typeof args.clearPreviousHighlights === 'boolean' ? args.clearPreviousHighlights : undefined,
          highlights: Array.isArray(args.highlights) ? args.highlights : undefined,
        })
        return cleanJson({
          pdfPath: command.pdfPath,
          section: command.section,
          page: command.page,
          highlightCount: command.highlights?.length ?? 0,
          delivered,
        })
      },
    }))
  )

  disposers.push(
    tools.register(defineTool({
      name: 'paper_reading_plan',
      description: 'Create, update, or clear the persistent Floating Reading Roadmap & Learning Goals Panel for the current session. Displays agreed reading sections (e.g. §4.1 -> §5.2) and core learning goals.',
      parameters: {
        action: { type: 'string', required: true, enum: ['set', 'update', 'clear'], description: 'set initializes/replaces; update patches; clear removes.' },
        paperTitle: { type: 'string', description: 'Title or short alias of the paper.' },
        paperKey: { type: 'string', description: 'Optional archive paper-key.' },
        pdfPath: { type: 'string', description: 'Optional local PDF path.' },
        mode: { type: 'string', enum: ['targeted', 'full'], description: 'Reading mode.' },
        stage: { type: 'string', enum: ['overview', 'reading', 'quiz', 'summary', 'completed'], description: 'Current workflow stage.' },
        goals: {
          type: 'array',
          description: 'Concrete learning objectives / questions to resolve.',
          items: {
            type: 'object',
            additionalProperties: false,
            properties: {
              id: { type: 'string' },
              text: { type: 'string', required: true },
              done: { type: 'boolean' },
            },
          },
        },
        sections: {
          type: 'array',
          description: 'Ordered list of agreed sections to study.',
          items: {
            type: 'object',
            additionalProperties: false,
            properties: {
              id: { type: 'string' },
              section: { type: 'string', required: true },
              title: { type: 'string' },
              page: { type: 'number' },
              note: { type: 'string' },
              status: { type: 'string', enum: ['pending', 'current', 'done'] },
            },
          },
        },
      },
      output: {
        schema: {
          type: 'object',
          additionalProperties: false,
          properties: {
            active: { type: 'boolean', required: true },
            paperTitle: { type: 'string' },
            stage: { type: 'string' },
            goalCount: { type: 'number', required: true },
            sectionCount: { type: 'number', required: true },
          },
        },
        render: textRender((v: any) =>
          v.active
            ? 'Updated reading roadmap panel for "' + v.paperTitle + '" (stage=' + v.stage + ', goals=' + v.goalCount + ', sections=' + v.sectionCount + ').'
            : 'Cleared reading roadmap panel.'
        ),
      },
      execute: async (args: any, exec: any) => {
        exec.signal?.throwIfAborted?.()
        const sessionId = sessionIdOf(exec)
        const absPdf = typeof args.pdfPath === 'string' && args.pdfPath.trim()
          ? await resolvePdfFilePath(ctx, sessionId, args.pdfPath).catch(() => args.pdfPath)
          : undefined
        const state = await store.updateReadingPlan(sessionId, {
          action: args.action,
          paperKey: args.paperKey,
          paperTitle: args.paperTitle,
          pdfPath: absPdf,
          mode: args.mode,
          stage: args.stage as ReadingStage | undefined,
          goals: args.goals,
          sections: args.sections,
        })
        return cleanJson({
          active: Boolean(state.plan),
          paperTitle: state.plan?.paperTitle,
          stage: state.plan?.stage,
          goalCount: state.plan?.goals.length ?? 0,
          sectionCount: state.plan?.sections.length ?? 0,
        })
      },
    }))
  )

  disposers.push(
    tools.register(defineTool({
      name: 'paper_reader_status',
      description: 'Read the current state of the sidebar paper PDF reader and reading roadmap panel for this conversation (currently open PDF path, user visible page, current section, detected outline sections, and roadmap progress).',
      parameters: {},
      output: {
        schema: {
          type: 'object',
          additionalProperties: true,
          properties: {
            connected: { type: 'boolean', required: true },
            activePdfPath: { type: 'string' },
            activePaperTitle: { type: 'string' },
          },
        },
        render: textRender((v: any) => JSON.stringify(v, null, 2)),
      },
      execute: async (_args: any, exec: any) => {
        exec.signal?.throwIfAborted?.()
        const sessionId = sessionIdOf(exec)
        const state = await store.getSessionState(sessionId)
        return cleanJson({
          connected: store.hasConnectedView(sessionId),
          activePdfPath: state.activePdfPath,
          activePaperTitle: state.activePaperTitle,
          viewport: state.viewport,
          plan: state.plan,
          activeHighlightCount: state.highlights.length,
        })
      },
    }))
  )

  return () => {
    for (const d of disposers) {
      try { d() } catch {}
    }
  }
}
