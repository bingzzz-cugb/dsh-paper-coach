import React, { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, useSyncExternalStore } from 'react'
import type { LoadedPdfEngine, PaperCoachClientController } from './controller'
import type { PaperCoachTranslate } from './locales'
import type { NormalizedRect, PaperHighlightSpec, PaperSectionEntry } from '../shared/protocol'
import { findBestSectionMatch, matchQuoteInSpans, normalizeSectionId, parseSectionHeadingLine } from '../shared/section-matcher'
import { RoadmapPanelContent } from './RoadmapPanel'
import { SelectionToolbar, type PdfSelectionState } from './SelectionToolbar'
import { PdfPageCache, PdfRenderQueue } from './render-resources'

export interface PaperPdfViewerProps {
  scope?: { sessionId: string }
  path: string
  title: string
  mediaUrl?: string
  visible?: boolean
  controller: PaperCoachClientController
  t: PaperCoachTranslate
}

interface PageDimension {
  width: number
  height: number
}

interface FlashOverlay {
  key: number
  page?: number
  rects?: NormalizedRect[]
  queryText?: string
  scrollToMatch?: boolean
}

function samePdfPath(a?: string, b?: string): boolean {
  if (!a || !b) return true
  const na = a.replace(/\\/g, '/').replace(/\/+$/, '').toLowerCase()
  const nb = b.replace(/\\/g, '/').replace(/\/+$/, '').toLowerCase()
  return na === nb || na.endsWith('/' + nb) || nb.endsWith('/' + na)
}

function mergeLineRects(raw: NormalizedRect[]): NormalizedRect[] {
  if (raw.length <= 1) return raw
  const sorted = [...raw].sort((a, b) => (Math.abs(a.y - b.y) < 0.008 ? a.x - b.x : a.y - b.y))
  const merged: NormalizedRect[] = []
  for (const r of sorted) {
    if (r.w <= 0.001 || r.h <= 0.001) continue
    const last = merged[merged.length - 1]
    if (
      last &&
      Math.abs(last.y - r.y) < 0.009 &&
      Math.abs(last.h - r.h) < 0.012 &&
      r.x <= last.x + last.w + 0.022
    ) {
      const right = Math.max(last.x + last.w, r.x + r.w)
      last.x = Math.min(last.x, r.x)
      last.w = right - last.x
      last.y = Math.min(last.y, r.y)
      last.h = Math.max(last.h, r.h)
    } else {
      merged.push({ ...r })
    }
  }
  return merged
}

function computeSpanRangeRects(
  shellEl: HTMLElement,
  spanEls: readonly HTMLSpanElement[],
  spanTexts: readonly string[],
  queryText: string
): NormalizedRect[] {
  const ranges = matchQuoteInSpans(spanTexts, queryText)
  if (ranges.length === 0) return []
  const shellBox = shellEl.getBoundingClientRect()
  if (shellBox.width <= 0 || shellBox.height <= 0) return []
  const rawRects: NormalizedRect[] = []
  for (const seg of ranges) {
    const span = spanEls[seg.spanIndex]
    const textNode = span?.firstChild
    if (!span || !textNode || textNode.nodeType !== Node.TEXT_NODE) continue
    const maxLen = textNode.textContent?.length ?? 0
    const start = Math.max(0, Math.min(maxLen, seg.startOffset))
    const end = Math.max(start, Math.min(maxLen, seg.endOffset))
    if (end <= start) continue
    try {
      const domRange = document.createRange()
      domRange.setStart(textNode, start)
      domRange.setEnd(textNode, end)
      const clientRects = domRange.getClientRects()
      for (let i = 0; i < clientRects.length; i++) {
        const cr = clientRects[i]!
        if (cr.width < 1 || cr.height < 1) continue
        rawRects.push({
          x: Math.max(0, Math.min(1, (cr.left - shellBox.left) / shellBox.width)),
          y: Math.max(0, Math.min(1, (cr.top - shellBox.top) / shellBox.height)),
          w: Math.max(0, Math.min(1, cr.width / shellBox.width)),
          h: Math.max(0, Math.min(1, cr.height / shellBox.height)),
        })
      }
    } catch {}
  }
  return mergeLineRects(rawRects)
}

