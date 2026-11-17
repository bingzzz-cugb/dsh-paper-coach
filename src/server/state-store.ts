import { mkdir, readFile, rename, writeFile } from 'node:fs/promises'
import { homedir } from 'node:os'
import { basename, join } from 'node:path'
import {
  DEFAULT_SETTINGS,
  type LearningGoalItem,
  type PaperCoachSettings,
  type PaperHighlightSpec,
  type PaperNavigationCommand,
  type PaperReadingPlan,
  type PaperViewportStatus,
  type ReadingStage,
  type RoadmapSectionItem,
  type ServerPushEvent,
  type SessionPaperState,
} from '../shared/protocol'
import { normalizeSectionId } from '../shared/section-matcher'

function sanitizeFileId(sessionId: string): string {
  return sessionId.replace(/[^a-zA-Z0-9._-]/g, '_').slice(0, 160) || 'default'
}

export class PaperCoachStore {
  private readonly baseDir: string
  private readonly sessionsDir: string
  private readonly settingsPath: string

  private settings: PaperCoachSettings = { ...DEFAULT_SETTINGS }
  private settingsLoaded = false
  private readonly states = new Map<string, SessionPaperState>()
  private readonly loadingStates = new Map<string, Promise<SessionPaperState>>()
  private readonly sessionSubscribers = new Map<string, Set<(ev: ServerPushEvent) => void>>()
  private readonly globalSubscribers = new Set<(ev: ServerPushEvent) => void>()
  private readonly settingsChangeListeners = new Set<() => void>()
  private navSeq = 1
  private saveTimers = new Map<string, ReturnType<typeof setTimeout>>()

  constructor(baseDir = join(homedir(), '.dsh', 'paper-coach')) {
    this.baseDir = baseDir
    this.sessionsDir = join(baseDir, 'sessions')
    this.settingsPath = join(baseDir, 'settings.json')
  }

  async init(): Promise<void> {
    if (this.settingsLoaded) return
    await mkdir(this.sessionsDir, { recursive: true }).catch(() => {})
    try {
      const raw = await readFile(this.settingsPath, 'utf8')
      const parsed = JSON.parse(raw) as Partial<PaperCoachSettings>
      this.settings = { ...DEFAULT_SETTINGS, ...parsed }
    } catch {
      this.settings = { ...DEFAULT_SETTINGS }
    }
    this.settingsLoaded = true
  }

  getRawSettings(): PaperCoachSettings {
    return { ...this.settings }
  }

  getRedactedSettings(): PaperCoachSettings {
    const copy: PaperCoachSettings = {
      ...this.settings,
      hasCustomApiKey: Boolean(this.settings.customApiKey && this.settings.customApiKey.trim().length > 0),
    }
    delete copy.customApiKey
    return copy
  }

  onSettingsChange(fn: () => void): () => void {
    this.settingsChangeListeners.add(fn)
    return () => this.settingsChangeListeners.delete(fn)
  }

