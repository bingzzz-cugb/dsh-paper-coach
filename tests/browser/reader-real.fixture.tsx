import React from 'react'
import { createRoot } from 'react-dom/client'
import * as pdfjs from 'pdfjs-dist/legacy/build/pdf.mjs'
import { PaperPdfViewer } from '../../src/client/PaperPdfViewer'
import { PAPER_COACH_CSS } from '../../src/client/styles'
import { DEFAULT_SETTINGS } from '../../src/shared/protocol'
import { zh } from '../../src/client/locales'
const w = window as any
const delay = (ms: number) => new Promise(r => setTimeout(r, ms))
const listeners = new Set<() => void>()
let settings = { ...DEFAULT_SETTINGS, roadmapDockMode: 'pdf_top' }
let state: any = { activePdfPath: 'D:/fate.pdf', highlights: [], plan: { paperTitle: 'FATE', pdfPath: 'D:/fate.pdf', stage: 'reading', goals: [{ id: 'g', text: '理解整体架构', done: false }], sections: [{ id: 's', section: '3', title: 'Overview', page: 3, status: 'current' }] } }
let jump: any = null
const emit = () => { for (const f of listeners) f() }
let reports = 0
const bytes = Uint8Array.from(atob(w.__PDF_DATA__), c => c.charCodeAt(0))
const networkFetch = window.fetch.bind(window)
window.fetch = (input, init) => String(input).includes('fixture-pdf') ? Promise.resolve(new Response(bytes)) : networkFetch(input, init)
const controller: any = {
  subscribe: (f: () => void) => { listeners.add(f); return () => listeners.delete(f) },
  getSettings: () => settings, getSessionState: () => state, getJumpTarget: () => jump,
  retainSession: () => () => {}, loadPdfEngine: async () => ({ ...pdfjs, workerCode: w.__PDF_WORKER__ }),
  routeUrl: (p: string) => p, reportViewport: () => { reports++ },
  consumeJumpTarget: () => { jump = null; emit() }, updateSettings: async (p: any) => { settings = { ...settings, ...p }; emit() },
  openSettingsModal() {}, clearHighlights() { state = { ...state, highlights: [] }; emit() },
}
const t: any = (key: string) => (zh as any)[key] || key
const style = document.createElement('style'); style.textContent = PAPER_COACH_CSS; document.head.append(style)
createRoot(document.getElementById('root')!).render(<div style={{ width: 1000, height: 800 }}><PaperPdfViewer scope={{ sessionId: 'smoke' }} path='D:/fate.pdf' title='FATE' mediaUrl='fixture-pdf' controller={controller} t={t} /></div>)
const results: any[] = []
const check = (name: string, pass: boolean, evidence: any) => results.push({ name, pass, evidence })
async function until(f: () => boolean) { const start = performance.now(); while (!f()) { if (performance.now()-start > 25000) throw new Error('real PDF render timed out: '+document.querySelector('.pc-main-area')?.textContent?.slice(0,200)); await delay(50) } }
async function run() {
  await until(() => document.querySelectorAll('[data-page="1"] .textLayer span').length > 30); await delay(300)
  check('real PDF renders with text and toolbar', !!document.querySelector('.pc-toolbar'), { spans: document.querySelectorAll('[data-page="1"] .textLayer span').length })
  state = { ...state, highlights: [{ id: 'h1', page: 1, color: 'amber', text: 'Our key insight is that dense pixel-level flow does not require equally dense matching.' }] }; emit()
  await until(() => !!document.querySelector('[data-page="1"] .pc-hl-rect'))
  const first = document.querySelector<HTMLElement>('[data-page="1"] .pc-hl-rect')!
  const normalized = { left: first.style.left, top: first.style.top, width: first.style.width }
  for(let n=0;n<3;n++){ document.querySelector<HTMLButtonElement>('button[title="放大"]')!.click(); await delay(35) }
  await delay(900)
  const shell = document.querySelector<HTMLElement>('[data-page="1"]')!
  const canvas = shell.querySelector('canvas')!
  const ratio = canvas.width / canvas.getBoundingClientRect().width
  check('settled zoom keeps full device-pixel resolution', Math.abs(ratio - Math.min(devicePixelRatio,2.5)) < 0.02, { ratio, devicePixelRatio })
  const hl = shell.querySelector<HTMLElement>('.pc-hl-rect')!
  check('highlight survives zoom at the same relative location', Math.abs(parseFloat(hl.style.top)-parseFloat(normalized.top)) < 0.6 && Math.abs(parseFloat(hl.style.left)-parseFloat(normalized.left)) < 0.6, { before: normalized, after: {left:hl.style.left,top:hl.style.top,width:hl.style.width} })
  const span = [...shell.querySelectorAll<HTMLElement>('.textLayer span')].find(s => s.textContent?.includes('Dense Flow')) || shell.querySelector<HTMLElement>('.textLayer span')!
  const range=document.createRange();range.selectNodeContents(span);const selection=window.getSelection()!;selection.removeAllRanges();selection.addRange(range)
  const scroll = document.querySelector<HTMLElement>('.pc-scrollport')!
  span.dispatchEvent(new MouseEvent('mouseup',{bubbles:true})); await delay(120)
  check('real text remains selectable', selection.toString().length > 0, { selection:selection.toString(), popover:!!document.querySelector('.pc-sel-popover') })
  const query=hl.getBoundingClientRect();scroll.scrollTop += query.top - scroll.getBoundingClientRect().top - 120
  await delay(300);selection.removeAllRanges()
  check('real document completes without runtime errors', !w.__errors.length, { reports })
  return { results, errors:w.__errors }
}
w.__results = run().catch(e => ({ results, error:String(e), stack:e.stack, errors:w.__errors }))
