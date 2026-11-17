import React, { useEffect, useSyncExternalStore } from 'react'
import type { DraftInputHandle, PaperCoachClientController } from './controller'
import type { PaperCoachTranslate } from './locales'
import type { PaperQuotePayload } from '../shared/protocol'
import { formatPaperQuoteBlock, normalizeSectionId, parsePaperQuoteBlock } from '../shared/section-matcher'

export function PaperQuoteDock({
  controller,
  sessionId,
  input,
  t,
}: {
  controller: PaperCoachClientController
  sessionId: string
  input?: DraftInputHandle
  t: PaperCoachTranslate
}): React.JSX.Element | null {
  const quotes = useSyncExternalStore(
    controller.subscribe,
    () => controller.getQuotes(sessionId)
  )

  useEffect(() => {
    controller.registerInput(sessionId, input)
    return () => controller.registerInput(sessionId, undefined)
  }, [controller, sessionId, input])

  // Automatically merge pending paper quotes into draft right before Enter or Send button click
  useEffect(() => {
    if (!input || quotes.length === 0) return

    const mergeIntoDraft = () => {
      const curQuotes = controller.getQuotes(sessionId)
      if (curQuotes.length === 0) return
      const snap = input.state.getSnapshot()
      if (snap.phase && snap.phase !== 'plain') return
      const merged = formatPaperQuoteBlock(curQuotes, snap.draft)
      input.setDraft(merged)
      controller.clearQuotes(sessionId)
    }

    const onKeyDown = (ev: KeyboardEvent) => {
      if (ev.key !== 'Enter' || ev.shiftKey || ev.altKey || ev.isComposing) return
      const active = document.activeElement as HTMLElement | null
      if (!active) return
      if (active.closest('.pc-modal-card, .pc-trans-card, [role="dialog"]')) return
      const isComposer =
        active.matches('[data-dsh-composer-input]') ||
        active instanceof HTMLTextAreaElement ||
        active.isContentEditable
      if (!isComposer) return
      mergeIntoDraft()
    }

    const onClick = (ev: MouseEvent) => {
      const target = ev.target as Element | null
      if (!target) return
      if (target.closest('.pc-modal-card, .pc-trans-card, [role="dialog"]')) return
      if (target.closest('button[aria-label*="停止"], button[aria-label*="Stop"]')) return
      const isSubmit = Boolean(
        target.closest(
          'button[aria-label*="发送"], button[aria-label*="Send"], button[aria-label*="排队"], button[aria-label*="Queue"], button[aria-label*="插话"], button[aria-label*="Steer"]'
        )
      )
      if (!isSubmit) return
      mergeIntoDraft()
    }

    window.addEventListener('keydown', onKeyDown, true)
    window.addEventListener('click', onClick, true)
    return () => {
      window.removeEventListener('keydown', onKeyDown, true)
      window.removeEventListener('click', onClick, true)
    }
  }, [controller, sessionId, input, quotes.length])

  if (quotes.length === 0) return null

  return (
    <div className='pc-quote-dock'>
      <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--pc-accent)' }}>
        📄 {t('quote.dockTitle')} ({quotes.length})
      </span>
      {quotes.map(q => {
        const secStr = q.section ? (' §' + (normalizeSectionId(q.section) || q.section)) : ''
        return (
          <div
            key={q.id}
            className='pc-quote-pill'
            title={t('quote.jumpBack') + '\n\n' + q.text}
            onClick={() =>
              controller.jumpToPaperLocation(sessionId, {
                pdfPath: q.pdfPath,
                paperTitle: q.paperTitle,
                page: q.page,
                section: q.section,
                rects: q.rects,
                queryText: q.text,
              })
            }
          >
            <strong>p.{q.page}{secStr}</strong>
            <span className='pc-quote-pill-text'>“{q.text}”</span>
            <button
              type='button'
              style={{ border: 'none', background: 'transparent', color: 'var(--pc-text-muted)', cursor: 'pointer', padding: '0 2px' }}
              onClick={e => {
                e.stopPropagation()
                controller.removeQuote(sessionId, q.id)
              }}
            >
              ✕
            </button>
          </div>
        )
      })}
      <button
        type='button'
        className='pc-btn'
        style={{ marginLeft: 'auto', padding: '2px 7px', fontSize: 11 }}
        onClick={() => controller.clearQuotes(sessionId)}
      >
        {t('quote.clear')}
      </button>
    </div>
  )
}

export interface PaperUserQuoteNodeData {
  quotes: PaperQuotePayload[]
}

export function createPaperUserTextRule() {
  return {
    key: 'dsh-paper-coach-quote',
    match(text: string, from: number) {
      const parsed = parsePaperQuoteBlock(text, from)
      if (!parsed) return undefined
      return {
        start: parsed.start,
        end: parsed.end,
        data: { quotes: parsed.quotes } as PaperUserQuoteNodeData,
      }
    },
  }
}

export function createPaperUserQuoteNode(controller: PaperCoachClientController) {
  return function PaperUserQuoteNode(props: any): React.JSX.Element | null {
    const data = props?.data as PaperUserQuoteNodeData | undefined
    const sessionId = props?.session?.sessionId || controller.getActiveSession() || ''
    if (!data?.quotes?.length) return null
    return (
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 6 }}>
        {data.quotes.map(q => {
          const secStr = q.section ? (' §' + (normalizeSectionId(q.section) || q.section)) : ''
          return (
            <span
              key={q.id}
              className='pc-quote-pill'
              title={'点击在右侧 PDF 定位原文：\n' + q.text}
              onClick={() => {
                if (!sessionId) return
                controller.jumpToPaperLocation(sessionId, {
                  pdfPath: q.pdfPath,
                  paperTitle: q.paperTitle,
                  page: q.page,
                  section: q.section,
                  rects: q.rects,
                  queryText: q.text,
                })
              }}
            >
              <span>📄 {q.paperTitle} · p.{q.page}{secStr}</span>
              <span className='pc-quote-pill-text'>“{q.text}”</span>
            </span>
          )
        })}
      </div>
    )
  }
}