async function extractPdfSections(pdfDoc: any, cancelled: () => boolean = () => false): Promise<PaperSectionEntry[]> {
  const sections: PaperSectionEntry[] = []
  const seenIds = new Set<string>()

  const pushEntry = (entry: PaperSectionEntry) => {
    const key = entry.id.toLowerCase()
    if (!key || seenIds.has(key)) return
    seenIds.add(key)
    sections.push(entry)
  }

  // 1. Try PDF Bookmark Outline first
  try {
    const outline = await pdfDoc.getOutline()
    if (Array.isArray(outline) && outline.length > 0) {
      const walk = async (items: any[], depth: number) => {
        if (depth > 3) return
        for (const item of items) {
          if (cancelled()) return
          const rawTitle = String(item?.title || '').replace(/\s+/g, ' ').trim()
          if (rawTitle) {
            try {
              const dest = typeof item.dest === 'string' ? await pdfDoc.getDestination(item.dest) : item.dest
              if (Array.isArray(dest) && dest[0]) {
                const pageIdx = await pdfDoc.getPageIndex(dest[0])
                const pageNum = pageIdx + 1
                let yRatio = 0
                if (typeof dest[3] === 'number') {
                  const pageObj = await pdfDoc.getPage(pageNum)
                  const view: number[] = pageObj.view || [0, 0, 612, 792]
                  const h = (view[3] ?? 792) - (view[1] ?? 0)
                  if (h > 0) {
                    yRatio = Math.max(0, Math.min(0.95, ((view[3] ?? 792) - dest[3]) / h))
                  }
                }
                const parsed = parseSectionHeadingLine(rawTitle)
                const id = parsed?.id || normalizeSectionId(rawTitle) || rawTitle.slice(0, 32)
                pushEntry({ id, rawTitle, page: pageNum, yRatio })
              }
            } catch {}
          }
          if (Array.isArray(item?.items) && item.items.length > 0) {
            await walk(item.items, depth + 1)
          }
        }
      }
      await walk(outline, 0)
    }
  } catch {}

  if (sections.length >= 3) {
    return sections.sort((a, b) => (a.page !== b.page ? a.page - b.page : (a.yRatio ?? 0) - (b.yRatio ?? 0)))
  }

  // 2. Fallback: scan text content across pages for academic headings (handles 1-col & 2-col arXiv PDFs)
  const maxScanPages = Math.min(Number(pdfDoc.numPages) || 0, 45)
  for (let p = 1; p <= maxScanPages; p++) {
    if (cancelled()) return []
    // Yield between pages so indexing cannot monopolize interaction time.
    await new Promise(resolve => setTimeout(resolve, 0))
    if (cancelled()) return []
    try {
      const page = await pdfDoc.getPage(p)
      const view: number[] = page.view || [0, 0, 612, 792]
      const yMin = view[1] ?? 0
      const yMax = view[3] ?? 792
      const pageH = Math.max(1, yMax - yMin)
      const tc = await page.getTextContent()
      const items = (tc?.items || []).filter((it: any) => typeof it?.str === 'string' && it.str.trim().length > 0)
      let curText = ''
      let curY: number | null = null
      let curRight: number | null = null

      const flushLine = () => {
        if (!curText || curY === null) return
        const parsed = parseSectionHeadingLine(curText)
        if (parsed) {
          const yRatio = Math.max(0, Math.min(0.95, (yMax - curY) / pageH))
          pushEntry({ id: parsed.id, rawTitle: parsed.rawTitle, page: p, yRatio })
        }
        curText = ''
        curY = null
        curRight = null
      }

      for (const it of items) {
        const tr = it.transform || [1, 0, 0, 1, 0, 0]
        const x = Number(tr[4]) || 0
        const y = Number(tr[5]) || 0
        const w = Number(it.width) || 0
        if (curY === null || Math.abs(y - curY) > 3.5 || (curRight !== null && (x - curRight > 28 || x < curRight - 15))) {
          flushLine()
          curText = it.str
          curY = y
          curRight = x + w
        } else {
          const gap = curRight !== null ? x - curRight : 0
          curText += (gap > 1.8 && !curText.endsWith(' ') && !it.str.startsWith(' ') ? ' ' : '') + it.str
          curRight = Math.max(curRight ?? x + w, x + w)
        }
      }
      flushLine()
    } catch {}
  }

  return sections.sort((a, b) => (a.page !== b.page ? a.page - b.page : (a.yRatio ?? 0) - (b.yRatio ?? 0)))
}

interface PdfPageViewProps {
  engine: LoadedPdfEngine
  pdfDoc: any
  pageNumber: number
  scale: number
  renderScale: number
  visible: boolean
  cache: PdfPageCache
  queue: PdfRenderQueue
  defaultDim: PageDimension
  scrollRoot: HTMLElement | null
  forceRender: boolean
  highlights: readonly PaperHighlightSpec[]
  flashOverlay: FlashOverlay | null
  registerPageEl: (page: number, el: HTMLDivElement | null) => void
}

