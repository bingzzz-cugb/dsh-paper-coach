import React, { useEffect } from 'react'
import { PaperCoachClientController } from './controller'
import { en, NS, zh, type PaperCoachTranslate } from './locales'
import { PAPER_COACH_CSS } from './styles'
import { PaperPdfViewer } from './PaperPdfViewer'
import { registerNativePdfViewer } from './native-pdf-viewer'
import { PaperQuoteDock, createPaperUserQuoteNode, createPaperUserTextRule } from './PaperQuoteDock'
import { RoadmapPanelContent } from './RoadmapPanel'
import { SettingsForm, SettingsModalHost } from './SettingsView'

export const inject = ['slots', 'locale', 'conversation', 'sessions']

function BookOpenIcon({ size = 16 }: { size?: number }): React.JSX.Element {
  return (
    <svg
      width={size}
      height={size}
      viewBox='0 0 24 24'
      fill='none'
      stroke='currentColor'
      strokeWidth='1.9'
      strokeLinecap='round'
      strokeLinejoin='round'
    >
      <path d='M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z' />
      <path d='M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z' />
    </svg>
  )
}

let modalHostClaimed = false

function SingletonSettingsModal({
  controller,
  t,
}: {
  controller: PaperCoachClientController
  t: PaperCoachTranslate
}): React.JSX.Element | null {
  const [owns, setOwns] = React.useState(false)
  useEffect(() => {
    if (!modalHostClaimed) {
      modalHostClaimed = true
      setOwns(true)
      return () => {
        modalHostClaimed = false
      }
    }
    return undefined
  }, [])
  if (!owns) return null
  return <SettingsModalHost controller={controller} t={t} />
}

