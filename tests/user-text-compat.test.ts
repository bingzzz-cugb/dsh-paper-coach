import React from 'react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { apply } from '../src/client/index'
import { createPaperUserQuoteNode } from '../src/client/PaperQuoteDock'
import { PaperCoachClientController } from '../src/client/controller'
import { zh } from '../src/client/locales'
import { formatPaperQuoteBlock } from '../src/shared/section-matcher'

const disposers: Array<() => void> = []
afterEach(() => {
  for (const dispose of disposers.splice(0).reverse()) dispose()
  vi.restoreAllMocks()
  vi.unstubAllGlobals()
})

// Mirror DSH @deepseek-ai/dsh-client-ui-conversation@0.2.2-rc.5 strict UserTextRegistry & validateCandidate checks.
function createStrictUserTextRegistry() {
  const rules = new Map<string, any>()
  return {
    rules,
    register(rule: any) {
      if (rule.id.length === 0) throw new Error('user-text rule ID must not be empty')
      if (rule.id === 'text') throw new Error('user-text rule "text" is reserved for original text')
      if (!Number.isFinite(rule.order)) throw new Error(`user-text rule "${rule.id}" order must be finite`)
      if (rules.has(rule.id)) throw new Error(`user-text rule "${rule.id}" is already registered`)
      rules.set(rule.id, rule)
      return () => {
        if (rules.get(rule.id) === rule) rules.delete(rule.id)
      }
    },
  }
}

function validateCandidate(text: string, ruleId: string, from: number, node: any) {
  if (
    !Number.isInteger(node.start) ||
    !Number.isInteger(node.end) ||
    node.start < from ||
    node.end <= node.start ||
    node.end > text.length
  ) {
    throw new Error(
      `invalid candidate range [${node.start}, ${node.end}); expected a nonempty range from ${from} to ${text.length}`
    )
  }
  if (node.id === 'text') {
    if (node.data?.text !== text.slice(node.start, node.end)) {
      throw new Error('text candidate must preserve its original substring')
    }
  } else if (node.id !== ruleId) {
    throw new Error(`candidate must use rule ID "${ruleId}" or text`)
  }
}

function mountClientWithUiConversation(userText: { register: (rule: any) => any }) {
  const slots = new Map<string, { definition: any; component: any }>()
  const openedFiles: Array<{ scope: any; path: string; title?: string }> = []
  const cleanups: Array<() => void> = []

  vi.stubGlobal('document', {
    baseURI: 'http://host.example/dsh/',
    head: { append() {} },
    createElement: () => ({ dataset: {}, textContent: '', remove() {} }),
    addEventListener() {},
    removeEventListener() {},
  })
  vi.stubGlobal('fetch', vi.fn(async () => ({ ok: false, json: async () => ({ ok: false }) })))

  const slotApi = {
    inject(_name: string, register: () => any) {
      const off = register()
      if (typeof off === 'function') cleanups.push(off)
      return off
    },
    register(definition: any, component: any) {
      const key = definition.name + ':' + (definition.key ?? definition.id)
      const record = { definition, component }
      slots.set(key, record)
      return () => {
        if (slots.get(key) === record) slots.delete(key)
      }
    },
  }

  const services = new Map<string, any>([
    ['slots', slotApi],
    ['sessions', {}],
    ['uiConversation', { userText }],
    [
      'betterSidebar',
      {
        registerFileViewer: () => () => {},
        openFile: (scope: any, path: string, title?: string) => {
          openedFiles.push({ scope, path, title })
        },
        hostRouteUrl: (path: string) => new URL(path, 'http://host.example/dsh/').href,
      },
    ],
    [
      'sidebarRightTabs',
      {
        register: () => () => {},
      },
    ],
  ])

  const ctx: any = {
    locale: { register: () => () => {}, bind: () => (key: string) => (zh as any)[key] ?? key },
    get: (key: string) => services.get(key),
    effect(fn: () => any) {
      const off = fn()
      if (typeof off === 'function') cleanups.push(off)
    },
    inject(deps: string[], callback: (scope: any) => void) {
      if (deps.every(key => services.has(key))) callback(ctx)
    },
  }

  let disposed = false
  const dispose = () => {
    if (!disposed) {
      disposed = true
      for (const off of cleanups.reverse()) off()
    }
  }
  disposers.push(dispose)
  apply(ctx)
  return { slots, openedFiles, dispose }
}

function findFirstClickableElement(node: any): any {
  if (!React.isValidElement<any>(node)) return undefined
  if (typeof node.props?.onClick === 'function') return node
  for (const child of React.Children.toArray(node.props?.children)) {
    const found = findFirstClickableElement(child)
    if (found) return found
  }
  return undefined
}

