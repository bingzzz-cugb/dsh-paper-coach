export type TranslationMode = 'host_model' | 'custom_api' | 'main_agent'
export type RoadmapDockMode = 'float' | 'pdf_top'
export type ArchiveBackendMode = 'auto' | 'openviking' | 'local'

export interface PaperCoachSettings {
  translationMode: TranslationMode
  targetLanguage: string
  customApiBaseUrl: string
  customApiKey?: string
  hasCustomApiKey?: boolean
  customApiModel: string
  hostModelRoute: string // '' = auto pick active session model or first available
  roadmapDockMode: RoadmapDockMode
  archiveBackend: ArchiveBackendMode
  preferLocalZotero: boolean
  researchFocusHint: string
}

export const DEFAULT_SETTINGS: PaperCoachSettings = {
  translationMode: 'host_model',
  targetLanguage: 'zh-CN',
  customApiBaseUrl: 'https://api.openai.com/v1',
  customApiModel: 'gpt-4o-mini',
  hostModelRoute: '',
  roadmapDockMode: 'float',
  archiveBackend: 'auto',
  preferLocalZotero: true,
  researchFocusHint: '',
}

export interface NormalizedRect {
  x: number
  y: number
  w: number
  h: number
}

export interface PaperSectionEntry {
  /** Normalized section id, e.g. '1', '4.1', '5.2', '8', 'A.1' */
  id: string
  /** Original heading text as seen in outline or page */
  rawTitle: string
  /** 1-based PDF page number */
  page: number
  /** Normalized [0..1] vertical offset on page */
  yRatio: number
}

export interface PaperHighlightSpec {
  id: string
  text: string
  page?: number
  section?: string
  color?: 'amber' | 'blue' | 'green' | 'rose'
  label?: string
  rects?: NormalizedRect[]
  createdAt: number
}

export interface LearningGoalItem {
  id: string
  text: string
  done: boolean
}

export type RoadmapSectionStatus = 'pending' | 'current' | 'done'

export interface RoadmapSectionItem {
  id: string
  /** Section identifier like '4.1' or '$5.2' or '§8' */
  section: string
  title?: string
  page?: number
  note?: string
  status: RoadmapSectionStatus
}

export type ReadingStage = 'overview' | 'reading' | 'quiz' | 'summary' | 'completed'

export interface PaperReadingPlan {
  paperKey?: string
  paperTitle: string
  pdfPath?: string
  mode: 'full' | 'targeted'
  stage: ReadingStage
  goals: LearningGoalItem[]
  sections: RoadmapSectionItem[]
  updatedAt: number
}

export interface PaperViewportStatus {
  pdfPath: string
  paperTitle?: string
  currentPage: number
  totalPages: number
  currentSection?: string
  detectedSections?: PaperSectionEntry[]
  updatedAt: number
}

export interface PaperNavigationCommand {
  seq: number
  pdfPath?: string
  paperTitle?: string
  openInSidebar?: boolean
  page?: number
  section?: string
  clearPreviousHighlights?: boolean
  highlights?: PaperHighlightSpec[]
  flashRects?: {
    page: number
    rects: NormalizedRect[]
  }
  issuedAt: number
}

export interface SessionPaperState {
  sessionId: string
  activePdfPath?: string
  activePaperTitle?: string
  plan?: PaperReadingPlan
  viewport?: PaperViewportStatus
  highlights: PaperHighlightSpec[]
  lastNav?: PaperNavigationCommand
  revision: number
}

export interface PaperQuotePayload {
  id: string
  pdfPath: string
  paperTitle: string
  page: number
  section?: string
  text: string
  rects?: NormalizedRect[]
}

export type ServerPushEvent =
  | { type: 'snapshot'; state: SessionPaperState; settings: PaperCoachSettings }
  | { type: 'state_updated'; state: SessionPaperState }
  | { type: 'navigate'; state: SessionPaperState; command: PaperNavigationCommand }
  | { type: 'settings_updated'; settings: PaperCoachSettings }
