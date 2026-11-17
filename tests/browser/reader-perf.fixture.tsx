import React, { useState } from 'react'
import { createRoot } from 'react-dom/client'
import { PaperPdfViewer } from '../../src/client/PaperPdfViewer'
import { RoadmapPanelContent } from '../../src/client/RoadmapPanel'
import { PAPER_COACH_CSS } from '../../src/client/styles'
import { DEFAULT_SETTINGS } from '../../src/shared/protocol'
import { zh } from '../../src/client/locales'

const delay = (ms: number) => new Promise(r => setTimeout(r, ms))
const results: any[] = []
const metrics = { renders: {} as Record<number, number>, active: 0, maxActive: 0, text: 0, reports: 0, documents: 0 }
const listeners = new Set<() => void>()
const emit = () => { for (const f of listeners) f() }
let settings = { ...DEFAULT_SETTINGS }
let state: any = { highlights: [], plan: { paperTitle: 'FATE', pdfPath: 'D:/fate.pdf', stage: 'reading', goals: [{ id: 'g', text: 'Understand architecture', done: false }], sections: [{ id: 's', section: '3', title: 'Overview', page: 3, status: 'current' }] } }
let jump: any = null
let changeVisible: (v: boolean) => void
const engine: any = {
  workerCode: '', PDFWorker: class { destroy() {} },
  getDocument: () => { metrics.documents++; return { promise: Promise.resolve(doc), destroy() {} } },
  TextLayer: class {
    constructor(private args: any) {}
    async render() {
      metrics.text++
      const span = document.createElement('span'); span.textContent = 'Shared pixel-to-token associations connect token matching.'
      span.style.cssText = `top:40px;left:30px;font-size:${12 * this.args.viewport.scale}px`
      this.args.container.append(span)
    }
    cancel() {}
  },
}
const doc: any = { numPages: 30, destroy() {},
  getOutline: async () => [1, 2, 3].map(i => ({ title: i + ' Section', dest: [i - 1, 0, 0, 700] })),
  getPageIndex: async (i: number) => i,
  getPage: async (page: number) => ({
    view: [0, 0, 612, 792],
    getViewport: ({ scale }: any) => ({ width: 612 * scale, height: 792 * scale, scale }),
    getTextContent: async () => ({ items: [] }), streamTextContent: () => ({}),
    render: ({ canvasContext, viewport }: any) => {
      metrics.renders[page] = (metrics.renders[page] || 0) + 1
      metrics.active++; metrics.maxActive = Math.max(metrics.active, metrics.maxActive)
      let settled = false; let reject: (e: Error) => void
      const promise = new Promise<void>((resolve, rej) => { reject = rej; setTimeout(() => {
        if (settled) return; settled = true; metrics.active--
        canvasContext.fillStyle = '#ffffff'; canvasContext.fillRect(0, 0, viewport.width, viewport.height)
        canvasContext.fillStyle = '#101010'; canvasContext.fillText('Page ' + page, 30, 40); resolve()
      }, 25) })
      return { promise, cancel() { if (!settled) { settled = true; metrics.active--; reject!(new Error('cancelled')) } } }
    },
  }),
}
// Substitute only the PDF/network boundary; real React, layout, observers and component effects run in Edge.
;(window as any).Worker = class { terminate() {} }
window.fetch = async () => new Response(new Uint8Array([1, 2, 3]))
const ctrl: any = {
  subscribe: (f: () => void) => { listeners.add(f); return () => listeners.delete(f) },
  getSettings: () => settings, getSessionState: () => state, getActiveSession: () => 'test', getJumpTarget: () => jump,
  retainSession: () => () => {}, loadPdfEngine: async () => engine, routeUrl: (p: string) => p,
  reportViewport: () => { metrics.reports++ },
  updateSettings: async (patch: any) => { settings = { ...settings, ...patch }; emit() },
  consumeJumpTarget: () => { jump = null; emit() },
  openSettingsModal() {}, clearHighlights() {}, toggleGoalDone() {}, advanceSectionDone() {},
  jumpToPaperLocation: (_s: string, target: any) => { jump = { ...target, nonce: Date.now() }; emit() },
}
const t: any = (key: string) => (zh as any)[key] || key
const style = document.createElement('style'); style.textContent = PAPER_COACH_CSS; document.head.append(style)
function App() {
  const [visible, setVisible] = useState(true); changeVisible = setVisible
  return <><div style={{ width: 900, height: 650 }}><PaperPdfViewer scope={{ sessionId: 'test' }} path='D:/fate.pdf' title='FATE' controller={ctrl} t={t} visible={visible} /></div><RoadmapPanelContent controller={ctrl} sessionId='test' docked={false} t={t} /></>
}
createRoot(document.getElementById('root')!).render(<App />)
const count = (p = 1) => metrics.renders[p] || 0
function check(name: string, pass: boolean, evidence: any) { results.push({ name, pass, evidence }) }
async function until(f: () => boolean, timeout = 4000) { const start = performance.now(); while (!f()) { if (performance.now() - start > timeout) throw new Error('condition timed out'); await delay(25) } }
const button = (title: string) => document.querySelector<HTMLButtonElement>(`.pc-toolbar button[title="${title}"]`)!
async function run() {
  await until(() => count(1) > 0 && metrics.active === 0); await delay(350)
  let head = document.querySelector<HTMLElement>('.pc-roadmap-float .pc-roadmap-header > div')!
  head.click(); await delay(50)
  check('header click never collapses', !!document.querySelector('.pc-roadmap-float .pc-roadmap-body'), {})
  if (!document.querySelector('.pc-roadmap-float .pc-roadmap-body')) (document.querySelector('.pc-roadmap-float .pc-roadmap-header button:last-child') as HTMLElement).click()
  await delay(30)
  head = document.querySelector<HTMLElement>('.pc-roadmap-float .pc-roadmap-header > div')!
  head.dispatchEvent(new MouseEvent('mousedown', { bubbles: true, button: 0, clientX: 600, clientY: 70 }))
  window.dispatchEvent(new MouseEvent('mousemove', { clientX: 550, clientY: 130 }))
  window.dispatchEvent(new MouseEvent('mouseup', { clientX: 550, clientY: 130 }))
  head.click(); await delay(80)
  check('drag plus trailing click never collapses', !!document.querySelector('.pc-roadmap-float .pc-roadmap-body'), {})
  const arrow = () => document.querySelector<HTMLElement>('.pc-roadmap-float .pc-roadmap-header > div:last-child button:last-child')!
  if (!document.querySelector('.pc-roadmap-float .pc-roadmap-body')) { arrow().click(); await delay(30) }
  arrow().click(); await delay(30); const collapsed = !document.querySelector('.pc-roadmap-float .pc-roadmap-body')
  arrow().click(); await delay(30); check('arrow toggles collapse and expand', collapsed && !!document.querySelector('.pc-roadmap-float .pc-roadmap-body'), {})
  const scroll = document.querySelector<HTMLElement>('.pc-scrollport')!
  const beforeReturn = count(1)
  scroll.scrollTop = document.querySelector<HTMLElement>('[data-page="4"]')!.offsetTop; await delay(350)
  scroll.scrollTop = 0; await delay(500)
  check('nearby return reuses page bitmap and text', count(1) === beforeReturn, { before: beforeReturn, after: count(1) })
  const beforeZoom = count(1)
  for (let i = 0; i < 4; i++) { button('放大').click(); await delay(40) }
  await delay(500)
  check('zoom burst paints only final scale', count(1) - beforeZoom <= 1, { addedPaints: count(1) - beforeZoom })
  check('page rendering concurrency is bounded', metrics.maxActive <= 2, { maxActive: metrics.maxActive })
  const docs = metrics.documents, dockPaint = count(1)
  await ctrl.updateSettings({ roadmapDockMode: 'pdf_top' }); await delay(400)
  check('docking retains loaded document and current bitmap', docs === metrics.documents && count(1) === dockPaint, { documents: metrics.documents, addedPaints: count(1) - dockPaint })
  const hiddenPaint = Object.values(metrics.renders).reduce((a, b) => a + b, 0), hiddenReport = metrics.reports
  changeVisible(false); await delay(80); button('缩小').click(); scroll.dispatchEvent(new Event('scroll')); await delay(500)
  check('hidden reader stops painting and viewport reports', hiddenPaint === Object.values(metrics.renders).reduce((a,b) => a+b,0) && hiddenReport === metrics.reports, { extraPaints: Object.values(metrics.renders).reduce((a,b) => a+b,0)-hiddenPaint, extraReports: metrics.reports-hiddenReport })
  changeVisible(true); await delay(500)
  for (let p = 5; p <= 25; p += 4) { scroll.scrollTop = document.querySelector<HTMLElement>(`[data-page="${p}"]`)!.offsetTop; await delay(200) }
  await delay(300)
  const canvases = document.querySelectorAll('.pc-page-shell canvas').length
  check('resident page cache is bounded', canvases <= 8, { canvases })
  const text = document.querySelector('.pc-text-host span')
  check('text layer remains selectable after rendering', !!text?.textContent, { text: text?.textContent })
  return { results, metrics, errors: (window as any).__errors }
}
;(window as any).__results = run().catch(e => ({ results, metrics, error: String(e), stack: e.stack, errors: (window as any).__errors }))
