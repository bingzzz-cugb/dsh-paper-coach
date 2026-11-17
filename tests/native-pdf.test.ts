import React from 'react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { apply } from '../src/client/index'
import { PaperPdfViewer } from '../src/client/PaperPdfViewer'
import { zh } from '../src/client/locales'

const disposers: Array<() => void> = []
afterEach(() => {
  for (const dispose of disposers.splice(0).reverse()) dispose()
  vi.unstubAllGlobals()
})

// Only host boundary services are doubled; execute the real client entry and renderer adapter.
function mountClient(options: { native?: boolean; failBody?: boolean } = {}) {
  const types = new Map<string, any>()
  const slots = new Map<string, { definition: any; component: any }>()
  const legacy = new Map<string, any>()
  const cleanups: Array<() => void> = []
  const pending: Array<{ deps: string[]; callback: (ctx: any) => void }> = []
  vi.stubGlobal('document', {
    baseURI: 'http://host.example/dsh/',
    head: { append() {} },
    createElement: () => ({ dataset: {}, textContent: '', remove() {} }),
    addEventListener() {}, removeEventListener() {},
  })
  vi.stubGlobal('fetch', vi.fn(async () => ({ ok: false, json: async () => ({ ok: false }) })))
  const slotApi = {
    inject(_name: string, register: () => any) {
      const off = register()
      if (typeof off === 'function') cleanups.push(off)
      return off
    },
    register(definition: any, component: any) {
      if (options.failBody && definition.name === 'sidebar.right.pane.tab') throw new Error('body registration failed')
      const key = definition.name + ':' + (definition.key ?? definition.id)
      const record = { definition, component }
      slots.set(key, record)
      return () => { if (slots.get(key) === record) slots.delete(key) }
    },
  }
  const native = { register(definition: any) {
    if (types.has(definition.id)) throw new Error('duplicate native resource type')
    types.set(definition.id, definition)
    return () => { if (types.get(definition.id) === definition) types.delete(definition.id) }
  } }
  const services = new Map<string, any>([
    ['slots', slotApi],
    ['sessions', {}],
    ['betterSidebar', {
      registerFileViewer(definition: any) { legacy.set(definition.id, definition); return () => legacy.delete(definition.id) },
      hostRouteUrl: (path: string) => new URL(path, 'http://host.example/dsh/').href,
    }],
  ])
  if (options.native !== false) services.set('sidebarRightTabs', native)
  const ctx: any = {
    locale: { register: () => () => {}, bind: () => (key: string) => (zh as any)[key] ?? key },
    get: (key: string) => services.get(key),
    effect(fn: () => any) { const off = fn(); if (typeof off === 'function') cleanups.push(off) },
    inject(deps: string[], callback: (scope: any) => void) {
      if (deps.every(key => services.has(key))) callback(ctx)
      else pending.push({ deps, callback })
    },
  }
  let disposed = false
  const dispose = () => { if (!disposed) { disposed = true; for (const off of cleanups.reverse()) off() } }
  disposers.push(dispose)
  apply(ctx)
  return { types, slots, legacy, dispose, publishNative() {
    services.set('sidebarRightTabs', native)
    for (const item of pending.splice(0)) if (item.deps.every(key => services.has(key))) item.callback(ctx)
  } }
}

function pdfType(host: ReturnType<typeof mountClient>) {
  const type = [...host.types.values()].find(t => t.canOpen?.('dsh-resource://file/session/seat/_paper_cache/fate.pdf'))
  expect(type, 'the host must receive a PDF resource claimant, not only a betterSidebar viewer').toBeDefined()
  return type
}
function readerIn(node: any): any {
  if (!React.isValidElement<any>(node)) return undefined
  if (node.type === PaperPdfViewer) return node
  return React.Children.toArray(node.props.children).map(readerIn).find(Boolean)
}
function renderBody(host: ReturnType<typeof mountClient>, address: string, seat = 'seat') {
  const type = pdfType(host)
  const slot = host.slots.get('sidebar.right.pane.tab:' + type.id)
  expect(slot, 'the claimed native PDF tab must have a body renderer').toBeDefined()
  const injected = slot!.definition.inject?.(seat) ?? {}
  return readerIn(slot!.component({ ...injected, sessionId: seat, useTabInfo: () => ({ tab: {
    id: 'tab1', kind: type.kind, title: 'FATE', contentId: address, visible: true,
    navigation: { address, params: {}, revision: 1 }, signal: new AbortController().signal,
  } }) }))
}

