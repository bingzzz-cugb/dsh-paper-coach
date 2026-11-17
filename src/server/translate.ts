import { randomUUID } from 'node:crypto'
import type { PaperCoachSettings } from '../shared/protocol'

export interface TranslateInput {
  text: string
  paperTitle?: string
  page?: number
  section?: string
  targetLanguage?: string
  modeOverride?: 'host_model' | 'custom_api'
  signal?: AbortSignal
}

export interface TranslateOutput {
  translation: string
  providerUsed: string
  modelUsed: string
}

function buildAcademicTranslationPrompt(input: TranslateInput, defaultLang: string): string {
  const lang = input.targetLanguage || defaultLang || 'zh-CN'
  const langName = lang.toLowerCase().startsWith('zh') ? '简体中文' : lang.toLowerCase().startsWith('en') ? 'English' : lang
  const locHints: string[] = []
  if (input.paperTitle) locHints.push(`论文：《${input.paperTitle}》`)
  if (input.section) locHints.push(`章节：${input.section}`)
  if (input.page) locHints.push(`页码：p.${input.page}`)
  const contextLine = locHints.length > 0 ? `出处上下文：${locHints.join(' · ')}\n` : ''

  return [
    `你是一位严谨的学术论文伴读翻译助手。请将下方选中的论文段落准确、流畅地翻译为${langName}。`,
    '翻译要求：',
    '1. 保持学术表达准确自然，关键专业术语可在首次出现时保留英文原词括注（如：条件泄露 condition leakage）；',
    '2. 严格保留原文中的所有数学符号、变量名与公式标记（如 $x_t$、\\alpha、下标等），不要破坏公式结构；',
    '3. 修复 PDF 双栏排版产生的断行连字符（如 trans-\nformer 应还原为 transformer 翻译）；',
    '4. 直接输出译文正文，不要输出任何寒暄、解释前缀或多余包裹。',
    '',
    contextLine + '待译原文：',
    input.text.trim(),
  ].join('\n')
}

function cleanPdfSourceText(raw: string): string {
  return raw.replace(/([A-Za-z])-\s*\r?\n\s*([a-z])/g, '$1$2').trim()
}

export function resolveOpenAiChatEndpoints(baseUrl: string): string[] {
  const cleanBase = baseUrl.trim().replace(/\/+$/, '')
  if (!cleanBase) return ['https://api.openai.com/v1/chat/completions']
  if (/\/chat\/completions$/i.test(cleanBase)) {
    return [cleanBase]
  }
  if (/\/v\d+(?:beta\d*)?$/i.test(cleanBase)) {
    return [`${cleanBase}/chat/completions`]
  }
  return [`${cleanBase}/v1/chat/completions`, `${cleanBase}/chat/completions`]
}

function isQwenMtModel(model: string): boolean {
  return /^(?:.*\/)?qwen-mt(?:-|$)/i.test(model.trim())
}

function resolveQwenMtTargetLang(rawLang: string): string {
  const norm = (rawLang || 'zh-CN').trim().toLowerCase()
  if (norm === 'zh-tw' || norm === 'zh-hk' || norm === 'zh-hant') return 'Traditional Chinese'
  if (norm.startsWith('zh')) return 'Chinese'
  if (norm.startsWith('en')) return 'English'
  if (norm.startsWith('ja')) return 'Japanese'
  if (norm.startsWith('ko')) return 'Korean'
  if (norm.startsWith('fr')) return 'French'
  if (norm.startsWith('de')) return 'German'
  if (norm.startsWith('es')) return 'Spanish'
  if (norm.startsWith('ru')) return 'Russian'
  return rawLang || 'Chinese'
}

function buildQwenMtDomainsHint(input: TranslateInput): string {
  const contextParts: string[] = []
  if (input.paperTitle) contextParts.push(`Paper: ${input.paperTitle}`)
  if (input.section) contextParts.push(`Section: ${input.section}`)
  const ctxSuffix = contextParts.length > 0 ? ` (${contextParts.join('; ')})` : ''
  return (
    `Academic research paper${ctxSuffix}. ` +
    'Translate accurately and fluently in scholarly register, preserving mathematical variables, symbols, and formulas verbatim.'
  )
}

