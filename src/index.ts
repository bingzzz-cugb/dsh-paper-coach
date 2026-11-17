import { createReadStream } from 'node:fs'
import { readFile, stat } from 'node:fs/promises'
import { pipeline } from 'node:stream/promises'
import { isAbsolute, resolve } from 'node:path'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import type { IncomingMessage, ServerResponse } from 'node:http'
import { PaperCoachStore } from './server/state-store'
import { registerBundledPaperSkills } from './server/skills-provider'
import { registerPaperCoachTools } from './server/tools'
import { translateExcerpt } from './server/translate'

export const name = 'dsh-paper-coach'

function writeJson(res: ServerResponse, status: number, body: unknown): void {
  if (res.headersSent) return
  const payload = JSON.stringify(body)
  res.writeHead(status, {
    'content-type': 'application/json; charset=utf-8',
    'cache-control': 'no-store',
  })
  res.end(payload)
}

async function readJsonBody(req: IncomingMessage, maxBytes = 512 * 1024): Promise<any> {
  const chunks: Buffer[] = []
  let total = 0
  for await (const chunk of req) {
    const buf = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk)
    total += buf.length
    if (total > maxBytes) throw new Error('Request body too large')
    chunks.push(buf)
  }
  const raw = Buffer.concat(chunks).toString('utf8')
  return raw.trim() ? JSON.parse(raw) : {}
}

