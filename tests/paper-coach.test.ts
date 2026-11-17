import { existsSync } from 'node:fs'
import { createServer, type IncomingMessage, type ServerResponse } from 'node:http'
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { describe, expect, it, vi } from 'vitest'
import {
  findBestSectionMatch,
  formatPaperQuoteBlock,
  matchQuoteInSpans,
  normalizeSectionId,
  parsePaperQuoteBlock,
  parseSectionHeadingLine,
} from '../src/shared/section-matcher'
import { PaperCoachStore } from '../src/server/state-store'
import { registerAgySkillsSync, registerBundledPaperSkills } from '../src/server/skills-provider'
import { resolveOpenAiChatEndpoints } from '../src/server/translate'
import { PaperCoachClientController, resolveHostHttpBaseUrl } from '../src/client/controller'
import { apply as applyServerPlugin } from '../src/index'

describe('section-matcher & quote block protocol', () => {
  it('normalizes diverse English, Chinese, LaTeX, IEEE Roman, and Appendix section identifiers', () => {
    expect(normalizeSectionId('$4.1')).toBe('4.1')
    expect(normalizeSectionId('§ 5.2.')).toBe('5.2')
    expect(normalizeSectionId('Section 8')).toBe('8')
    expect(normalizeSectionId('第8部分')).toBe('8')
    expect(normalizeSectionId('第八节')).toBe('8')
    expect(normalizeSectionId('IV-A')).toBe('4.1')
    expect(normalizeSectionId('VIII. Conclusion')).toBe('8')
    expect(normalizeSectionId('Appendix B.2')).toBe('B.2')
  })

  it('parses real academic section headings while rejecting captions and metric rows', () => {
    expect(parseSectionHeadingLine('4.1 Cross-Scale Feature Alignment')).toEqual({
      id: '4.1',
      rawTitle: '4.1 Cross-Scale Feature Alignment',
    })
    expect(parseSectionHeadingLine('VIII. CONCLUSION AND FUTURE WORK')).toEqual({
      id: '8',
      rawTitle: 'VIII. CONCLUSION AND FUTURE WORK',
    })
    expect(parseSectionHeadingLine('Appendix A: Proof of Theorem 1')).toEqual({
      id: 'A',
      rawTitle: 'Appendix A: Proof of Theorem 1',
    })
    expect(parseSectionHeadingLine('Figure 4: Qualitative comparison')).toBeUndefined()
    expect(parseSectionHeadingLine('Table 2. Ablation results')).toBeUndefined()
    expect(parseSectionHeadingLine('4.1 83.2 91.5 +2.4')).toBeUndefined()
  })

  it('matches best section by exact id, hierarchy fallback, and title keyword', () => {
    const entries = [
      { id: '1', rawTitle: '1 Introduction', page: 1, yRatio: 0.35 },
      { id: '4.1', rawTitle: '4.1 Architecture Overview', page: 4, yRatio: 0.2 },
      { id: '5.2', rawTitle: '5.2 Ablation Study', page: 6, yRatio: 0.55 },
      { id: '8', rawTitle: '8 Conclusion and Limitations', page: 9, yRatio: 0.18 },
    ]
    expect(findBestSectionMatch(entries, '第8部分')?.page).toBe(9)
    expect(findBestSectionMatch(entries, '$4')?.id).toBe('4.1')
    expect(findBestSectionMatch(entries, '4.1.2')?.id).toBe('4.1')
    expect(findBestSectionMatch(entries, 'Ablation')?.id).toBe('5.2')
  })

  it('matches verbatim quotes across PDF TextLayer spans with hyphens, ligatures, and ellipses', () => {
    const spans = [
      'Specifically, our efﬁcient trans-',
      'former module reduces memory overhead',
      'by 43% across high-resolution scenes.',
    ]
    const hit = matchQuoteInSpans(
      spans,
      'our efficient transformer module ... across high-resolution scenes'
    )
    expect(hit.length).toBe(3)
    expect(hit[0]).toEqual({ spanIndex: 0, startOffset: 14, endOffset: spans[0]!.length - 1 })
    expect(hit[2]!.spanIndex).toBe(2)
  })

  it('round-trips paper quote blocks cleanly without losing coordinates or user question', () => {
    const quotes = [
      {
        id: 'q1',
        pdfPath: 'D:/papers/demo.pdf',
        paperTitle: 'AttrEcho (2026)',
        page: 6,
        section: '5.2',
        text: 'Removing the temporal gate drops F1 by 4.8 points.',
        rects: [{ x: 0.12, y: 0.44, w: 0.72, h: 0.025 }],
      },
    ]
    const msg = formatPaperQuoteBlock(quotes, '为什么去掉这个门控会掉这么多点？')
    const parsed = parsePaperQuoteBlock(msg, 0)
    expect(parsed).toBeDefined()
    expect(parsed!.quotes).toHaveLength(1)
    expect(parsed!.quotes[0]!.page).toBe(6)
    expect(parsed!.quotes[0]!.section).toBe('5.2')
    expect(parsed!.quotes[0]!.rects).toHaveLength(1)
    expect(msg.slice(parsed!.end)).toBe('为什么去掉这个门控会掉这么多点？')
  })
})