export function apply(ctx: any): void {
  ctx.effect(() => ctx.locale.register(NS, { zh, en }))
  const t = ctx.locale.bind(NS) as PaperCoachTranslate
  const slots = ctx.get('slots')
  const sessions = ctx.get('sessions')
  const controller = new PaperCoachClientController()

  void controller.refreshSettings().catch(() => {})
  ctx.effect(() => () => controller.dispose())

  const isSubagent = (id: string): boolean =>
    Boolean(sessions?.subagentAddress?.(id)) ||
    sessions?.list?.getSnapshot?.()?.byId?.[id]?.origin === 'subagent'

  // 1. Inject plugin stylesheet
  ctx.effect(() => {
    const style = document.createElement('style')
    style.dataset.plugin = 'dsh-paper-coach'
    style.dataset.pluginCss = 'dsh-paper-coach/client.css'
    style.textContent = PAPER_COACH_CSS
    ;(document.head ?? document.documentElement).append(style)
    return () => style.remove()
  })

  // 2. Bind dsh-better-sidebar and register enhanced PDF reader
  const attachBetterSidebar = (bs: any): (() => void) => {
    if (!bs || typeof bs.registerFileViewer !== 'function') return () => {}
    controller.setBetterSidebar(bs)
    const offViewer = bs.registerFileViewer({
      id: 'paper-coach:pdf',
      title: () => t('viewer.title'),
      icon: (size = 14) => <BookOpenIcon size={size} />,
      exts: ['pdf'],
      priority: 20,
      fetchStrategy: 'mediaUrl',
      detect: (filePath: string, head: Uint8Array) =>
        filePath.toLowerCase().endsWith('.pdf') ||
        (head.length >= 4 && head[0] === 0x25 && head[1] === 0x50 && head[2] === 0x44 && head[3] === 0x46),
      settings: {
        render: () => <SettingsForm controller={controller} t={t} />,
      },
      component: (props: any) => (
        <PaperPdfViewer {...props} controller={controller} t={t} />
      ),
    })
    return () => {
      try { offViewer?.() } catch {}
      if (controller.getBetterSidebar() === bs) {
        controller.setBetterSidebar(undefined)
      }
    }
  }

  if (typeof ctx.inject === 'function') {
    ctx.inject(['betterSidebar'], (scope: any) => {
      const off = attachBetterSidebar(scope.get('betterSidebar'))
      scope.effect(() => off)
    })
  } else if (ctx.get?.('betterSidebar')) {
    const off = attachBetterSidebar(ctx.get('betterSidebar'))
    ctx.effect(() => off)
  }

  // Native resource tabs bypass betterSidebar's legacy file-viewer registry.
  registerNativePdfViewer(ctx, controller, t)

  // 3. Register User Quote Chip Rule & Renderer
  const userTextRule = createPaperUserTextRule()
  const UserQuoteNode = createPaperUserQuoteNode(controller)

  const attachUserTextRule = (uiConv: any) => {
    if (uiConv?.userText && typeof uiConv.userText.register === 'function') {
      return uiConv.userText.register(userTextRule)
    }
    return undefined
  }

  if (typeof ctx.inject === 'function') {
    ctx.inject(['uiConversation'], (scope: any) => {
      const off = attachUserTextRule(scope.get('uiConversation'))
      if (typeof off === 'function') scope.effect(() => off)
    })
  } else {
    const off = attachUserTextRule(ctx.get?.('uiConversation'))
    if (typeof off === 'function') ctx.effect(() => off)
  }

  slots.inject('conversation.user.text.node', () =>
    slots.register(
      {
        name: 'conversation.user.text.node',
        key: 'dsh-paper-coach-quote',
        priority: 100,
        locale: NS,
      },
      UserQuoteNode as any
    )
  )

  // 4. Register Conversation Dock (SSE auto-open listener + Quote Dock + Floating Roadmap Capsule)
  function PaperCoachSessionDock(props: any): React.JSX.Element | null {
    const sessionId = String(props?.session?.sessionId || '')
    const subagent = Boolean(props?.session?.subagent) || (sessionId ? isSubagent(sessionId) : false)

    useEffect(() => {
      if (!sessionId || subagent) return undefined
      controller.setActiveSession(sessionId)
      return controller.retainSession(sessionId)
    }, [sessionId, subagent])

    if (!sessionId || subagent) return null
    const sessionScope = sessions?.scope?.(sessionId)
    const input = sessionScope ? ctx.conversation?.input?.for?.(sessionScope) : undefined
    const boundT: PaperCoachTranslate = props?.t || t

    return (
      <>
        <PaperQuoteDock controller={controller} sessionId={sessionId} input={input} t={boundT} />
        <RoadmapPanelContent controller={controller} sessionId={sessionId} docked={false} t={boundT} />
        <SingletonSettingsModal controller={controller} t={boundT} />
      </>
    )
  }

  slots.inject('conversation.input.dock', () =>
    slots.register(
      {
        name: 'conversation.input.dock',
        id: 'dsh-paper-coach',
        order: -45,
        locale: NS,
      },
      PaperCoachSessionDock as any
    )
  )

  // 5. Register DSH Settings Section for Paper Coach
  slots.inject('settings.section.icon', () =>
    slots.register(
      {
        name: 'settings.section.icon',
        id: 'paper-coach',
        order: 115,
        label: () => t('settings.title'),
      },
      ({ size = 16 }: { size?: number }) => <BookOpenIcon size={size} />
    )
  )

  slots.inject('settings.section', () =>
    slots.register(
      {
        name: 'settings.section',
        id: 'paper-coach',
        order: 115,
        label: () => t('settings.title'),
      },
      () => (
        <div style={{ maxWidth: 640, padding: '16px 20px' }}>
          <h3 style={{ margin: '0 0 14px 0', fontSize: 16 }}>📖 {t('settings.title')}</h3>
          <SettingsForm controller={controller} t={t} />
        </div>
      )
    )
  )

  // 6. Intercept clicks on Assistant inline location badges: [📍 §8 · p.9](paper-coach://loc?section=8&page=9&q=...)
  ctx.effect(() => {
    const onDocClick = (ev: MouseEvent) => {
      const target = ev.target as Element | null
      const anchor = target?.closest?.('a') as HTMLAnchorElement | null
      if (!anchor) return
      const rawHref = anchor.getAttribute('href') || ''
      let search = ''
      if (/^paper-coach:\/\/loc\b/i.test(rawHref)) {
        const qIdx = rawHref.indexOf('?')
        search = qIdx >= 0 ? rawHref.slice(qIdx + 1) : ''
      } else {
        const markerIdx = rawHref.indexOf('#paper-coach-loc')
        if (markerIdx < 0) return
        const frag = rawHref.slice(markerIdx + '#paper-coach-loc'.length)
        const qIdx = frag.indexOf('?')
        search = qIdx >= 0 ? frag.slice(qIdx + 1) : ''
      }

      ev.preventDefault()
      ev.stopPropagation()

      const params = new URLSearchParams(search)
      const section = params.get('section') || params.get('sec') || undefined
      const pageRaw = params.get('page') || params.get('p')
      const page = pageRaw && Number.isFinite(Number(pageRaw)) ? Math.max(1, Math.floor(Number(pageRaw))) : undefined
      const queryText = params.get('q') || params.get('quote') || undefined
      const pdfPath = params.get('path') || undefined

      const sessionAttrEl = anchor.closest('[data-session-id]') as HTMLElement | null
      const sessionId = sessionAttrEl?.dataset?.sessionId || controller.getActiveSession()
      if (!sessionId) return

      controller.jumpToPaperLocation(sessionId, {
        pdfPath,
        section,
        page,
        queryText,
      })
    }

    document.addEventListener('click', onDocClick, true)
    return () => document.removeEventListener('click', onDocClick, true)
  })
}
