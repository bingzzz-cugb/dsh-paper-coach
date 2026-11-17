import type { PaperQuotePayload, PaperSectionEntry } from './protocol'

const ROMAN_MAP: Record<string, number> = {
  I: 1, II: 2, III: 3, IV: 4, V: 5, VI: 6,
  VII: 7, VIII: 8, IX: 9, X: 10, XI: 11, XII: 12,
  XIII: 13, XIV: 14, XV: 15,
}

const CN_NUM_MAP: Record<string, number> = {
  一: 1, 二: 2, 三: 3, 四: 4, 五: 5, 六: 6, 七: 7, 八: 8, 九: 9, 十: 10,
  十一: 11, 十二: 12,
}

/**
 * Normalize section references like "$4.1", "§ 5.2.", "Section 8", "第8部分",
 * "IV-A", "VIII. Conclusion", "Appendix B.1" into a canonical id ('4.1', '8', 'B.1').
 */
export function normalizeSectionId(raw: string): string {
  let s = raw.trim()
  if (!s) return ''

  // Chinese pattern: 第8部分 / 第八节 / 第 4.1 节
  const cnMatch = s.match(/^第\s*([0-9]+(?:\.[0-9]+)*|[一二三四五六七八九十]+)\s*(?:部分|节|章|小节)?$/i)
  if (cnMatch) {
    const token = cnMatch[1]!
    if (CN_NUM_MAP[token] !== undefined) return String(CN_NUM_MAP[token])
    return token
  }

  // Strip leading markers: $, §, Sec., Section, Part, Chapter
  s = s.replace(/^(?:[$§]+|sec(?:tion)?\.?|part|chap(?:ter)?\.?)\s*/i, '').trim()

  // Appendix pattern: Appendix A / Appendix A.2
  const appMatch = s.match(/^appendix\s+([A-Z](?:\.[0-9]+)*)\b/i)
  if (appMatch) {
    return appMatch[1]!.toUpperCase()
  }

  // IEEE Roman-Letter pattern: IV-A / VIII / III.B
  const romanSubMatch = s.match(/^(X{0,1}(?:IX|IV|V?I{0,3}))(?:[-.]([A-Z]))?(?:\b|[.\s:]|$)/i)
  if (romanSubMatch && romanSubMatch[1]) {
    const romanUpper = romanSubMatch[1].toUpperCase()
    const num = ROMAN_MAP[romanUpper]
    if (num !== undefined) {
      if (romanSubMatch[2]) {
        const subIdx = romanSubMatch[2].toUpperCase().charCodeAt(0) - 64
        return `${num}.${subIdx}`
      }
      const rest = s.slice(romanSubMatch[0].length).replace(/^[:.\-–—\s]+/, '').trim()
      if (!rest || /^[A-Za-z\u4e00-\u9fa5]/.test(rest)) {
        return String(num)
      }
    }
  }

  // Numeric or Appendix dotted id at start: 4.1, 5.2.1, A.1
  const numMatch = s.match(/^([0-9]+(?:\.[0-9]+)*|[A-Z]\.[0-9]+(?:\.[0-9]+)*)(?:\.?)(?:\s|$|:)/)
  if (numMatch) {
    return numMatch[1]!
  }

  // Single appendix letter: "A"
  if (/^[A-H]$/i.test(s)) {
    return s.toUpperCase()
  }

  return s.replace(/\.+$/, '').trim()
}

const COMMON_UNNUMBERED_HEADINGS: Record<string, string> = {
  abstract: 'Abstract',
  introduction: '1',
  conclusion: 'Conclusion',
  conclusions: 'Conclusion',
  discussion: 'Discussion',
  acknowledgments: 'Acknowledgments',
  acknowledgements: 'Acknowledgments',
  references: 'References',
  appendix: 'Appendix',
}

/**
 * Parse a single candidate heading line from a PDF outline or TextLayer line.
 */