describe('native PDF resource takeover', () => {
  it('routes the native PDF resource to the actual PaperPdfViewer instead of the host preview', () => {
    const host = mountClient()
    const type = pdfType(host)
    expect(type.priority).toBe('extension')
    expect(type.patterns).toContain('dsh-resource://file/**')
    const reader = renderBody(host, 'dsh-resource://file/session/seat/D:/papers/FATE.pdf')
    expect(reader?.type).toBe(PaperPdfViewer)
    expect(reader.props.path).toBe('D:/papers/FATE.pdf')
    expect(reader.props.scope.sessionId).toBe('seat')
    expect(reader.props.t('toolbar.outline')).toBe('章节目录')
  })

  it.each([
    'dsh-resource://file/session/seat/paper.docx',
    'dsh-resource://file/session/seat/notes.md',
    'dsh-resource://file/session/seat/paper.pdf.exe',
    'dsh-resource://file/session/seat/malformed%ZZ.pdf',
    'dsh-resource://file/session//paper.pdf',
    'https://host.example/paper.pdf',
    'dsh-resource://file/unknown/paper.pdf',
  ])('does not steal a non-PDF or malformed resource: %s', address => {
    expect(pdfType(mountClient()).canOpen(address)).toBe(false)
  })

  it('decodes the content scope but keeps roadmap and quotes in the viewing conversation', () => {
    const reader = renderBody(mountClient(), 'dsh-resource://file/session/source%20session/_paper_cache/%E6%96%87%23%3F%20P.PDF#page=3', 'viewing-session')
    expect(reader.props.path).toBe('_paper_cache/文#? P.PDF')
    expect(reader.props.scope.sessionId).toBe('viewing-session')
    const url = new URL(reader.props.mediaUrl)
    expect(url.origin).toBe('http://host.example')
    expect(url.pathname).toBe('/dsh/sidebar/file')
    expect(url.searchParams.get('sessionId')).toBe('source session')
    expect(url.searchParams.get('path')).toBe('_paper_cache/文#? P.PDF')
  })

  it.each([
    ['dsh-resource://file/absolute/C:/papers/fate.pdf', 'C:/papers/fate.pdf'],
    ['dsh-resource://file/absolute/home/me/fate.pdf', '/home/me/fate.pdf'],
    ['dsh-resource://file/absolute//server/share/fate.pdf', '//server/share/fate.pdf'],
  ])('supports legacy absolute file addresses: %s', (address, path) => {
    const reader = renderBody(mountClient(), address)
    expect(reader.props.path).toBe(path)
    expect(new URL(reader.props.mediaUrl).searchParams.get('sessionId')).toBe('seat')
  })

  it('retains the legacy PDF viewer when the native registry is not available', () => {
    const host = mountClient({ native: false })
    expect(host.types.size).toBe(0)
    const viewer = host.legacy.get('paper-coach:pdf')
    expect(viewer.exts).toContain('pdf')
    expect(viewer.component({ path: 'D:/paper.pdf' }).type).toBe(PaperPdfViewer)
  })

  it('registers when the native service appears after the client plugin', () => {
    const host = mountClient({ native: false })
    host.publishNative()
    expect(renderBody(host, 'dsh-resource://file/session/seat/paper.pdf')?.type).toBe(PaperPdfViewer)
  })

  it('unregisters the resource claimant and body when the plugin is disabled', () => {
    const host = mountClient()
    const type = pdfType(host)
    host.dispose()
    expect(host.types.has(type.id)).toBe(false)
    expect(host.slots.has('sidebar.right.pane.tab:' + type.id)).toBe(false)
  })

  it('rolls the resource type back if body registration fails', () => {
    expect(() => mountClient({ failBody: true })).toThrow('body registration failed')
  })
})