const PdfPageView = React.memo(function PdfPageView({
  engine,
  pdfDoc,
  pageNumber,
  scale,
  renderScale,
  visible,
  cache,
  queue,
  defaultDim,
  scrollRoot,
  forceRender,
  highlights,
  flashOverlay,
  registerPageEl,
}: PdfPageViewProps): React.JSX.Element {
  const shellRef = useRef<HTMLDivElement | null>(null)
  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  const textHostRef = useRef<HTMLDivElement | null>(null)
  const [nearViewport, setNearViewport] = useState(pageNumber <= 2)
  const [pageDim, setPageDim] = useState<PageDimension>(defaultDim)
  const [textReadyRev, setTextReadyRev] = useState(0)
  const spansRef = useRef<{ els: HTMLSpanElement[]; texts: string[] }>({ els: [], texts: [] })

  const [retained, setRetained] = useState(false)
  const [paintedScale, setPaintedScale] = useState(scale)
  const completedScale = useRef<number | null>(null)
  const shouldRender = visible && (nearViewport || forceRender)

  useEffect(() => { cache.setActive(pageNumber, shouldRender) }, [cache, pageNumber, shouldRender])
  useEffect(() => () => cache.forget(pageNumber), [cache, pageNumber])

  const setShell = useCallback(
    (el: HTMLDivElement | null) => {
      shellRef.current = el
      registerPageEl(pageNumber, el)
    },
    [pageNumber, registerPageEl]
  )

  useEffect(() => {
    const el = shellRef.current
    if (!el || !scrollRoot || !visible) return
    const io = new IntersectionObserver(
      entries => {
        for (const entry of entries) {
          if (entry.target === el) {
            setNearViewport(entry.isIntersecting)
          }
        }
      },
      { root: scrollRoot, rootMargin: '500px 0px' }
    )
    io.observe(el)
    return () => io.disconnect()
  }, [scrollRoot, visible])

  useEffect(() => {
    if (!shouldRender || !pdfDoc) return
    if (completedScale.current === renderScale) { cache.touch(pageNumber); return }
    const abort = new AbortController()
    let renderTask: any = null
    let textLayerInstance: any = null
    void queue.run(abort.signal, async () => {
      const page = await pdfDoc.getPage(pageNumber)
      if (abort.signal.aborted) return
      const baseVp = page.getViewport({ scale: 1 })
      setPageDim(cur => cur.width === baseVp.width && cur.height === baseVp.height ? cur : { width: baseVp.width, height: baseVp.height })
      const viewport = page.getViewport({ scale: renderScale })
      const canvas = canvasRef.current
      const textHost = textHostRef.current
      if (!canvas || !textHost) return
      // Render into staging surfaces; never erase the last good image during a zoom burst.
      const staging = document.createElement('canvas')
      const dpr = Math.min(window.devicePixelRatio || 1, 2.5)
      staging.width = Math.floor(viewport.width * dpr)
      staging.height = Math.floor(viewport.height * dpr)
      const ctx2d = staging.getContext('2d')
      if (!ctx2d) return
      ctx2d.setTransform(dpr, 0, 0, dpr, 0, 0)
      renderTask = page.render({ canvasContext: ctx2d, viewport })
      await renderTask.promise
      if (abort.signal.aborted) return
      const layerDiv = document.createElement('div')
      layerDiv.className = 'textLayer'
      layerDiv.style.setProperty('--scale-factor', String(viewport.scale))
      layerDiv.style.setProperty('--total-scale-factor', String(viewport.scale))
      textLayerInstance = new engine.TextLayer({ textContentSource: page.streamTextContent(), container: layerDiv, viewport })
      await textLayerInstance.render()
      if (abort.signal.aborted) return
      canvas.width = staging.width; canvas.height = staging.height
      canvas.style.width = `${viewport.width}px`; canvas.style.height = `${viewport.height}px`
      canvas.getContext('2d')?.drawImage(staging, 0, 0)
      textHost.replaceChildren(layerDiv)
      const els = Array.from(layerDiv.querySelectorAll('span')) as HTMLSpanElement[]
      spansRef.current = { els, texts: els.map(s => s.textContent ?? '') }
      completedScale.current = renderScale
      setPaintedScale(renderScale)
      setRetained(true)
      setTextReadyRev(r => r + 1)
      cache.retain(pageNumber, canvas.width * canvas.height, () => {
        completedScale.current = null
        canvas.width = 0; canvas.height = 0
        textHost.replaceChildren()
        spansRef.current = { els: [], texts: [] }
        setRetained(false)
      })
    }).catch(error => { if (!abort.signal.aborted) console.warn('[paper-coach] page render failed', error) })
    return () => {
      abort.abort()
      try { renderTask?.cancel?.() } catch {}
      try { textLayerInstance?.cancel?.() } catch {}
    }
  }, [shouldRender, pdfDoc, pageNumber, renderScale, engine, cache, queue])

  const [computedHighlights, setComputedHighlights] = useState<Array<{ id: string; color: string; label?: string; rects: NormalizedRect[] }>>([])
  useLayoutEffect(() => {
    const compute = () => {
      if (!shouldRender || textReadyRev === 0 || !shellRef.current) return []
      const { els, texts } = spansRef.current
      if (els.length === 0) return []
      const items: Array<{ id: string; color: string; label?: string; rects: NormalizedRect[] }> = []
      for (const hl of highlights) {
        if (hl.page && hl.page !== pageNumber) continue
        const rects = computeSpanRangeRects(shellRef.current, els, texts, hl.text)
        if (rects.length > 0) {
          items.push({
            id: hl.id,
            color: hl.color || 'amber',
            label: hl.label,
            rects,
          })
        }
      }
      return items
    }
    setComputedHighlights(compute())
  }, [shouldRender, textReadyRev, highlights, pageNumber, paintedScale, scale])

  const scrolledFlashKeyRef = useRef(0)
  const [computedFlashRects, setComputedFlashRects] = useState<NormalizedRect[]>([])
  useLayoutEffect(() => {
    const compute = () => {
      if (!flashOverlay || !shouldRender) return []
      if (flashOverlay.page && flashOverlay.page !== pageNumber) return []
      if (flashOverlay.rects && flashOverlay.rects.length > 0 && flashOverlay.page === pageNumber) {
        return flashOverlay.rects
      }
      if (flashOverlay.queryText && textReadyRev > 0 && shellRef.current) {
        const { els, texts } = spansRef.current
        return computeSpanRangeRects(shellRef.current, els, texts, flashOverlay.queryText)
      }
      return []
    }
    const nextRects = compute()
    setComputedFlashRects(nextRects)
    if (
      flashOverlay?.scrollToMatch &&
      flashOverlay.page === pageNumber &&
      nextRects.length > 0 &&
      scrolledFlashKeyRef.current !== flashOverlay.key &&
      scrollRoot &&
      shellRef.current
    ) {
      scrolledFlashKeyRef.current = flashOverlay.key
      const r0 = nextRects[0]!
      const targetTop = Math.max(
        0,
        shellRef.current.offsetTop + r0.y * shellRef.current.offsetHeight - Math.min(180, scrollRoot.clientHeight * 0.28)
      )
      scrollRoot.scrollTo({ top: targetTop, behavior: 'smooth' })
    }
  }, [flashOverlay, shouldRender, pageNumber, textReadyRev, paintedScale, scale, scrollRoot])

  const widthPx = Math.round(pageDim.width * scale)
  const heightPx = Math.round(pageDim.height * scale)

  return (
    <div
      ref={setShell}
      className='pc-page-shell'
      data-page={pageNumber}
      style={{ width: widthPx, height: heightPx }}
    >
      {(shouldRender || retained) && (
        <>
          <div style={{ position: 'absolute', left: 0, top: 0, width: pageDim.width * paintedScale, height: pageDim.height * paintedScale, transform: `scale(${scale / paintedScale})`, transformOrigin: '0 0' }}>
            <canvas ref={canvasRef} className='pc-page-canvas' />
            <div ref={textHostRef} className='pc-text-host' />
          </div>
          <div className='pc-highlight-layer'>
            {computedHighlights.map(item =>
              item.rects.map((r, idx) => (
                <React.Fragment key={item.id + '-' + idx}>
                  <div
                    className={'pc-hl-rect pc-hl-' + item.color}
                    style={{
                      left: `${r.x * 100}%`,
                      top: `${r.y * 100}%`,
                      width: `${r.w * 100}%`,
                      height: `${r.h * 100}%`,
                    }}
                  />
                  {idx === 0 && item.label && (
                    <span
                      className={'pc-hl-label pc-hl-label-' + item.color}
                      style={{ left: `${r.x * 100}%`, top: `${r.y * 100}%` }}
                    >
                      {item.label}
                    </span>
                  )}
                </React.Fragment>
              ))
            )}
            {flashOverlay &&
              computedFlashRects.map((r, idx) => (
                <div
                  key={'flash-' + flashOverlay.key + '-' + idx}
                  className='pc-hl-flash'
                  style={{
                    left: `${r.x * 100}%`,
                    top: `${r.y * 100}%`,
                    width: `${r.w * 100}%`,
                    height: `${r.h * 100}%`,
                  }}
                />
              ))}
          </div>
        </>
      )}
    </div>
  )
})

