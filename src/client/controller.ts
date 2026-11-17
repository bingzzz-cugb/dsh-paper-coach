import { DEFAULT_SETTINGS, type NormalizedRect, type PaperCoachSettings, type PaperHighlightSpec, type PaperNavigationCommand, type PaperQuotePayload, type PaperViewportStatus, type ServerPushEvent, type SessionPaperState } from '../shared/protocol'
import { formatPaperQuoteBlock, normalizeSectionId } from '../shared/section-matcher'

export interface DraftInputHandle {
  state: { getSnapshot(): { draft: string; draftRev?: number; phase?: string; occurrences?: readonly { source: string; ref: string }[] } }
  setDraft(text: string): void
  focus?(): void
  notify?(level: 'info' | 'error', text: string): void
  insertReference?(ref: unknown, span: unknown): boolean
}

export interface ViewerJumpTarget {
  nonce: number
  pdfPath?: string
  page?: number
  section?: string
  queryText?: string
  highlights?: PaperHighlightSpec[]
  flashRects?: { page: number; rects: NormalizedRect[] }
}

export interface LoadedPdfEngine {
  getDocument: any
  GlobalWorkerOptions: any
  PDFWorker: any
  TextLayer: any
  workerCode: string
}

export const PAPER_QUOTE_SOURCE = 'dsh-paper-coach-quote'
const EMPTY_QUOTES: readonly PaperQuotePayload[] = Object.freeze([])

export function resolveHostHttpBaseUrl(
  docBaseUri?: string,
  locationHref?: string,
  streamBaseUrl?: string
): string {
  const pageBase =
    (typeof docBaseUri === 'string' && docBaseUri) ||
    (typeof document !== 'undefined' && typeof document.baseURI === 'string' && document.baseURI) ||
    (typeof locationHref === 'string' && locationHref) ||
    (typeof window !== 'undefined' && typeof window.location?.href === 'string' && window.location.href) ||
    ''
  const w = typeof window !== 'undefined' ? (window as any) : undefined
  const transportBase = streamBaseUrl ?? w?.__DSH_TRANSPORT__?.streamBaseUrl
  // Prefer the page's own baseURI (e.g. dsh-app://app/ in Desktop, or reverse-proxy path in Web)
  // so Electron's same-origin protocol handler attaches Host auth cookies without cross-origin CORS blocks.
  const raw =
    pageBase ||
    (typeof transportBase === 'string' && transportBase ? transportBase : 'http://dsh.internal/')
  const u = new URL(raw, 'http://dsh.internal/')
  u.search = ''
  u.hash = ''
  if (!u.pathname) {
    u.pathname = '/'
  } else if (!u.pathname.endsWith('/')) {
    const lastSlash = u.pathname.lastIndexOf('/')
    const lastSeg = lastSlash >= 0 ? u.pathname.slice(lastSlash + 1) : u.pathname
    if (lastSeg.includes('.')) {
      u.pathname = u.pathname.slice(0, Math.max(0, lastSlash) + 1) || '/'
    } else {
      u.pathname += '/'
    }
  }
  return u.href
}

export class PaperCoachClientController {
  private betterSidebar: any = undefined
  private settings: PaperCoachSettings = { ...DEFAULT_SETTINGS }
  private settingsOpenSessionId: string | null = null
  private readonly sessionStates = new Map<string, SessionPaperState>()
  private readonly sessionStreams = new Map<string, { abort: AbortController; refCount: number }>()
  private readonly handledNavSeq = new Map<string, number>()
  private readonly jumpTargets = new Map<string, ViewerJumpTarget>()
  private readonly quotes = new Map<string, PaperQuotePayload[]>()
  private readonly inputs = new Map<string, DraftInputHandle>()
  private readonly listeners = new Set<() => void>()
  private activeSessionId: string | undefined = undefined
  private jumpNonce = 1
  private pdfEnginePromise: Promise<LoadedPdfEngine> | null = null

  setBetterSidebar(service: any): void {
    this.betterSidebar = service
    this.emit()
  }

  getBetterSidebar(): any {
    return this.betterSidebar
  }

  setActiveSession(sessionId: string): void {
    this.activeSessionId = sessionId
  }

  getActiveSession(): string | undefined {
    return this.activeSessionId
  }

  registerInput(sessionId: string, input: DraftInputHandle | undefined): void {
    if (input) this.inputs.set(sessionId, input)
    else this.inputs.delete(sessionId)
  }