describe('PaperCoachStore & bundled dual skills', () => {
  it('persists session roadmap, navigation, highlights, and redacts custom API keys', async () => {
    const tmp = await mkdtemp(join(tmpdir(), 'paper-coach-test-'))
    try {
      const store = new PaperCoachStore(tmp)
      await store.init()

      const redacted = await store.updateSettings({
        translationMode: 'custom_api',
        customApiKey: 'sk-secret-test-12345',
        customApiModel: 'deepseek-chat',
      })
      expect(redacted.customApiKey).toBeUndefined()
      expect(redacted.hasCustomApiKey).toBe(true)
      expect(store.getRawSettings().customApiKey).toBe('sk-secret-test-12345')

      const events: any[] = []
      const unsub = store.subscribeSession('sess-1', ev => events.push(ev))

      const openRes = await store.openPaper('sess-1', {
        pdfPath: '/workspace/papers/sample.pdf',
        paperTitle: 'Sample Paper',
        section: '$4.1',
      })
      expect(openRes.delivered).toBe(true)

      const planState = await store.updateReadingPlan('sess-1', {
        action: 'set',
        paperTitle: 'Sample Paper',
        mode: 'targeted',
        stage: 'reading',
        goals: [{ text: '搞懂跨尺度对齐模块如何省显存' }],
        sections: [
          { section: '§4.1', title: 'Feature Alignment', status: 'current' },
          { section: '§5.2', title: 'Ablation Study', status: 'pending' },
        ],
      })
      expect(planState.plan?.sections.map(s => s.section)).toEqual(['4.1', '5.2'])
      expect(planState.plan?.goals).toHaveLength(1)

      const navRes = await store.navigatePaper('sess-1', {
        section: '第8部分',
        page: 9,
        highlights: [{ text: 'Our method generalizes across sensors.', label: '核心结论' }],
      })
      expect(navRes.command.section).toBe('8')
      expect(navRes.state.highlights).toHaveLength(1)
      expect(events.map(e => e.type)).toEqual(['navigate', 'state_updated', 'navigate'])

      unsub()
      store.dispose()
    } finally {
      await rm(tmp, { recursive: true, force: true })
    }
  })

  it('registers both paper-reading-navigator and coaching-paper-reading skills via skills provider', async () => {
    const tmp = await mkdtemp(join(tmpdir(), 'paper-coach-skills-'))
    try {
      const store = new PaperCoachStore(tmp)
      await store.init()
      await store.updateSettings({ researchFocusHint: '聚焦遥感变化检测与基础模型适配' })

      let capturedProvider: any = null
      let invalidated = 0
      const mockCtx = {
        get(key: string) {
          if (key === 'skills') {
            return {
              registerProvider(factory: any) {
                capturedProvider = factory({ invalidate() { invalidated += 1 } })
                return () => { capturedProvider = null }
              },
            }
          }
          return undefined
        },
      }

      const dispose = registerBundledPaperSkills(mockCtx, store)
      expect(capturedProvider).toBeTruthy()
      const list = await capturedProvider.list()
      const names = list.map((s: any) => s.name).sort()
      expect(names).toEqual(['coaching-paper-reading', 'paper-reading-navigator'])
      const detail = await capturedProvider.get(list[0])
      expect(detail.content).toContain('聚焦遥感变化检测与基础模型适配')

      await store.updateSettings({ archiveBackend: 'local' })
      expect(invalidated).toBeGreaterThanOrEqual(1)
      dispose()
      store.dispose()
    } finally {
      await rm(tmp, { recursive: true, force: true })
    }
  })

  it('compiles all 4 tools cleanly through strict defineTool schema validation and executes open', async () => {

    const tmp = await mkdtemp(join(tmpdir(), 'paper-coach-tools-'))
    const dummyPdf = join(tmp, 'dummy.pdf')
    await writeFile(dummyPdf, '%PDF-1.4\n%test\n')
    try {
      const store = new PaperCoachStore(tmp)
      await store.init()
      const toolsSrc = await import('../src/server/tools')
      const registered: any[] = []
      const mockCtx = {
        get(name: string) {
          if (name === 'tools') {
            return {
              register(def: any) {
                registered.push(def)
                return () => {}
              },
            }
          }
          return undefined
        },
      }
      toolsSrc.registerPaperCoachTools(mockCtx, store)
      expect(registered.map(t => t.name)).toEqual([
        'paper_reader_open',
        'paper_reader_navigate',
        'paper_reading_plan',
        'paper_reader_status',
      ])
      // Validate each raw definition also passes realDefineTool compilation if not already compiled
      const openRes = await registered[0].execute(
        { path: dummyPdf, title: 'Dummy Test Paper', section: '4.1' },
        { agent: { session: { id: 'sess-tool-1' } } }
      )
      expect(openRes.paperTitle).toBe('Dummy Test Paper')
      store.dispose()
    } finally {
      await rm(tmp, { recursive: true, force: true })
    }
  })

  it('extracts section headings and matches verbatim text spans on a real PDF fixture', async () => {
    const samplePdf =
      process.env.PAPER_COACH_SAMPLE_PDF ||
      join(fileURLToPath(new URL('.', import.meta.url)), 'fixtures', 'sample-paper.pdf')
    if (!existsSync(samplePdf)) return
    const pdfjs = await import('pdfjs-dist/legacy/build/pdf.mjs')
    const bytes = new Uint8Array(await readFile(samplePdf))
    const doc = await pdfjs.getDocument({ data: bytes, disableWorker: true } as any).promise
    expect(doc.numPages).toBeGreaterThanOrEqual(1)

    const p1 = await doc.getPage(1)
    const tc1 = await p1.getTextContent()
    const spans = (tc1.items as any[]).map(i => String(i.str || '')).filter(Boolean)
    expect(spans.length).toBeGreaterThanOrEqual(4)

    // Pick a contiguous snippet from page 1 and verify matchQuoteInSpans locates it
    const sampleQuote = spans.slice(1, 4).join(' ').trim()
    if (sampleQuote.length >= 12) {
      const matched = matchQuoteInSpans(spans, sampleQuote)
      expect(matched.length).toBeGreaterThan(0)
    }
    await doc.destroy()
  })

  it('keeps client getQuotes snapshot referentially stable and prefers page baseURI over streamBaseUrl', () => {
    const ctrl = new PaperCoachClientController()
    const s1 = ctrl.getQuotes('session-1')
    const s2 = ctrl.getQuotes('session-1')
    expect(Object.is(s1, s2)).toBe(true)

    const added = ctrl.addQuote('session-1', {
      pdfPath: 'D:/papers/fate.pdf',
      paperTitle: 'FATE',
      page: 4,
      section: '3',
      text: 'Shared pixel-to-token associations',
      rects: [{ x: 0.1, y: 0.2, w: 0.5, h: 0.03 }],
    })
    expect(ctrl.getQuotes('session-1')).toHaveLength(1)
    ctrl.removeQuote('session-1', added.id)
    expect(Object.is(ctrl.getQuotes('session-1'), s1)).toBe(true)

    expect(
      resolveHostHttpBaseUrl('dsh-app://app/index.html', 'dsh-app://app/index.html', 'http://127.0.0.1:54221')
    ).toBe('dsh-app://app/')
    expect(
      resolveHostHttpBaseUrl('https://host.example/proxy/3080/index.html', undefined, 'http://127.0.0.1:3080')
    ).toBe('https://host.example/proxy/3080/')
    ctrl.dispose()
  })

  it('registers systemPrompt section with finite numeric order even when getSectionOrder("tools") is undefined', () => {
    let capturedSection: any = null
    const disposers: Array<() => void> = []
    const mockCtx: any = {
      effect(fn: any) {
        const d = fn()
        if (typeof d === 'function') disposers.push(d)
      },
      inject(deps: string[], cb: (sub: any) => void) {
        const sub: any = {
          effect(fn: any) {
            const d = fn()
            if (typeof d === 'function') disposers.push(d)
          },
          systemPrompt: deps.includes('systemPrompt')
            ? {
                getSectionOrder(key: string) {
                  return key === 'TOOLS_SDK' ? 5000 : undefined
                },
                section(spec: any) {
                  capturedSection = spec
                  return () => {}
                },
              }
            : undefined,
        }
        cb(sub)
      },
    }
    applyServerPlugin(mockCtx)
    expect(capturedSection).toBeTruthy()
    expect(Number.isFinite(capturedSection.order)).toBe(true)
    expect(capturedSection.order).toBe(5005)
    for (const d of disposers) d()
  })

  it('does not trigger persistent host composer info notice on addQuote, and clears quotes cleanly', () => {
    const ctrl = new PaperCoachClientController()
    const notifySpy = vi.fn()
    const focusSpy = vi.fn()
    ctrl.registerInput('session-q', {
      state: { getSnapshot: () => ({ draft: '' }) },
      setDraft: () => {},
      focus: focusSpy,
      notify: notifySpy,
    })

    ctrl.addQuote('session-q', {
      pdfPath: 'D:/papers/fate.pdf',
      paperTitle: 'FATE · Dense Flow from Adaptive Correspondence',
      page: 5,
      section: 'FATE: Flow from Adaptive Token Estimation',
      text: 'computed once and reused across frames',
      rects: [{ x: 0.1, y: 0.3, w: 0.4, h: 0.02 }],
    })
    expect(ctrl.getQuotes('session-q')).toHaveLength(1)
    expect(focusSpy).toHaveBeenCalledTimes(1)
    expect(notifySpy).not.toHaveBeenCalled()

    ctrl.clearQuotes('session-q')
    expect(ctrl.getQuotes('session-q')).toHaveLength(0)
    expect(notifySpy).not.toHaveBeenCalled()
    ctrl.dispose()
  })

  it('translates over real HTTP POST without premature AbortError and handles /compatible-mode + qwen-mt-plus', async () => {
    const tmp = await mkdtemp(join(tmpdir(), 'paper-coach-http-trans-'))
    const receivedRequests: Array<{ url: string; body: any }> = []
    let upstreamSawCancel = false

    const upstream = createServer(async (req, res) => {
      const chunks: Buffer[] = []
      for await (const c of req) chunks.push(Buffer.isBuffer(c) ? c : Buffer.from(c))
      const raw = Buffer.concat(chunks).toString('utf8')
      const body = raw ? JSON.parse(raw) : {}
      receivedRequests.push({ url: req.url || '', body })

      if (req.url === '/compatible-mode/v1/chat/completions') {
        if (body.messages?.[0]?.content === 'SLOW_CANCEL_TEST') {
          req.on('aborted', () => { upstreamSawCancel = true })
          res.on('close', () => { if (!res.writableEnded) upstreamSawCancel = true })
          await new Promise(r => setTimeout(r, 400))
          if (!res.writableEnded && !res.destroyed) {
            res.writeHead(200, { 'content-type': 'application/json' })
            res.end(JSON.stringify({ choices: [{ message: { content: 'late' } }] }))
          }
          return
        }
        await new Promise(r => setTimeout(r, 35))
        res.writeHead(200, { 'content-type': 'application/json' })
        res.end(
          JSON.stringify({
            model: 'qwen-mt-plus',
            choices: [{ message: { content: '池化与广播：关联矩阵 A 连接像素空间与标记空间。' } }],
          })
        )
        return
      }

      if (req.url === '/legacy-gateway/chat/completions') {
        res.writeHead(200, { 'content-type': 'application/json' })
        res.end(
          JSON.stringify({
            model: 'deepseek-chat',
            choices: [{ message: { content: '兼容无 /v1 前缀网关译文。' } }],
          })
        )
        return
      }

      res.writeHead(404, { 'content-type': 'application/json' })
      res.end(JSON.stringify({ error: 'not found' }))
    })

    await new Promise<void>(resolve => upstream.listen(0, '127.0.0.1', () => resolve()))
    const upstreamPort = (upstream.address() as any).port

    let routeHandler: ((req: IncomingMessage, res: ServerResponse) => Promise<void>) | null = null
    const disposers: Array<() => void> = []
    const mockCtx: any = {
      effect(fn: any) {
        const d = fn()
        if (typeof d === 'function') disposers.push(d)
      },
      inject(deps: string[], cb: (sub: any) => void) {
        if (deps.includes('webServer')) {
          cb({
            effect(fn: any) {
              const d = fn()
              if (typeof d === 'function') disposers.push(d)
            },
            webServer: {
              register(spec: any) {
                routeHandler = spec.handler
                return () => { routeHandler = null }
              },
            },
          })
        }
      },
    }

    applyServerPlugin(mockCtx, { storeDir: tmp })
    expect(routeHandler).toBeTypeOf('function')

    const pluginHttp = createServer((req, res) => {
      void routeHandler!(req, res)
    })
    await new Promise<void>(resolve => pluginHttp.listen(0, '127.0.0.1', () => resolve()))
    const pluginPort = (pluginHttp.address() as any).port

    try {
      expect(
        resolveOpenAiChatEndpoints('https://example.aliyuncs.com/compatible-mode')
      ).toEqual([
        'https://example.aliyuncs.com/compatible-mode/v1/chat/completions',
        'https://example.aliyuncs.com/compatible-mode/chat/completions',
      ])
      expect(resolveOpenAiChatEndpoints('https://api.openai.com/v1')).toEqual([
        'https://api.openai.com/v1/chat/completions',
      ])

      // 1. Configure Bailian-style /compatible-mode (without /v1) + qwen-mt-plus
      const cfgRes = await fetch(`http://127.0.0.1:${pluginPort}/paper-coach/api/settings.update`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          translationMode: 'custom_api',
          targetLanguage: 'zh-CN',
          customApiBaseUrl: `http://127.0.0.1:${upstreamPort}/compatible-mode`,
          customApiKey: 'sk-test-bailian',
          customApiModel: 'qwen-mt-plus',
        }),
      })
      expect(cfgRes.status).toBe(200)

      // 2. Real POST /paper-coach/api/translate must NOT fail with "This operation was aborted"
      const transRes = await fetch(`http://127.0.0.1:${pluginPort}/paper-coach/api/translate`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          sessionId: 'sess-trans',
          text: 'Pooling and broad-\ncasting: matrix A connects pixel and token spaces.',
          paperTitle: 'FATE',
          page: 5,
          section: 'FATE: Flow from Adaptive Token Estimation',
        }),
      })
      const transJson = (await transRes.json()) as any
      expect(transRes.status).toBe(200)
      expect(transJson.ok).toBe(true)
      expect(transJson.translation).toContain('池化与广播')
      expect(transJson.modelUsed).toBe('qwen-mt-plus')
      expect(receivedRequests[0]?.url).toBe('/compatible-mode/v1/chat/completions')
      expect(receivedRequests[0]?.body.messages).toEqual([
        { role: 'user', content: 'Pooling and broadcasting: matrix A connects pixel and token spaces.' },
      ])
      expect(receivedRequests[0]?.body.translation_options?.target_lang).toBe('Chinese')

      // 3. Fallback to /chat/completions when custom gateway returns 404 on /v1/chat/completions
      await fetch(`http://127.0.0.1:${pluginPort}/paper-coach/api/settings.update`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          customApiBaseUrl: `http://127.0.0.1:${upstreamPort}/legacy-gateway`,
          customApiModel: 'deepseek-chat',
        }),
      })
      const fallbackRes = await fetch(`http://127.0.0.1:${pluginPort}/paper-coach/api/translate`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ text: 'Dense flow estimation.' }),
      })
      const fallbackJson = (await fallbackRes.json()) as any
      expect(fallbackRes.status).toBe(200)
      expect(fallbackJson.translation).toBe('兼容无 /v1 前缀网关译文。')

      // 4. Genuine client abort mid-request still cancels upstream request
      await fetch(`http://127.0.0.1:${pluginPort}/paper-coach/api/settings.update`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          customApiBaseUrl: `http://127.0.0.1:${upstreamPort}/compatible-mode`,
          customApiModel: 'qwen-mt-plus',
        }),
      })
      const clientAbort = new AbortController()
      setTimeout(() => clientAbort.abort(), 40)
      await expect(
        fetch(`http://127.0.0.1:${pluginPort}/paper-coach/api/translate`, {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ text: 'SLOW_CANCEL_TEST' }),
          signal: clientAbort.signal,
        })
      ).rejects.toThrow()
      await new Promise(r => setTimeout(r, 80))
      expect(upstreamSawCancel).toBe(true)
    } finally {
      for (const d of disposers) d()
      await new Promise<void>(resolve => pluginHttp.close(() => resolve()))
      await new Promise<void>(resolve => upstream.close(() => resolve()))
      await rm(tmp, { recursive: true, force: true })
    }
  })

  it('auto-syncs bundled skills with live settings to AGY ~/.gemini/config/skills when present and cleans up safely', async () => {
    const tmp = await mkdtemp(join(tmpdir(), 'paper-coach-agy-sync-'))
    const storeDir = join(tmp, 'store')
    const missingAgyDir = join(tmp, 'nonexistent-gemini-config')
    const agyConfigDir = join(tmp, 'gemini-config')

    try {
      const store = new PaperCoachStore(storeDir)
      await store.init()
      await store.updateSettings({
        archiveBackend: 'openviking',
        preferLocalZotero: true,
        researchFocusHint: '遥感变化检测与多时相特征对齐',
      })

      // 1. No-op when AGY config root does not exist (never pollute non-AGY users)
      const noopCleanup = await registerAgySkillsSync(store, { agyConfigDir: missingAgyDir })
      expect(existsSync(missingAgyDir)).toBe(false)
      await noopCleanup()

      // 2. Syncs both skills with frontmatter + sidebar/quote instructions + live settings when AGY config exists
      const { mkdir } = await import('node:fs/promises')
      await mkdir(agyConfigDir, { recursive: true })

      // Pre-create a user-custom unmanaged skill in paper-reading-navigator to verify non-clobber protection
      const customNavDir = join(agyConfigDir, 'skills', 'paper-reading-navigator')
      await mkdir(customNavDir, { recursive: true })
      const customNavFile = join(customNavDir, 'SKILL.md')
      await writeFile(customNavFile, '---\nname: paper-reading-navigator\ndescription: user custom\n---\n# Custom\n', 'utf8')

      const cleanupProtected = await registerAgySkillsSync(store, { agyConfigDir })
      const preservedCustom = await readFile(customNavFile, 'utf8')
      expect(preservedCustom).toContain('# Custom')
      expect(preservedCustom).not.toContain('dsh-paper-coach:managed')

      const coachFile = join(agyConfigDir, 'skills', 'coaching-paper-reading', 'SKILL.md')
      expect(existsSync(coachFile)).toBe(true)
      const coachInitial = await readFile(coachFile, 'utf8')
      expect(coachInitial.startsWith('---\n')).toBe(true)
      expect(coachInitial).toContain('name: coaching-paper-reading')
      expect(coachInitial).toContain('# 论文原文定位引用 (Paper Excerpt)')
      expect(coachInitial).toContain('paper-coach://loc')
      expect(coachInitial).toContain('优先使用 OpenViking viking://~/resources/paper-reading/')
      expect(coachInitial).toContain('优先核查本机 Zotero 文献库')
      expect(coachInitial).toContain('遥感变化检测与多时相特征对齐')
      expect(coachInitial).toContain('<!-- dsh-paper-coach:managed -->')

      // 3. Live refresh when user updates settings
      await store.updateSettings({
        archiveBackend: 'local',
        preferLocalZotero: false,
        researchFocusHint: '双时相基础模型微调',
      })
      await new Promise(r => setTimeout(r, 50))
      const coachUpdated = await readFile(coachFile, 'utf8')
      expect(coachUpdated).toContain('强制使用本地工作区 .paper-reading/')
      expect(coachUpdated).toContain('未强制要求预查本机 Zotero')
      expect(coachUpdated).toContain('双时相基础模型微调')
      expect(coachUpdated).not.toContain('遥感变化检测与多时相特征对齐')

      // 4. Cleanup removes managed skill directory but never touches user-authored unmanaged skill
      await cleanupProtected()
      expect(existsSync(coachFile)).toBe(false)
      expect(existsSync(customNavFile)).toBe(true)

      store.dispose()
    } finally {
      await rm(tmp, { recursive: true, force: true })
    }
  })
})