export function PaperPdfViewer({
  scope,
  path,
  title,
  mediaUrl,
  visible = true,
  controller,
  t,
}: PaperPdfViewerProps): React.JSX.Element {
  const sessionId = scope?.sessionId || controller.getActiveSession() || 'default'
  const scrollRef = useRef<HTMLDivElement | null>(null)
  const pageElsRef = useRef<Map<number, HTMLDivElement>>(new Map())
  const [scrollRoot, setScrollRoot] = useState<HTMLDivElement | null>(null)
  const [engine, setEngine] = useState<LoadedPdfEngine | null>(null)
  const [pdfDoc, setPdfDoc] = useState<any>(null)
  const [totalPages, setTotalPages] = useState(0)
  const [defaultDim, setDefaultDim] = useState<PageDimension>({ width: 612, height: 792 })
  const [sections, setSections] = useState<PaperSectionEntry[]>([])
  const [currentPage, setCurrentPage] = useState(1)
  const [currentSection, setCurrentSection] = useState<string | undefined>(undefined)
  const [outlineOpen, setOutlineOpen] = useState(false)
  const [containerWidth, setContainerWidth] = useState(520)
  const [zoomMode, setZoomMode] = useState<'fit' | number>('fit')
  const [loadingError, setLoadingError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [selection, setSelection] = useState<PdfSelectionState | null>(null)
  const [flashOverlay, setFlashOverlay] = useState<FlashOverlay | null>(null)
  const [pinnedPage, setPinnedPage] = useState<number | null>(null)
  const [documentVisible, setDocumentVisible] = useState(() => !document.hidden)
  const active = visible && documentVisible
  const cache = useMemo(() => new PdfPageCache(), [pdfDoc])
  const queue = useMemo(() => new PdfRenderQueue(2), [pdfDoc])
  const indexedDoc = useRef<any>(null)
  const setScrollElement = useCallback((el: HTMLDivElement | null) => {
    scrollRef.current = el
    setScrollRoot(el)
  }, [])

  useEffect(() => {
    const update = () => setDocumentVisible(!document.hidden)
    document.addEventListener('visibilitychange', update)
    return () => document.removeEventListener('visibilitychange', update)
  }, [])
  useEffect(() => { if (!active) setSelection(null) }, [active])
  useEffect(() => {
    if (pinnedPage === null) return
    const timer = setTimeout(() => setPinnedPage(null), 900)
    return () => clearTimeout(timer)
  }, [pinnedPage])

  const sessionState = useSyncExternalStore(
    controller.subscribe,
    () => controller.getSessionState(sessionId)
  )
  const settings = useSyncExternalStore(
    controller.subscribe,
    () => controller.getSettings()
  )
  const jumpTarget = useSyncExternalStore(
    controller.subscribe,
    () => controller.getJumpTarget(sessionId)
  )

  const paperTitle = useMemo(() => {
    if (sessionState?.activePaperTitle && samePdfPath(sessionState.activePdfPath, path)) {
      return sessionState.activePaperTitle
    }
    return title || path.split(/[\\/]/).pop() || 'Paper.pdf'
  }, [sessionState?.activePaperTitle, sessionState?.activePdfPath, path, title])

  // Retain SSE connection while viewer is mounted
  useEffect(() => controller.retainSession(sessionId), [controller, sessionId])

  // Observe scrollport width for responsive Fit-Width zoom
  useEffect(() => {
    const el = scrollRoot
    if (!el || !active) return
    const updateWidth = () => {
      const w = el.clientWidth - 28
      if (w > 160) setContainerWidth(cur => Math.abs(cur - w) < 1 ? cur : w)
    }
    updateWidth()
    const ro = new ResizeObserver(updateWidth)
    ro.observe(el)
    return () => ro.disconnect()
  }, [scrollRoot, active])

  const effectiveScale = useMemo(() => {
    const fitScale = Math.max(0.5, Math.min(2.6, containerWidth / Math.max(1, defaultDim.width)))
    return zoomMode === 'fit' ? fitScale : zoomMode
  }, [containerWidth, defaultDim.width, zoomMode])

  // Layout/bitmap scale is immediate; high-quality rasterization waits until a zoom burst settles.
  const [renderScale, setRenderScale] = useState(effectiveScale)
  useEffect(() => {
    const timer = setTimeout(() => setRenderScale(effectiveScale), 160)
    return () => clearTimeout(timer)
  }, [effectiveScale])

  // Load the document once. Hiding a tab does not discard its decoded document.
  useEffect(() => {
    let cancelled = false
    const abort = new AbortController()
    let rawWorker: Worker | null = null
    let pdfWorker: any = null
    let loadingTask: any = null
    let loadedDoc: any = null

    setLoading(true)
    setLoadingError(null)
    setPdfDoc(null)
    setSections([])
    setSelection(null)

    ;(async () => {
      try {
        const eng = await controller.loadPdfEngine()
        if (cancelled) return
        setEngine(eng)

        let pdfRes: Response | null = null
        if (mediaUrl) {
          pdfRes = await fetch(mediaUrl, { credentials: 'include', signal: abort.signal }).catch(() => null)
        }
        if (!pdfRes || !pdfRes.ok) {
          const fallbackUrl = controller.routeUrl(
            'paper-coach/pdf?sessionId=' + encodeURIComponent(sessionId) + '&path=' + encodeURIComponent(path)
          )
          pdfRes = await fetch(fallbackUrl, { credentials: 'include', signal: abort.signal })
        }
        if (!pdfRes.ok) {
          throw new Error('HTTP ' + pdfRes.status + ' loading PDF: ' + path)
        }
        const bytes = new Uint8Array(await pdfRes.arrayBuffer())
        if (cancelled) return

        const workerBlobUrl = URL.createObjectURL(new Blob([eng.workerCode], { type: 'text/javascript' }))
        try {
          rawWorker = new Worker(workerBlobUrl, { type: 'module' })
        } finally {
          URL.revokeObjectURL(workerBlobUrl)
        }
        pdfWorker = new eng.PDFWorker({ port: rawWorker })
        loadingTask = eng.getDocument({ data: bytes, worker: pdfWorker })
        loadedDoc = await loadingTask.promise
        if (cancelled) return

        const page1 = await loadedDoc.getPage(1)
        const vp1 = page1.getViewport({ scale: 1 })
        if (cancelled) return

        setDefaultDim({ width: vp1.width, height: vp1.height })
        setTotalPages(loadedDoc.numPages)
        setPdfDoc(loadedDoc)
        setLoading(false)

        // Indexing and viewport reports are visibility-gated effects below.
      } catch (err) {
        if (cancelled || abort.signal.aborted) return
        setLoadingError(err instanceof Error ? err.message : String(err))
        setLoading(false)
      }
    })()

    return () => {
      cancelled = true
      abort.abort()
      try { loadingTask?.destroy?.() } catch {}
      try { loadedDoc?.destroy?.() } catch {}
      try { pdfWorker?.destroy?.() } catch {}
      try { rawWorker?.terminate?.() } catch {}
    }
  }, [controller, sessionId, path, mediaUrl])

  useEffect(() => {
    if (!pdfDoc || !active || indexedDoc.current === pdfDoc) return
    let cancelled = false
    void extractPdfSections(pdfDoc, () => cancelled).then(detected => {
      if (cancelled) return
      indexedDoc.current = pdfDoc
      setSections(detected)
    })
    return () => { cancelled = true }
  }, [pdfDoc, active])

  const registerPageEl = useCallback((page: number, el: HTMLDivElement | null) => {
    if (el) pageElsRef.current.set(page, el)
    else pageElsRef.current.delete(page)
  }, [])

  const findSectionAtPosition = useCallback(
    (page: number, yRatio = 0.15): string | undefined => {
      if (sections.length === 0) return undefined
      let best: PaperSectionEntry | undefined
      for (const s of sections) {
        if (s.page < page || (s.page === page && (s.yRatio ?? 0) <= yRatio + 0.04)) {
          best = s
        } else {
          break
        }
      }
      return best?.id ?? sections[0]?.id
    },
    [sections]
  )

  const scrollToLocation = useCallback(
    (page: number, yRatio = 0, behavior: ScrollBehavior = 'smooth') => {
      const root = scrollRef.current
      if (!root || totalPages <= 0) return
      const clampedPage = Math.max(1, Math.min(totalPages, page))
      setPinnedPage(clampedPage)
      const pageEl = pageElsRef.current.get(clampedPage)
      if (pageEl) {
        const offsetWithinPage = Math.max(0, Math.min(0.92, yRatio)) * pageEl.offsetHeight
        const targetTop = Math.max(0, pageEl.offsetTop - 16 + offsetWithinPage)
        root.scrollTo({ top: targetTop, behavior })
      }
    },
    [totalPages]
  )

  // Execute incoming jump targets (from paper_reader_navigate, quote chip click, roadmap click, or #paper-coach-loc badge)
  useEffect(() => {
    if (!active || !jumpTarget || !pdfDoc || totalPages <= 0) return
    if (jumpTarget.pdfPath && !samePdfPath(jumpTarget.pdfPath, path)) return
    // If jump relies on section name and sections are still extracting right after load, wait briefly unless page is given
    if (jumpTarget.section && !jumpTarget.page && sections.length === 0) {
      const timer = setTimeout(() => {
        // Fallback if PDF has zero recognizable headings
        controller.consumeJumpTarget(sessionId, jumpTarget.nonce)
      }, 1200)
      return () => clearTimeout(timer)
    }

    const matchedSec = jumpTarget.section ? findBestSectionMatch(sections, jumpTarget.section) : undefined
    const targetPage =
      jumpTarget.page ??
      matchedSec?.page ??
      jumpTarget.highlights?.find(h => h.page)?.page ??
      jumpTarget.flashRects?.page ??
      1
    const hlOnTargetPage =
      jumpTarget.highlights?.find(h => !h.page || h.page === targetPage) ??
      jumpTarget.highlights?.[0]
    const flashPage =
      jumpTarget.flashRects?.page ??
      (jumpTarget.queryText ? targetPage : hlOnTargetPage?.page ?? targetPage)
    const flashQuery = jumpTarget.queryText || hlOnTargetPage?.text
    const hasExplicitY =
      Boolean(jumpTarget.flashRects?.rects?.[0]) ||
      Boolean(matchedSec && matchedSec.page === targetPage && !jumpTarget.queryText)
    const targetY =
      jumpTarget.flashRects?.rects?.[0]?.y ??
      (matchedSec && matchedSec.page === targetPage ? matchedSec.yRatio ?? 0 : 0)

    scrollToLocation(targetPage, Math.max(0, targetY - 0.04), 'smooth')

    if (jumpTarget.flashRects || flashQuery) {
      const key = Date.now()
      setFlashOverlay({
        key,
        page: flashPage,
        rects: jumpTarget.flashRects?.rects,
        queryText: flashQuery,
        scrollToMatch: !hasExplicitY && flashPage === targetPage,
      })
      setTimeout(() => {
        setFlashOverlay(cur => (cur?.key === key ? null : cur))
      }, 2600)
    }

    controller.consumeJumpTarget(sessionId, jumpTarget.nonce)
  }, [active, jumpTarget, pdfDoc, totalPages, path, sections, scrollToLocation, controller, sessionId])

  // Track current visible page + section on scroll and report to server (debounced)
  useEffect(() => {
    const root = scrollRoot
    if (!active || !root || !pdfDoc || totalPages <= 0) return
    let timer: ReturnType<typeof setTimeout> | null = null
    let frame = 0

    const measure = () => {
      frame = 0
      setSelection(cur => (cur ? null : cur))
      const viewMid = root.scrollTop + root.clientHeight * 0.32
      let foundPage = 1
      let relY = 0.2
      for (const [p, el] of pageElsRef.current.entries()) {
        const top = el.offsetTop
        const height = el.offsetHeight
        if (top > viewMid) break
        foundPage = p
        relY = height > 0 ? Math.min(1, (viewMid - top) / height) : 0.2
        if (viewMid <= top + height) break
      }
      const sec = findSectionAtPosition(foundPage, relY)
      setCurrentPage(foundPage)
      setCurrentSection(sec)
      if (timer) clearTimeout(timer)
      timer = setTimeout(() => {
        controller.reportViewport(sessionId, {
          pdfPath: path,
          paperTitle,
          currentPage: foundPage,
          totalPages,
          currentSection: sec,
          detectedSections: sections,
          updatedAt: Date.now(),
        })
      }, 320)
    }

    const onScroll = () => { if (!frame) frame = requestAnimationFrame(measure) }
    root.addEventListener('scroll', onScroll, { passive: true })
    const resize = new ResizeObserver(onScroll)
    resize.observe(root)
    onScroll()
    return () => {
      root.removeEventListener('scroll', onScroll)
      resize.disconnect()
      if (frame) cancelAnimationFrame(frame)
      if (timer) clearTimeout(timer)
    }
  }, [active, scrollRoot, pdfDoc, totalPages, findSectionAtPosition, controller, sessionId, path, paperTitle, sections])

  // Capture user text selection inside PDF TextLayer -> show floating { 翻译 ; 引用 }
  const handleSelectionCheck = useCallback(() => {
    requestAnimationFrame(() => {
      const sel = window.getSelection()
      const root = scrollRef.current
      if (!sel || sel.isCollapsed || sel.rangeCount === 0 || !root) {
        return
      }
      const range = sel.getRangeAt(0)
      const anchorEl = (sel.anchorNode instanceof Element ? sel.anchorNode : sel.anchorNode?.parentElement) as HTMLElement | null
      const focusEl = (sel.focusNode instanceof Element ? sel.focusNode : sel.focusNode?.parentElement) as HTMLElement | null
      if (!anchorEl || !root.contains(anchorEl)) return

      const pageShell = (anchorEl.closest('.pc-page-shell') || focusEl?.closest('.pc-page-shell')) as HTMLElement | null
      if (!pageShell) return
      const pageNum = Number(pageShell.dataset.page || '1') || 1

      const rawText = sel
        .toString()
        .replace(/([A-Za-z])-\r?\n\s*([a-z])/g, '$1$2')
        .replace(/\s*\r?\n\s*/g, ' ')
        .replace(/\s{2,}/g, ' ')
        .trim()
      if (rawText.length < 2) return

      const shellBox = pageShell.getBoundingClientRect()
      const clientRects = range.getClientRects()
      const normRects: NormalizedRect[] = []
      let minTop = Infinity
      let topCenterX = shellBox.left + shellBox.width / 2

      for (let i = 0; i < clientRects.length; i++) {
        const cr = clientRects[i]!
        if (cr.width < 1 || cr.height < 1) continue
        if (cr.top < minTop) {
          minTop = cr.top
          topCenterX = cr.left + cr.width / 2
        }
        if (shellBox.width > 0 && shellBox.height > 0) {
          normRects.push({
            x: Math.max(0, Math.min(1, (cr.left - shellBox.left) / shellBox.width)),
            y: Math.max(0, Math.min(1, (cr.top - shellBox.top) / shellBox.height)),
            w: Math.max(0, Math.min(1, cr.width / shellBox.width)),
            h: Math.max(0, Math.min(1, cr.height / shellBox.height)),
          })
        }
      }

      if (!Number.isFinite(minTop)) {
        const br = range.getBoundingClientRect()
        minTop = br.top
        topCenterX = br.left + br.width / 2
      }

      const merged = mergeLineRects(normRects)
      const sec = findSectionAtPosition(pageNum, merged[0]?.y ?? 0.2)

      setSelection({
        text: rawText.slice(0, 3600),
        page: pageNum,
        section: sec,
        rects: merged,
        anchorX: Math.max(60, Math.min(window.innerWidth - 60, topCenterX)),
        anchorY: Math.max(46, minTop),
      })
    })
  }, [findSectionAtPosition])

  const activeHighlights = useMemo(() => {
    const list = sessionState?.highlights ?? []
    if (sessionState?.activePdfPath && !samePdfPath(sessionState.activePdfPath, path)) return []
    return list
  }, [sessionState?.highlights, sessionState?.activePdfPath, path])

  // Persistent highlights are painted when their page becomes visible, not pinned for the document lifetime.
  const forcedPage = pinnedPage ?? flashOverlay?.page

  const adjustZoom = (delta: number) => {
    const next = Math.max(0.55, Math.min(2.6, Math.round((effectiveScale + delta) * 100) / 100))
    setZoomMode(next)
  }

  return (
    <div className='pc-viewer-root'>
      <div className='pc-toolbar'>
        <div className='pc-toolbar-group'>
          <button
            type='button'
            className={'pc-btn' + (outlineOpen ? ' pc-btn-primary' : '')}
            onClick={() => setOutlineOpen(v => !v)}
            title={t('toolbar.outline')}
          >
            📑 {t('toolbar.outline')} {sections.length > 0 ? `(${sections.length})` : ''}
          </button>
          <span className='pc-badge'>
            p.{currentPage} / {totalPages || '…'}
            {currentSection ? ` · §${currentSection}` : ''}
          </span>
        </div>

        <div className='pc-toolbar-group'>
          <button type='button' className='pc-btn' onClick={() => adjustZoom(-0.15)} title={t('toolbar.zoomOut')}>
            −
          </button>
          <button
            type='button'
            className='pc-btn'
            onClick={() => setZoomMode('fit')}
            title={t('toolbar.fitWidth')}
          >
            {zoomMode === 'fit' ? t('toolbar.fitWidth') : `${Math.round(effectiveScale * 100)}%`}
          </button>
          <button type='button' className='pc-btn' onClick={() => adjustZoom(0.15)} title={t('toolbar.zoomIn')}>
            +
          </button>
          {activeHighlights.length > 0 && (
            <button
              type='button'
              className='pc-btn'
              onClick={() => void controller.clearHighlights(sessionId)}
              title={t('toolbar.clearHighlights')}
            >
              🧹 {t('toolbar.clearHighlights')} ({activeHighlights.length})
            </button>
          )}
          {sessionState?.plan && (
            <button
              type='button'
              className='pc-btn'
              onClick={() =>
                void controller.updateSettings({
                  roadmapDockMode: settings.roadmapDockMode === 'pdf_top' ? 'float' : 'pdf_top',
                })
              }
              title={
                settings.roadmapDockMode === 'pdf_top'
                  ? t('toolbar.floatRoadmap')
                  : t('toolbar.dockRoadmap')
              }
            >
              {settings.roadmapDockMode === 'pdf_top' ? '↗' : '📌'}
            </button>
          )}
          <button
            type='button'
            className='pc-btn'
            onClick={() => controller.openSettingsModal(sessionId)}
            title={t('toolbar.settings')}
          >
            ⚙
          </button>
        </div>
      </div>

      {active && <RoadmapPanelContent controller={controller} sessionId={sessionId} docked={true} t={t} />}

      <div className='pc-main-area'>
        {outlineOpen && (
          <div className='pc-outline-drawer'>
            {sections.length === 0 ? (
              <div style={{ padding: '8px', color: 'var(--pc-text-muted)' }}>
                未检测到章节标题
              </div>
            ) : (
              sections.map(sec => (
                <div
                  key={sec.id + '-' + sec.page}
                  className={'pc-outline-item' + (currentSection === sec.id ? ' pc-outline-item-active' : '')}
                  onClick={() => scrollToLocation(sec.page, sec.yRatio ?? 0, 'smooth')}
                >
                  <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {sec.rawTitle}
                  </span>
                  <span style={{ fontSize: 11, color: 'var(--pc-text-muted)', flexShrink: 0 }}>
                    p.{sec.page}
                  </span>
                </div>
              ))
            )}
          </div>
        )}

        <div
          ref={setScrollElement}
          className='pc-scrollport'
          onMouseUp={handleSelectionCheck}
          onKeyUp={handleSelectionCheck}
          onMouseDown={e => {
            if (!(e.target as HTMLElement | null)?.closest('.pc-sel-popover, .pc-trans-card')) {
              setSelection(null)
            }
          }}
        >
          {loading && (
            <div style={{ padding: 32, color: 'var(--pc-text-muted)', fontSize: 13 }}>
              正在加载论文 PDF 与构建章节定位索引…
            </div>
          )}
          {loadingError && (
            <div style={{ padding: 24, color: '#ef4444', fontSize: 13, maxWidth: 460 }}>
              PDF 加载失败：{loadingError}
            </div>
          )}
          {!loading &&
            !loadingError &&
            engine &&
            pdfDoc &&
            Array.from({ length: totalPages }, (_, idx) => {
              const pageNumber = idx + 1
              return (
                <PdfPageView
                  key={pageNumber}
                  engine={engine}
                  pdfDoc={pdfDoc}
                  pageNumber={pageNumber}
                  scale={effectiveScale}
                  renderScale={renderScale}
                  visible={active}
                  cache={cache}
                  queue={queue}
                  defaultDim={defaultDim}
                  scrollRoot={scrollRoot}
                  forceRender={forcedPage === pageNumber}
                  highlights={activeHighlights}
                  flashOverlay={flashOverlay}
                  registerPageEl={registerPageEl}
                />
              )
            })}
        </div>
      </div>

      {active && <SelectionToolbar
        controller={controller}
        sessionId={sessionId}
        pdfPath={path}
        paperTitle={paperTitle}
        selection={selection}
        onDismiss={() => setSelection(null)}
        t={t}
      />}
    </div>
  )
}