  getInput(sessionId: string): DraftInputHandle | undefined {
    return this.inputs.get(sessionId)
  }

  subscribe = (listener: () => void): (() => void) => {
    this.listeners.add(listener)
    return () => this.listeners.delete(listener)
  }

  private emit(): void {
    for (const fn of this.listeners) {
      try { fn() } catch {}
    }
  }

  routeUrl(path: string): string {
    const clean = path.replace(/^\/+/, '')
    if (this.betterSidebar && typeof this.betterSidebar.hostRouteUrl === 'function') {
      const r = this.betterSidebar.hostRouteUrl(clean)
      return typeof r === 'string' ? r : r.href
    }
    return new URL(clean, resolveHostHttpBaseUrl()).href
  }

  async apiPost<T = any>(action: string, body: Record<string, unknown>, signal?: AbortSignal): Promise<T> {
    const res = await fetch(this.routeUrl('paper-coach/api/' + action), {
      method: 'POST',
      credentials: 'include',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(body),
      signal,
    })
    const data = await res.json().catch(() => ({ ok: false, error: 'Invalid JSON response' }))
    if (!res.ok || data.ok === false) {
      throw new Error(data.error || ('Request failed: HTTP ' + res.status))
    }
    return data as T
  }

  loadPdfEngine(): Promise<LoadedPdfEngine> {
    if (this.pdfEnginePromise) return this.pdfEnginePromise
    this.pdfEnginePromise = (async () => {
      const [runtimeRes, workerRes] = await Promise.all([
        fetch(this.routeUrl('paper-coach/assets/pdf-runtime.mjs'), { credentials: 'include' }),
        fetch(this.routeUrl('paper-coach/assets/pdf.worker.mjs'), { credentials: 'include' }),
      ])
      if (!runtimeRes.ok) throw new Error('Failed to load pdf-runtime.mjs: HTTP ' + runtimeRes.status)
      if (!workerRes.ok) throw new Error('Failed to load pdf.worker.mjs: HTTP ' + workerRes.status)
      const [runtimeCode, workerCode] = await Promise.all([runtimeRes.text(), workerRes.text()])
      const blobUrl = URL.createObjectURL(new Blob([runtimeCode], { type: 'text/javascript' }))
      try {
        const mod = await import(/* @vite-ignore */ blobUrl)
        return {
          getDocument: mod.getDocument,
          GlobalWorkerOptions: mod.GlobalWorkerOptions,
          PDFWorker: mod.PDFWorker,
          TextLayer: mod.TextLayer,
          workerCode,
        }
      } finally {
        URL.revokeObjectURL(blobUrl)
      }
    })().catch(err => {
      this.pdfEnginePromise = null
      throw err
    })
    return this.pdfEnginePromise
  }

  getSettings(): PaperCoachSettings {
    return this.settings
  }

  async refreshSettings(): Promise<PaperCoachSettings> {
    const res = await this.apiPost<{ settings: PaperCoachSettings }>('settings.get', {})
    this.settings = res.settings
    this.emit()
    return this.settings
  }

  async updateSettings(patch: Partial<PaperCoachSettings> & { clearCustomApiKey?: boolean }): Promise<PaperCoachSettings> {
    const res = await this.apiPost<{ settings: PaperCoachSettings }>('settings.update', patch as Record<string, unknown>)
    this.settings = res.settings
    this.emit()
    return this.settings
  }

  isSettingsModalOpen(): boolean {
    return this.settingsOpenSessionId !== null
  }

  openSettingsModal(sessionId = 'global'): void {
    this.settingsOpenSessionId = sessionId
    void this.refreshSettings().catch(() => {})
    this.emit()
  }

  closeSettingsModal(): void {
    this.settingsOpenSessionId = null
    this.emit()
  }

  getSessionState(sessionId: string): SessionPaperState | undefined {
    return this.sessionStates.get(sessionId)
  }

  getJumpTarget(sessionId: string): ViewerJumpTarget | undefined {
    return this.jumpTargets.get(sessionId)
  }

  consumeJumpTarget(sessionId: string, nonce: number): void {
    const cur = this.jumpTargets.get(sessionId)
    if (cur && cur.nonce === nonce) {
      this.jumpTargets.delete(sessionId)
      this.emit()
    }
  }