  async updateSettings(patch: Partial<PaperCoachSettings> & { clearCustomApiKey?: boolean }): Promise<PaperCoachSettings> {
    await this.init()
    const next: PaperCoachSettings = { ...this.settings }
    if (patch.translationMode) next.translationMode = patch.translationMode
    if (typeof patch.targetLanguage === 'string' && patch.targetLanguage.trim()) {
      next.targetLanguage = patch.targetLanguage.trim()
    }
    if (typeof patch.customApiBaseUrl === 'string' && patch.customApiBaseUrl.trim()) {
      next.customApiBaseUrl = patch.customApiBaseUrl.trim()
    }
    if (typeof patch.customApiModel === 'string' && patch.customApiModel.trim()) {
      next.customApiModel = patch.customApiModel.trim()
    }
    if (typeof patch.hostModelRoute === 'string') {
      next.hostModelRoute = patch.hostModelRoute.trim()
    }
    if (patch.roadmapDockMode === 'float' || patch.roadmapDockMode === 'pdf_top') {
      next.roadmapDockMode = patch.roadmapDockMode
    }
    if (patch.archiveBackend === 'auto' || patch.archiveBackend === 'openviking' || patch.archiveBackend === 'local') {
      next.archiveBackend = patch.archiveBackend
    }
    if (typeof patch.preferLocalZotero === 'boolean') {
      next.preferLocalZotero = patch.preferLocalZotero
    }
    if (typeof patch.researchFocusHint === 'string') {
      next.researchFocusHint = patch.researchFocusHint
    }
    if (patch.clearCustomApiKey) {
      delete next.customApiKey
    } else if (typeof patch.customApiKey === 'string' && patch.customApiKey.trim().length > 0) {
      next.customApiKey = patch.customApiKey.trim()
    }

    this.settings = next
    await mkdir(this.baseDir, { recursive: true }).catch(() => {})
    const tmp = `${this.settingsPath}.tmp`
    await writeFile(tmp, JSON.stringify(this.settings, null, 2), 'utf8')
    await rename(tmp, this.settingsPath).catch(() => writeFile(this.settingsPath, JSON.stringify(this.settings, null, 2), 'utf8'))

    const redacted = this.getRedactedSettings()
    this.broadcastGlobal({ type: 'settings_updated', settings: redacted })
    for (const fn of this.settingsChangeListeners) {
      try { fn() } catch {}
    }
    return redacted
  }

  async getSessionState(sessionId: string): Promise<SessionPaperState> {
    await this.init()
    const cached = this.states.get(sessionId)
    if (cached) return cached

    const pending = this.loadingStates.get(sessionId)
    if (pending) return pending

    const loadTask = (async (): Promise<SessionPaperState> => {
      const filePath = join(this.sessionsDir, `${sanitizeFileId(sessionId)}.json`)
      try {
        const raw = await readFile(filePath, 'utf8')
        const parsed = JSON.parse(raw) as SessionPaperState
        const hydrated: SessionPaperState = {
          sessionId,
          activePdfPath: parsed.activePdfPath,
          activePaperTitle: parsed.activePaperTitle,
          plan: parsed.plan,
          viewport: parsed.viewport,
          highlights: Array.isArray(parsed.highlights) ? parsed.highlights : [],
          lastNav: parsed.lastNav,
          revision: typeof parsed.revision === 'number' ? parsed.revision : 1,
        }
        if (hydrated.lastNav && hydrated.lastNav.seq >= this.navSeq) {
          this.navSeq = hydrated.lastNav.seq + 1
        }
        this.states.set(sessionId, hydrated)
        return hydrated
      } catch {
        const fresh: SessionPaperState = {
          sessionId,
          highlights: [],
          revision: 1,
        }
        this.states.set(sessionId, fresh)
        return fresh
      } finally {
        this.loadingStates.delete(sessionId)
      }
    })()

    this.loadingStates.set(sessionId, loadTask)
    return loadTask
  }

  private schedulePersist(sessionId: string): void {
    const existing = this.saveTimers.get(sessionId)
    if (existing) clearTimeout(existing)
    const timer = setTimeout(() => {
      this.saveTimers.delete(sessionId)
      const state = this.states.get(sessionId)
      if (!state) return
      const filePath = join(this.sessionsDir, `${sanitizeFileId(sessionId)}.json`)
      const tmp = `${filePath}.tmp`
      mkdir(this.sessionsDir, { recursive: true })
        .then(() => writeFile(tmp, JSON.stringify(state, null, 2), 'utf8'))
        .then(() => rename(tmp, filePath))
        .catch(() => writeFile(filePath, JSON.stringify(state, null, 2), 'utf8').catch(() => {}))
    }, 120)
    timer.unref?.()
    this.saveTimers.set(sessionId, timer)
  }

  hasConnectedView(sessionId: string): boolean {
    const subs = this.sessionSubscribers.get(sessionId)
    return Boolean(subs && subs.size > 0)
  }