async function callOpenAiCompatible(options: {
  baseUrl: string
  apiKey: string
  model: string
  prompt: string
  sourceText: string
  inputMeta: TranslateInput
  defaultLang: string
  signal?: AbortSignal
}): Promise<TranslateOutput> {
  const endpoints = resolveOpenAiChatEndpoints(options.baseUrl)
  const useQwenMt = isQwenMtModel(options.model)
  const targetLang = options.inputMeta.targetLanguage || options.defaultLang || 'zh-CN'

  const primaryPayload: Record<string, unknown> = useQwenMt
    ? {
        model: options.model,
        stream: false,
        messages: [{ role: 'user', content: options.sourceText }],
        translation_options: {
          source_lang: 'auto',
          target_lang: resolveQwenMtTargetLang(targetLang),
          domains: buildQwenMtDomainsHint(options.inputMeta),
        },
      }
    : {
        model: options.model,
        temperature: 0.2,
        stream: false,
        messages: [{ role: 'user', content: options.prompt }],
      }

  const postOnce = (endpoint: string, payload: Record<string, unknown>) =>
    fetch(endpoint, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        authorization: `Bearer ${options.apiKey}`,
      },
      body: JSON.stringify(payload),
      signal: options.signal,
    })

  let chosenEndpoint = endpoints[0]!
  let res = await postOnce(chosenEndpoint, primaryPayload)
  if (res.status === 404 && endpoints.length > 1 && !options.signal?.aborted) {
    chosenEndpoint = endpoints[1]!
    res = await postOnce(chosenEndpoint, primaryPayload)
  }

  // Fallback to standard prompt payload if a custom proxy wrapping qwen-mt rejects translation_options
  if (useQwenMt && res.status === 400 && !options.signal?.aborted) {
    res = await postOnce(chosenEndpoint, {
      model: options.model,
      temperature: 0.2,
      stream: false,
      messages: [{ role: 'user', content: options.prompt }],
    })
  }

  if (!res.ok) {
    const bodyText = await res.text().catch(() => '')
    throw new Error(`自定义翻译 API 请求失败 (HTTP ${res.status}): ${bodyText.slice(0, 240) || res.statusText}`)
  }

  const data = (await res.json()) as {
    model?: string
    choices?: Array<{ message?: { content?: string | Array<{ type?: string; text?: string }> } }>
  }
  const rawContent = data.choices?.[0]?.message?.content
  const text = typeof rawContent === 'string'
    ? rawContent.trim()
    : Array.isArray(rawContent)
      ? rawContent.map(p => p.text ?? '').join('').trim()
      : ''

  if (!text) {
    throw new Error('自定义翻译 API 返回内容为空，请检查模型名称与接口兼容性')
  }

  return {
    translation: text,
    providerUsed: 'custom_api',
    modelUsed: data.model || options.model,
  }
}

async function resolveHostModelRoute(
  ctx: any,
  sessionId: string | undefined,
  preferredRoute: string
): Promise<{ provider: string; model: string }> {
  if (preferredRoute && preferredRoute.includes('/')) {
    const slash = preferredRoute.indexOf('/')
    const p = preferredRoute.slice(0, slash).trim()
    const m = preferredRoute.slice(slash + 1).trim()
    if (p && m) return { provider: p, model: m }
  }

  const llm = ctx.llm ?? ctx.get?.('llm')
  if (!llm || typeof llm.listProviders !== 'function') {
    throw new Error('宿主未挂载 dsh-llm 服务，请在插件设置中配置自定义翻译 API')
  }

  const providers: string[] = llm.listProviders() ?? []
  const providerSet = new Set(providers)

  // 1. Try active agent or persisted session header (only if backed by dsh-llm rather than an external ACP bridge)
  if (sessionId) {
    const agent = (ctx.agents ?? ctx.get?.('agents'))?.get?.(sessionId)
    const agentModel = agent?.model ?? agent?.route ?? agent?.config?.model
    if (
      agentModel &&
      typeof agentModel === 'object' &&
      agentModel.provider &&
      agentModel.model &&
      providerSet.has(String(agentModel.provider))
    ) {
      return { provider: String(agentModel.provider), model: String(agentModel.model) }
    }
    const session = (ctx.sessions ?? ctx.get?.('sessions'))?.get?.(sessionId)
    const header = session?.header
    if (header?.provider && header?.model && providerSet.has(String(header.provider))) {
      return { provider: String(header.provider), model: String(header.model) }
    }
  }

  // 2. Discover from ctx.llm.listProviders() + listModels()
  const candidates: Array<{ provider: string; model: string }> = []
  for (const p of providers) {
    try {
      const models = await llm.listModels(p)
      if (Array.isArray(models)) {
        for (const item of models) {
          const id = typeof item === 'string' ? item : item?.id ?? item?.model
          if (typeof id === 'string' && id) {
            candidates.push({ provider: p, model: id })
          }
        }
      }
    } catch {}
  }

  if (candidates.length === 0) {
    throw new Error('未发现可用的宿主模型路由，请在设置中配置自定义翻译 API 或指定模型路由')
  }

  // Prefer fast flash/mini/lite models for instant translation response
  const fast = candidates.find(c => /flash|mini|lite|haiku|fast/i.test(c.model))
  return fast ?? candidates[0]!
}