  retainSession(sessionId: string): () => void {
    const existing = this.sessionStreams.get(sessionId)
    if (existing) {
      existing.refCount += 1
      return () => this.releaseSession(sessionId)
    }
    const abort = new AbortController()
    this.sessionStreams.set(sessionId, { abort, refCount: 1 })
    void this.runEventLoop(sessionId, abort.signal)
    return () => this.releaseSession(sessionId)
  }

  private releaseSession(sessionId: string): void {
    const entry = this.sessionStreams.get(sessionId)
    if (!entry) return
    entry.refCount -= 1
    if (entry.refCount <= 0) {
      entry.abort.abort()
      this.sessionStreams.delete(sessionId)
    }
  }

  private async runEventLoop(sessionId: string, signal: AbortSignal): Promise<void> {
    while (!signal.aborted) {
      try {
        const url = this.routeUrl('paper-coach/events?sessionId=' + encodeURIComponent(sessionId))
        const res = await fetch(url, { credentials: 'include', signal })
        if (!res.ok || !res.body) throw new Error('SSE HTTP ' + res.status)
        const reader = res.body.getReader()
        const decoder = new TextDecoder()
        let buffer = ''
        while (!signal.aborted) {
          const { value, done } = await reader.read()
          if (done) break
          buffer += decoder.decode(value, { stream: true })
          let idx: number
          while ((idx = buffer.indexOf('\n\n')) >= 0) {
            const rawEvent = buffer.slice(0, idx)
            buffer = buffer.slice(idx + 2)
            for (const line of rawEvent.split('\n')) {
              if (line.startsWith('data: ')) {
                try {
                  const ev = JSON.parse(line.slice(6)) as ServerPushEvent
                  this.handleServerEvent(sessionId, ev)
                } catch {}
              }
            }
          }
        }
      } catch {
        if (signal.aborted) return
        await new Promise(r => setTimeout(r, 2000))
      }
    }
  }

  private handleServerEvent(sessionId: string, ev: ServerPushEvent): void {
    if (ev.type === 'snapshot') {
      this.settings = ev.settings
      this.sessionStates.set(sessionId, ev.state)
      // If a navigation command was issued recently (< 30s) while view wasn't connected, execute it now
      if (ev.state.lastNav && Date.now() - ev.state.lastNav.issuedAt < 30000) {
        this.applyNavigationCommand(sessionId, ev.state.lastNav)
      }
      this.emit()
      return
    }
    if (ev.type === 'settings_updated') {
      this.settings = ev.settings
      this.emit()
      return
    }
    if (ev.type === 'state_updated') {
      this.sessionStates.set(sessionId, ev.state)
      this.emit()
      return
    }
    if (ev.type === 'navigate') {
      this.sessionStates.set(sessionId, ev.state)
      this.applyNavigationCommand(sessionId, ev.command)
      this.emit()
    }
  }

  private applyNavigationCommand(sessionId: string, cmd: PaperNavigationCommand): void {
    const prevSeq = this.handledNavSeq.get(sessionId) ?? 0
    if (cmd.seq <= prevSeq) return
    this.handledNavSeq.set(sessionId, cmd.seq)

    if (cmd.openInSidebar && cmd.pdfPath && this.betterSidebar?.openFile) {
      try {
        this.betterSidebar.openFile({ sessionId }, cmd.pdfPath, cmd.paperTitle)
      } catch (err) {
        console.warn('[paper-coach] openFile failed:', err)
      }
    }

    if (cmd.page !== undefined || cmd.section !== undefined || (cmd.highlights && cmd.highlights.length > 0) || cmd.flashRects) {
      this.jumpTargets.set(sessionId, {
        nonce: this.jumpNonce++, 
        pdfPath: cmd.pdfPath,
        page: cmd.page,
        section: cmd.section,
        highlights: cmd.highlights,
        flashRects: cmd.flashRects,
      })
    }
  }

  jumpToPaperLocation(
    sessionId: string,
    target: { pdfPath?: string; paperTitle?: string; page?: number; section?: string; queryText?: string; rects?: NormalizedRect[] }
  ): boolean {
    const state = this.sessionStates.get(sessionId)
    const pdfPath = target.pdfPath || state?.activePdfPath || state?.plan?.pdfPath
    const paperTitle = target.paperTitle || state?.activePaperTitle || state?.plan?.paperTitle
    if (pdfPath && this.betterSidebar?.openFile) {
      try {
        this.betterSidebar.openFile({ sessionId }, pdfPath, paperTitle)
      } catch {}
    }
    this.jumpTargets.set(sessionId, {
      nonce: this.jumpNonce++,
      pdfPath,
      page: target.page,
      section: target.section ? normalizeSectionId(target.section) || target.section : undefined,
      queryText: target.queryText,
      flashRects: target.page && target.rects && target.rects.length > 0 ? { page: target.page, rects: target.rects } : undefined,
    })
    this.emit()
    return Boolean(pdfPath || target.page || target.section)
  }

