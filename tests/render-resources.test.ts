import { describe, expect, it } from 'vitest'
import { PdfPageCache, PdfRenderQueue } from '../src/client/render-resources'

describe('PDF resource budgets', () => {
  it('evicts least recently used inactive pages but keeps current pages', () => {
    const cache = new PdfPageCache(2, 100)
    const evicted: number[] = []
    cache.setActive(1, true)
    cache.retain(1, 10, () => evicted.push(1))
    cache.retain(2, 10, () => evicted.push(2))
    cache.retain(3, 10, () => evicted.push(3))
    expect(evicted).toEqual([2])
    cache.setActive(1, false)
    cache.touch(1)
    cache.retain(4, 10, () => evicted.push(4))
    expect(evicted).toEqual([2, 3])
  })
  it('enforces a bitmap budget and releases protection when a page is hidden', () => {
    const cache = new PdfPageCache(8, 20)
    const evicted: number[] = []
    cache.setActive(1, true); cache.setActive(2, true)
    cache.retain(1, 15, () => evicted.push(1)); cache.retain(2, 15, () => evicted.push(2))
    expect(evicted).toEqual([])
    cache.setActive(1, false)
    expect(evicted).toEqual([1])
  })
  it('serializes expensive work to the concurrency budget and skips aborted queued jobs', async () => {
    const queue = new PdfRenderQueue(2)
    const started: number[] = []; const finish: Array<() => void> = []
    const job = (n: number) => async () => { started.push(n); await new Promise<void>(r => finish.push(r)) }
    const a = queue.run(new AbortController().signal, job(1))
    const b = queue.run(new AbortController().signal, job(2))
    const abort = new AbortController()
    const c = queue.run(abort.signal, job(3)).catch(() => {})
    const d = queue.run(new AbortController().signal, job(4))
    await Promise.resolve(); expect(started).toEqual([1, 2])
    abort.abort(); finish[0]!(); await a; await Promise.resolve()
    expect(started).toEqual([1, 2, 4])
    finish[1]!(); finish[2]!(); await Promise.all([b, c, d])
  })
})
