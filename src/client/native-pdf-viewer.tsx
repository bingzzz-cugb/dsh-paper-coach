import React from 'react'
import type { PaperCoachClientController } from './controller'
import type { PaperCoachTranslate } from './locales'
import { PaperPdfViewer } from './PaperPdfViewer'

const TYPE_ID = 'paper-coach:pdf'
const FILE_PREFIX = 'dsh-resource://file/'

interface PdfResource { path: string; sourceSessionId?: string }

// Mirror the host's segment-encoded file-address grammar without importing its runtime packages.
function pdfResource(address: string): PdfResource | undefined {
  try {
    if (!address.startsWith(FILE_PREFIX)) return undefined
    const end = address.search(/[?#]/)
    const [scope, ...parts] = address.slice(FILE_PREFIX.length, end < 0 ? undefined : end).split('/')
    let path: string
    let sourceSessionId: string | undefined
    if (scope === 'session') {
      const [id, ...segments] = parts
      if (!id || segments.length === 0) return undefined
      sourceSessionId = decodeURIComponent(id)
      path = segments.map(decodeURIComponent).join('/')
    } else if (scope === 'absolute') {
      const unc = parts[0] === '' && parts.length > 1
      const segments = (unc ? parts.slice(1) : parts).map(decodeURIComponent)
      if (!segments[0]) return undefined
      path = segments.join('/')
      if (unc) path = '//' + path
      else if (!/^[A-Za-z]:$/.test(segments[0])) path = '/' + path
    } else {
      return undefined
    }
    return path.toLowerCase().endsWith('.pdf') ? { path, sourceSessionId } : undefined
  } catch {
    // A malformed escape is not a file this viewer may claim.
    return undefined
  }
}

interface NativePdfProps {
  sessionId: string
  controller: PaperCoachClientController
  t: PaperCoachTranslate
  useTabInfo: () => { tab: { contentId: string; title: string; visible: boolean } }
}

function NativePdfBody({ sessionId, controller, t, useTabInfo }: NativePdfProps): React.JSX.Element | null {
  const { tab } = useTabInfo()
  const file = pdfResource(tab.contentId)
  if (!file || !sessionId) return null
  // Read from the address's namespace, but keep plans, quotes and viewport updates in the seat conversation.
  const params = new URLSearchParams({ sessionId: file.sourceSessionId || sessionId, path: file.path })
  return (
    <div data-paper-coach-native-pdf='' style={{ display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0, height: '100%', width: '100%' }}>
      <PaperPdfViewer
        scope={{ sessionId }}
        path={file.path}
        title={tab.title}
        mediaUrl={controller.routeUrl('sidebar/file?' + params.toString())}
        visible={tab.visible}
        controller={controller}
        t={t}
      />
    </div>
  )
}

/** Register in the HOST resource registry: betterSidebar file viewers alone do not own native PDF tabs. */
export function registerNativePdfViewer(ctx: any, controller: PaperCoachClientController, t: PaperCoachTranslate): void {
  const attach = (scope: any) => {
    const tabs = scope.sidebarRightTabs ?? scope.get?.('sidebarRightTabs')
    const slots = scope.slots ?? scope.get?.('slots')
    if (typeof tabs?.register !== 'function' || typeof slots?.inject !== 'function') return
    scope.effect(() => {
      const offType = tabs.register({
        id: TYPE_ID,
        kind: 'paper-coach-pdf',
        multiple: true,
        keepMounted: true,
        patterns: ['dsh-resource://file/**'],
        priority: 'extension',
        canOpen: (address: string) => pdfResource(address) !== undefined,
        title: (address: string) => pdfResource(address)?.path.split('/').pop() || t('viewer.title'),
      })
      try {
        const offBody = slots.inject('sidebar.right.pane.tab', () => slots.register({
          name: 'sidebar.right.pane.tab',
          key: TYPE_ID,
          inject: (sessionId: string) => ({ sessionId, controller, t }),
        }, NativePdfBody))
        return () => { try { offBody() } finally { offType() } }
      } catch (error) {
        // Never leave an address claimant behind without a renderer if activation fails.
        offType()
        throw error
      }
    })
  }
  // The host may provide the registry after the plugin starts; a slot declaration is not a readiness signal.
  if (typeof ctx.inject === 'function') ctx.inject(['sidebarRightTabs'], attach)
  else attach(ctx)
}