  reportViewport(sessionId: string, viewport: PaperViewportStatus): void {
    void this.apiPost('viewport.update', { sessionId, viewport }).catch(() => {})
  }

  async clearHighlights(sessionId: string): Promise<void> {
    await this.apiPost('highlights.clear', { sessionId }).catch(() => {})
  }

  /* Quotes management */
  getQuotes(sessionId: string): readonly PaperQuotePayload[] {
    return this.quotes.get(sessionId) ?? EMPTY_QUOTES
  }

  addQuote(sessionId: string, quote: Omit<PaperQuotePayload, 'id'>): PaperQuotePayload {
    const full: PaperQuotePayload = {
      ...quote,
      id: 'pquote-' + Date.now() + '-' + Math.random().toString(36).slice(2, 6),
    }
    const prev = this.quotes.get(sessionId) ?? []
    this.quotes.set(sessionId, [...prev, full])
    this.emit()
    this.inputs.get(sessionId)?.focus?.()
    return full
  }

  removeQuote(sessionId: string, id: string): void {
    const prev = this.quotes.get(sessionId)
    if (!prev || prev.length === 0) return
    const next = prev.filter(q => q.id !== id)
    if (next.length === 0) this.quotes.delete(sessionId)
    else this.quotes.set(sessionId, next)
    this.emit()
  }

  clearQuotes(sessionId: string): void {
    this.quotes.delete(sessionId)
    this.emit()
  }

  askMainAgentTranslate(sessionId: string, quote: Omit<PaperQuotePayload, 'id'>): void {
    const input = this.inputs.get(sessionId)
    if (!input) return
    const formatted = formatPaperQuoteBlock(
      [{ ...quote, id: 'tr-1' }],
      '请结合上下文将上面选中的论文段落准确翻译为中文，保留数学符号与关键专业术语，并简要点明该句在本节中的作用。'
    )
    input.setDraft(formatted)
    input.focus?.()
  }

  async toggleGoalDone(sessionId: string, goalId: string): Promise<void> {
    const plan = this.sessionStates.get(sessionId)?.plan
    if (!plan) return
    const goals = plan.goals.map(g => (g.id === goalId ? { ...g, done: !g.done } : g))
    await this.apiPost('plan.update', { sessionId, action: 'update', goals })
  }

  async advanceSectionDone(sessionId: string, sectionId: string): Promise<void> {
    const plan = this.sessionStates.get(sessionId)?.plan
    if (!plan) return
    let promoteNext = false
    let nextTarget: { section: string; page?: number } | undefined
    const sections = plan.sections.map(s => {
      if (s.id === sectionId) {
        if (s.status !== 'done') promoteNext = true
        return { ...s, status: 'done' as const }
      }
      if (promoteNext && s.status === 'pending') {
        promoteNext = false
        nextTarget = { section: s.section, page: s.page }
        return { ...s, status: 'current' as const }
      }
      return s
    })
    await this.apiPost('plan.update', { sessionId, action: 'update', sections })
    if (nextTarget) {
      this.jumpToPaperLocation(sessionId, { pdfPath: plan.pdfPath, paperTitle: plan.paperTitle, section: nextTarget.section, page: nextTarget.page })
    }
  }

  async startQuizFromPanel(sessionId: string): Promise<void> {
    const plan = this.sessionStates.get(sessionId)?.plan
    await this.apiPost('plan.update', { sessionId, action: 'update', stage: 'quiz' }).catch(() => {})
    const input = this.inputs.get(sessionId)
    if (input) {
      const secLabels = plan?.sections.map(s => s.section).join('、') || '约定范围'
      input.setDraft('我已经读完了约定的精读范围（' + secLabels + '），可以开始理解检验了。')
      input.focus?.()
    }
  }

  dispose(): void {
    for (const entry of this.sessionStreams.values()) entry.abort.abort()
    this.sessionStreams.clear()
    this.listeners.clear()
  }
}
