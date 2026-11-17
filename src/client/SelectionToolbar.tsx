import React, { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import type { PaperCoachClientController } from './controller'
import type { PaperCoachTranslate } from './locales'
import type { NormalizedRect } from '../shared/protocol'
import { normalizeSectionId } from '../shared/section-matcher'

export interface PdfSelectionState {
  text: string
  page: number
  section?: string
  rects: NormalizedRect[]
  anchorX: number
  anchorY: number
}

export function SelectionToolbar({
  controller,
  sessionId,
  pdfPath,
  paperTitle,
  selection,
  onDismiss,
  t,
}: {
  controller: PaperCoachClientController
  sessionId: string
  pdfPath: string
  paperTitle: string
  selection: PdfSelectionState | null
  onDismiss: () => void
  t: PaperCoachTranslate
}): React.JSX.Element | null {
  const [transCard, setTransCard] = useState<{
    source: PdfSelectionState
    loading: boolean
    result?: string
    modelInfo?: string
    error?: string
    copied?: boolean
  } | null>(null)
  const abortRef = useRef<AbortController | null>(null)

  useEffect(() => () => abortRef.current?.abort(), [])

  const runTranslation = async (sel: PdfSelectionState) => {
    const settings = controller.getSettings()
    if (settings.translationMode === 'main_agent') {
      controller.askMainAgentTranslate(sessionId, {
        pdfPath,
        paperTitle,
        page: sel.page,
        section: sel.section,
        text: sel.text,
        rects: sel.rects,
      })
      window.getSelection()?.removeAllRanges()
      onDismiss()
      return
    }

    abortRef.current?.abort()
    const ctrl = new AbortController()
    abortRef.current = ctrl
    setTransCard({ source: sel, loading: true })
    onDismiss()

    try {
      const res = await controller.apiPost<{ translation: string; providerUsed: string; modelUsed: string }>(
        'translate',
        {
          sessionId,
          text: sel.text,
          paperTitle,
          page: sel.page,
          section: sel.section,
        },
        ctrl.signal
      )
      if (ctrl.signal.aborted) return
      setTransCard({
        source: sel,
        loading: false,
        result: res.translation,
        modelInfo: res.providerUsed + ' · ' + res.modelUsed,
      })
    } catch (err) {
      if (ctrl.signal.aborted) return
      setTransCard({
        source: sel,
        loading: false,
        error: err instanceof Error ? err.message : String(err),
      })
    }
  }

  const handleQuote = (sel: PdfSelectionState) => {
    controller.addQuote(sessionId, {
      pdfPath,
      paperTitle,
      page: sel.page,
      section: sel.section,
      text: sel.text,
      rects: sel.rects,
    })
    window.getSelection()?.removeAllRanges()
    onDismiss()
  }

  const clampedLeft = selection ? Math.max(80, Math.min(window.innerWidth - 80, selection.anchorX)) : 0
  const clampedTop = selection ? Math.max(46, Math.min(window.innerHeight - 20, selection.anchorY)) : 0

  const cardSource = transCard?.source
  const cardLeft = cardSource ? Math.max(12, Math.min(window.innerWidth - 406, cardSource.anchorX - 180)) : 0
  const cardTop = cardSource ? Math.max(48, Math.min(window.innerHeight - 330, cardSource.anchorY + 14)) : 0

  return (
    <>
      {selection && createPortal(
        <div
          className='pc-sel-popover'
          style={{ left: clampedLeft + 'px', top: clampedTop + 'px' }}
          onMouseDown={e => { e.preventDefault(); e.stopPropagation() }}
        >
          <button type='button' className='pc-sel-btn' onClick={() => void runTranslation(selection)}>
            <span>🌐</span>
            <span>{t('selection.translate')}</span>
          </button>
          <div className='pc-sel-divider' />
          <button type='button' className='pc-sel-btn' onClick={() => handleQuote(selection)}>
            <span>❝</span>
            <span>{t('selection.quote')}</span>
          </button>
        </div>,
        document.body
      )}

      {transCard && createPortal(
        <div className='pc-trans-card' style={{ left: cardLeft + 'px', top: cardTop + 'px' }}>
          <div className='pc-trans-header'>
            <span>
              🌐 {t('translate.title')} · p.{transCard.source.page}
              {transCard.source.section ? (' §' + (normalizeSectionId(transCard.source.section) || transCard.source.section)) : ''}
            </span>
            <div style={{ display: 'flex', gap: 4 }}>
              <button
                type='button'
                className='pc-btn'
                style={{ padding: '1px 6px', fontSize: 11 }}
                title={t('toolbar.settings')}
                onClick={() => controller.openSettingsModal(sessionId)}
              >
                ⚙
              </button>
              <button
                type='button'
                className='pc-btn'
                style={{ padding: '1px 6px', fontSize: 11 }}
                onClick={() => { abortRef.current?.abort(); setTransCard(null) }}
              >
                ✕
              </button>
            </div>
          </div>
          <div className='pc-trans-body'>
            {transCard.loading && <span style={{ color: 'var(--pc-text-muted)' }}>{t('translate.loading')}</span>}
            {transCard.error && (
              <div style={{ color: '#ef4444' }}>
                <div>{transCard.error}</div>
                <div style={{ marginTop: 8, display: 'flex', gap: 6 }}>
                  <button type='button' className='pc-btn' onClick={() => void runTranslation(transCard.source)}>
                    {t('translate.retry')}
                  </button>
                  <button type='button' className='pc-btn' onClick={() => controller.openSettingsModal(sessionId)}>
                    配置翻译 API
                  </button>
                </div>
              </div>
            )}
            {transCard.result && <div>{transCard.result}</div>}
          </div>
          <div className='pc-trans-footer'>
            <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 180 }}>
              {transCard.modelInfo || ''}
            </span>
            <div style={{ display: 'flex', gap: 5 }}>
              {transCard.result && (
                <button
                  type='button'
                  className='pc-btn'
                  style={{ padding: '2px 7px', fontSize: 11 }}
                  onClick={() => {
                    void navigator.clipboard?.writeText(transCard.result || '')
                    setTransCard(prev => (prev ? { ...prev, copied: true } : null))
                  }}
                >
                  {transCard.copied ? t('translate.copied') : t('translate.copy')}
                </button>
              )}
              <button
                type='button'
                className='pc-btn'
                style={{ padding: '2px 7px', fontSize: 11 }}
                onClick={() => {
                  controller.addQuote(sessionId, {
                    pdfPath,
                    paperTitle,
                    page: transCard.source.page,
                    section: transCard.source.section,
                    text: transCard.source.text,
                    rects: transCard.source.rects,
                  })
                  setTransCard(null)
                }}
              >
                + {t('selection.quote')}
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}
    </>
  )
}