  subscribeSession(sessionId: string, fn: (ev: ServerPushEvent) => void): () => void {
    let set = this.sessionSubscribers.get(sessionId)
    if (!set) {
      set = new Set()
      this.sessionSubscribers.set(sessionId, set)
    }
    set.add(fn)
    this.globalSubscribers.add(fn)
    return () => {
      set?.delete(fn)
      if (set && set.size === 0) this.sessionSubscribers.delete(sessionId)
      this.globalSubscribers.delete(fn)
    }
  }

  private emitSession(sessionId: string, ev: ServerPushEvent): void {
    const subs = this.sessionSubscribers.get(sessionId)
    if (!subs) return
    for (const fn of subs) {
      try { fn(ev) } catch {}
    }
  }

  private broadcastGlobal(ev: ServerPushEvent): void {
    for (const fn of this.globalSubscribers) {
      try { fn(ev) } catch {}
    }
  }

  async openPaper(
    sessionId: string,
    input: { pdfPath: string; paperTitle?: string; page?: number; section?: string }
  ): Promise<{ state: SessionPaperState; command: PaperNavigationCommand; delivered: boolean }> {
    const state = await this.getSessionState(sessionId)
    const title = input.paperTitle?.trim() || basename(input.pdfPath).replace(/\.pdf$/i, '')
    state.activePdfPath = input.pdfPath
    state.activePaperTitle = title
    if (state.plan && !state.plan.pdfPath) {
      state.plan.pdfPath = input.pdfPath
    }
    const cmd: PaperNavigationCommand = {
      seq: this.navSeq++,
      pdfPath: input.pdfPath,
      paperTitle: title,
      openInSidebar: true,
      page: input.page,
      section: input.section ? normalizeSectionId(input.section) || input.section : undefined,
      issuedAt: Date.now(),
    }
    state.lastNav = cmd
    state.revision += 1
    this.schedulePersist(sessionId)
    const delivered = this.hasConnectedView(sessionId)
    this.emitSession(sessionId, { type: 'navigate', state, command: cmd })
    return { state, command: cmd, delivered }
  }

  async navigatePaper(
    sessionId: string,
    input: {
      pdfPath?: string
      page?: number
      section?: string
      clearPreviousHighlights?: boolean
      highlights?: Array<{ text: string; page?: number; section?: string; color?: 'amber' | 'blue' | 'green' | 'rose'; label?: string }>
    }
  ): Promise<{ state: SessionPaperState; command: PaperNavigationCommand; delivered: boolean }> {
    const state = await this.getSessionState(sessionId)
    const targetPath = input.pdfPath || state.activePdfPath || state.plan?.pdfPath
    if (targetPath) {
      state.activePdfPath = targetPath
    }

    const newHighlights: PaperHighlightSpec[] = (input.highlights ?? [])
      .filter(h => typeof h.text === 'string' && h.text.trim().length > 0)
      .map((h, i) => ({
        id: `hl-${Date.now()}-${i}`,
        text: h.text.trim(),
        page: h.page ?? input.page,
        section: h.section ?? input.section,
        color: h.color ?? 'amber',
        label: h.label?.trim() || undefined,
        createdAt: Date.now(),
      }))

    if (input.clearPreviousHighlights !== false && newHighlights.length > 0) {
      state.highlights = newHighlights
    } else if (newHighlights.length > 0) {
      state.highlights = [...state.highlights.slice(-20), ...newHighlights]
    } else if (input.clearPreviousHighlights === true) {
      state.highlights = []
    }

    const cmd: PaperNavigationCommand = {
      seq: this.navSeq++,
      pdfPath: targetPath,
      paperTitle: state.activePaperTitle,
      openInSidebar: Boolean(targetPath),
      page: input.page,
      section: input.section ? normalizeSectionId(input.section) || input.section : undefined,
      clearPreviousHighlights: input.clearPreviousHighlights,
      highlights: newHighlights.length > 0 ? newHighlights : undefined,
      issuedAt: Date.now(),
    }
    state.lastNav = cmd
    state.revision += 1
    this.schedulePersist(sessionId)
    const delivered = this.hasConnectedView(sessionId)
    this.emitSession(sessionId, { type: 'navigate', state, command: cmd })
    return { state, command: cmd, delivered }
  }

