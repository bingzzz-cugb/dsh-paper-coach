import React, { useEffect, useRef, useState, useSyncExternalStore } from 'react'
import { createPortal } from 'react-dom'
import type { PaperCoachClientController } from './controller'
import type { PaperCoachTranslate } from './locales'
import type { ReadingStage } from '../shared/protocol'
import { normalizeSectionId } from '../shared/section-matcher'

const FLOAT_POS_KEY = 'dsh-paper-coach:roadmap-pos'

function readSavedPos(): { right: number; top: number } {
  try {
    const raw = localStorage.getItem(FLOAT_POS_KEY)
    if (raw) {
      const p = JSON.parse(raw)
      if (typeof p.right === 'number' && typeof p.top === 'number') return p
    }
  } catch {}
  return { right: 24, top: 60 }
}

function stageLabelOf(stage: ReadingStage, t: PaperCoachTranslate): string {
  switch (stage) {
    case 'overview': return t('roadmap.stage.overview')
    case 'reading': return t('roadmap.stage.reading')
    case 'quiz': return t('roadmap.stage.quiz')
    case 'summary': return t('roadmap.stage.summary')
    case 'completed': return t('roadmap.stage.completed')
    default: return t('roadmap.stage.reading')
  }
}

export const RoadmapPanelContent = React.memo(function RoadmapPanelContent({
  controller,
  sessionId,
  docked,
  t,
}: {
  controller: PaperCoachClientController
  sessionId: string
  docked: boolean
  t: PaperCoachTranslate
}): React.JSX.Element | null {
  const state = useSyncExternalStore(
    controller.subscribe,
    () => controller.getSessionState(sessionId)
  )
  const settings = useSyncExternalStore(
    controller.subscribe,
    () => controller.getSettings()
  )
  const [collapsed, setCollapsed] = useState(false)
  const [pos, setPos] = useState(readSavedPos)
  const dragRef = useRef<{ startX: number; startY: number; origRight: number; origTop: number; moved: boolean } | null>(null)

  const plan = state?.plan
  if (!plan) return null

  // Only render in the chosen dock slot
  if (docked && settings.roadmapDockMode !== 'pdf_top') return null
  if (!docked && settings.roadmapDockMode !== 'float') return null

  const totalSec = plan.sections.length
  const doneSec = plan.sections.filter(s => s.status === 'done').length
  const currentSec = plan.sections.find(s => s.status === 'current') ?? plan.sections.find(s => s.status === 'pending')
  const allSectionsDone = totalSec > 0 && doneSec === totalSec

  const onHeaderMouseDown = (e: React.MouseEvent) => {
    if (docked || e.button !== 0) return
    if ((e.target as HTMLElement).closest('button')) return
    e.preventDefault()
    dragRef.current = {
      startX: e.clientX,
      startY: e.clientY,
      origRight: pos.right,
      origTop: pos.top,
      moved: false,
    }
    const onMove = (ev: MouseEvent) => {
      const d = dragRef.current
      if (!d) return
      const dx = ev.clientX - d.startX
      const dy = ev.clientY - d.startY
      if (Math.abs(dx) > 3 || Math.abs(dy) > 3) d.moved = true
      const nextRight = Math.max(8, Math.min(window.innerWidth - 180, d.origRight - dx))
      const nextTop = Math.max(8, Math.min(window.innerHeight - 60, d.origTop + dy))
      setPos({ right: nextRight, top: nextTop })
    }
    const onUp = () => {
      window.removeEventListener('mousemove', onMove)
      window.removeEventListener('mouseup', onUp)
      if (dragRef.current?.moved) {
        setPos(cur => {
          try { localStorage.setItem(FLOAT_POS_KEY, JSON.stringify(cur)) } catch {}
          return cur
        })
      }
      dragRef.current = null
    }
    window.addEventListener('mousemove', onMove)
    window.addEventListener('mouseup', onUp)
  }

  const toggleDockMode = () => {
    const next = docked ? 'float' : 'pdf_top'
    void controller.updateSettings({ roadmapDockMode: next })
  }

  const summaryBadge = currentSec
    ? ('§' + (normalizeSectionId(currentSec.section) || currentSec.section) + ' (' + doneSec + '/' + totalSec + ')')
    : totalSec > 0
      ? ('✓ ' + doneSec + '/' + totalSec)
      : stageLabelOf(plan.stage, t)

  const inner = (
    <div
      className={docked ? 'pc-roadmap-docked' : ('pc-roadmap-float' + (collapsed ? ' pc-roadmap-float-collapsed' : ''))}
      style={docked ? undefined : { top: pos.top + 'px', right: pos.right + 'px' }}
    >
      <div className='pc-roadmap-header' onMouseDown={onHeaderMouseDown}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, minWidth: 0 }}>
          <span style={{ fontWeight: 600, whiteSpace: 'nowrap' }}>📖 {t('roadmap.capsulePrefix')}</span>
          <span className='pc-badge'>{summaryBadge}</span>
          {!collapsed && (
            <span style={{ color: 'var(--pc-text-muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 110 }} title={plan.paperTitle}>
              {plan.paperTitle}
            </span>
          )}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 4, flexShrink: 0 }}>
          {!collapsed && (
            <button
              type='button'
              className='pc-btn'
              style={{ padding: '2px 6px', fontSize: 11 }}
              title={docked ? t('roadmap.undockToChat') : t('roadmap.dockToPdf')}
              onClick={toggleDockMode}
            >
              {docked ? '↗' : '⇥'}
            </button>
          )}
          <button
            type='button'
            className='pc-btn'
            style={{ padding: '2px 6px', fontSize: 11 }}
            title={collapsed ? '展开精读路线' : '收起精读路线'}
            aria-expanded={!collapsed}
            onClick={() => setCollapsed(c => !c)}
          >
            {collapsed ? '▾' : '▴'}
          </button>
        </div>
      </div>

      {!collapsed && (
        <div className='pc-roadmap-body'>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: 11, color: 'var(--pc-text-muted)' }}>
            <span>阶段：{stageLabelOf(plan.stage, t)}</span>
            {plan.pdfPath && (
              <button
                type='button'
                className='pc-btn'
                style={{ padding: '1px 6px', fontSize: 11 }}
                onClick={() => controller.jumpToPaperLocation(sessionId, { pdfPath: plan.pdfPath, paperTitle: plan.paperTitle })}
              >
                打开 PDF
              </button>
            )}
          </div>

          {plan.goals.length > 0 && (
            <div>
              <div className='pc-roadmap-sec-title'>
                <span>🎯 {t('roadmap.goalsTitle')}</span>
                <span>{plan.goals.filter(g => g.done).length}/{plan.goals.length}</span>
              </div>
              {plan.goals.map(g => (
                <div
                  key={g.id}
                  className='pc-goal-row'
                  onClick={() => void controller.toggleGoalDone(sessionId, g.id)}
                >
                  <span style={{ color: g.done ? '#10b981' : 'var(--pc-text-muted)', flexShrink: 0 }}>
                    {g.done ? '☑' : '☐'}
                  </span>
                  <span style={{ textDecoration: g.done ? 'line-through' : 'none', opacity: g.done ? 0.72 : 1 }}>
                    {g.text}
                  </span>
                </div>
              ))}
            </div>
          )}

          {plan.sections.length > 0 && (
            <div>
              <div className='pc-roadmap-sec-title'>
                <span>🗺️ {t('roadmap.sectionsTitle')}</span>
                <span>{doneSec}/{totalSec}</span>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                {plan.sections.map(sec => {
                  const normSec = normalizeSectionId(sec.section) || sec.section
                  const icon = sec.status === 'done' ? '✓' : sec.status === 'current' ? '●' : '○'
                  const rowCls =
                    'pc-sec-row' +
                    (sec.status === 'current' ? ' pc-sec-row-current' : '') +
                    (sec.status === 'done' ? ' pc-sec-row-done' : '')
                  return (
                    <div
                      key={sec.id}
                      className={rowCls}
                      onClick={() =>
                        controller.jumpToPaperLocation(sessionId, {
                          pdfPath: plan.pdfPath,
                          paperTitle: plan.paperTitle,
                          section: normSec,
                          page: sec.page,
                        })
                      }
                      title={sec.note || '点击在侧边栏定位到该章节'}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6, minWidth: 0 }}>
                        <span style={{ color: sec.status === 'done' ? '#10b981' : sec.status === 'current' ? 'var(--pc-accent)' : 'var(--pc-text-muted)', fontWeight: 700 }}>
                          {icon}
                        </span>
                        <span style={{ fontWeight: 600 }}>§{normSec}</span>
                        {sec.title && (
                          <span style={{ color: 'var(--pc-text-muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                            {sec.title}
                          </span>
                        )}
                      </div>
                      {sec.status !== 'done' && (
                        <button
                          type='button'
                          className='pc-btn'
                          style={{ padding: '1px 6px', fontSize: 10.5, flexShrink: 0 }}
                          onClick={e => {
                            e.stopPropagation()
                            void controller.advanceSectionDone(sessionId, sec.id)
                          }}
                        >
                          读完
                        </button>
                      )}
                    </div>
                  )
                })}
              </div>
            </div>
          )}

          {allSectionsDone && plan.stage === 'reading' && (
            <button
              type='button'
              className='pc-btn pc-btn-primary'
              style={{ width: '100%', justifyContent: 'center', padding: '6px 10px', fontWeight: 600 }}
              onClick={() => void controller.startQuizFromPanel(sessionId)}
            >
              ✨ {t('roadmap.startQuiz')}
            </button>
          )}
        </div>
      )}
    </div>
  )

  if (docked) return inner
  return createPortal(inner, document.body)
})
