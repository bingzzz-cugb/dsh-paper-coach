/** Per-document budgets. Active pages are protected; off-screen pages are evicted in LRU order. */
export class PdfPageCache {
  private pages = new Map<number, { pixels: number; evict: () => void }>()
  private active = new Set<number>()
  constructor(private maxPages = 8, private maxPixels = 24 * 1024 * 1024) {}
  setActive(page: number, active: boolean): void {
    if (active) { this.active.add(page); this.touch(page) } else this.active.delete(page)
    this.trim()
  }
  touch(page: number): void {
    const entry = this.pages.get(page)
    if (entry) { this.pages.delete(page); this.pages.set(page, entry) }
  }
  retain(page: number, pixels: number, evict: () => void): void {
    this.pages.delete(page); this.pages.set(page, { pixels, evict }); this.trim()
  }
  forget(page: number): void { this.pages.delete(page); this.active.delete(page) }
  private trim(): void {
    let pixels = [...this.pages.values()].reduce((n, p) => n + p.pixels, 0)
    for (const [page, entry] of this.pages) {
      if (this.pages.size <= this.maxPages && pixels <= this.maxPixels) break
      if (this.active.has(page)) continue
      this.pages.delete(page); pixels -= entry.pixels; entry.evict()
    }
  }
}

/** Keep canvas and text-layer creation from saturating the main thread. */
export class PdfRenderQueue {
  private running = 0
  private pending: Array<() => void> = []
  constructor(private concurrency = 2) {}
  run(signal: AbortSignal, work: () => Promise<void>): Promise<void> {
    return new Promise((resolve, reject) => {
      if (signal.aborted) { reject(signal.reason); return }
      const cancelQueued = () => {
        const i = this.pending.indexOf(start)
        if (i >= 0) this.pending.splice(i, 1)
        reject(signal.reason)
      }
      const start = () => {
        signal.removeEventListener('abort', cancelQueued)
        if (signal.aborted) { reject(signal.reason); return }
        this.running++
        Promise.resolve().then(work).then(() => {
          this.running--; this.drain(); resolve()
        }, error => {
          this.running--; this.drain(); reject(error)
        })
      }
      signal.addEventListener('abort', cancelQueued, { once: true })
      this.pending.push(start); this.drain()
    })
  }
  private drain(): void {
    while (this.running < this.concurrency && this.pending.length) this.pending.shift()!()
  }
}