export function apply(ctx: any, options?: { storeDir?: string }): void {
  const store = new PaperCoachStore(options?.storeDir)
  void store.init()

  ctx.effect(() => () => store.dispose())

  if (typeof ctx.inject === 'function') {
    ctx.inject(['skills'], (sctx: any) => {
      const off = registerBundledPaperSkills(sctx, store)
      sctx.effect(() => off)
    })
    ctx.inject(['tools'], (tctx: any) => {
      const off = registerPaperCoachTools(tctx, store)
      tctx.effect(() => off)
    })
    ctx.inject(['systemPrompt'], (spCtx: any) => {
      const sp = spCtx.systemPrompt ?? spCtx.get?.('systemPrompt')
      if (!sp || typeof sp.section !== 'function') return
      const rawOrder =
        typeof sp.getSectionOrder === 'function'
          ? (sp.getSectionOrder('TOOLS_SDK') ?? sp.getSectionOrder('MCP_SERVERS') ?? sp.getSectionOrder('tools'))
          : undefined
      const order = typeof rawOrder === 'number' && Number.isFinite(rawOrder) ? rawOrder + 5 : 5005
      const off = sp.section({
        name: 'dsh-paper-coach',
        order,
        text: [
          '## Academic Paper Sidebar & Reading Panel (dsh-paper-coach)',
          '- When starting or resuming close reading of a local cached PDF paper, call paper_reader_open to open it automatically in the right sidebar, and call paper_reading_plan to display agreed reading sections (e.g. §4.1, §5.2) and learning goals in the floating panel.',
          '- When answering questions about a specific section or sentence of the open paper, call paper_reader_navigate to scroll the sidebar PDF to that section/page and highlight 1-3 key verbatim sentences, and include clickable location badges like [📍 §8 · p.9](paper-coach://loc?section=8&page=9&q=first%20few%20words) in your explanation.',
          '- User messages starting with "# 论文原文定位引用 (Paper Excerpt)" come from the user selecting text directly inside the sidebar PDF reader with exact page and section coordinates.',
        ].join('\n'),
      })
      spCtx.effect(() => off)
    })
  } else {
    ctx.effect(() => registerBundledPaperSkills(ctx, store))
    ctx.effect(() => registerPaperCoachTools(ctx, store))
  }

  const registerWebRoutes = (wctx: any) => {
    const webServer = wctx.webServer ?? wctx.get?.('webServer')
    if (!webServer || typeof webServer.register !== 'function') return () => {}

    const activeSseResponses = new Set<ServerResponse>()
    const libDir = dirname(fileURLToPath(import.meta.url))
    const fence = (req: IncomingMessage): boolean => {
      const conn = wctx.get?.('connection') ?? ctx.get?.('connection')
      if (!conn || typeof conn.requestRejection !== 'function') return true
      return conn.requestRejection(req) === undefined
    }

    const offRoute = webServer.register({
      kind: 'prefix',
      path: '/paper-coach',
      handler: async (req: IncomingMessage, res: ServerResponse) => {
        if (!fence(req)) {
          writeJson(res, 403, { ok: false, error: 'forbidden' })
          return
        }

        const parsedUrl = new URL(req.url ?? '/', 'http://dsh.internal')
        const pathname = parsedUrl.pathname

        if (req.method === 'GET' && pathname.startsWith('/paper-coach/assets/')) {
          const assetName = pathname.slice('/paper-coach/assets/'.length)
          if (assetName !== 'pdf-runtime.mjs' && assetName !== 'pdf.worker.mjs') {
            writeJson(res, 404, { ok: false, error: 'unknown asset' })
            return
          }
          try {
            const bytes = await readFile(join(libDir, assetName))
            res.writeHead(200, {
              'content-type': 'text/javascript; charset=utf-8',
              'cache-control': 'public, max-age=3600',
            })
            res.end(bytes)
          } catch (err) {
            writeJson(res, 500, { ok: false, error: String(err) })
          }
          return
        }

        if (req.method === 'GET' && pathname === '/paper-coach/pdf') {
          const rawPath = parsedUrl.searchParams.get('path') || ''
          if (!rawPath || !rawPath.toLowerCase().endsWith('.pdf')) {
            writeJson(res, 400, { ok: false, error: 'valid .pdf path is required' })
            return
          }
          try {
            const absPath = isAbsolute(rawPath) ? resolve(rawPath) : resolve(process.cwd(), rawPath)
            const info = await stat(absPath)
            if (!info.isFile()) {
              writeJson(res, 404, { ok: false, error: 'PDF file not found' })
              return
            }
            const stream = createReadStream(absPath)
            res.writeHead(200, {
              'content-type': 'application/pdf',
              'content-length': String(info.size),
              'cache-control': 'no-cache',
            })
            await pipeline(stream, res)
          } catch (err) {
            if (!res.headersSent) writeJson(res, 404, { ok: false, error: String(err) })
            else res.destroy()
          }
          return
        }
        if (req.method === 'GET' && pathname === '/paper-coach/events') {
          const sessionId = parsedUrl.searchParams.get('sessionId') || ''
          if (!sessionId) {
            writeJson(res, 400, { ok: false, error: 'sessionId is required' })
            return
          }

          res.writeHead(200, {
            'content-type': 'text/event-stream; charset=utf-8',
            'cache-control': 'no-cache, no-transform',
            connection: 'keep-alive',
            'x-accel-buffering': 'no',
          })

          const sendEvent = (event: unknown) => {
            if (res.writableEnded || res.destroyed) return
            res.write('data: ' + JSON.stringify(event) + '\n\n')
          }

          const initialState = await store.getSessionState(sessionId)
          sendEvent({
            type: 'snapshot',
            state: initialState,
            settings: store.getRedactedSettings(),
          })

          const unsub = store.subscribeSession(sessionId, sendEvent)
          const heartbeat = setInterval(() => {
            if (!res.writableEnded && !res.destroyed) {
              res.write(': ping\n\n')
            }
          }, 20000)
          heartbeat.unref?.()

          activeSseResponses.add(res)
          let sseClosed = false
          const cleanupSse = () => {
            if (sseClosed) return
            sseClosed = true
            activeSseResponses.delete(res)
            clearInterval(heartbeat)
            unsub()
          }
          req.on('aborted', cleanupSse)
          res.on('close', cleanupSse)
          return
        }

        if (req.method !== 'POST' || !pathname.startsWith('/paper-coach/api/')) {
          writeJson(res, 404, { ok: false, error: 'not found' })
          return
        }

        const action = pathname.slice('/paper-coach/api/'.length)
        const abortCtrl = new AbortController()
        req.on('aborted', () => abortCtrl.abort())
        res.on('close', () => {
          if (!res.writableEnded) abortCtrl.abort()
        })

        try {
          const body = await readJsonBody(req)
          switch (action) {
            case 'state.get': {
              const sessionId = String(body.sessionId || '')
              if (!sessionId) throw new Error('sessionId is required')
              const state = await store.getSessionState(sessionId)
              writeJson(res, 200, { ok: true, state, settings: store.getRedactedSettings() })
              return
            }
            case 'settings.get': {
              await store.init()
              writeJson(res, 200, { ok: true, settings: store.getRedactedSettings() })
              return
            }
            case 'settings.update': {
              const settings = await store.updateSettings(body ?? {})
              writeJson(res, 200, { ok: true, settings })
              return
            }
            case 'viewport.update': {
              const sessionId = String(body.sessionId || '')
              if (!sessionId || !body.viewport) throw new Error('sessionId and viewport required')
              const state = await store.updateViewport(sessionId, body.viewport)
              writeJson(res, 200, { ok: true, state })
              return
            }
            case 'plan.update': {
              const sessionId = String(body.sessionId || '')
              if (!sessionId) throw new Error('sessionId required')
              const state = await store.updateReadingPlan(sessionId, body)
              writeJson(res, 200, { ok: true, state })
              return
            }
            case 'highlights.clear': {
              const sessionId = String(body.sessionId || '')
              if (!sessionId) throw new Error('sessionId required')
              const state = await store.clearHighlights(sessionId)
              writeJson(res, 200, { ok: true, state })
              return
            }
            case 'translate': {
              await store.init()
              const result = await translateExcerpt(
                ctx,
                typeof body.sessionId === 'string' ? body.sessionId : undefined,
                store.getRawSettings(),
                {
                  text: String(body.text || ''),
                  paperTitle: body.paperTitle,
                  page: body.page,
                  section: body.section,
                  targetLanguage: body.targetLanguage,
                  modeOverride: body.modeOverride,
                  signal: abortCtrl.signal,
                }
              )
              writeJson(res, 200, { ok: true, ...result })
              return
            }
            default:
              writeJson(res, 404, { ok: false, error: 'Unknown action: ' + action })
          }
        } catch (err) {
          writeJson(res, 400, {
            ok: false,
            error: err instanceof Error ? err.message : String(err),
          })
        }
      },
    })
    return () => {
      for (const sseRes of activeSseResponses) {
        try { sseRes.end() } catch {}
      }
      activeSseResponses.clear()
      offRoute?.()
    }
  }

  if (typeof ctx.inject === 'function') {
    ctx.inject(['webServer'], (wctx: any) => {
      const off = registerWebRoutes(wctx)
      wctx.effect(() => off)
    })
  } else {
    ctx.effect(() => registerWebRoutes(ctx))
  }
}