export function parseSectionHeadingLine(line: string): { id: string; rawTitle: string } | undefined {
  const trimmed = line.replace(/\s+/g, ' ').trim()
  if (trimmed.length < 2 || trimmed.length > 140) return undefined

  // Reject figure/table/equation/algorithm captions and citations
  if (/^(?:fig(?:ure)?|tab(?:le)?|eq(?:uation)?|alg(?:orithm)?|lemma|theorem|proposition|corollary|remark)\b/i.test(trimmed)) {
    return undefined
  }
  if (/^\[[0-9,\s-]+\]/.test(trimmed)) return undefined

  // 1. Standard numbered heading: "1 Introduction", "4.1. Method", "8 Conclusion and Future Work"
  const numHeading = trimmed.match(/^([1-9][0-9]?(?:\.[1-9][0-9]?){0,3})\.?\s+([A-Z][A-Za-z0-9\s,:;()\-–—/'"&?]{2,110})$/)
  if (numHeading) {
    const id = numHeading[1]!
    const titleWords = numHeading[2]!.trim()
    // Reject obvious metric rows like "4.1 82.3 91.0"
    if (/^[0-9.\s+-]+$/.test(titleWords)) return undefined
    const topNum = Number(id.split('.')[0])
    if (topNum >= 1 && topNum <= 25) {
      return { id, rawTitle: trimmed }
    }
  }

  // 2. Appendix heading: "Appendix A", "Appendix B: Implementation Details", "A.1 Proof of Lemma"
  const appHeading = trimmed.match(/^(?:Appendix\s+([A-H](?:\.[1-9][0-9]?)?)|([A-H]\.[1-9][0-9]?(?:\.[1-9][0-9]?)?))\.?\s*[:\-–]?\s*([A-Z][A-Za-z0-9\s,:;()\-–—/'"&?]{2,110})?$/i)
  if (appHeading) {
    const rawId = (appHeading[1] || appHeading[2] || '').toUpperCase()
    if (rawId && (appHeading[1] || appHeading[3])) {
      return { id: rawId, rawTitle: trimmed }
    }
  }

  // 3. IEEE Roman heading: "I. INTRODUCTION", "IV-A. Network Architecture", "VIII. CONCLUSION"
  const romanHeading = trimmed.match(/^(X{0,1}(?:IX|IV|V?I{0,3}))(?:[-.]([A-Z]))?\.\s+([A-Z][A-Za-z0-9\s,:;()\-–—/'"&?]{2,110})$/)
  if (romanHeading && romanHeading[1]) {
    const num = ROMAN_MAP[romanHeading[1]]
    if (num !== undefined) {
      const id = romanHeading[2]
        ? `${num}.${romanHeading[2].charCodeAt(0) - 64}`
        : String(num)
      return { id, rawTitle: trimmed }
    }
  }

  // 4. Standalone canonical headings: "Abstract", "References", "Conclusion"
  const lower = trimmed.toLowerCase().replace(/[:.]+$/, '')
  if (COMMON_UNNUMBERED_HEADINGS[lower]) {
    return { id: COMMON_UNNUMBERED_HEADINGS[lower]!, rawTitle: trimmed }
  }

  return undefined
}

/**
 * Find the best matching section entry for a user/model query (e.g. "8", "$4.1", "Conclusion").
 */
export function findBestSectionMatch(
  entries: readonly PaperSectionEntry[],
  query: string
): PaperSectionEntry | undefined {
  if (!entries.length || !query.trim()) return undefined
  const norm = normalizeSectionId(query)
  const lowerQuery = query.trim().toLowerCase()

  // 1. Exact normalized ID match
  const exact = entries.find(e => e.id.toLowerCase() === norm.toLowerCase())
  if (exact) return exact

  // 2. Subsection fallback: if query is "4" and only "4.1" exists, or query is "4.1.2" and "4.1" exists
  const childMatch = entries.find(e => e.id.toLowerCase().startsWith(norm.toLowerCase() + '.'))
  if (childMatch) return childMatch

  if (norm.includes('.')) {
    const parentId = norm.split('.').slice(0, -1).join('.')
    const parentMatch = entries.find(e => e.id.toLowerCase() === parentId.toLowerCase())
    if (parentMatch) return parentMatch
  }

  // 3. Title keyword match (e.g. query = "Conclusion" or "Related Work")
  const keyword = lowerQuery.replace(/^(?:[$§]+|sec(?:tion)?\.?|第|部分|节)\s*/g, '').trim()
  if (keyword.length >= 3) {
    const byTitle = entries.find(e => e.rawTitle.toLowerCase().includes(keyword))
    if (byTitle) return byTitle
  }

  return undefined
}

export interface SpanCharRange {
  spanIndex: number
  startOffset: number
  endOffset: number
}

const LIGATURE_EXPANSIONS: Record<string, string> = {
  '\ufb00': 'ff',
  '\ufb01': 'fi',
  '\ufb02': 'fl',
  '\ufb03': 'ffi',
  '\ufb04': 'ffl',
  '\u2018': "'",
  '\u2019': "'",
  '\u201c': '"',
  '\u201d': '"',
  '\u2013': '-',
  '\u2014': '-',
  '\u00ad': '', // soft hyphen
}

interface CharOrigin {
  spanIndex: number
  charStart: number
  charEnd: number
}

function buildNormalizedPageStream(spans: readonly string[]): {
  norm: string
  origins: CharOrigin[]
} {
  let norm = ''
  const origins: CharOrigin[] = []

  const appendChar = (ch: string, spanIndex: number, charStart: number, charEnd: number) => {
    const lower = ch.toLowerCase()
    if (/\s/.test(lower)) {
      if (norm.length > 0 && norm[norm.length - 1] !== ' ') {
        norm += ' '
        origins.push({ spanIndex, charStart, charEnd })
      }
      return
    }
    norm += lower
    origins.push({ spanIndex, charStart, charEnd })
  }

  for (let sIdx = 0; sIdx < spans.length; sIdx++) {
    const raw = spans[sIdx] ?? ''
    if (!raw) continue

    // Detect end-of-line hyphenation: span ends with '<letter>-' and next non-empty span starts with lowercase letter
    let stripTrailingHyphen = false
    if (/[A-Za-z]-\s*$/.test(raw)) {
      for (let nextIdx = sIdx + 1; nextIdx < spans.length; nextIdx++) {
        const nextTrim = (spans[nextIdx] ?? '').trim()
        if (nextTrim.length > 0) {
          if (/^[a-z]/.test(nextTrim)) {
            stripTrailingHyphen = true
          }
          break
        }
      }
    }

    const effectiveLen = stripTrailingHyphen ? raw.replace(/-\s*$/, '').length : raw.length

    for (let cIdx = 0; cIdx < effectiveLen; cIdx++) {
      const ch = raw[cIdx]!
      const exp = LIGATURE_EXPANSIONS[ch]
      if (exp !== undefined) {
        for (const sub of exp) {
          appendChar(sub, sIdx, cIdx, cIdx + 1)
        }
      } else {
        appendChar(ch, sIdx, cIdx, cIdx + 1)
      }
    }

    // Add virtual space boundary between spans unless hyphen-joined
    if (!stripTrailingHyphen && norm.length > 0 && norm[norm.length - 1] !== ' ') {
      norm += ' '
      origins.push({ spanIndex: sIdx, charStart: raw.length, charEnd: raw.length })
    }
  }

  return { norm: norm.trimEnd(), origins: origins.slice(0, norm.trimEnd().length) }
}

function normalizeQueryString(query: string): string {
  let out = ''
  // Remove inline line-break hyphens inside pasted PDF text as well
  const cleaned = query.replace(/([A-Za-z])-\s*\r?\n\s*([a-z])/g, '$1$2')
  for (let i = 0; i < cleaned.length; i++) {
    const ch = cleaned[i]!
    const exp = LIGATURE_EXPANSIONS[ch]
    const piece = exp !== undefined ? exp : ch
    for (const sub of piece) {
      const lower = sub.toLowerCase()
      if (/\s/.test(lower)) {
        if (out.length > 0 && out[out.length - 1] !== ' ') out += ' '
      } else {
        out += lower
      }
    }
  }
  return out.trim()
}

function originsToSpanRanges(
  origins: readonly CharOrigin[],
  spans: readonly string[],
  startIdx: number,
  endIdxExclusive: number
): SpanCharRange[] {
  const bySpan = new Map<number, { start: number; end: number }>()
  for (let i = startIdx; i < endIdxExclusive && i < origins.length; i++) {
    const o = origins[i]!
    if (o.charStart === o.charEnd) continue // virtual space between spans
    const prev = bySpan.get(o.spanIndex)
    if (!prev) {
      bySpan.set(o.spanIndex, { start: o.charStart, end: o.charEnd })
    } else {
      prev.start = Math.min(prev.start, o.charStart)
      prev.end = Math.max(prev.end, o.charEnd)
    }
  }

  const result: SpanCharRange[] = []
  for (const [spanIndex, range] of bySpan.entries()) {
    const len = (spans[spanIndex] ?? '').length
    const s = Math.max(0, Math.min(len, range.start))
    const e = Math.max(s, Math.min(len, range.end))
    if (e > s) {
      result.push({ spanIndex, startOffset: s, endOffset: e })
    }
  }
  return result
}

/**
 * Match a target sentence/phrase across PDF TextLayer spans with tolerance for
 * line breaks, column wraps, hyphenated words, ligatures, and '...' ellipses.
 */
export function matchQuoteInSpans(
  spans: readonly string[],
  queryText: string
): SpanCharRange[] {
  if (!spans.length || !queryText.trim()) return []
  const { norm, origins } = buildNormalizedPageStream(spans)
  if (!norm) return []

  // Handle '...' or '…' ellipses in model-quoted sentences
  const parts = queryText
    .split(/(?:\.{3,}|…)/)
    .map(normalizeQueryString)
    .filter(p => p.length >= 4)

  if (parts.length === 0) return []

  if (parts.length === 1) {
    const q = parts[0]!
    const exactPos = norm.indexOf(q)
    if (exactPos >= 0) {
      return originsToSpanRanges(origins, spans, exactPos, exactPos + q.length)
    }

    // Fallback: strip punctuation (handles minor LaTeX spacing differences like "x_t" vs "xt")
    const alphaStreamChars: number[] = []
    let alphaNorm = ''
    for (let i = 0; i < norm.length; i++) {
      const c = norm[i]!
      if (/[a-z0-9\u4e00-\u9fa5]/.test(c)) {
        alphaNorm += c
        alphaStreamChars.push(i)
      }
    }
    const alphaQuery = q.replace(/[^a-z0-9\u4e00-\u9fa5]/g, '')
    if (alphaQuery.length >= 8) {
      const alphaPos = alphaNorm.indexOf(alphaQuery)
      if (alphaPos >= 0) {
        const startNorm = alphaStreamChars[alphaPos]!
        const endNorm = alphaStreamChars[alphaPos + alphaQuery.length - 1]! + 1
        return originsToSpanRanges(origins, spans, startNorm, endNorm)
      }
    }

    // Fallback 2: longest contiguous word-window (>= 5 words)
    const words = q.split(' ').filter(Boolean)
    if (words.length >= 6) {
      for (let win = Math.min(words.length - 1, 14); win >= 5; win--) {
        for (let offset = 0; offset + win <= words.length; offset++) {
          const sub = words.slice(offset, offset + win).join(' ')
          if (sub.length < 18) continue
          const pos = norm.indexOf(sub)
          if (pos >= 0) {
            return originsToSpanRanges(origins, spans, pos, pos + sub.length)
          }
        }
      }
    }
    return []
  }

  // Multi-segment ellipsis match: anchor first & last segment within reasonable distance
  const firstPos = norm.indexOf(parts[0]!)
  if (firstPos < 0) return []
  const lastPart = parts[parts.length - 1]!
  const searchStart = firstPos + parts[0]!.length
  const lastPos = norm.indexOf(lastPart, searchStart)
  if (lastPos >= 0 && lastPos - firstPos <= 1200) {
    return originsToSpanRanges(origins, spans, firstPos, lastPos + lastPart.length)
  }
  return originsToSpanRanges(origins, spans, firstPos, firstPos + parts[0]!.length)
}

export const PAPER_QUOTE_HEADING = '# 论文原文定位引用 (Paper Excerpt)'
export const PAPER_QUOTE_SEP = '--- \n## 用户提问：\n\n'

export function formatPaperQuoteBlock(quotes: readonly PaperQuotePayload[], userDraft = ''): string {
  if (quotes.length === 0) return userDraft
  const lines: string[] = [PAPER_QUOTE_HEADING]
  for (const q of quotes) {
    const secLabel = q.section ? ` | §${normalizeSectionId(q.section) || q.section}` : ''
    const meta = JSON.stringify({
      pdfPath: q.pdfPath,
      paperTitle: q.paperTitle,
      page: q.page,
      section: q.section,
      rects: q.rects,
    })
    lines.push(`> [论文出处：${q.paperTitle} | p.${q.page}${secLabel}] <!-- paper-coach:${meta} -->`)
    for (const rawLine of q.text.split(/\r?\n/)) {
      const trimmed = rawLine.trim()
      if (trimmed) lines.push(`> ${trimmed}`)
    }
    lines.push('')
  }
  lines.push('--- ')
  lines.push('## 用户提问：')
  lines.push('')
  return userDraft.trim() ? `${lines.join('\n')}\n${userDraft}` : `${lines.join('\n')}\n`
}

export interface ParsedPaperQuoteBlock {
  start: number
  end: number
  quotes: PaperQuotePayload[]
}

export function parsePaperQuoteBlock(text: string, from = 0): ParsedPaperQuoteBlock | undefined {
  const start = text.indexOf(PAPER_QUOTE_HEADING, from)
  if (start < 0) return undefined
  if (text.slice(from, start).trim().length > 0) return undefined

  const sepRe = /## 用户提问：[ \t]*\r?\n(?:\r?\n)?/g
  sepRe.lastIndex = start
  const sepMatch = sepRe.exec(text)
  const end = sepMatch ? sepMatch.index + sepMatch[0].length : text.length
  const block = text.slice(start, end)

  const itemRegex = /> \[论文出处：([^\]]+)\](?: <!-- paper-coach:(\{[^\n]*\}) -->)?\n((?:> [^\n]*\n?)+)/g
  const quotes: PaperQuotePayload[] = []
  let m: RegExpExecArray | null
  let idx = 0
  while ((m = itemRegex.exec(block)) !== null) {
    const header = m[1] ?? ''
    const metaRaw = m[2]
    const bodyRaw = m[3] ?? ''
    const excerpt = bodyRaw
      .split(/\r?\n/)
      .map(l => l.replace(/^>\s?/, '').trim())
      .filter(Boolean)
      .join(' ')

    let parsedMeta: Partial<PaperQuotePayload> = {}
    if (metaRaw) {
      try {
        parsedMeta = JSON.parse(metaRaw)
      } catch {}
    }

    const parts = header.split('|').map(s => s.trim())
    const fallbackTitle = parts[0] || 'Paper'
    const pageMatch = header.match(/p\.([0-9]+)/i)
    const secMatch = header.match(/§([^|\s]+)/)

    quotes.push({
      id: `pq-${idx++}`,
      pdfPath: parsedMeta.pdfPath ?? '',
      paperTitle: parsedMeta.paperTitle ?? fallbackTitle,
      page: parsedMeta.page ?? (pageMatch ? Number(pageMatch[1]) : 1),
      section: parsedMeta.section ?? (secMatch ? secMatch[1] : undefined),
      text: excerpt,
      rects: parsedMeta.rects,
    })
  }

  if (quotes.length === 0) return undefined
  return { start, end, quotes }
}
