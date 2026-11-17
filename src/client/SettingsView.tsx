import React, { useEffect, useState, useSyncExternalStore } from 'react'
import { createPortal } from 'react-dom'
import type { PaperCoachClientController } from './controller'
import type { PaperCoachTranslate } from './locales'
import type { ArchiveBackendMode, RoadmapDockMode, TranslationMode } from '../shared/protocol'

export function SettingsForm({
  controller,
  t,
  onSaved,
}: {
  controller: PaperCoachClientController
  t: PaperCoachTranslate
  onSaved?: () => void
}): React.JSX.Element {
  const live = useSyncExternalStore(controller.subscribe, () => controller.getSettings())
  const [translationMode, setTranslationMode] = useState<TranslationMode>(live.translationMode)
  const [targetLanguage, setTargetLanguage] = useState(live.targetLanguage)
  const [customApiBaseUrl, setCustomApiBaseUrl] = useState(live.customApiBaseUrl)
  const [customApiKey, setCustomApiKey] = useState('')
  const [clearKey, setClearKey] = useState(false)
  const [customApiModel, setCustomApiModel] = useState(live.customApiModel)
  const [hostModelRoute, setHostModelRoute] = useState(live.hostModelRoute)
  const [roadmapDockMode, setRoadmapDockMode] = useState<RoadmapDockMode>(live.roadmapDockMode)
  const [archiveBackend, setArchiveBackend] = useState<ArchiveBackendMode>(live.archiveBackend)
  const [preferLocalZotero, setPreferLocalZotero] = useState(live.preferLocalZotero)
  const [researchFocusHint, setResearchFocusHint] = useState(live.researchFocusHint)
  const [saving, setSaving] = useState(false)
  const [statusMsg, setStatusMsg] = useState('')

  useEffect(() => {
    setTranslationMode(live.translationMode)
    setTargetLanguage(live.targetLanguage)
    setCustomApiBaseUrl(live.customApiBaseUrl)
    setCustomApiModel(live.customApiModel)
    setHostModelRoute(live.hostModelRoute)
    setRoadmapDockMode(live.roadmapDockMode)
    setArchiveBackend(live.archiveBackend)
    setPreferLocalZotero(live.preferLocalZotero)
    setResearchFocusHint(live.researchFocusHint)
  }, [live])

  const save = async (e: React.FormEvent) => {
    e.preventDefault()
    setSaving(true)
    setStatusMsg('')
    try {
      await controller.updateSettings({
        translationMode,
        targetLanguage,
        customApiBaseUrl,
        customApiKey: customApiKey.trim() || undefined,
        clearCustomApiKey: clearKey || undefined,
        customApiModel,
        hostModelRoute,
        roadmapDockMode,
        archiveBackend,
        preferLocalZotero,
        researchFocusHint,
      })
      setCustomApiKey('')
      setClearKey(false)
      setStatusMsg(t('settings.saved'))
      onSaved?.()
    } catch (err) {
      setStatusMsg(err instanceof Error ? err.message : String(err))
    } finally {
      setSaving(false)
    }
  }

  return (
    <form onSubmit={save} style={{ display: 'flex', flexDirection: 'column', gap: 11 }}>
      <div className='pc-field'>
        <label>{t('settings.translationMode')}</label>
        <select className='pc-select' value={translationMode} onChange={e => setTranslationMode(e.target.value as TranslationMode)}>
          <option value='host_model'>{t('settings.mode.host')}</option>
          <option value='custom_api'>{t('settings.mode.custom')}</option>
          <option value='main_agent'>{t('settings.mode.main')}</option>
        </select>
      </div>

      <div className='pc-field'>
        <label>{t('settings.targetLang')}</label>
        <select className='pc-select' value={targetLanguage} onChange={e => setTargetLanguage(e.target.value)}>
          <option value='zh-CN'>简体中文 (zh-CN)</option>
          <option value='en'>English (en)</option>
          <option value='ja'>日本語 (ja)</option>
        </select>
      </div>

      {translationMode === 'custom_api' && (
        <div style={{ padding: 10, borderRadius: 8, background: 'var(--pc-bg-subtle)', display: 'flex', flexDirection: 'column', gap: 9 }}>
          <div className='pc-field'>
            <label>{t('settings.apiBaseUrl')}</label>
            <input className='pc-input' value={customApiBaseUrl} onChange={e => setCustomApiBaseUrl(e.target.value)} placeholder='https://api.openai.com/v1' />
          </div>
          <div className='pc-field'>
            <label style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span>{t('settings.apiKey')}</span>
              {live.hasCustomApiKey && !clearKey && (
                <span style={{ color: '#10b981', fontWeight: 500 }}>✓ {t('settings.apiKeyConfigured')}</span>
              )}
            </label>
            <div style={{ display: 'flex', gap: 6 }}>
              <input
                type='password'
                className='pc-input'
                style={{ flex: 1 }}
                value={customApiKey}
                onChange={e => { setCustomApiKey(e.target.value); setClearKey(false) }}
                placeholder={t('settings.apiKeyPlaceholder')}
              />
              {live.hasCustomApiKey && (
                <button type='button' className='pc-btn' onClick={() => setClearKey(true)}>
                  清除
                </button>
              )}
            </div>
          </div>
          <div className='pc-field'>
            <label>{t('settings.apiModel')}</label>
            <input className='pc-input' value={customApiModel} onChange={e => setCustomApiModel(e.target.value)} placeholder='gpt-4o-mini / deepseek-chat' />
          </div>
        </div>
      )}

      {translationMode === 'host_model' && (
        <div className='pc-field'>
          <label>{t('settings.hostRoute')}</label>
          <input className='pc-input' value={hostModelRoute} onChange={e => setHostModelRoute(e.target.value)} placeholder='例如 deepseek-account/deepseek-flash（留空自动匹配）' />
        </div>
      )}

      <div className='pc-field'>
        <label>精读路线面板默认位置</label>
        <select className='pc-select' value={roadmapDockMode} onChange={e => setRoadmapDockMode(e.target.value as RoadmapDockMode)}>
          <option value='float'>聊天区右上角可拖拽悬浮胶囊</option>
          <option value='pdf_top'>侧边栏 PDF 阅读器顶部导览栏</option>
        </select>
      </div>

      <div className='pc-field'>
        <label>{t('settings.archiveBackend')}</label>
        <select className='pc-select' value={archiveBackend} onChange={e => setArchiveBackend(e.target.value as ArchiveBackendMode)}>
          <option value='auto'>自动（检测到 OpenViking 优先，否则本地 .paper-reading/）</option>
          <option value='openviking'>优先使用 OpenViking 私有资源库</option>
          <option value='local'>使用工作区本地 .paper-reading/ Markdown 档案</option>
        </select>
      </div>

      <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', fontSize: 12.5 }}>
        <input type='checkbox' checked={preferLocalZotero} onChange={e => setPreferLocalZotero(e.target.checked)} />
        <span>{t('settings.preferZotero')}</span>
      </label>

      <div className='pc-field'>
        <label>{t('settings.researchHint')}</label>
        <textarea
          className='pc-textarea'
          rows={2}
          value={researchFocusHint}
          onChange={e => setResearchFocusHint(e.target.value)}
          placeholder='例如：主攻遥感变化检测与多模态生成方法迁移（留空则为通用学术模式）'
        />
      </div>

      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 4 }}>
        <span style={{ fontSize: 12, color: statusMsg === t('settings.saved') ? '#10b981' : '#ef4444' }}>{statusMsg}</span>
        <button type='submit' className='pc-btn pc-btn-primary' disabled={saving}>
          {saving ? '...' : t('settings.save')}
        </button>
      </div>
    </form>
  )
}

export function SettingsModalHost({
  controller,
  t,
}: {
  controller: PaperCoachClientController
  t: PaperCoachTranslate
}): React.JSX.Element | null {
  const open = useSyncExternalStore(controller.subscribe, () => controller.isSettingsModalOpen())
  if (!open) return null

  return createPortal(
    <div className='pc-modal-backdrop' onMouseDown={e => { if (e.target === e.currentTarget) controller.closeSettingsModal() }}>
      <div className='pc-modal-card'>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <strong style={{ fontSize: 15 }}>⚙ {t('settings.title')}</strong>
          <button type='button' className='pc-btn' onClick={() => controller.closeSettingsModal()}>✕</button>
        </div>
        <SettingsForm controller={controller} t={t} onSaved={() => setTimeout(() => controller.closeSettingsModal(), 450)} />
      </div>
    </div>,
    document.body
  )
}