  async updateReadingPlan(
    sessionId: string,
    input: {
      action: 'set' | 'update' | 'clear'
      paperKey?: string
      paperTitle?: string
      pdfPath?: string
      mode?: 'full' | 'targeted'
      stage?: ReadingStage
      goals?: Array<{ id?: string; text: string; done?: boolean }>
      sections?: Array<{ id?: string; section: string; title?: string; page?: number; note?: string; status?: 'pending' | 'current' | 'done' }>
    }
  ): Promise<SessionPaperState> {
    const state = await this.getSessionState(sessionId)
    if (input.action === 'clear') {
      state.plan = undefined
      state.revision += 1
      this.schedulePersist(sessionId)
      this.emitSession(sessionId, { type: 'state_updated', state })
      return state
    }

    const prev = input.action === 'update' ? state.plan : undefined
    const goals: LearningGoalItem[] = input.goals
      ? input.goals.map((g, idx) => ({
          id: g.id || `goal-${idx + 1}`,
          text: g.text.trim(),
          done: Boolean(g.done),
        }))
      : prev?.goals ?? []

    const sections: RoadmapSectionItem[] = input.sections
      ? input.sections.map((s, idx) => ({
          id: s.id || `sec-${idx + 1}`,
          section: normalizeSectionId(s.section) || s.section.trim(),
          title: s.title?.trim() || undefined,
          page: s.page,
          note: s.note?.trim() || undefined,
          status: s.status ?? (idx === 0 ? 'current' : 'pending'),
        }))
      : prev?.sections ?? []

    const resolvedPdfPath = input.pdfPath?.trim() || prev?.pdfPath || state.activePdfPath
    const resolvedTitle =
      input.paperTitle?.trim() ||
      prev?.paperTitle ||
      state.activePaperTitle ||
      (resolvedPdfPath ? basename(resolvedPdfPath).replace(/\.pdf$/i, '') : '当前精读论文')

    const nextPlan: PaperReadingPlan = {
      paperKey: input.paperKey?.trim() || prev?.paperKey,
      paperTitle: resolvedTitle,
      pdfPath: resolvedPdfPath,
      mode: input.mode ?? prev?.mode ?? (sections.length > 0 ? 'targeted' : 'full'),
      stage: input.stage ?? prev?.stage ?? (sections.length > 0 ? 'reading' : 'overview'),
      goals,
      sections,
      updatedAt: Date.now(),
    }

    state.plan = nextPlan
    if (resolvedPdfPath && !state.activePdfPath) state.activePdfPath = resolvedPdfPath
    if (resolvedTitle && !state.activePaperTitle) state.activePaperTitle = resolvedTitle
    state.revision += 1
    this.schedulePersist(sessionId)
    this.emitSession(sessionId, { type: 'state_updated', state })
    return state
  }

  async updateViewport(sessionId: string, viewport: PaperViewportStatus): Promise<SessionPaperState> {
    const state = await this.getSessionState(sessionId)
    state.viewport = { ...viewport, updatedAt: Date.now() }
    if (viewport.pdfPath) state.activePdfPath = viewport.pdfPath
    if (viewport.paperTitle && !state.activePaperTitle) state.activePaperTitle = viewport.paperTitle
    this.schedulePersist(sessionId)
    return state
  }

  async clearHighlights(sessionId: string): Promise<SessionPaperState> {
    const state = await this.getSessionState(sessionId)
    state.highlights = []
    state.revision += 1
    this.schedulePersist(sessionId)
    this.emitSession(sessionId, { type: 'state_updated', state })
    return state
  }

  dispose(): void {
    for (const timer of this.saveTimers.values()) clearTimeout(timer)
    this.saveTimers.clear()
    this.sessionSubscribers.clear()
    this.globalSubscribers.clear()
    this.settingsChangeListeners.clear()
  }
}