describe('DSH 0.2.2-rc.5 uiConversation.userText compatibility', () => {
  it('registers a valid userText rule (id, finite order, candidate id) without breaking client startup', () => {
    const registry = createStrictUserTextRegistry()
    const host = mountClientWithUiConversation(registry)

    expect(registry.rules.has('dsh-paper-coach-quote')).toBe(true)
    const rule = registry.rules.get('dsh-paper-coach-quote')
    expect(typeof rule.id).toBe('string')
    expect(Number.isFinite(rule.order)).toBe(true)

    // Subsequent client registrations must complete intact
    expect(host.slots.has('conversation.input.dock:dsh-paper-coach')).toBe(true)
    expect(host.slots.has('settings.section:paper-coach')).toBe(true)

    const msg = formatPaperQuoteBlock(
      [
        {
          id: 'q1',
          pdfPath: 'D:/papers/demo.pdf',
          paperTitle: 'Demo Thesis',
          page: 40,
          section: '3.1',
          text: 'Mining subsidence alters regional hydrology.',
          rects: [{ x: 0.1, y: 0.2, w: 0.6, h: 0.03 }],
        },
      ],
      '请解释这一句的作用。'
    )
    const candidate = rule.match(msg, 0)
    expect(candidate).toBeDefined()
    expect(() => validateCandidate(msg, rule.id, 0, candidate)).not.toThrow()
    expect(candidate.id).toBe('dsh-paper-coach-quote')
    expect(candidate.data.quotes).toHaveLength(1)
  })

  it('renders quote pills from DSH 0.2.2-rc.5 { node, raw, interactive } slot props and jumps with injected sessionId', () => {
    const registry = createStrictUserTextRegistry()
    const host = mountClientWithUiConversation(registry)

    const rule = registry.rules.get('dsh-paper-coach-quote')
    const msg = formatPaperQuoteBlock(
      [
        {
          id: 'q1',
          pdfPath: 'D:/papers/thesis.pdf',
          paperTitle: 'Thesis (2025)',
          page: 40,
          section: '3',
          text: 'Temporal evolution of mining subsidence.',
        },
      ],
      '总结一下这一段'
    )
    const candidate = rule.match(msg, 0)
    const slot = host.slots.get('conversation.user.text.node:dsh-paper-coach-quote')
    expect(slot).toBeDefined()

    const injected = slot!.definition.inject?.('sess-target-42') ?? {}
    const tree = slot!.component({
      ...injected,
      node: candidate,
      raw: msg.slice(candidate.start, candidate.end),
      interactive: true,
    })
    expect(tree).not.toBeNull()

    const pill = findFirstClickableElement(tree)
    expect(pill).toBeDefined()
    pill.props.onClick()

    expect(host.openedFiles).toEqual([
      {
        scope: { sessionId: 'sess-target-42' },
        path: 'D:/papers/thesis.pdf',
        title: 'Thesis (2025)',
      },
    ])
  })

  it('still supports legacy { data, session } props on createPaperUserQuoteNode', () => {
    const controller = new PaperCoachClientController()
    const opened: any[] = []
    controller.setBetterSidebar({
      openFile: (scope: any, path: string, title?: string) => opened.push({ scope, path, title }),
    })
    const NodeComp = createPaperUserQuoteNode(controller)
    const tree = NodeComp({
      data: {
        quotes: [
          {
            id: 'q-legacy',
            pdfPath: 'D:/papers/legacy.pdf',
            paperTitle: 'Legacy Paper',
            page: 5,
            text: 'Legacy quote text.',
          },
        ],
      },
      session: { sessionId: 'sess-legacy-1' },
    })
    expect(tree).not.toBeNull()
    const pill = findFirstClickableElement(tree)
    expect(pill).toBeDefined()
    pill.props.onClick()
    expect(opened).toEqual([
      { scope: { sessionId: 'sess-legacy-1' }, path: 'D:/papers/legacy.pdf', title: 'Legacy Paper' },
    ])
  })

  it('isolates host userText.register exceptions so PaperCoachSessionDock and SSE setup still mount', () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})
    const host = mountClientWithUiConversation({
      register() {
        throw new Error('incompatible host userText contract')
      },
    })

    expect(warnSpy).toHaveBeenCalled()
    expect(host.slots.has('conversation.input.dock:dsh-paper-coach')).toBe(true)
    expect(host.slots.has('settings.section:paper-coach')).toBe(true)
    expect(host.slots.has('sidebar.right.pane.tab:paper-coach:pdf')).toBe(true)
  })
})