export async function translateExcerpt(
  ctx: any,
  sessionId: string | undefined,
  settings: PaperCoachSettings,
  input: TranslateInput
): Promise<TranslateOutput> {
  if (!input.text || !input.text.trim()) {
    throw new Error('待翻译文本不能为空')
  }
  const clipped = input.text.trim().slice(0, 8000)
  const cleanedSource = cleanPdfSourceText(clipped)
  const prompt = buildAcademicTranslationPrompt({ ...input, text: clipped }, settings.targetLanguage)
  const mode = input.modeOverride ?? (settings.translationMode === 'custom_api' ? 'custom_api' : 'host_model')

  if (mode === 'custom_api') {
    if (!settings.customApiKey || !settings.customApiKey.trim()) {
      throw new Error('尚未填写自定义翻译 API Key，请在侧边栏或论文伴读设置中填写 API Key，或切换为宿主模型翻译')
    }
    return callOpenAiCompatible({
      baseUrl: settings.customApiBaseUrl || 'https://api.openai.com/v1',
      apiKey: settings.customApiKey.trim(),
      model: settings.customApiModel || 'gpt-4o-mini',
      prompt,
      sourceText: cleanedSource,
      inputMeta: input,
      defaultLang: settings.targetLanguage,
      signal: input.signal,
    })
  }

  const llm = ctx.llm ?? ctx.get?.('llm')
  if (!llm || typeof llm.stream !== 'function') {
    if (settings.customApiKey?.trim()) {
      return callOpenAiCompatible({
        baseUrl: settings.customApiBaseUrl || 'https://api.openai.com/v1',
        apiKey: settings.customApiKey.trim(),
        model: settings.customApiModel || 'gpt-4o-mini',
        prompt,
        sourceText: cleanedSource,
        inputMeta: input,
        defaultLang: settings.targetLanguage,
        signal: input.signal,
      })
    }
    throw new Error('当前环境无法调用宿主模型，请配置自定义翻译 API')
  }

  const route = await resolveHostModelRoute(ctx, sessionId, settings.hostModelRoute)
  let output = ''
  const stream = llm.stream({
    provider: route.provider,
    model: route.model,
    messages: [
      {
        id: randomUUID(),
        role: 'user',
        content: [{ type: 'text', text: prompt }],
        source: { kind: 'user' },
      },
    ],
    signal: input.signal,
  })

  for await (const chunk of stream) {
    if (input.signal?.aborted) throw new Error('翻译已取消')
    if (chunk && chunk.type === 'text-delta' && typeof chunk.text === 'string') {
      output += chunk.text
    } else if (chunk && chunk.type === 'finish' && chunk.reason?.kind === 'error') {
      throw new Error(chunk.reason.failure?.message || '宿主模型流式翻译失败')
    } else if (chunk && chunk.type === 'error') {
      throw new Error(chunk.error?.message || chunk.message || '宿主模型流式翻译失败')
    }
  }

  const trimmed = output.trim()
  if (!trimmed) {
    throw new Error(`模型 (${route.provider}/${route.model}) 未返回译文内容`)
  }
  return {
    translation: trimmed,
    providerUsed: route.provider,
    modelUsed: route.model,
  }
}
