window.__ModuleLoader__.load({id:"dsh-paper-coach",factory:(require)=>{const module={exports:{}};const exports=module.exports;
"use strict";
var __create = Object.create;
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __getProtoOf = Object.getPrototypeOf;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toESM = (mod, isNodeMode, target) => (target = mod != null ? __create(__getProtoOf(mod)) : {}, __copyProps(
  // If the importer is in node compatibility mode or this is not an ESM
  // file that has been converted to a CommonJS file using a Babel-
  // compatible transform (i.e. "__esModule" has not been set), then set
  // "default" to the CommonJS "module.exports" for node compatibility.
  isNodeMode || !mod || !mod.__esModule ? __defProp(target, "default", { value: mod, enumerable: true }) : target,
  mod
));
var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);

// src/client/index.tsx
var index_exports = {};
__export(index_exports, {
  apply: () => apply,
  inject: () => inject
});
module.exports = __toCommonJS(index_exports);
var import_react6 = __toESM(require("react"), 1);

// src/shared/protocol.ts
var DEFAULT_SETTINGS = {
  translationMode: "host_model",
  targetLanguage: "zh-CN",
  customApiBaseUrl: "https://api.openai.com/v1",
  customApiModel: "gpt-4o-mini",
  hostModelRoute: "",
  roadmapDockMode: "float",
  archiveBackend: "auto",
  preferLocalZotero: true,
  researchFocusHint: ""
};

// src/shared/section-matcher.ts
var ROMAN_MAP = {
  I: 1,
  II: 2,
  III: 3,
  IV: 4,
  V: 5,
  VI: 6,
  VII: 7,
  VIII: 8,
  IX: 9,
  X: 10,
  XI: 11,
  XII: 12,
  XIII: 13,
  XIV: 14,
  XV: 15
};
var CN_NUM_MAP = {
  \u4E00: 1,
  \u4E8C: 2,
  \u4E09: 3,
  \u56DB: 4,
  \u4E94: 5,
  \u516D: 6,
  \u4E03: 7,
  \u516B: 8,
  \u4E5D: 9,
  \u5341: 10,
  \u5341\u4E00: 11,
  \u5341\u4E8C: 12
};
function normalizeSectionId(raw) {
  let s = raw.trim();
  if (!s) return "";
  const cnMatch = s.match(/^第\s*([0-9]+(?:\.[0-9]+)*|[一二三四五六七八九十]+)\s*(?:部分|节|章|小节)?$/i);
  if (cnMatch) {
    const token = cnMatch[1];
    if (CN_NUM_MAP[token] !== void 0) return String(CN_NUM_MAP[token]);
    return token;
  }
  s = s.replace(/^(?:[$§]+|sec(?:tion)?\.?|part|chap(?:ter)?\.?)\s*/i, "").trim();
  const appMatch = s.match(/^appendix\s+([A-Z](?:\.[0-9]+)*)\b/i);
  if (appMatch) {
    return appMatch[1].toUpperCase();
  }
  const romanSubMatch = s.match(/^(X{0,1}(?:IX|IV|V?I{0,3}))(?:[-.]([A-Z]))?(?:\b|[.\s:]|$)/i);
  if (romanSubMatch && romanSubMatch[1]) {
    const romanUpper = romanSubMatch[1].toUpperCase();
    const num = ROMAN_MAP[romanUpper];
    if (num !== void 0) {
      if (romanSubMatch[2]) {
        const subIdx = romanSubMatch[2].toUpperCase().charCodeAt(0) - 64;
        return `${num}.${subIdx}`;
      }
      const rest = s.slice(romanSubMatch[0].length).replace(/^[:.\-–—\s]+/, "").trim();
      if (!rest || /^[A-Za-z\u4e00-\u9fa5]/.test(rest)) {
        return String(num);
      }
    }
  }
  const numMatch = s.match(/^([0-9]+(?:\.[0-9]+)*|[A-Z]\.[0-9]+(?:\.[0-9]+)*)(?:\.?)(?:\s|$|:)/);
  if (numMatch) {
    return numMatch[1];
  }
  if (/^[A-H]$/i.test(s)) {
    return s.toUpperCase();
  }
  return s.replace(/\.+$/, "").trim();
}
var COMMON_UNNUMBERED_HEADINGS = {
  abstract: "Abstract",
  introduction: "1",
  conclusion: "Conclusion",
  conclusions: "Conclusion",
  discussion: "Discussion",
  acknowledgments: "Acknowledgments",
  acknowledgements: "Acknowledgments",
  references: "References",
  appendix: "Appendix"
};
function parseSectionHeadingLine(line) {
  const trimmed = line.replace(/\s+/g, " ").trim();
  if (trimmed.length < 2 || trimmed.length > 140) return void 0;
  if (/^(?:fig(?:ure)?|tab(?:le)?|eq(?:uation)?|alg(?:orithm)?|lemma|theorem|proposition|corollary|remark)\b/i.test(trimmed)) {
    return void 0;
  }
  if (/^\[[0-9,\s-]+\]/.test(trimmed)) return void 0;
  const numHeading = trimmed.match(/^([1-9][0-9]?(?:\.[1-9][0-9]?){0,3})\.?\s+([A-Z][A-Za-z0-9\s,:;()\-–—/'"&?]{2,110})$/);
  if (numHeading) {
    const id = numHeading[1];
    const titleWords = numHeading[2].trim();
    if (/^[0-9.\s+-]+$/.test(titleWords)) return void 0;
    const topNum = Number(id.split(".")[0]);
    if (topNum >= 1 && topNum <= 25) {
      return { id, rawTitle: trimmed };
    }
  }
  const appHeading = trimmed.match(/^(?:Appendix\s+([A-H](?:\.[1-9][0-9]?)?)|([A-H]\.[1-9][0-9]?(?:\.[1-9][0-9]?)?))\.?\s*[:\-–]?\s*([A-Z][A-Za-z0-9\s,:;()\-–—/'"&?]{2,110})?$/i);
  if (appHeading) {
    const rawId = (appHeading[1] || appHeading[2] || "").toUpperCase();
    if (rawId && (appHeading[1] || appHeading[3])) {
      return { id: rawId, rawTitle: trimmed };
    }
  }
  const romanHeading = trimmed.match(/^(X{0,1}(?:IX|IV|V?I{0,3}))(?:[-.]([A-Z]))?\.\s+([A-Z][A-Za-z0-9\s,:;()\-–—/'"&?]{2,110})$/);
  if (romanHeading && romanHeading[1]) {
    const num = ROMAN_MAP[romanHeading[1]];
    if (num !== void 0) {
      const id = romanHeading[2] ? `${num}.${romanHeading[2].charCodeAt(0) - 64}` : String(num);
      return { id, rawTitle: trimmed };
    }
  }
  const lower = trimmed.toLowerCase().replace(/[:.]+$/, "");
  if (COMMON_UNNUMBERED_HEADINGS[lower]) {
    return { id: COMMON_UNNUMBERED_HEADINGS[lower], rawTitle: trimmed };
  }
  return void 0;
}
function findBestSectionMatch(entries, query) {
  if (!entries.length || !query.trim()) return void 0;
  const norm = normalizeSectionId(query);
  const lowerQuery = query.trim().toLowerCase();
  const exact = entries.find((e) => e.id.toLowerCase() === norm.toLowerCase());
  if (exact) return exact;
  const childMatch = entries.find((e) => e.id.toLowerCase().startsWith(norm.toLowerCase() + "."));
  if (childMatch) return childMatch;
  if (norm.includes(".")) {
    const parentId = norm.split(".").slice(0, -1).join(".");
    const parentMatch = entries.find((e) => e.id.toLowerCase() === parentId.toLowerCase());
    if (parentMatch) return parentMatch;
  }
  const keyword = lowerQuery.replace(/^(?:[$§]+|sec(?:tion)?\.?|第|部分|节)\s*/g, "").trim();
  if (keyword.length >= 3) {
    const byTitle = entries.find((e) => e.rawTitle.toLowerCase().includes(keyword));
    if (byTitle) return byTitle;
  }
  return void 0;
}
var LIGATURE_EXPANSIONS = {
  "\uFB00": "ff",
  "\uFB01": "fi",
  "\uFB02": "fl",
  "\uFB03": "ffi",
  "\uFB04": "ffl",
  "\u2018": "'",
  "\u2019": "'",
  "\u201C": '"',
  "\u201D": '"',
  "\u2013": "-",
  "\u2014": "-",
  "\xAD": ""
  // soft hyphen
};
function buildNormalizedPageStream(spans) {
  let norm = "";
  const origins = [];
  const appendChar = (ch, spanIndex, charStart, charEnd) => {
    const lower = ch.toLowerCase();
    if (/\s/.test(lower)) {
      if (norm.length > 0 && norm[norm.length - 1] !== " ") {
        norm += " ";
        origins.push({ spanIndex, charStart, charEnd });
      }
      return;
    }
    norm += lower;
    origins.push({ spanIndex, charStart, charEnd });
  };
  for (let sIdx = 0; sIdx < spans.length; sIdx++) {
    const raw = spans[sIdx] ?? "";
    if (!raw) continue;
    let stripTrailingHyphen = false;
    if (/[A-Za-z]-\s*$/.test(raw)) {
      for (let nextIdx = sIdx + 1; nextIdx < spans.length; nextIdx++) {
        const nextTrim = (spans[nextIdx] ?? "").trim();
        if (nextTrim.length > 0) {
          if (/^[a-z]/.test(nextTrim)) {
            stripTrailingHyphen = true;
          }
          break;
        }
      }
    }
    const effectiveLen = stripTrailingHyphen ? raw.replace(/-\s*$/, "").length : raw.length;
    for (let cIdx = 0; cIdx < effectiveLen; cIdx++) {
      const ch = raw[cIdx];
      const exp = LIGATURE_EXPANSIONS[ch];
      if (exp !== void 0) {
        for (const sub of exp) {
          appendChar(sub, sIdx, cIdx, cIdx + 1);
        }
      } else {
        appendChar(ch, sIdx, cIdx, cIdx + 1);
      }
    }
    if (!stripTrailingHyphen && norm.length > 0 && norm[norm.length - 1] !== " ") {
      norm += " ";
      origins.push({ spanIndex: sIdx, charStart: raw.length, charEnd: raw.length });
    }
  }
  return { norm: norm.trimEnd(), origins: origins.slice(0, norm.trimEnd().length) };
}
function normalizeQueryString(query) {
  let out = "";
  const cleaned = query.replace(/([A-Za-z])-\s*\r?\n\s*([a-z])/g, "$1$2");
  for (let i = 0; i < cleaned.length; i++) {
    const ch = cleaned[i];
    const exp = LIGATURE_EXPANSIONS[ch];
    const piece = exp !== void 0 ? exp : ch;
    for (const sub of piece) {
      const lower = sub.toLowerCase();
      if (/\s/.test(lower)) {
        if (out.length > 0 && out[out.length - 1] !== " ") out += " ";
      } else {
        out += lower;
      }
    }
  }
  return out.trim();
}
function originsToSpanRanges(origins, spans, startIdx, endIdxExclusive) {
  const bySpan = /* @__PURE__ */ new Map();
  for (let i = startIdx; i < endIdxExclusive && i < origins.length; i++) {
    const o = origins[i];
    if (o.charStart === o.charEnd) continue;
    const prev = bySpan.get(o.spanIndex);
    if (!prev) {
      bySpan.set(o.spanIndex, { start: o.charStart, end: o.charEnd });
    } else {
      prev.start = Math.min(prev.start, o.charStart);
      prev.end = Math.max(prev.end, o.charEnd);
    }
  }
  const result = [];
  for (const [spanIndex, range] of bySpan.entries()) {
    const len = (spans[spanIndex] ?? "").length;
    const s = Math.max(0, Math.min(len, range.start));
    const e = Math.max(s, Math.min(len, range.end));
    if (e > s) {
      result.push({ spanIndex, startOffset: s, endOffset: e });
    }
  }
  return result;
}
function matchQuoteInSpans(spans, queryText) {
  if (!spans.length || !queryText.trim()) return [];
  const { norm, origins } = buildNormalizedPageStream(spans);
  if (!norm) return [];
  const parts = queryText.split(/(?:\.{3,}|…)/).map(normalizeQueryString).filter((p) => p.length >= 4);
  if (parts.length === 0) return [];
  if (parts.length === 1) {
    const q = parts[0];
    const exactPos = norm.indexOf(q);
    if (exactPos >= 0) {
      return originsToSpanRanges(origins, spans, exactPos, exactPos + q.length);
    }
    const alphaStreamChars = [];
    let alphaNorm = "";
    for (let i = 0; i < norm.length; i++) {
      const c = norm[i];
      if (/[a-z0-9\u4e00-\u9fa5]/.test(c)) {
        alphaNorm += c;
        alphaStreamChars.push(i);
      }
    }
    const alphaQuery = q.replace(/[^a-z0-9\u4e00-\u9fa5]/g, "");
    if (alphaQuery.length >= 8) {
      const alphaPos = alphaNorm.indexOf(alphaQuery);
      if (alphaPos >= 0) {
        const startNorm = alphaStreamChars[alphaPos];
        const endNorm = alphaStreamChars[alphaPos + alphaQuery.length - 1] + 1;
        return originsToSpanRanges(origins, spans, startNorm, endNorm);
      }
    }
    const words = q.split(" ").filter(Boolean);
    if (words.length >= 6) {
      for (let win = Math.min(words.length - 1, 14); win >= 5; win--) {
        for (let offset = 0; offset + win <= words.length; offset++) {
          const sub = words.slice(offset, offset + win).join(" ");
          if (sub.length < 18) continue;
          const pos = norm.indexOf(sub);
          if (pos >= 0) {
            return originsToSpanRanges(origins, spans, pos, pos + sub.length);
          }
        }
      }
    }
    return [];
  }
  const firstPos = norm.indexOf(parts[0]);
  if (firstPos < 0) return [];
  const lastPart = parts[parts.length - 1];
  const searchStart = firstPos + parts[0].length;
  const lastPos = norm.indexOf(lastPart, searchStart);
  if (lastPos >= 0 && lastPos - firstPos <= 1200) {
    return originsToSpanRanges(origins, spans, firstPos, lastPos + lastPart.length);
  }
  return originsToSpanRanges(origins, spans, firstPos, firstPos + parts[0].length);
}
var PAPER_QUOTE_HEADING = "# \u8BBA\u6587\u539F\u6587\u5B9A\u4F4D\u5F15\u7528 (Paper Excerpt)";
function formatPaperQuoteBlock(quotes, userDraft = "") {
  if (quotes.length === 0) return userDraft;
  const lines = [PAPER_QUOTE_HEADING];
  for (const q of quotes) {
    const secLabel = q.section ? ` | \xA7${normalizeSectionId(q.section) || q.section}` : "";
    const meta = JSON.stringify({
      pdfPath: q.pdfPath,
      paperTitle: q.paperTitle,
      page: q.page,
      section: q.section,
      rects: q.rects
    });
    lines.push(`> [\u8BBA\u6587\u51FA\u5904\uFF1A${q.paperTitle} | p.${q.page}${secLabel}] <!-- paper-coach:${meta} -->`);
    for (const rawLine of q.text.split(/\r?\n/)) {
      const trimmed = rawLine.trim();
      if (trimmed) lines.push(`> ${trimmed}`);
    }
    lines.push("");
  }
  lines.push("--- ");
  lines.push("## \u7528\u6237\u63D0\u95EE\uFF1A");
  lines.push("");
  return userDraft.trim() ? `${lines.join("\n")}
${userDraft}` : `${lines.join("\n")}
`;
}
function parsePaperQuoteBlock(text, from = 0) {
  const start = text.indexOf(PAPER_QUOTE_HEADING, from);
  if (start < 0) return void 0;
  if (text.slice(from, start).trim().length > 0) return void 0;
  const sepRe = /## 用户提问：[ \t]*\r?\n(?:\r?\n)?/g;
  sepRe.lastIndex = start;
  const sepMatch = sepRe.exec(text);
  const end = sepMatch ? sepMatch.index + sepMatch[0].length : text.length;
  const block = text.slice(start, end);
  const itemRegex = /> \[论文出处：([^\]]+)\](?: <!-- paper-coach:(\{[^\n]*\}) -->)?\n((?:> [^\n]*\n?)+)/g;
  const quotes = [];
  let m;
  let idx = 0;
  while ((m = itemRegex.exec(block)) !== null) {
    const header = m[1] ?? "";
    const metaRaw = m[2];
    const bodyRaw = m[3] ?? "";
    const excerpt = bodyRaw.split(/\r?\n/).map((l) => l.replace(/^>\s?/, "").trim()).filter(Boolean).join(" ");
    let parsedMeta = {};
    if (metaRaw) {
      try {
        parsedMeta = JSON.parse(metaRaw);
      } catch {
      }
    }
    const parts = header.split("|").map((s) => s.trim());
    const fallbackTitle = parts[0] || "Paper";
    const pageMatch = header.match(/p\.([0-9]+)/i);
    const secMatch = header.match(/§([^|\s]+)/);
    quotes.push({
      id: `pq-${idx++}`,
      pdfPath: parsedMeta.pdfPath ?? "",
      paperTitle: parsedMeta.paperTitle ?? fallbackTitle,
      page: parsedMeta.page ?? (pageMatch ? Number(pageMatch[1]) : 1),
      section: parsedMeta.section ?? (secMatch ? secMatch[1] : void 0),
      text: excerpt,
      rects: parsedMeta.rects
    });
  }
  if (quotes.length === 0) return void 0;
  return { start, end, quotes };
}

// src/client/controller.ts
var EMPTY_QUOTES = Object.freeze([]);
function resolveHostHttpBaseUrl(docBaseUri, locationHref, streamBaseUrl) {
  const pageBase = typeof docBaseUri === "string" && docBaseUri || typeof document !== "undefined" && typeof document.baseURI === "string" && document.baseURI || typeof locationHref === "string" && locationHref || typeof window !== "undefined" && typeof window.location?.href === "string" && window.location.href || "";
  const w = typeof window !== "undefined" ? window : void 0;
  const transportBase = streamBaseUrl ?? w?.__DSH_TRANSPORT__?.streamBaseUrl;
  const raw = pageBase || (typeof transportBase === "string" && transportBase ? transportBase : "http://dsh.internal/");
  const u = new URL(raw, "http://dsh.internal/");
  u.search = "";
  u.hash = "";
  if (!u.pathname) {
    u.pathname = "/";
  } else if (!u.pathname.endsWith("/")) {
    const lastSlash = u.pathname.lastIndexOf("/");
    const lastSeg = lastSlash >= 0 ? u.pathname.slice(lastSlash + 1) : u.pathname;
    if (lastSeg.includes(".")) {
      u.pathname = u.pathname.slice(0, Math.max(0, lastSlash) + 1) || "/";
    } else {
      u.pathname += "/";
    }
  }
  return u.href;
}
var PaperCoachClientController = class {
  betterSidebar = void 0;
  settings = { ...DEFAULT_SETTINGS };
  settingsOpenSessionId = null;
  sessionStates = /* @__PURE__ */ new Map();
  sessionStreams = /* @__PURE__ */ new Map();
  handledNavSeq = /* @__PURE__ */ new Map();
  jumpTargets = /* @__PURE__ */ new Map();
  quotes = /* @__PURE__ */ new Map();
  inputs = /* @__PURE__ */ new Map();
  listeners = /* @__PURE__ */ new Set();
  activeSessionId = void 0;
  jumpNonce = 1;
  pdfEnginePromise = null;
  setBetterSidebar(service) {
    this.betterSidebar = service;
    this.emit();
  }
  getBetterSidebar() {
    return this.betterSidebar;
  }
  setActiveSession(sessionId) {
    this.activeSessionId = sessionId;
  }
  getActiveSession() {
    return this.activeSessionId;
  }
  registerInput(sessionId, input) {
    if (input) this.inputs.set(sessionId, input);
    else this.inputs.delete(sessionId);
  }
  getInput(sessionId) {
    return this.inputs.get(sessionId);
  }
  subscribe = (listener) => {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  };
  emit() {
    for (const fn of this.listeners) {
      try {
        fn();
      } catch {
      }
    }
  }
  routeUrl(path) {
    const clean = path.replace(/^\/+/, "");
    if (this.betterSidebar && typeof this.betterSidebar.hostRouteUrl === "function") {
      const r = this.betterSidebar.hostRouteUrl(clean);
      return typeof r === "string" ? r : r.href;
    }
    return new URL(clean, resolveHostHttpBaseUrl()).href;
  }
  async apiPost(action, body, signal) {
    const res = await fetch(this.routeUrl("paper-coach/api/" + action), {
      method: "POST",
      credentials: "include",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
      signal
    });
    const data = await res.json().catch(() => ({ ok: false, error: "Invalid JSON response" }));
    if (!res.ok || data.ok === false) {
      throw new Error(data.error || "Request failed: HTTP " + res.status);
    }
    return data;
  }
  loadPdfEngine() {
    if (this.pdfEnginePromise) return this.pdfEnginePromise;
    this.pdfEnginePromise = (async () => {
      const [runtimeRes, workerRes] = await Promise.all([
        fetch(this.routeUrl("paper-coach/assets/pdf-runtime.mjs"), { credentials: "include" }),
        fetch(this.routeUrl("paper-coach/assets/pdf.worker.mjs"), { credentials: "include" })
      ]);
      if (!runtimeRes.ok) throw new Error("Failed to load pdf-runtime.mjs: HTTP " + runtimeRes.status);
      if (!workerRes.ok) throw new Error("Failed to load pdf.worker.mjs: HTTP " + workerRes.status);
      const [runtimeCode, workerCode] = await Promise.all([runtimeRes.text(), workerRes.text()]);
      const blobUrl = URL.createObjectURL(new Blob([runtimeCode], { type: "text/javascript" }));
      try {
        const mod = await import(
          /* @vite-ignore */
          blobUrl
        );
        return {
          getDocument: mod.getDocument,
          GlobalWorkerOptions: mod.GlobalWorkerOptions,
          PDFWorker: mod.PDFWorker,
          TextLayer: mod.TextLayer,
          workerCode
        };
      } finally {
        URL.revokeObjectURL(blobUrl);
      }
    })().catch((err) => {
      this.pdfEnginePromise = null;
      throw err;
    });
    return this.pdfEnginePromise;
  }
  getSettings() {
    return this.settings;
  }
  async refreshSettings() {
    const res = await this.apiPost("settings.get", {});
    this.settings = res.settings;
    this.emit();
    return this.settings;
  }
  async updateSettings(patch) {
    const res = await this.apiPost("settings.update", patch);
    this.settings = res.settings;
    this.emit();
    return this.settings;
  }
  isSettingsModalOpen() {
    return this.settingsOpenSessionId !== null;
  }
  openSettingsModal(sessionId = "global") {
    this.settingsOpenSessionId = sessionId;
    void this.refreshSettings().catch(() => {
    });
    this.emit();
  }
  closeSettingsModal() {
    this.settingsOpenSessionId = null;
    this.emit();
  }
  getSessionState(sessionId) {
    return this.sessionStates.get(sessionId);
  }
  getJumpTarget(sessionId) {
    return this.jumpTargets.get(sessionId);
  }
  consumeJumpTarget(sessionId, nonce) {
    const cur = this.jumpTargets.get(sessionId);
    if (cur && cur.nonce === nonce) {
      this.jumpTargets.delete(sessionId);
      this.emit();
    }
  }
  retainSession(sessionId) {
    const existing = this.sessionStreams.get(sessionId);
    if (existing) {
      existing.refCount += 1;
      return () => this.releaseSession(sessionId);
    }
    const abort = new AbortController();
    this.sessionStreams.set(sessionId, { abort, refCount: 1 });
    void this.runEventLoop(sessionId, abort.signal);
    return () => this.releaseSession(sessionId);
  }
  releaseSession(sessionId) {
    const entry = this.sessionStreams.get(sessionId);
    if (!entry) return;
    entry.refCount -= 1;
    if (entry.refCount <= 0) {
      entry.abort.abort();
      this.sessionStreams.delete(sessionId);
    }
  }
  async runEventLoop(sessionId, signal) {
    while (!signal.aborted) {
      try {
        const url = this.routeUrl("paper-coach/events?sessionId=" + encodeURIComponent(sessionId));
        const res = await fetch(url, { credentials: "include", signal });
        if (!res.ok || !res.body) throw new Error("SSE HTTP " + res.status);
        const reader = res.body.getReader();
        const decoder = new TextDecoder();
        let buffer = "";
        while (!signal.aborted) {
          const { value, done } = await reader.read();
          if (done) break;
          buffer += decoder.decode(value, { stream: true });
          let idx;
          while ((idx = buffer.indexOf("\n\n")) >= 0) {
            const rawEvent = buffer.slice(0, idx);
            buffer = buffer.slice(idx + 2);
            for (const line of rawEvent.split("\n")) {
              if (line.startsWith("data: ")) {
                try {
                  const ev = JSON.parse(line.slice(6));
                  this.handleServerEvent(sessionId, ev);
                } catch {
                }
              }
            }
          }
        }
      } catch {
        if (signal.aborted) return;
        await new Promise((r) => setTimeout(r, 2e3));
      }
    }
  }
  handleServerEvent(sessionId, ev) {
    if (ev.type === "snapshot") {
      this.settings = ev.settings;
      this.sessionStates.set(sessionId, ev.state);
      if (ev.state.lastNav && Date.now() - ev.state.lastNav.issuedAt < 3e4) {
        this.applyNavigationCommand(sessionId, ev.state.lastNav);
      }
      this.emit();
      return;
    }
    if (ev.type === "settings_updated") {
      this.settings = ev.settings;
      this.emit();
      return;
    }
    if (ev.type === "state_updated") {
      this.sessionStates.set(sessionId, ev.state);
      this.emit();
      return;
    }
    if (ev.type === "navigate") {
      this.sessionStates.set(sessionId, ev.state);
      this.applyNavigationCommand(sessionId, ev.command);
      this.emit();
    }
  }
  applyNavigationCommand(sessionId, cmd) {
    const prevSeq = this.handledNavSeq.get(sessionId) ?? 0;
    if (cmd.seq <= prevSeq) return;
    this.handledNavSeq.set(sessionId, cmd.seq);
    if (cmd.openInSidebar && cmd.pdfPath && this.betterSidebar?.openFile) {
      try {
        this.betterSidebar.openFile({ sessionId }, cmd.pdfPath, cmd.paperTitle);
      } catch (err) {
        console.warn("[paper-coach] openFile failed:", err);
      }
    }
    if (cmd.page !== void 0 || cmd.section !== void 0 || cmd.highlights && cmd.highlights.length > 0 || cmd.flashRects) {
      this.jumpTargets.set(sessionId, {
        nonce: this.jumpNonce++,
        pdfPath: cmd.pdfPath,
        page: cmd.page,
        section: cmd.section,
        highlights: cmd.highlights,
        flashRects: cmd.flashRects
      });
    }
  }
  jumpToPaperLocation(sessionId, target) {
    const state = this.sessionStates.get(sessionId);
    const pdfPath = target.pdfPath || state?.activePdfPath || state?.plan?.pdfPath;
    const paperTitle = target.paperTitle || state?.activePaperTitle || state?.plan?.paperTitle;
    if (pdfPath && this.betterSidebar?.openFile) {
      try {
        this.betterSidebar.openFile({ sessionId }, pdfPath, paperTitle);
      } catch {
      }
    }
    this.jumpTargets.set(sessionId, {
      nonce: this.jumpNonce++,
      pdfPath,
      page: target.page,
      section: target.section ? normalizeSectionId(target.section) || target.section : void 0,
      queryText: target.queryText,
      flashRects: target.page && target.rects && target.rects.length > 0 ? { page: target.page, rects: target.rects } : void 0
    });
    this.emit();
    return Boolean(pdfPath || target.page || target.section);
  }
  reportViewport(sessionId, viewport) {
    void this.apiPost("viewport.update", { sessionId, viewport }).catch(() => {
    });
  }
  async clearHighlights(sessionId) {
    await this.apiPost("highlights.clear", { sessionId }).catch(() => {
    });
  }
  /* Quotes management */
  getQuotes(sessionId) {
    return this.quotes.get(sessionId) ?? EMPTY_QUOTES;
  }
  addQuote(sessionId, quote) {
    const full = {
      ...quote,
      id: "pquote-" + Date.now() + "-" + Math.random().toString(36).slice(2, 6)
    };
    const prev = this.quotes.get(sessionId) ?? [];
    this.quotes.set(sessionId, [...prev, full]);
    this.emit();
    this.inputs.get(sessionId)?.focus?.();
    return full;
  }
  removeQuote(sessionId, id) {
    const prev = this.quotes.get(sessionId);
    if (!prev || prev.length === 0) return;
    const next = prev.filter((q) => q.id !== id);
    if (next.length === 0) this.quotes.delete(sessionId);
    else this.quotes.set(sessionId, next);
    this.emit();
  }
  clearQuotes(sessionId) {
    this.quotes.delete(sessionId);
    this.emit();
  }
  askMainAgentTranslate(sessionId, quote) {
    const input = this.inputs.get(sessionId);
    if (!input) return;
    const formatted = formatPaperQuoteBlock(
      [{ ...quote, id: "tr-1" }],
      "\u8BF7\u7ED3\u5408\u4E0A\u4E0B\u6587\u5C06\u4E0A\u9762\u9009\u4E2D\u7684\u8BBA\u6587\u6BB5\u843D\u51C6\u786E\u7FFB\u8BD1\u4E3A\u4E2D\u6587\uFF0C\u4FDD\u7559\u6570\u5B66\u7B26\u53F7\u4E0E\u5173\u952E\u4E13\u4E1A\u672F\u8BED\uFF0C\u5E76\u7B80\u8981\u70B9\u660E\u8BE5\u53E5\u5728\u672C\u8282\u4E2D\u7684\u4F5C\u7528\u3002"
    );
    input.setDraft(formatted);
    input.focus?.();
  }
  async toggleGoalDone(sessionId, goalId) {
    const plan = this.sessionStates.get(sessionId)?.plan;
    if (!plan) return;
    const goals = plan.goals.map((g) => g.id === goalId ? { ...g, done: !g.done } : g);
    await this.apiPost("plan.update", { sessionId, action: "update", goals });
  }
  async advanceSectionDone(sessionId, sectionId) {
    const plan = this.sessionStates.get(sessionId)?.plan;
    if (!plan) return;
    let promoteNext = false;
    let nextTarget;
    const sections = plan.sections.map((s) => {
      if (s.id === sectionId) {
        if (s.status !== "done") promoteNext = true;
        return { ...s, status: "done" };
      }
      if (promoteNext && s.status === "pending") {
        promoteNext = false;
        nextTarget = { section: s.section, page: s.page };
        return { ...s, status: "current" };
      }
      return s;
    });
    await this.apiPost("plan.update", { sessionId, action: "update", sections });
    if (nextTarget) {
      this.jumpToPaperLocation(sessionId, { pdfPath: plan.pdfPath, paperTitle: plan.paperTitle, section: nextTarget.section, page: nextTarget.page });
    }
  }
  async startQuizFromPanel(sessionId) {
    const plan = this.sessionStates.get(sessionId)?.plan;
    await this.apiPost("plan.update", { sessionId, action: "update", stage: "quiz" }).catch(() => {
    });
    const input = this.inputs.get(sessionId);
    if (input) {
      const secLabels = plan?.sections.map((s) => s.section).join("\u3001") || "\u7EA6\u5B9A\u8303\u56F4";
      input.setDraft("\u6211\u5DF2\u7ECF\u8BFB\u5B8C\u4E86\u7EA6\u5B9A\u7684\u7CBE\u8BFB\u8303\u56F4\uFF08" + secLabels + "\uFF09\uFF0C\u53EF\u4EE5\u5F00\u59CB\u7406\u89E3\u68C0\u9A8C\u4E86\u3002");
      input.focus?.();
    }
  }
  dispose() {
    for (const entry of this.sessionStreams.values()) entry.abort.abort();
    this.sessionStreams.clear();
    this.listeners.clear();
  }
};

// src/client/locales.ts
var NS = "paper-coach";
var zh = {
  "viewer.title": "\u8BBA\u6587\u4F34\u8BFB\u9605\u8BFB\u5668 (PDF)",
  "toolbar.outline": "\u7AE0\u8282\u76EE\u5F55",
  "toolbar.zoomOut": "\u7F29\u5C0F",
  "toolbar.zoomIn": "\u653E\u5927",
  "toolbar.fitWidth": "\u9002\u5E94\u9875\u5BBD",
  "toolbar.clearHighlights": "\u6E05\u9664\u9AD8\u4EAE",
  "toolbar.settings": "\u4F34\u8BFB\u4E0E\u7FFB\u8BD1\u8BBE\u7F6E",
  "toolbar.dockRoadmap": "\u5C06\u8DEF\u7EBF\u9762\u677F\u505C\u9760\u81F3\u6B64\u5904",
  "toolbar.floatRoadmap": "\u5F39\u51FA\u4E3A\u804A\u5929\u533A\u60AC\u6D6E\u80F6\u56CA",
  "selection.translate": "\u7FFB\u8BD1",
  "selection.quote": "\u5F15\u7528",
  "translate.title": "\u5B66\u672F\u6BB5\u843D\u7FFB\u8BD1",
  "translate.loading": "\u6B63\u5728\u7FFB\u8BD1\u9009\u4E2D\u6BB5\u843D\u2026",
  "translate.copy": "\u590D\u5236\u8BD1\u6587",
  "translate.copied": "\u5DF2\u590D\u5236",
  "translate.retry": "\u91CD\u8BD5",
  "translate.sendMain": "\u53D1\u7ED9\u4E3B\u4EE3\u7406\u7CBE\u8BB2",
  "translate.close": "\u5173\u95ED",
  "quote.added": "\u5DF2\u6DFB\u52A0\u8BBA\u6587\u4F4D\u7F6E\u5F15\u7528",
  "quote.dockTitle": "\u8BBA\u6587\u539F\u6587\u5F15\u7528",
  "quote.insertDraft": "\u586B\u5165\u8F93\u5165\u6846",
  "quote.clear": "\u6E05\u7A7A",
  "quote.jumpBack": "\u70B9\u51FB\u5728\u4FA7\u8FB9\u680F\u5B9A\u4F4D\u5230\u8BE5\u9875\u4E0E\u9009\u533A",
  "roadmap.capsulePrefix": "\u7CBE\u8BFB",
  "roadmap.goalsTitle": "\u672C\u7BC7\u6838\u5FC3\u5B66\u4E60\u76EE\u6807",
  "roadmap.sectionsTitle": "\u5B9A\u5411\u7CBE\u8BFB\u7AE0\u8282\u8DEF\u7EBF",
  "roadmap.stage.overview": "\u8BFB\u524D\u6982\u89C8",
  "roadmap.stage.reading": "\u81EA\u4E3B\u7CBE\u8BFB\u4E0E\u7B54\u7591",
  "roadmap.stage.quiz": "\u7406\u89E3\u68C0\u9A8C",
  "roadmap.stage.summary": "\u5B66\u4E60\u603B\u7ED3",
  "roadmap.stage.completed": "\u5DF2\u5B8C\u6210\u7CBE\u8BFB",
  "roadmap.status.pending": "\u5F85\u8BFB",
  "roadmap.status.current": "\u5F53\u524D\u7CBE\u8BFB",
  "roadmap.status.done": "\u5DF2\u8BFB\u5B8C",
  "roadmap.markDoneNext": "\u8BFB\u5B8C\u672C\u8282 \xB7 \u4E0B\u4E00\u8282",
  "roadmap.startQuiz": "\u5DF2\u5B8C\u6210\u7EA6\u5B9A\u8303\u56F4\uFF0C\u5F00\u59CB\u7406\u89E3\u68C0\u9A8C",
  "roadmap.dockToPdf": "\u505C\u9760\u5230 PDF \u9876\u90E8",
  "roadmap.undockToChat": "\u60AC\u6D6E\u4E8E\u804A\u5929\u53F3\u4E0A\u89D2",
  "settings.title": "\u8BBA\u6587\u7C97\u8BFB+\u7CBE\u8BFB\u4F34\u8BFB\u8BBE\u7F6E",
  "settings.translationMode": "\u5212\u8BCD\u7FFB\u8BD1\u901A\u9053",
  "settings.mode.host": "\u590D\u7528 DSH \u5BBF\u4E3B\u6A21\u578B\u65C1\u8DEF\u79D2\u7FFB\uFF08\u63A8\u8350\uFF0C\u4E0D\u6C61\u67D3\u4E3B\u4F1A\u8BDD\uFF09",
  "settings.mode.custom": "\u4F7F\u7528\u81EA\u5B9A\u4E49\u5916\u90E8\u5927\u6A21\u578B API",
  "settings.mode.main": "\u53D1\u9001\u7ED9\u5F53\u524D\u4E3B\u4F1A\u8BDD\u4EE3\u7406\u7FFB\u8BD1",
  "settings.targetLang": "\u76EE\u6807\u7FFB\u8BD1\u8BED\u8A00",
  "settings.apiBaseUrl": "\u81EA\u5B9A\u4E49 API Base URL (OpenAI \u517C\u5BB9)",
  "settings.apiKey": "\u81EA\u5B9A\u4E49 API Key",
  "settings.apiKeyPlaceholder": "\u8F93\u5165\u65B0\u5BC6\u94A5\u4EE5\u4FDD\u5B58\uFF08\u7559\u7A7A\u4FDD\u6301\u4E0D\u53D8\uFF09",
  "settings.apiKeyConfigured": "\u5DF2\u5B89\u5168\u4FDD\u5B58\u5BC6\u94A5",
  "settings.apiModel": "\u81EA\u5B9A\u4E49\u7FFB\u8BD1\u6A21\u578B\u540D\u79F0",
  "settings.hostRoute": "\u6307\u5B9A\u5BBF\u4E3B\u6A21\u578B\u8DEF\u7531\uFF08\u53EF\u9009\uFF0C\u5982 provider/model\uFF0C\u7559\u7A7A\u81EA\u52A8\u9009\u62E9\uFF09",
  "settings.preferZotero": "\u7CBE\u8BFB\u524D\u4F18\u5148\u68C0\u67E5\u672C\u673A Zotero \u6587\u732E\u5E93",
  "settings.archiveBackend": "\u6587\u732E\u6863\u6848\u5B58\u50A8\u4F4D\u7F6E",
  "settings.researchHint": "\u4E2A\u4EBA\u7814\u7A76\u80CC\u666F\u63D0\u793A\uFF08\u53EF\u9009\uFF0C\u4F9B\u5BFC\u8BFB/\u7CBE\u8BFB\u8BC4\u4F30\u4EF7\u503C\u53C2\u8003\uFF09",
  "settings.save": "\u4FDD\u5B58\u8BBE\u7F6E",
  "settings.saved": "\u8BBE\u7F6E\u5DF2\u4FDD\u5B58"
};
var en = {
  "viewer.title": "Paper Coach Reader (PDF)",
  "toolbar.outline": "Sections",
  "toolbar.zoomOut": "Zoom out",
  "toolbar.zoomIn": "Zoom in",
  "toolbar.fitWidth": "Fit width",
  "toolbar.clearHighlights": "Clear highlights",
  "toolbar.settings": "Paper Coach Settings",
  "toolbar.dockRoadmap": "Dock roadmap here",
  "toolbar.floatRoadmap": "Float roadmap in chat",
  "selection.translate": "Translate",
  "selection.quote": "Quote",
  "translate.title": "Academic Translation",
  "translate.loading": "Translating excerpt\u2026",
  "translate.copy": "Copy",
  "translate.copied": "Copied",
  "translate.retry": "Retry",
  "translate.sendMain": "Ask Main Agent",
  "translate.close": "Close",
  "quote.added": "Added paper quote",
  "quote.dockTitle": "Paper Quotes",
  "quote.insertDraft": "Insert into input",
  "quote.clear": "Clear",
  "quote.jumpBack": "Click to locate in PDF sidebar",
  "roadmap.capsulePrefix": "Reading",
  "roadmap.goalsTitle": "Learning Goals",
  "roadmap.sectionsTitle": "Reading Roadmap",
  "roadmap.stage.overview": "Overview",
  "roadmap.stage.reading": "Close Reading",
  "roadmap.stage.quiz": "Comprehension Check",
  "roadmap.stage.summary": "Summary",
  "roadmap.stage.completed": "Completed",
  "roadmap.status.pending": "Pending",
  "roadmap.status.current": "Reading",
  "roadmap.status.done": "Done",
  "roadmap.markDoneNext": "Mark Done \xB7 Next",
  "roadmap.startQuiz": "Finished Scope \xB7 Start Check",
  "roadmap.dockToPdf": "Dock to PDF Top",
  "roadmap.undockToChat": "Float in Chat",
  "settings.title": "Paper Coach Settings",
  "settings.translationMode": "Translation Channel",
  "settings.mode.host": "DSH Host Model Bypass (Recommended)",
  "settings.mode.custom": "Custom OpenAI-Compatible API",
  "settings.mode.main": "Send to Main Conversation Agent",
  "settings.targetLang": "Target Language",
  "settings.apiBaseUrl": "Custom API Base URL",
  "settings.apiKey": "Custom API Key",
  "settings.apiKeyPlaceholder": "Enter new key to update (blank keeps current)",
  "settings.apiKeyConfigured": "API Key saved on host",
  "settings.apiModel": "Custom Model Name",
  "settings.hostRoute": "Host Model Route (optional provider/model)",
  "settings.preferZotero": "Check local Zotero library first before web search",
  "settings.archiveBackend": "Paper Archive Storage",
  "settings.researchHint": "Personal Research Focus Hint (optional)",
  "settings.save": "Save Settings",
  "settings.saved": "Saved"
};

// src/client/styles.ts
var PAPER_COACH_CSS = `
:root {
  --pc-bg: var(--dsw-alias-bg-surface, #ffffff);
  --pc-bg-elevated: var(--dsw-alias-bg-elevated, #ffffff);
  --pc-bg-subtle: var(--dsw-alias-bg-subtle, rgba(127, 134, 148, 0.08));
  --pc-border: var(--dsw-alias-border-default, rgba(127, 134, 148, 0.22));
  --pc-text: var(--dsw-alias-text-primary, #1f2329);
  --pc-text-muted: var(--dsw-alias-text-secondary, #646a73);
  --pc-accent: var(--dsw-alias-brand-primary, #3b82f6);
  --pc-accent-soft: rgba(59, 130, 246, 0.12);
  --pc-shadow: 0 8px 28px rgba(0, 0, 0, 0.14), 0 1px 3px rgba(0, 0, 0, 0.08);
}
@media (prefers-color-scheme: dark) {
  :root {
    --pc-bg: var(--dsw-alias-bg-surface, #1e2025);
    --pc-bg-elevated: var(--dsw-alias-bg-elevated, #252830);
    --pc-bg-subtle: var(--dsw-alias-bg-subtle, rgba(255, 255, 255, 0.06));
    --pc-border: var(--dsw-alias-border-default, rgba(255, 255, 255, 0.14));
    --pc-text: var(--dsw-alias-text-primary, #ebedf0);
    --pc-text-muted: var(--dsw-alias-text-secondary, #9aa0a6);
    --pc-shadow: 0 10px 32px rgba(0, 0, 0, 0.45), 0 1px 3px rgba(0, 0, 0, 0.3);
  }
}
[data-theme='dark'] {
  --pc-bg: var(--dsw-alias-bg-surface, #1e2025);
  --pc-bg-elevated: var(--dsw-alias-bg-elevated, #252830);
  --pc-bg-subtle: var(--dsw-alias-bg-subtle, rgba(255, 255, 255, 0.06));
  --pc-border: var(--dsw-alias-border-default, rgba(255, 255, 255, 0.14));
  --pc-text: var(--dsw-alias-text-primary, #ebedf0);
  --pc-text-muted: var(--dsw-alias-text-secondary, #9aa0a6);
}

/* PDF Viewer Container */
.pc-viewer-root {
  display: flex;
  flex-direction: column;
  width: 100%;
  height: 100%;
  min-height: 0;
  background: var(--dsw-alias-bg-document-preview, var(--pc-bg-subtle));
  color: var(--pc-text);
  font-family: var(--dsw-font, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif);
  position: relative;
}
.pc-toolbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 6px;
  padding: 6px 10px;
  background: var(--pc-bg);
  border-bottom: 1px solid var(--pc-border);
  font-size: 12px;
  flex-shrink: 0;
  flex-wrap: wrap;
  z-index: 5;
}
.pc-toolbar-group {
  display: flex;
  align-items: center;
  gap: 5px;
}
.pc-btn {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 3px 8px;
  border-radius: 6px;
  border: 1px solid var(--pc-border);
  background: var(--pc-bg-elevated);
  color: var(--pc-text);
  font-size: 12px;
  line-height: 1.4;
  cursor: pointer;
  transition: background 0.15s, border-color 0.15s;
}
.pc-btn:hover {
  background: var(--pc-bg-subtle);
  border-color: var(--pc-accent);
}
.pc-btn-primary {
  background: var(--pc-accent);
  border-color: var(--pc-accent);
  color: #fff;
}
.pc-btn-primary:hover {
  opacity: 0.92;
  background: var(--pc-accent);
  color: #fff;
}
.pc-badge {
  display: inline-flex;
  align-items: center;
  padding: 1px 6px;
  border-radius: 999px;
  background: var(--pc-accent-soft);
  color: var(--pc-accent);
  font-size: 11px;
  font-weight: 500;
}
.pc-main-area {
  display: flex;
  flex: 1;
  min-height: 0;
  position: relative;
}
.pc-outline-drawer {
  width: 210px;
  max-width: 45%;
  border-right: 1px solid var(--pc-border);
  background: var(--pc-bg);
  overflow-y: auto;
  padding: 8px 6px;
  flex-shrink: 0;
  font-size: 12px;
}
.pc-outline-item {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: 6px;
  padding: 5px 8px;
  border-radius: 6px;
  cursor: pointer;
  color: var(--pc-text);
}
.pc-outline-item:hover, .pc-outline-item-active {
  background: var(--pc-accent-soft);
  color: var(--pc-accent);
}
.pc-scrollport {
  scrollbar-gutter: stable;
  flex: 1;
  min-width: 0;
  min-height: 0;
  overflow: auto;
  padding: 12px;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 14px;
  position: relative;
}
.pc-page-shell {
  position: relative;
  background: #ffffff;
  box-shadow: 0 2px 10px rgba(0, 0, 0, 0.12);
  border-radius: 3px;
  flex-shrink: 0;
}
.pc-page-canvas {
  display: block;
  width: 100%;
  height: 100%;
}
/* Official PDF.js TextLayer alignment */
.pc-text-host {
  position: absolute;
  inset: 0;
  overflow: clip;
  z-index: 2;
}
.pc-text-host .textLayer {
  position: absolute;
  text-align: initial;
  inset: 0;
  overflow: clip;
  opacity: 1;
  line-height: 1;
  text-size-adjust: none;
  forced-color-adjust: none;
  transform-origin: 0 0;
  z-index: 2;
}
.pc-text-host .textLayer :is(span, br) {
  color: transparent;
  position: absolute;
  white-space: pre;
  cursor: text;
  transform-origin: 0% 0%;
}
.pc-text-host .textLayer ::selection {
  background: rgba(59, 130, 246, 0.28);
}

/* Highlight Overlay Layer */
.pc-highlight-layer {
  position: absolute;
  inset: 0;
  pointer-events: none;
  z-index: 1;
}
.pc-hl-rect {
  position: absolute;
  border-radius: 3px;
  mix-blend-mode: multiply;
  transition: opacity 0.25s;
}
.pc-hl-amber { background: rgba(245, 158, 11, 0.34); border-bottom: 1.5px solid rgba(217, 119, 6, 0.75); }
.pc-hl-blue  { background: rgba(59, 130, 246, 0.26); border-bottom: 1.5px solid rgba(37, 99, 235, 0.75); }
.pc-hl-green { background: rgba(16, 185, 129, 0.28); border-bottom: 1.5px solid rgba(5, 150, 105, 0.75); }
.pc-hl-rose  { background: rgba(244, 63, 94, 0.26); border-bottom: 1.5px solid rgba(225, 29, 72, 0.75); }
@keyframes pc-flash-pulse {
  0%   { background: rgba(59, 130, 246, 0.55); box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.35); }
  60%  { background: rgba(245, 158, 11, 0.45); box-shadow: 0 0 0 1px rgba(245, 158, 11, 0.2); }
  100% { background: rgba(245, 158, 11, 0.0); box-shadow: none; }
}
.pc-hl-flash {
  position: absolute;
  border-radius: 4px;
  animation: pc-flash-pulse 2.2s ease-out forwards;
}
.pc-hl-label {
  position: absolute;
  transform: translateY(-100%);
  background: #b45309;
  color: #ffffff;
  font-size: 10px;
  font-weight: 600;
  padding: 1px 5px;
  border-radius: 4px;
  white-space: nowrap;
  box-shadow: 0 1px 4px rgba(0,0,0,0.2);
}
.pc-hl-label-amber { background: #b45309; }
.pc-hl-label-blue  { background: #1d4ed8; }
.pc-hl-label-green { background: #047857; }
.pc-hl-label-rose  { background: #be123c; }

/* Assistant inline location badge links */
a[href^="paper-coach://loc"], a[href*="#paper-coach-loc"] {
  display: inline-flex;
  align-items: center;
  gap: 2px;
  padding: 1px 7px;
  margin: 0 2px;
  border-radius: 999px;
  background: var(--pc-accent-soft);
  color: var(--pc-accent) !important;
  font-size: 0.88em;
  font-weight: 500;
  text-decoration: none !important;
  cursor: pointer;
  transition: background 0.15s, opacity 0.15s;
}
a[href^="paper-coach://loc"]:hover, a[href*="#paper-coach-loc"]:hover {
  opacity: 0.86;
}

/* Floating Selection Toolbar { \u7FFB\u8BD1 ; \u5F15\u7528 } */
.pc-sel-popover {
  position: fixed;
  z-index: 10050;
  display: inline-flex;
  align-items: center;
  gap: 2px;
  padding: 3px;
  border-radius: 8px;
  background: var(--pc-bg-elevated);
  border: 1px solid var(--pc-border);
  box-shadow: var(--pc-shadow);
  transform: translate(-50%, -100%);
  margin-top: -8px;
  user-select: none;
}
.pc-sel-btn {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 4px 10px;
  border: none;
  border-radius: 6px;
  background: transparent;
  color: var(--pc-text);
  font-size: 12px;
  font-weight: 500;
  cursor: pointer;
}
.pc-sel-btn:hover {
  background: var(--pc-accent-soft);
  color: var(--pc-accent);
}
.pc-sel-divider {
  width: 1px;
  height: 14px;
  background: var(--pc-border);
}

/* Non-modal Translation Card */
.pc-trans-card {
  position: fixed;
  z-index: 10055;
  width: min(390px, calc(100vw - 24px));
  max-height: 320px;
  display: flex;
  flex-direction: column;
  background: var(--pc-bg-elevated);
  border: 1px solid var(--pc-border);
  border-radius: 12px;
  box-shadow: var(--pc-shadow);
  color: var(--pc-text);
  overflow: hidden;
}
.pc-trans-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 8px 12px;
  border-bottom: 1px solid var(--pc-border);
  font-size: 12px;
  font-weight: 600;
  background: var(--pc-bg-subtle);
}
.pc-trans-body {
  padding: 10px 12px;
  font-size: 13px;
  line-height: 1.65;
  overflow-y: auto;
  white-space: pre-wrap;
  word-break: break-word;
}
.pc-trans-footer {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 6px 12px;
  border-top: 1px solid var(--pc-border);
  font-size: 11px;
  color: var(--pc-text-muted);
}

/* Paper Quote Dock above Composer & Inline Chips */
.pc-quote-dock {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 6px;
  padding: 6px 10px;
  margin-bottom: 6px;
  border-radius: 10px;
  background: var(--pc-bg-subtle);
  border: 1px solid var(--pc-border);
}
.pc-quote-pill {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  max-width: 100%;
  padding: 3px 8px;
  border-radius: 999px;
  background: var(--pc-bg-elevated);
  border: 1px solid var(--pc-border);
  color: var(--pc-text);
  font-size: 12px;
  cursor: pointer;
}
.pc-quote-pill:hover {
  border-color: var(--pc-accent);
  color: var(--pc-accent);
}
.pc-quote-pill-text {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  max-width: 260px;
}

/* Assistant Inline Anchor Badge [\u{1F4CD} \xA78 \xB7 p.9](#paper-coach-loc?...) */
a[href^='#paper-coach-loc'] {
  display: inline-flex;
  align-items: center;
  gap: 3px;
  padding: 1px 7px;
  margin: 0 2px;
  border-radius: 999px;
  background: var(--pc-accent-soft);
  color: var(--pc-accent) !important;
  font-size: 0.86em;
  font-weight: 500;
  text-decoration: none !important;
  border: 1px solid rgba(59, 130, 246, 0.28);
  cursor: pointer;
  vertical-align: baseline;
}
a[href^='#paper-coach-loc']:hover {
  background: rgba(59, 130, 246, 0.2);
}

/* Roadmap & Learning Goals Floating / Docked Panel */
.pc-roadmap-float {
  position: fixed;
  z-index: 900;
  width: 300px;
  max-width: calc(100vw - 32px);
  background: var(--pc-bg-elevated);
  border: 1px solid var(--pc-border);
  border-radius: 12px;
  box-shadow: var(--pc-shadow);
  color: var(--pc-text);
  font-size: 12px;
  overflow: hidden;
}
.pc-roadmap-float-collapsed {
  width: auto;
  border-radius: 999px;
}
.pc-roadmap-docked {
  border-bottom: 1px solid var(--pc-border);
  background: var(--pc-bg);
  font-size: 12px;
  flex-shrink: 0;
}
.pc-roadmap-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  padding: 7px 11px;
  cursor: grab;
  user-select: none;
  background: var(--pc-bg-subtle);
}
.pc-roadmap-body {
  padding: 9px 11px;
  max-height: 310px;
  overflow-y: auto;
  display: flex;
  flex-direction: column;
  gap: 10px;
}
.pc-roadmap-sec-title {
  font-size: 11px;
  font-weight: 600;
  color: var(--pc-text-muted);
  margin-bottom: 4px;
  display: flex;
  align-items: center;
  justify-content: space-between;
}
.pc-goal-row {
  display: flex;
  align-items: flex-start;
  gap: 6px;
  padding: 3px 4px;
  border-radius: 6px;
  line-height: 1.45;
  cursor: pointer;
}
.pc-goal-row:hover { background: var(--pc-bg-subtle); }
.pc-sec-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 6px;
  padding: 5px 7px;
  border-radius: 7px;
  border: 1px solid transparent;
  cursor: pointer;
}
.pc-sec-row:hover {
  background: var(--pc-bg-subtle);
}
.pc-sec-row-current {
  background: var(--pc-accent-soft);
  border-color: rgba(59, 130, 246, 0.35);
}
.pc-sec-row-done {
  opacity: 0.72;
}

/* Settings Modal / Panel */
.pc-modal-backdrop {
  position: fixed;
  inset: 0;
  z-index: 10100;
  background: rgba(0, 0, 0, 0.42);
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 16px;
}
.pc-modal-card {
  width: min(480px, 100%);
  max-height: 85vh;
  overflow-y: auto;
  background: var(--pc-bg-elevated);
  color: var(--pc-text);
  border: 1px solid var(--pc-border);
  border-radius: 14px;
  box-shadow: var(--pc-shadow);
  padding: 16px 18px;
  display: flex;
  flex-direction: column;
  gap: 12px;
  font-size: 13px;
}
.pc-field {
  display: flex;
  flex-direction: column;
  gap: 4px;
}
.pc-field label {
  font-size: 12px;
  font-weight: 600;
}
.pc-input, .pc-select, .pc-textarea {
  padding: 6px 9px;
  border-radius: 7px;
  border: 1px solid var(--pc-border);
  background: var(--pc-bg);
  color: var(--pc-text);
  font-size: 12.5px;
  outline: none;
}
.pc-input:focus, .pc-select:focus, .pc-textarea:focus {
  border-color: var(--pc-accent);
}
`;

// src/client/PaperPdfViewer.tsx
var import_react3 = __toESM(require("react"), 1);

// src/client/RoadmapPanel.tsx
var import_react = __toESM(require("react"), 1);
var import_react_dom = require("react-dom");
var import_jsx_runtime = require("react/jsx-runtime");
var FLOAT_POS_KEY = "dsh-paper-coach:roadmap-pos";
function readSavedPos() {
  try {
    const raw = localStorage.getItem(FLOAT_POS_KEY);
    if (raw) {
      const p = JSON.parse(raw);
      if (typeof p.right === "number" && typeof p.top === "number") return p;
    }
  } catch {
  }
  return { right: 24, top: 60 };
}
function stageLabelOf(stage, t) {
  switch (stage) {
    case "overview":
      return t("roadmap.stage.overview");
    case "reading":
      return t("roadmap.stage.reading");
    case "quiz":
      return t("roadmap.stage.quiz");
    case "summary":
      return t("roadmap.stage.summary");
    case "completed":
      return t("roadmap.stage.completed");
    default:
      return t("roadmap.stage.reading");
  }
}
var RoadmapPanelContent = import_react.default.memo(function RoadmapPanelContent2({
  controller,
  sessionId,
  docked,
  t
}) {
  const state = (0, import_react.useSyncExternalStore)(
    controller.subscribe,
    () => controller.getSessionState(sessionId)
  );
  const settings = (0, import_react.useSyncExternalStore)(
    controller.subscribe,
    () => controller.getSettings()
  );
  const [collapsed, setCollapsed] = (0, import_react.useState)(false);
  const [pos, setPos] = (0, import_react.useState)(readSavedPos);
  const dragRef = (0, import_react.useRef)(null);
  const plan = state?.plan;
  if (!plan) return null;
  if (docked && settings.roadmapDockMode !== "pdf_top") return null;
  if (!docked && settings.roadmapDockMode !== "float") return null;
  const totalSec = plan.sections.length;
  const doneSec = plan.sections.filter((s) => s.status === "done").length;
  const currentSec = plan.sections.find((s) => s.status === "current") ?? plan.sections.find((s) => s.status === "pending");
  const allSectionsDone = totalSec > 0 && doneSec === totalSec;
  const onHeaderMouseDown = (e) => {
    if (docked || e.button !== 0) return;
    if (e.target.closest("button")) return;
    e.preventDefault();
    dragRef.current = {
      startX: e.clientX,
      startY: e.clientY,
      origRight: pos.right,
      origTop: pos.top,
      moved: false
    };
    const onMove = (ev) => {
      const d = dragRef.current;
      if (!d) return;
      const dx = ev.clientX - d.startX;
      const dy = ev.clientY - d.startY;
      if (Math.abs(dx) > 3 || Math.abs(dy) > 3) d.moved = true;
      const nextRight = Math.max(8, Math.min(window.innerWidth - 180, d.origRight - dx));
      const nextTop = Math.max(8, Math.min(window.innerHeight - 60, d.origTop + dy));
      setPos({ right: nextRight, top: nextTop });
    };
    const onUp = () => {
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
      if (dragRef.current?.moved) {
        setPos((cur) => {
          try {
            localStorage.setItem(FLOAT_POS_KEY, JSON.stringify(cur));
          } catch {
          }
          return cur;
        });
      }
      dragRef.current = null;
    };
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
  };
  const toggleDockMode = () => {
    const next = docked ? "float" : "pdf_top";
    void controller.updateSettings({ roadmapDockMode: next });
  };
  const summaryBadge = currentSec ? "\xA7" + (normalizeSectionId(currentSec.section) || currentSec.section) + " (" + doneSec + "/" + totalSec + ")" : totalSec > 0 ? "\u2713 " + doneSec + "/" + totalSec : stageLabelOf(plan.stage, t);
  const inner = /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(
    "div",
    {
      className: docked ? "pc-roadmap-docked" : "pc-roadmap-float" + (collapsed ? " pc-roadmap-float-collapsed" : ""),
      style: docked ? void 0 : { top: pos.top + "px", right: pos.right + "px" },
      children: [
        /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { className: "pc-roadmap-header", onMouseDown: onHeaderMouseDown, children: [
          /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { style: { display: "flex", alignItems: "center", gap: 6, minWidth: 0 }, children: [
            /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", { style: { fontWeight: 600, whiteSpace: "nowrap" }, children: [
              "\u{1F4D6} ",
              t("roadmap.capsulePrefix")
            ] }),
            /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { className: "pc-badge", children: summaryBadge }),
            !collapsed && /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { style: { color: "var(--pc-text-muted)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", maxWidth: 110 }, title: plan.paperTitle, children: plan.paperTitle })
          ] }),
          /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { style: { display: "flex", alignItems: "center", gap: 4, flexShrink: 0 }, children: [
            !collapsed && /* @__PURE__ */ (0, import_jsx_runtime.jsx)(
              "button",
              {
                type: "button",
                className: "pc-btn",
                style: { padding: "2px 6px", fontSize: 11 },
                title: docked ? t("roadmap.undockToChat") : t("roadmap.dockToPdf"),
                onClick: toggleDockMode,
                children: docked ? "\u2197" : "\u21E5"
              }
            ),
            /* @__PURE__ */ (0, import_jsx_runtime.jsx)(
              "button",
              {
                type: "button",
                className: "pc-btn",
                style: { padding: "2px 6px", fontSize: 11 },
                title: collapsed ? "\u5C55\u5F00\u7CBE\u8BFB\u8DEF\u7EBF" : "\u6536\u8D77\u7CBE\u8BFB\u8DEF\u7EBF",
                "aria-expanded": !collapsed,
                onClick: () => setCollapsed((c) => !c),
                children: collapsed ? "\u25BE" : "\u25B4"
              }
            )
          ] })
        ] }),
        !collapsed && /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { className: "pc-roadmap-body", children: [
          /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { style: { display: "flex", alignItems: "center", justifyContent: "space-between", fontSize: 11, color: "var(--pc-text-muted)" }, children: [
            /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", { children: [
              "\u9636\u6BB5\uFF1A",
              stageLabelOf(plan.stage, t)
            ] }),
            plan.pdfPath && /* @__PURE__ */ (0, import_jsx_runtime.jsx)(
              "button",
              {
                type: "button",
                className: "pc-btn",
                style: { padding: "1px 6px", fontSize: 11 },
                onClick: () => controller.jumpToPaperLocation(sessionId, { pdfPath: plan.pdfPath, paperTitle: plan.paperTitle }),
                children: "\u6253\u5F00 PDF"
              }
            )
          ] }),
          plan.goals.length > 0 && /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [
            /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { className: "pc-roadmap-sec-title", children: [
              /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", { children: [
                "\u{1F3AF} ",
                t("roadmap.goalsTitle")
              ] }),
              /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", { children: [
                plan.goals.filter((g) => g.done).length,
                "/",
                plan.goals.length
              ] })
            ] }),
            plan.goals.map((g) => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(
              "div",
              {
                className: "pc-goal-row",
                onClick: () => void controller.toggleGoalDone(sessionId, g.id),
                children: [
                  /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { style: { color: g.done ? "#10b981" : "var(--pc-text-muted)", flexShrink: 0 }, children: g.done ? "\u2611" : "\u2610" }),
                  /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { style: { textDecoration: g.done ? "line-through" : "none", opacity: g.done ? 0.72 : 1 }, children: g.text })
                ]
              },
              g.id
            ))
          ] }),
          plan.sections.length > 0 && /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [
            /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { className: "pc-roadmap-sec-title", children: [
              /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", { children: [
                "\u{1F5FA}\uFE0F ",
                t("roadmap.sectionsTitle")
              ] }),
              /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", { children: [
                doneSec,
                "/",
                totalSec
              ] })
            ] }),
            /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", { style: { display: "flex", flexDirection: "column", gap: 4 }, children: plan.sections.map((sec) => {
              const normSec = normalizeSectionId(sec.section) || sec.section;
              const icon = sec.status === "done" ? "\u2713" : sec.status === "current" ? "\u25CF" : "\u25CB";
              const rowCls = "pc-sec-row" + (sec.status === "current" ? " pc-sec-row-current" : "") + (sec.status === "done" ? " pc-sec-row-done" : "");
              return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(
                "div",
                {
                  className: rowCls,
                  onClick: () => controller.jumpToPaperLocation(sessionId, {
                    pdfPath: plan.pdfPath,
                    paperTitle: plan.paperTitle,
                    section: normSec,
                    page: sec.page
                  }),
                  title: sec.note || "\u70B9\u51FB\u5728\u4FA7\u8FB9\u680F\u5B9A\u4F4D\u5230\u8BE5\u7AE0\u8282",
                  children: [
                    /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { style: { display: "flex", alignItems: "center", gap: 6, minWidth: 0 }, children: [
                      /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { style: { color: sec.status === "done" ? "#10b981" : sec.status === "current" ? "var(--pc-accent)" : "var(--pc-text-muted)", fontWeight: 700 }, children: icon }),
                      /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", { style: { fontWeight: 600 }, children: [
                        "\xA7",
                        normSec
                      ] }),
                      sec.title && /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { style: { color: "var(--pc-text-muted)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }, children: sec.title })
                    ] }),
                    sec.status !== "done" && /* @__PURE__ */ (0, import_jsx_runtime.jsx)(
                      "button",
                      {
                        type: "button",
                        className: "pc-btn",
                        style: { padding: "1px 6px", fontSize: 10.5, flexShrink: 0 },
                        onClick: (e) => {
                          e.stopPropagation();
                          void controller.advanceSectionDone(sessionId, sec.id);
                        },
                        children: "\u8BFB\u5B8C"
                      }
                    )
                  ]
                },
                sec.id
              );
            }) })
          ] }),
          allSectionsDone && plan.stage === "reading" && /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(
            "button",
            {
              type: "button",
              className: "pc-btn pc-btn-primary",
              style: { width: "100%", justifyContent: "center", padding: "6px 10px", fontWeight: 600 },
              onClick: () => void controller.startQuizFromPanel(sessionId),
              children: [
                "\u2728 ",
                t("roadmap.startQuiz")
              ]
            }
          )
        ] })
      ]
    }
  );
  if (docked) return inner;
  return (0, import_react_dom.createPortal)(inner, document.body);
});

// src/client/SelectionToolbar.tsx
var import_react2 = require("react");
var import_react_dom2 = require("react-dom");
var import_jsx_runtime2 = require("react/jsx-runtime");
function SelectionToolbar({
  controller,
  sessionId,
  pdfPath,
  paperTitle,
  selection,
  onDismiss,
  t
}) {
  const [transCard, setTransCard] = (0, import_react2.useState)(null);
  const abortRef = (0, import_react2.useRef)(null);
  (0, import_react2.useEffect)(() => () => abortRef.current?.abort(), []);
  const runTranslation = async (sel) => {
    const settings = controller.getSettings();
    if (settings.translationMode === "main_agent") {
      controller.askMainAgentTranslate(sessionId, {
        pdfPath,
        paperTitle,
        page: sel.page,
        section: sel.section,
        text: sel.text,
        rects: sel.rects
      });
      window.getSelection()?.removeAllRanges();
      onDismiss();
      return;
    }
    abortRef.current?.abort();
    const ctrl = new AbortController();
    abortRef.current = ctrl;
    setTransCard({ source: sel, loading: true });
    onDismiss();
    try {
      const res = await controller.apiPost(
        "translate",
        {
          sessionId,
          text: sel.text,
          paperTitle,
          page: sel.page,
          section: sel.section
        },
        ctrl.signal
      );
      if (ctrl.signal.aborted) return;
      setTransCard({
        source: sel,
        loading: false,
        result: res.translation,
        modelInfo: res.providerUsed + " \xB7 " + res.modelUsed
      });
    } catch (err) {
      if (ctrl.signal.aborted) return;
      setTransCard({
        source: sel,
        loading: false,
        error: err instanceof Error ? err.message : String(err)
      });
    }
  };
  const handleQuote = (sel) => {
    controller.addQuote(sessionId, {
      pdfPath,
      paperTitle,
      page: sel.page,
      section: sel.section,
      text: sel.text,
      rects: sel.rects
    });
    window.getSelection()?.removeAllRanges();
    onDismiss();
  };
  const clampedLeft = selection ? Math.max(80, Math.min(window.innerWidth - 80, selection.anchorX)) : 0;
  const clampedTop = selection ? Math.max(46, Math.min(window.innerHeight - 20, selection.anchorY)) : 0;
  const cardSource = transCard?.source;
  const cardLeft = cardSource ? Math.max(12, Math.min(window.innerWidth - 406, cardSource.anchorX - 180)) : 0;
  const cardTop = cardSource ? Math.max(48, Math.min(window.innerHeight - 330, cardSource.anchorY + 14)) : 0;
  return /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)(import_jsx_runtime2.Fragment, { children: [
    selection && (0, import_react_dom2.createPortal)(
      /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)(
        "div",
        {
          className: "pc-sel-popover",
          style: { left: clampedLeft + "px", top: clampedTop + "px" },
          onMouseDown: (e) => {
            e.preventDefault();
            e.stopPropagation();
          },
          children: [
            /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)("button", { type: "button", className: "pc-sel-btn", onClick: () => void runTranslation(selection), children: [
              /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("span", { children: "\u{1F310}" }),
              /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("span", { children: t("selection.translate") })
            ] }),
            /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("div", { className: "pc-sel-divider" }),
            /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)("button", { type: "button", className: "pc-sel-btn", onClick: () => handleQuote(selection), children: [
              /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("span", { children: "\u275D" }),
              /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("span", { children: t("selection.quote") })
            ] })
          ]
        }
      ),
      document.body
    ),
    transCard && (0, import_react_dom2.createPortal)(
      /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)("div", { className: "pc-trans-card", style: { left: cardLeft + "px", top: cardTop + "px" }, children: [
        /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)("div", { className: "pc-trans-header", children: [
          /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)("span", { children: [
            "\u{1F310} ",
            t("translate.title"),
            " \xB7 p.",
            transCard.source.page,
            transCard.source.section ? " \xA7" + (normalizeSectionId(transCard.source.section) || transCard.source.section) : ""
          ] }),
          /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)("div", { style: { display: "flex", gap: 4 }, children: [
            /* @__PURE__ */ (0, import_jsx_runtime2.jsx)(
              "button",
              {
                type: "button",
                className: "pc-btn",
                style: { padding: "1px 6px", fontSize: 11 },
                title: t("toolbar.settings"),
                onClick: () => controller.openSettingsModal(sessionId),
                children: "\u2699"
              }
            ),
            /* @__PURE__ */ (0, import_jsx_runtime2.jsx)(
              "button",
              {
                type: "button",
                className: "pc-btn",
                style: { padding: "1px 6px", fontSize: 11 },
                onClick: () => {
                  abortRef.current?.abort();
                  setTransCard(null);
                },
                children: "\u2715"
              }
            )
          ] })
        ] }),
        /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)("div", { className: "pc-trans-body", children: [
          transCard.loading && /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("span", { style: { color: "var(--pc-text-muted)" }, children: t("translate.loading") }),
          transCard.error && /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)("div", { style: { color: "#ef4444" }, children: [
            /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("div", { children: transCard.error }),
            /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)("div", { style: { marginTop: 8, display: "flex", gap: 6 }, children: [
              /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("button", { type: "button", className: "pc-btn", onClick: () => void runTranslation(transCard.source), children: t("translate.retry") }),
              /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("button", { type: "button", className: "pc-btn", onClick: () => controller.openSettingsModal(sessionId), children: "\u914D\u7F6E\u7FFB\u8BD1 API" })
            ] })
          ] }),
          transCard.result && /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("div", { children: transCard.result })
        ] }),
        /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)("div", { className: "pc-trans-footer", children: [
          /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("span", { style: { overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", maxWidth: 180 }, children: transCard.modelInfo || "" }),
          /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)("div", { style: { display: "flex", gap: 5 }, children: [
            transCard.result && /* @__PURE__ */ (0, import_jsx_runtime2.jsx)(
              "button",
              {
                type: "button",
                className: "pc-btn",
                style: { padding: "2px 7px", fontSize: 11 },
                onClick: () => {
                  void navigator.clipboard?.writeText(transCard.result || "");
                  setTransCard((prev) => prev ? { ...prev, copied: true } : null);
                },
                children: transCard.copied ? t("translate.copied") : t("translate.copy")
              }
            ),
            /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)(
              "button",
              {
                type: "button",
                className: "pc-btn",
                style: { padding: "2px 7px", fontSize: 11 },
                onClick: () => {
                  controller.addQuote(sessionId, {
                    pdfPath,
                    paperTitle,
                    page: transCard.source.page,
                    section: transCard.source.section,
                    text: transCard.source.text,
                    rects: transCard.source.rects
                  });
                  setTransCard(null);
                },
                children: [
                  "+ ",
                  t("selection.quote")
                ]
              }
            )
          ] })
        ] })
      ] }),
      document.body
    )
  ] });
}

// src/client/render-resources.ts
var PdfPageCache = class {
  constructor(maxPages = 8, maxPixels = 24 * 1024 * 1024) {
    this.maxPages = maxPages;
    this.maxPixels = maxPixels;
  }
  pages = /* @__PURE__ */ new Map();
  active = /* @__PURE__ */ new Set();
  setActive(page, active) {
    if (active) {
      this.active.add(page);
      this.touch(page);
    } else this.active.delete(page);
    this.trim();
  }
  touch(page) {
    const entry = this.pages.get(page);
    if (entry) {
      this.pages.delete(page);
      this.pages.set(page, entry);
    }
  }
  retain(page, pixels, evict) {
    this.pages.delete(page);
    this.pages.set(page, { pixels, evict });
    this.trim();
  }
  forget(page) {
    this.pages.delete(page);
    this.active.delete(page);
  }
  trim() {
    let pixels = [...this.pages.values()].reduce((n, p) => n + p.pixels, 0);
    for (const [page, entry] of this.pages) {
      if (this.pages.size <= this.maxPages && pixels <= this.maxPixels) break;
      if (this.active.has(page)) continue;
      this.pages.delete(page);
      pixels -= entry.pixels;
      entry.evict();
    }
  }
};
var PdfRenderQueue = class {
  constructor(concurrency = 2) {
    this.concurrency = concurrency;
  }
  running = 0;
  pending = [];
  run(signal, work) {
    return new Promise((resolve, reject) => {
      if (signal.aborted) {
        reject(signal.reason);
        return;
      }
      const cancelQueued = () => {
        const i = this.pending.indexOf(start);
        if (i >= 0) this.pending.splice(i, 1);
        reject(signal.reason);
      };
      const start = () => {
        signal.removeEventListener("abort", cancelQueued);
        if (signal.aborted) {
          reject(signal.reason);
          return;
        }
        this.running++;
        Promise.resolve().then(work).then(() => {
          this.running--;
          this.drain();
          resolve();
        }, (error) => {
          this.running--;
          this.drain();
          reject(error);
        });
      };
      signal.addEventListener("abort", cancelQueued, { once: true });
      this.pending.push(start);
      this.drain();
    });
  }
  drain() {
    while (this.running < this.concurrency && this.pending.length) this.pending.shift()();
  }
};

// src/client/PaperPdfViewer.tsx
var import_jsx_runtime3 = require("react/jsx-runtime");
function samePdfPath(a, b) {
  if (!a || !b) return true;
  const na = a.replace(/\\/g, "/").replace(/\/+$/, "").toLowerCase();
  const nb = b.replace(/\\/g, "/").replace(/\/+$/, "").toLowerCase();
  return na === nb || na.endsWith("/" + nb) || nb.endsWith("/" + na);
}
function mergeLineRects(raw) {
  if (raw.length <= 1) return raw;
  const sorted = [...raw].sort((a, b) => Math.abs(a.y - b.y) < 8e-3 ? a.x - b.x : a.y - b.y);
  const merged = [];
  for (const r of sorted) {
    if (r.w <= 1e-3 || r.h <= 1e-3) continue;
    const last = merged[merged.length - 1];
    if (last && Math.abs(last.y - r.y) < 9e-3 && Math.abs(last.h - r.h) < 0.012 && r.x <= last.x + last.w + 0.022) {
      const right = Math.max(last.x + last.w, r.x + r.w);
      last.x = Math.min(last.x, r.x);
      last.w = right - last.x;
      last.y = Math.min(last.y, r.y);
      last.h = Math.max(last.h, r.h);
    } else {
      merged.push({ ...r });
    }
  }
  return merged;
}
function computeSpanRangeRects(shellEl, spanEls, spanTexts, queryText) {
  const ranges = matchQuoteInSpans(spanTexts, queryText);
  if (ranges.length === 0) return [];
  const shellBox = shellEl.getBoundingClientRect();
  if (shellBox.width <= 0 || shellBox.height <= 0) return [];
  const rawRects = [];
  for (const seg of ranges) {
    const span = spanEls[seg.spanIndex];
    const textNode = span?.firstChild;
    if (!span || !textNode || textNode.nodeType !== Node.TEXT_NODE) continue;
    const maxLen = textNode.textContent?.length ?? 0;
    const start = Math.max(0, Math.min(maxLen, seg.startOffset));
    const end = Math.max(start, Math.min(maxLen, seg.endOffset));
    if (end <= start) continue;
    try {
      const domRange = document.createRange();
      domRange.setStart(textNode, start);
      domRange.setEnd(textNode, end);
      const clientRects = domRange.getClientRects();
      for (let i = 0; i < clientRects.length; i++) {
        const cr = clientRects[i];
        if (cr.width < 1 || cr.height < 1) continue;
        rawRects.push({
          x: Math.max(0, Math.min(1, (cr.left - shellBox.left) / shellBox.width)),
          y: Math.max(0, Math.min(1, (cr.top - shellBox.top) / shellBox.height)),
          w: Math.max(0, Math.min(1, cr.width / shellBox.width)),
          h: Math.max(0, Math.min(1, cr.height / shellBox.height))
        });
      }
    } catch {
    }
  }
  return mergeLineRects(rawRects);
}
async function extractPdfSections(pdfDoc, cancelled = () => false) {
  const sections = [];
  const seenIds = /* @__PURE__ */ new Set();
  const pushEntry = (entry) => {
    const key = entry.id.toLowerCase();
    if (!key || seenIds.has(key)) return;
    seenIds.add(key);
    sections.push(entry);
  };
  try {
    const outline = await pdfDoc.getOutline();
    if (Array.isArray(outline) && outline.length > 0) {
      const walk = async (items, depth) => {
        if (depth > 3) return;
        for (const item of items) {
          if (cancelled()) return;
          const rawTitle = String(item?.title || "").replace(/\s+/g, " ").trim();
          if (rawTitle) {
            try {
              const dest = typeof item.dest === "string" ? await pdfDoc.getDestination(item.dest) : item.dest;
              if (Array.isArray(dest) && dest[0]) {
                const pageIdx = await pdfDoc.getPageIndex(dest[0]);
                const pageNum = pageIdx + 1;
                let yRatio = 0;
                if (typeof dest[3] === "number") {
                  const pageObj = await pdfDoc.getPage(pageNum);
                  const view = pageObj.view || [0, 0, 612, 792];
                  const h = (view[3] ?? 792) - (view[1] ?? 0);
                  if (h > 0) {
                    yRatio = Math.max(0, Math.min(0.95, ((view[3] ?? 792) - dest[3]) / h));
                  }
                }
                const parsed = parseSectionHeadingLine(rawTitle);
                const id = parsed?.id || normalizeSectionId(rawTitle) || rawTitle.slice(0, 32);
                pushEntry({ id, rawTitle, page: pageNum, yRatio });
              }
            } catch {
            }
          }
          if (Array.isArray(item?.items) && item.items.length > 0) {
            await walk(item.items, depth + 1);
          }
        }
      };
      await walk(outline, 0);
    }
  } catch {
  }
  if (sections.length >= 3) {
    return sections.sort((a, b) => a.page !== b.page ? a.page - b.page : (a.yRatio ?? 0) - (b.yRatio ?? 0));
  }
  const maxScanPages = Math.min(Number(pdfDoc.numPages) || 0, 45);
  for (let p = 1; p <= maxScanPages; p++) {
    if (cancelled()) return [];
    await new Promise((resolve) => setTimeout(resolve, 0));
    if (cancelled()) return [];
    try {
      const page = await pdfDoc.getPage(p);
      const view = page.view || [0, 0, 612, 792];
      const yMin = view[1] ?? 0;
      const yMax = view[3] ?? 792;
      const pageH = Math.max(1, yMax - yMin);
      const tc = await page.getTextContent();
      const items = (tc?.items || []).filter((it) => typeof it?.str === "string" && it.str.trim().length > 0);
      let curText = "";
      let curY = null;
      let curRight = null;
      const flushLine = () => {
        if (!curText || curY === null) return;
        const parsed = parseSectionHeadingLine(curText);
        if (parsed) {
          const yRatio = Math.max(0, Math.min(0.95, (yMax - curY) / pageH));
          pushEntry({ id: parsed.id, rawTitle: parsed.rawTitle, page: p, yRatio });
        }
        curText = "";
        curY = null;
        curRight = null;
      };
      for (const it of items) {
        const tr = it.transform || [1, 0, 0, 1, 0, 0];
        const x = Number(tr[4]) || 0;
        const y = Number(tr[5]) || 0;
        const w = Number(it.width) || 0;
        if (curY === null || Math.abs(y - curY) > 3.5 || curRight !== null && (x - curRight > 28 || x < curRight - 15)) {
          flushLine();
          curText = it.str;
          curY = y;
          curRight = x + w;
        } else {
          const gap = curRight !== null ? x - curRight : 0;
          curText += (gap > 1.8 && !curText.endsWith(" ") && !it.str.startsWith(" ") ? " " : "") + it.str;
          curRight = Math.max(curRight ?? x + w, x + w);
        }
      }
      flushLine();
    } catch {
    }
  }
  return sections.sort((a, b) => a.page !== b.page ? a.page - b.page : (a.yRatio ?? 0) - (b.yRatio ?? 0));
}
var PdfPageView = import_react3.default.memo(function PdfPageView2({
  engine,
  pdfDoc,
  pageNumber,
  scale,
  renderScale,
  visible,
  cache,
  queue,
  defaultDim,
  scrollRoot,
  forceRender,
  highlights,
  flashOverlay,
  registerPageEl
}) {
  const shellRef = (0, import_react3.useRef)(null);
  const canvasRef = (0, import_react3.useRef)(null);
  const textHostRef = (0, import_react3.useRef)(null);
  const [nearViewport, setNearViewport] = (0, import_react3.useState)(pageNumber <= 2);
  const [pageDim, setPageDim] = (0, import_react3.useState)(defaultDim);
  const [textReadyRev, setTextReadyRev] = (0, import_react3.useState)(0);
  const spansRef = (0, import_react3.useRef)({ els: [], texts: [] });
  const [retained, setRetained] = (0, import_react3.useState)(false);
  const [paintedScale, setPaintedScale] = (0, import_react3.useState)(scale);
  const completedScale = (0, import_react3.useRef)(null);
  const shouldRender = visible && (nearViewport || forceRender);
  (0, import_react3.useEffect)(() => {
    cache.setActive(pageNumber, shouldRender);
  }, [cache, pageNumber, shouldRender]);
  (0, import_react3.useEffect)(() => () => cache.forget(pageNumber), [cache, pageNumber]);
  const setShell = (0, import_react3.useCallback)(
    (el) => {
      shellRef.current = el;
      registerPageEl(pageNumber, el);
    },
    [pageNumber, registerPageEl]
  );
  (0, import_react3.useEffect)(() => {
    const el = shellRef.current;
    if (!el || !scrollRoot || !visible) return;
    const io = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.target === el) {
            setNearViewport(entry.isIntersecting);
          }
        }
      },
      { root: scrollRoot, rootMargin: "500px 0px" }
    );
    io.observe(el);
    return () => io.disconnect();
  }, [scrollRoot, visible]);
  (0, import_react3.useEffect)(() => {
    if (!shouldRender || !pdfDoc) return;
    if (completedScale.current === renderScale) {
      cache.touch(pageNumber);
      return;
    }
    const abort = new AbortController();
    let renderTask = null;
    let textLayerInstance = null;
    void queue.run(abort.signal, async () => {
      const page = await pdfDoc.getPage(pageNumber);
      if (abort.signal.aborted) return;
      const baseVp = page.getViewport({ scale: 1 });
      setPageDim((cur) => cur.width === baseVp.width && cur.height === baseVp.height ? cur : { width: baseVp.width, height: baseVp.height });
      const viewport = page.getViewport({ scale: renderScale });
      const canvas = canvasRef.current;
      const textHost = textHostRef.current;
      if (!canvas || !textHost) return;
      const staging = document.createElement("canvas");
      const dpr = Math.min(window.devicePixelRatio || 1, 2.5);
      staging.width = Math.floor(viewport.width * dpr);
      staging.height = Math.floor(viewport.height * dpr);
      const ctx2d = staging.getContext("2d");
      if (!ctx2d) return;
      ctx2d.setTransform(dpr, 0, 0, dpr, 0, 0);
      renderTask = page.render({ canvasContext: ctx2d, viewport });
      await renderTask.promise;
      if (abort.signal.aborted) return;
      const layerDiv = document.createElement("div");
      layerDiv.className = "textLayer";
      layerDiv.style.setProperty("--scale-factor", String(viewport.scale));
      layerDiv.style.setProperty("--total-scale-factor", String(viewport.scale));
      textLayerInstance = new engine.TextLayer({ textContentSource: page.streamTextContent(), container: layerDiv, viewport });
      await textLayerInstance.render();
      if (abort.signal.aborted) return;
      canvas.width = staging.width;
      canvas.height = staging.height;
      canvas.style.width = `${viewport.width}px`;
      canvas.style.height = `${viewport.height}px`;
      canvas.getContext("2d")?.drawImage(staging, 0, 0);
      textHost.replaceChildren(layerDiv);
      const els = Array.from(layerDiv.querySelectorAll("span"));
      spansRef.current = { els, texts: els.map((s) => s.textContent ?? "") };
      completedScale.current = renderScale;
      setPaintedScale(renderScale);
      setRetained(true);
      setTextReadyRev((r) => r + 1);
      cache.retain(pageNumber, canvas.width * canvas.height, () => {
        completedScale.current = null;
        canvas.width = 0;
        canvas.height = 0;
        textHost.replaceChildren();
        spansRef.current = { els: [], texts: [] };
        setRetained(false);
      });
    }).catch((error) => {
      if (!abort.signal.aborted) console.warn("[paper-coach] page render failed", error);
    });
    return () => {
      abort.abort();
      try {
        renderTask?.cancel?.();
      } catch {
      }
      try {
        textLayerInstance?.cancel?.();
      } catch {
      }
    };
  }, [shouldRender, pdfDoc, pageNumber, renderScale, engine, cache, queue]);
  const [computedHighlights, setComputedHighlights] = (0, import_react3.useState)([]);
  (0, import_react3.useLayoutEffect)(() => {
    const compute = () => {
      if (!shouldRender || textReadyRev === 0 || !shellRef.current) return [];
      const { els, texts } = spansRef.current;
      if (els.length === 0) return [];
      const items = [];
      for (const hl of highlights) {
        if (hl.page && hl.page !== pageNumber) continue;
        const rects = computeSpanRangeRects(shellRef.current, els, texts, hl.text);
        if (rects.length > 0) {
          items.push({
            id: hl.id,
            color: hl.color || "amber",
            label: hl.label,
            rects
          });
        }
      }
      return items;
    };
    setComputedHighlights(compute());
  }, [shouldRender, textReadyRev, highlights, pageNumber, paintedScale, scale]);
  const scrolledFlashKeyRef = (0, import_react3.useRef)(0);
  const [computedFlashRects, setComputedFlashRects] = (0, import_react3.useState)([]);
  (0, import_react3.useLayoutEffect)(() => {
    const compute = () => {
      if (!flashOverlay || !shouldRender) return [];
      if (flashOverlay.page && flashOverlay.page !== pageNumber) return [];
      if (flashOverlay.rects && flashOverlay.rects.length > 0 && flashOverlay.page === pageNumber) {
        return flashOverlay.rects;
      }
      if (flashOverlay.queryText && textReadyRev > 0 && shellRef.current) {
        const { els, texts } = spansRef.current;
        return computeSpanRangeRects(shellRef.current, els, texts, flashOverlay.queryText);
      }
      return [];
    };
    const nextRects = compute();
    setComputedFlashRects(nextRects);
    if (flashOverlay?.scrollToMatch && flashOverlay.page === pageNumber && nextRects.length > 0 && scrolledFlashKeyRef.current !== flashOverlay.key && scrollRoot && shellRef.current) {
      scrolledFlashKeyRef.current = flashOverlay.key;
      const r0 = nextRects[0];
      const targetTop = Math.max(
        0,
        shellRef.current.offsetTop + r0.y * shellRef.current.offsetHeight - Math.min(180, scrollRoot.clientHeight * 0.28)
      );
      scrollRoot.scrollTo({ top: targetTop, behavior: "smooth" });
    }
  }, [flashOverlay, shouldRender, pageNumber, textReadyRev, paintedScale, scale, scrollRoot]);
  const widthPx = Math.round(pageDim.width * scale);
  const heightPx = Math.round(pageDim.height * scale);
  return /* @__PURE__ */ (0, import_jsx_runtime3.jsx)(
    "div",
    {
      ref: setShell,
      className: "pc-page-shell",
      "data-page": pageNumber,
      style: { width: widthPx, height: heightPx },
      children: (shouldRender || retained) && /* @__PURE__ */ (0, import_jsx_runtime3.jsxs)(import_jsx_runtime3.Fragment, { children: [
        /* @__PURE__ */ (0, import_jsx_runtime3.jsxs)("div", { style: { position: "absolute", left: 0, top: 0, width: pageDim.width * paintedScale, height: pageDim.height * paintedScale, transform: `scale(${scale / paintedScale})`, transformOrigin: "0 0" }, children: [
          /* @__PURE__ */ (0, import_jsx_runtime3.jsx)("canvas", { ref: canvasRef, className: "pc-page-canvas" }),
          /* @__PURE__ */ (0, import_jsx_runtime3.jsx)("div", { ref: textHostRef, className: "pc-text-host" })
        ] }),
        /* @__PURE__ */ (0, import_jsx_runtime3.jsxs)("div", { className: "pc-highlight-layer", children: [
          computedHighlights.map(
            (item) => item.rects.map((r, idx) => /* @__PURE__ */ (0, import_jsx_runtime3.jsxs)(import_react3.default.Fragment, { children: [
              /* @__PURE__ */ (0, import_jsx_runtime3.jsx)(
                "div",
                {
                  className: "pc-hl-rect pc-hl-" + item.color,
                  style: {
                    left: `${r.x * 100}%`,
                    top: `${r.y * 100}%`,
                    width: `${r.w * 100}%`,
                    height: `${r.h * 100}%`
                  }
                }
              ),
              idx === 0 && item.label && /* @__PURE__ */ (0, import_jsx_runtime3.jsx)(
                "span",
                {
                  className: "pc-hl-label pc-hl-label-" + item.color,
                  style: { left: `${r.x * 100}%`, top: `${r.y * 100}%` },
                  children: item.label
                }
              )
            ] }, item.id + "-" + idx))
          ),
          flashOverlay && computedFlashRects.map((r, idx) => /* @__PURE__ */ (0, import_jsx_runtime3.jsx)(
            "div",
            {
              className: "pc-hl-flash",
              style: {
                left: `${r.x * 100}%`,
                top: `${r.y * 100}%`,
                width: `${r.w * 100}%`,
                height: `${r.h * 100}%`
              }
            },
            "flash-" + flashOverlay.key + "-" + idx
          ))
        ] })
      ] })
    }
  );
});
function PaperPdfViewer({
  scope,
  path,
  title,
  mediaUrl,
  visible = true,
  controller,
  t
}) {
  const sessionId = scope?.sessionId || controller.getActiveSession() || "default";
  const scrollRef = (0, import_react3.useRef)(null);
  const pageElsRef = (0, import_react3.useRef)(/* @__PURE__ */ new Map());
  const [scrollRoot, setScrollRoot] = (0, import_react3.useState)(null);
  const [engine, setEngine] = (0, import_react3.useState)(null);
  const [pdfDoc, setPdfDoc] = (0, import_react3.useState)(null);
  const [totalPages, setTotalPages] = (0, import_react3.useState)(0);
  const [defaultDim, setDefaultDim] = (0, import_react3.useState)({ width: 612, height: 792 });
  const [sections, setSections] = (0, import_react3.useState)([]);
  const [currentPage, setCurrentPage] = (0, import_react3.useState)(1);
  const [currentSection, setCurrentSection] = (0, import_react3.useState)(void 0);
  const [outlineOpen, setOutlineOpen] = (0, import_react3.useState)(false);
  const [containerWidth, setContainerWidth] = (0, import_react3.useState)(520);
  const [zoomMode, setZoomMode] = (0, import_react3.useState)("fit");
  const [loadingError, setLoadingError] = (0, import_react3.useState)(null);
  const [loading, setLoading] = (0, import_react3.useState)(true);
  const [selection, setSelection] = (0, import_react3.useState)(null);
  const [flashOverlay, setFlashOverlay] = (0, import_react3.useState)(null);
  const [pinnedPage, setPinnedPage] = (0, import_react3.useState)(null);
  const [documentVisible, setDocumentVisible] = (0, import_react3.useState)(() => !document.hidden);
  const active = visible && documentVisible;
  const cache = (0, import_react3.useMemo)(() => new PdfPageCache(), [pdfDoc]);
  const queue = (0, import_react3.useMemo)(() => new PdfRenderQueue(2), [pdfDoc]);
  const indexedDoc = (0, import_react3.useRef)(null);
  const setScrollElement = (0, import_react3.useCallback)((el) => {
    scrollRef.current = el;
    setScrollRoot(el);
  }, []);
  (0, import_react3.useEffect)(() => {
    const update = () => setDocumentVisible(!document.hidden);
    document.addEventListener("visibilitychange", update);
    return () => document.removeEventListener("visibilitychange", update);
  }, []);
  (0, import_react3.useEffect)(() => {
    if (!active) setSelection(null);
  }, [active]);
  (0, import_react3.useEffect)(() => {
    if (pinnedPage === null) return;
    const timer = setTimeout(() => setPinnedPage(null), 900);
    return () => clearTimeout(timer);
  }, [pinnedPage]);
  const sessionState = (0, import_react3.useSyncExternalStore)(
    controller.subscribe,
    () => controller.getSessionState(sessionId)
  );
  const settings = (0, import_react3.useSyncExternalStore)(
    controller.subscribe,
    () => controller.getSettings()
  );
  const jumpTarget = (0, import_react3.useSyncExternalStore)(
    controller.subscribe,
    () => controller.getJumpTarget(sessionId)
  );
  const paperTitle = (0, import_react3.useMemo)(() => {
    if (sessionState?.activePaperTitle && samePdfPath(sessionState.activePdfPath, path)) {
      return sessionState.activePaperTitle;
    }
    return title || path.split(/[\\/]/).pop() || "Paper.pdf";
  }, [sessionState?.activePaperTitle, sessionState?.activePdfPath, path, title]);
  (0, import_react3.useEffect)(() => controller.retainSession(sessionId), [controller, sessionId]);
  (0, import_react3.useEffect)(() => {
    const el = scrollRoot;
    if (!el || !active) return;
    const updateWidth = () => {
      const w = el.clientWidth - 28;
      if (w > 160) setContainerWidth((cur) => Math.abs(cur - w) < 1 ? cur : w);
    };
    updateWidth();
    const ro = new ResizeObserver(updateWidth);
    ro.observe(el);
    return () => ro.disconnect();
  }, [scrollRoot, active]);
  const effectiveScale = (0, import_react3.useMemo)(() => {
    const fitScale = Math.max(0.5, Math.min(2.6, containerWidth / Math.max(1, defaultDim.width)));
    return zoomMode === "fit" ? fitScale : zoomMode;
  }, [containerWidth, defaultDim.width, zoomMode]);
  const [renderScale, setRenderScale] = (0, import_react3.useState)(effectiveScale);
  (0, import_react3.useEffect)(() => {
    const timer = setTimeout(() => setRenderScale(effectiveScale), 160);
    return () => clearTimeout(timer);
  }, [effectiveScale]);
  (0, import_react3.useEffect)(() => {
    let cancelled = false;
    const abort = new AbortController();
    let rawWorker = null;
    let pdfWorker = null;
    let loadingTask = null;
    let loadedDoc = null;
    setLoading(true);
    setLoadingError(null);
    setPdfDoc(null);
    setSections([]);
    setSelection(null);
    (async () => {
      try {
        const eng = await controller.loadPdfEngine();
        if (cancelled) return;
        setEngine(eng);
        let pdfRes = null;
        if (mediaUrl) {
          pdfRes = await fetch(mediaUrl, { credentials: "include", signal: abort.signal }).catch(() => null);
        }
        if (!pdfRes || !pdfRes.ok) {
          const fallbackUrl = controller.routeUrl(
            "paper-coach/pdf?sessionId=" + encodeURIComponent(sessionId) + "&path=" + encodeURIComponent(path)
          );
          pdfRes = await fetch(fallbackUrl, { credentials: "include", signal: abort.signal });
        }
        if (!pdfRes.ok) {
          throw new Error("HTTP " + pdfRes.status + " loading PDF: " + path);
        }
        const bytes = new Uint8Array(await pdfRes.arrayBuffer());
        if (cancelled) return;
        const workerBlobUrl = URL.createObjectURL(new Blob([eng.workerCode], { type: "text/javascript" }));
        try {
          rawWorker = new Worker(workerBlobUrl, { type: "module" });
        } finally {
          URL.revokeObjectURL(workerBlobUrl);
        }
        pdfWorker = new eng.PDFWorker({ port: rawWorker });
        loadingTask = eng.getDocument({ data: bytes, worker: pdfWorker });
        loadedDoc = await loadingTask.promise;
        if (cancelled) return;
        const page1 = await loadedDoc.getPage(1);
        const vp1 = page1.getViewport({ scale: 1 });
        if (cancelled) return;
        setDefaultDim({ width: vp1.width, height: vp1.height });
        setTotalPages(loadedDoc.numPages);
        setPdfDoc(loadedDoc);
        setLoading(false);
      } catch (err) {
        if (cancelled || abort.signal.aborted) return;
        setLoadingError(err instanceof Error ? err.message : String(err));
        setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
      abort.abort();
      try {
        loadingTask?.destroy?.();
      } catch {
      }
      try {
        loadedDoc?.destroy?.();
      } catch {
      }
      try {
        pdfWorker?.destroy?.();
      } catch {
      }
      try {
        rawWorker?.terminate?.();
      } catch {
      }
    };
  }, [controller, sessionId, path, mediaUrl]);
  (0, import_react3.useEffect)(() => {
    if (!pdfDoc || !active || indexedDoc.current === pdfDoc) return;
    let cancelled = false;
    void extractPdfSections(pdfDoc, () => cancelled).then((detected) => {
      if (cancelled) return;
      indexedDoc.current = pdfDoc;
      setSections(detected);
    });
    return () => {
      cancelled = true;
    };
  }, [pdfDoc, active]);
  const registerPageEl = (0, import_react3.useCallback)((page, el) => {
    if (el) pageElsRef.current.set(page, el);
    else pageElsRef.current.delete(page);
  }, []);
  const findSectionAtPosition = (0, import_react3.useCallback)(
    (page, yRatio = 0.15) => {
      if (sections.length === 0) return void 0;
      let best;
      for (const s of sections) {
        if (s.page < page || s.page === page && (s.yRatio ?? 0) <= yRatio + 0.04) {
          best = s;
        } else {
          break;
        }
      }
      return best?.id ?? sections[0]?.id;
    },
    [sections]
  );
  const scrollToLocation = (0, import_react3.useCallback)(
    (page, yRatio = 0, behavior = "smooth") => {
      const root = scrollRef.current;
      if (!root || totalPages <= 0) return;
      const clampedPage = Math.max(1, Math.min(totalPages, page));
      setPinnedPage(clampedPage);
      const pageEl = pageElsRef.current.get(clampedPage);
      if (pageEl) {
        const offsetWithinPage = Math.max(0, Math.min(0.92, yRatio)) * pageEl.offsetHeight;
        const targetTop = Math.max(0, pageEl.offsetTop - 16 + offsetWithinPage);
        root.scrollTo({ top: targetTop, behavior });
      }
    },
    [totalPages]
  );
  (0, import_react3.useEffect)(() => {
    if (!active || !jumpTarget || !pdfDoc || totalPages <= 0) return;
    if (jumpTarget.pdfPath && !samePdfPath(jumpTarget.pdfPath, path)) return;
    if (jumpTarget.section && !jumpTarget.page && sections.length === 0) {
      const timer = setTimeout(() => {
        controller.consumeJumpTarget(sessionId, jumpTarget.nonce);
      }, 1200);
      return () => clearTimeout(timer);
    }
    const matchedSec = jumpTarget.section ? findBestSectionMatch(sections, jumpTarget.section) : void 0;
    const targetPage = jumpTarget.page ?? matchedSec?.page ?? jumpTarget.highlights?.find((h) => h.page)?.page ?? jumpTarget.flashRects?.page ?? 1;
    const hlOnTargetPage = jumpTarget.highlights?.find((h) => !h.page || h.page === targetPage) ?? jumpTarget.highlights?.[0];
    const flashPage = jumpTarget.flashRects?.page ?? (jumpTarget.queryText ? targetPage : hlOnTargetPage?.page ?? targetPage);
    const flashQuery = jumpTarget.queryText || hlOnTargetPage?.text;
    const hasExplicitY = Boolean(jumpTarget.flashRects?.rects?.[0]) || Boolean(matchedSec && matchedSec.page === targetPage && !jumpTarget.queryText);
    const targetY = jumpTarget.flashRects?.rects?.[0]?.y ?? (matchedSec && matchedSec.page === targetPage ? matchedSec.yRatio ?? 0 : 0);
    scrollToLocation(targetPage, Math.max(0, targetY - 0.04), "smooth");
    if (jumpTarget.flashRects || flashQuery) {
      const key = Date.now();
      setFlashOverlay({
        key,
        page: flashPage,
        rects: jumpTarget.flashRects?.rects,
        queryText: flashQuery,
        scrollToMatch: !hasExplicitY && flashPage === targetPage
      });
      setTimeout(() => {
        setFlashOverlay((cur) => cur?.key === key ? null : cur);
      }, 2600);
    }
    controller.consumeJumpTarget(sessionId, jumpTarget.nonce);
  }, [active, jumpTarget, pdfDoc, totalPages, path, sections, scrollToLocation, controller, sessionId]);
  (0, import_react3.useEffect)(() => {
    const root = scrollRoot;
    if (!active || !root || !pdfDoc || totalPages <= 0) return;
    let timer = null;
    let frame = 0;
    const measure = () => {
      frame = 0;
      setSelection((cur) => cur ? null : cur);
      const viewMid = root.scrollTop + root.clientHeight * 0.32;
      let foundPage = 1;
      let relY = 0.2;
      for (const [p, el] of pageElsRef.current.entries()) {
        const top = el.offsetTop;
        const height = el.offsetHeight;
        if (top > viewMid) break;
        foundPage = p;
        relY = height > 0 ? Math.min(1, (viewMid - top) / height) : 0.2;
        if (viewMid <= top + height) break;
      }
      const sec = findSectionAtPosition(foundPage, relY);
      setCurrentPage(foundPage);
      setCurrentSection(sec);
      if (timer) clearTimeout(timer);
      timer = setTimeout(() => {
        controller.reportViewport(sessionId, {
          pdfPath: path,
          paperTitle,
          currentPage: foundPage,
          totalPages,
          currentSection: sec,
          detectedSections: sections,
          updatedAt: Date.now()
        });
      }, 320);
    };
    const onScroll = () => {
      if (!frame) frame = requestAnimationFrame(measure);
    };
    root.addEventListener("scroll", onScroll, { passive: true });
    const resize = new ResizeObserver(onScroll);
    resize.observe(root);
    onScroll();
    return () => {
      root.removeEventListener("scroll", onScroll);
      resize.disconnect();
      if (frame) cancelAnimationFrame(frame);
      if (timer) clearTimeout(timer);
    };
  }, [active, scrollRoot, pdfDoc, totalPages, findSectionAtPosition, controller, sessionId, path, paperTitle, sections]);
  const handleSelectionCheck = (0, import_react3.useCallback)(() => {
    requestAnimationFrame(() => {
      const sel = window.getSelection();
      const root = scrollRef.current;
      if (!sel || sel.isCollapsed || sel.rangeCount === 0 || !root) {
        return;
      }
      const range = sel.getRangeAt(0);
      const anchorEl = sel.anchorNode instanceof Element ? sel.anchorNode : sel.anchorNode?.parentElement;
      const focusEl = sel.focusNode instanceof Element ? sel.focusNode : sel.focusNode?.parentElement;
      if (!anchorEl || !root.contains(anchorEl)) return;
      const pageShell = anchorEl.closest(".pc-page-shell") || focusEl?.closest(".pc-page-shell");
      if (!pageShell) return;
      const pageNum = Number(pageShell.dataset.page || "1") || 1;
      const rawText = sel.toString().replace(/([A-Za-z])-\r?\n\s*([a-z])/g, "$1$2").replace(/\s*\r?\n\s*/g, " ").replace(/\s{2,}/g, " ").trim();
      if (rawText.length < 2) return;
      const shellBox = pageShell.getBoundingClientRect();
      const clientRects = range.getClientRects();
      const normRects = [];
      let minTop = Infinity;
      let topCenterX = shellBox.left + shellBox.width / 2;
      for (let i = 0; i < clientRects.length; i++) {
        const cr = clientRects[i];
        if (cr.width < 1 || cr.height < 1) continue;
        if (cr.top < minTop) {
          minTop = cr.top;
          topCenterX = cr.left + cr.width / 2;
        }
        if (shellBox.width > 0 && shellBox.height > 0) {
          normRects.push({
            x: Math.max(0, Math.min(1, (cr.left - shellBox.left) / shellBox.width)),
            y: Math.max(0, Math.min(1, (cr.top - shellBox.top) / shellBox.height)),
            w: Math.max(0, Math.min(1, cr.width / shellBox.width)),
            h: Math.max(0, Math.min(1, cr.height / shellBox.height))
          });
        }
      }
      if (!Number.isFinite(minTop)) {
        const br = range.getBoundingClientRect();
        minTop = br.top;
        topCenterX = br.left + br.width / 2;
      }
      const merged = mergeLineRects(normRects);
      const sec = findSectionAtPosition(pageNum, merged[0]?.y ?? 0.2);
      setSelection({
        text: rawText.slice(0, 3600),
        page: pageNum,
        section: sec,
        rects: merged,
        anchorX: Math.max(60, Math.min(window.innerWidth - 60, topCenterX)),
        anchorY: Math.max(46, minTop)
      });
    });
  }, [findSectionAtPosition]);
  const activeHighlights = (0, import_react3.useMemo)(() => {
    const list = sessionState?.highlights ?? [];
    if (sessionState?.activePdfPath && !samePdfPath(sessionState.activePdfPath, path)) return [];
    return list;
  }, [sessionState?.highlights, sessionState?.activePdfPath, path]);
  const forcedPage = pinnedPage ?? flashOverlay?.page;
  const adjustZoom = (delta) => {
    const next = Math.max(0.55, Math.min(2.6, Math.round((effectiveScale + delta) * 100) / 100));
    setZoomMode(next);
  };
  return /* @__PURE__ */ (0, import_jsx_runtime3.jsxs)("div", { className: "pc-viewer-root", children: [
    /* @__PURE__ */ (0, import_jsx_runtime3.jsxs)("div", { className: "pc-toolbar", children: [
      /* @__PURE__ */ (0, import_jsx_runtime3.jsxs)("div", { className: "pc-toolbar-group", children: [
        /* @__PURE__ */ (0, import_jsx_runtime3.jsxs)(
          "button",
          {
            type: "button",
            className: "pc-btn" + (outlineOpen ? " pc-btn-primary" : ""),
            onClick: () => setOutlineOpen((v) => !v),
            title: t("toolbar.outline"),
            children: [
              "\u{1F4D1} ",
              t("toolbar.outline"),
              " ",
              sections.length > 0 ? `(${sections.length})` : ""
            ]
          }
        ),
        /* @__PURE__ */ (0, import_jsx_runtime3.jsxs)("span", { className: "pc-badge", children: [
          "p.",
          currentPage,
          " / ",
          totalPages || "\u2026",
          currentSection ? ` \xB7 \xA7${currentSection}` : ""
        ] })
      ] }),
      /* @__PURE__ */ (0, import_jsx_runtime3.jsxs)("div", { className: "pc-toolbar-group", children: [
        /* @__PURE__ */ (0, import_jsx_runtime3.jsx)("button", { type: "button", className: "pc-btn", onClick: () => adjustZoom(-0.15), title: t("toolbar.zoomOut"), children: "\u2212" }),
        /* @__PURE__ */ (0, import_jsx_runtime3.jsx)(
          "button",
          {
            type: "button",
            className: "pc-btn",
            onClick: () => setZoomMode("fit"),
            title: t("toolbar.fitWidth"),
            children: zoomMode === "fit" ? t("toolbar.fitWidth") : `${Math.round(effectiveScale * 100)}%`
          }
        ),
        /* @__PURE__ */ (0, import_jsx_runtime3.jsx)("button", { type: "button", className: "pc-btn", onClick: () => adjustZoom(0.15), title: t("toolbar.zoomIn"), children: "+" }),
        activeHighlights.length > 0 && /* @__PURE__ */ (0, import_jsx_runtime3.jsxs)(
          "button",
          {
            type: "button",
            className: "pc-btn",
            onClick: () => void controller.clearHighlights(sessionId),
            title: t("toolbar.clearHighlights"),
            children: [
              "\u{1F9F9} ",
              t("toolbar.clearHighlights"),
              " (",
              activeHighlights.length,
              ")"
            ]
          }
        ),
        sessionState?.plan && /* @__PURE__ */ (0, import_jsx_runtime3.jsx)(
          "button",
          {
            type: "button",
            className: "pc-btn",
            onClick: () => void controller.updateSettings({
              roadmapDockMode: settings.roadmapDockMode === "pdf_top" ? "float" : "pdf_top"
            }),
            title: settings.roadmapDockMode === "pdf_top" ? t("toolbar.floatRoadmap") : t("toolbar.dockRoadmap"),
            children: settings.roadmapDockMode === "pdf_top" ? "\u2197" : "\u{1F4CC}"
          }
        ),
        /* @__PURE__ */ (0, import_jsx_runtime3.jsx)(
          "button",
          {
            type: "button",
            className: "pc-btn",
            onClick: () => controller.openSettingsModal(sessionId),
            title: t("toolbar.settings"),
            children: "\u2699"
          }
        )
      ] })
    ] }),
    active && /* @__PURE__ */ (0, import_jsx_runtime3.jsx)(RoadmapPanelContent, { controller, sessionId, docked: true, t }),
    /* @__PURE__ */ (0, import_jsx_runtime3.jsxs)("div", { className: "pc-main-area", children: [
      outlineOpen && /* @__PURE__ */ (0, import_jsx_runtime3.jsx)("div", { className: "pc-outline-drawer", children: sections.length === 0 ? /* @__PURE__ */ (0, import_jsx_runtime3.jsx)("div", { style: { padding: "8px", color: "var(--pc-text-muted)" }, children: "\u672A\u68C0\u6D4B\u5230\u7AE0\u8282\u6807\u9898" }) : sections.map((sec) => /* @__PURE__ */ (0, import_jsx_runtime3.jsxs)(
        "div",
        {
          className: "pc-outline-item" + (currentSection === sec.id ? " pc-outline-item-active" : ""),
          onClick: () => scrollToLocation(sec.page, sec.yRatio ?? 0, "smooth"),
          children: [
            /* @__PURE__ */ (0, import_jsx_runtime3.jsx)("span", { style: { overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }, children: sec.rawTitle }),
            /* @__PURE__ */ (0, import_jsx_runtime3.jsxs)("span", { style: { fontSize: 11, color: "var(--pc-text-muted)", flexShrink: 0 }, children: [
              "p.",
              sec.page
            ] })
          ]
        },
        sec.id + "-" + sec.page
      )) }),
      /* @__PURE__ */ (0, import_jsx_runtime3.jsxs)(
        "div",
        {
          ref: setScrollElement,
          className: "pc-scrollport",
          onMouseUp: handleSelectionCheck,
          onKeyUp: handleSelectionCheck,
          onMouseDown: (e) => {
            if (!e.target?.closest(".pc-sel-popover, .pc-trans-card")) {
              setSelection(null);
            }
          },
          children: [
            loading && /* @__PURE__ */ (0, import_jsx_runtime3.jsx)("div", { style: { padding: 32, color: "var(--pc-text-muted)", fontSize: 13 }, children: "\u6B63\u5728\u52A0\u8F7D\u8BBA\u6587 PDF \u4E0E\u6784\u5EFA\u7AE0\u8282\u5B9A\u4F4D\u7D22\u5F15\u2026" }),
            loadingError && /* @__PURE__ */ (0, import_jsx_runtime3.jsxs)("div", { style: { padding: 24, color: "#ef4444", fontSize: 13, maxWidth: 460 }, children: [
              "PDF \u52A0\u8F7D\u5931\u8D25\uFF1A",
              loadingError
            ] }),
            !loading && !loadingError && engine && pdfDoc && Array.from({ length: totalPages }, (_, idx) => {
              const pageNumber = idx + 1;
              return /* @__PURE__ */ (0, import_jsx_runtime3.jsx)(
                PdfPageView,
                {
                  engine,
                  pdfDoc,
                  pageNumber,
                  scale: effectiveScale,
                  renderScale,
                  visible: active,
                  cache,
                  queue,
                  defaultDim,
                  scrollRoot,
                  forceRender: forcedPage === pageNumber,
                  highlights: activeHighlights,
                  flashOverlay,
                  registerPageEl
                },
                pageNumber
              );
            })
          ]
        }
      )
    ] }),
    active && /* @__PURE__ */ (0, import_jsx_runtime3.jsx)(
      SelectionToolbar,
      {
        controller,
        sessionId,
        pdfPath: path,
        paperTitle,
        selection,
        onDismiss: () => setSelection(null),
        t
      }
    )
  ] });
}

// src/client/native-pdf-viewer.tsx
var import_jsx_runtime4 = require("react/jsx-runtime");
var TYPE_ID = "paper-coach:pdf";
var FILE_PREFIX = "dsh-resource://file/";
function pdfResource(address) {
  try {
    if (!address.startsWith(FILE_PREFIX)) return void 0;
    const end = address.search(/[?#]/);
    const [scope, ...parts] = address.slice(FILE_PREFIX.length, end < 0 ? void 0 : end).split("/");
    let path;
    let sourceSessionId;
    if (scope === "session") {
      const [id, ...segments] = parts;
      if (!id || segments.length === 0) return void 0;
      sourceSessionId = decodeURIComponent(id);
      path = segments.map(decodeURIComponent).join("/");
    } else if (scope === "absolute") {
      const unc = parts[0] === "" && parts.length > 1;
      const segments = (unc ? parts.slice(1) : parts).map(decodeURIComponent);
      if (!segments[0]) return void 0;
      path = segments.join("/");
      if (unc) path = "//" + path;
      else if (!/^[A-Za-z]:$/.test(segments[0])) path = "/" + path;
    } else {
      return void 0;
    }
    return path.toLowerCase().endsWith(".pdf") ? { path, sourceSessionId } : void 0;
  } catch {
    return void 0;
  }
}
function NativePdfBody({ sessionId, controller, t, useTabInfo }) {
  const { tab } = useTabInfo();
  const file = pdfResource(tab.contentId);
  if (!file || !sessionId) return null;
  const params = new URLSearchParams({ sessionId: file.sourceSessionId || sessionId, path: file.path });
  return /* @__PURE__ */ (0, import_jsx_runtime4.jsx)("div", { "data-paper-coach-native-pdf": "", style: { display: "flex", flexDirection: "column", flex: 1, minHeight: 0, height: "100%", width: "100%" }, children: /* @__PURE__ */ (0, import_jsx_runtime4.jsx)(
    PaperPdfViewer,
    {
      scope: { sessionId },
      path: file.path,
      title: tab.title,
      mediaUrl: controller.routeUrl("sidebar/file?" + params.toString()),
      visible: tab.visible,
      controller,
      t
    }
  ) });
}
function registerNativePdfViewer(ctx, controller, t) {
  const attach = (scope) => {
    const tabs = scope.sidebarRightTabs ?? scope.get?.("sidebarRightTabs");
    const slots = scope.slots ?? scope.get?.("slots");
    if (typeof tabs?.register !== "function" || typeof slots?.inject !== "function") return;
    scope.effect(() => {
      const offType = tabs.register({
        id: TYPE_ID,
        kind: "paper-coach-pdf",
        multiple: true,
        keepMounted: true,
        patterns: ["dsh-resource://file/**"],
        priority: "extension",
        canOpen: (address) => pdfResource(address) !== void 0,
        title: (address) => pdfResource(address)?.path.split("/").pop() || t("viewer.title")
      });
      try {
        const offBody = slots.inject("sidebar.right.pane.tab", () => slots.register({
          name: "sidebar.right.pane.tab",
          key: TYPE_ID,
          inject: (sessionId) => ({ sessionId, controller, t })
        }, NativePdfBody));
        return () => {
          try {
            offBody();
          } finally {
            offType();
          }
        };
      } catch (error) {
        offType();
        throw error;
      }
    });
  };
  if (typeof ctx.inject === "function") ctx.inject(["sidebarRightTabs"], attach);
  else attach(ctx);
}

// src/client/PaperQuoteDock.tsx
var import_react4 = require("react");
var import_jsx_runtime5 = require("react/jsx-runtime");
function PaperQuoteDock({
  controller,
  sessionId,
  input,
  t
}) {
  const quotes = (0, import_react4.useSyncExternalStore)(
    controller.subscribe,
    () => controller.getQuotes(sessionId)
  );
  (0, import_react4.useEffect)(() => {
    controller.registerInput(sessionId, input);
    return () => controller.registerInput(sessionId, void 0);
  }, [controller, sessionId, input]);
  (0, import_react4.useEffect)(() => {
    if (!input || quotes.length === 0) return;
    const mergeIntoDraft = () => {
      const curQuotes = controller.getQuotes(sessionId);
      if (curQuotes.length === 0) return;
      const snap = input.state.getSnapshot();
      if (snap.phase && snap.phase !== "plain") return;
      const merged = formatPaperQuoteBlock(curQuotes, snap.draft);
      input.setDraft(merged);
      controller.clearQuotes(sessionId);
    };
    const onKeyDown = (ev) => {
      if (ev.key !== "Enter" || ev.shiftKey || ev.altKey || ev.isComposing) return;
      const active = document.activeElement;
      if (!active) return;
      if (active.closest('.pc-modal-card, .pc-trans-card, [role="dialog"]')) return;
      const isComposer = active.matches("[data-dsh-composer-input]") || active instanceof HTMLTextAreaElement || active.isContentEditable;
      if (!isComposer) return;
      mergeIntoDraft();
    };
    const onClick = (ev) => {
      const target = ev.target;
      if (!target) return;
      if (target.closest('.pc-modal-card, .pc-trans-card, [role="dialog"]')) return;
      if (target.closest('button[aria-label*="\u505C\u6B62"], button[aria-label*="Stop"]')) return;
      const isSubmit = Boolean(
        target.closest(
          'button[aria-label*="\u53D1\u9001"], button[aria-label*="Send"], button[aria-label*="\u6392\u961F"], button[aria-label*="Queue"], button[aria-label*="\u63D2\u8BDD"], button[aria-label*="Steer"]'
        )
      );
      if (!isSubmit) return;
      mergeIntoDraft();
    };
    window.addEventListener("keydown", onKeyDown, true);
    window.addEventListener("click", onClick, true);
    return () => {
      window.removeEventListener("keydown", onKeyDown, true);
      window.removeEventListener("click", onClick, true);
    };
  }, [controller, sessionId, input, quotes.length]);
  if (quotes.length === 0) return null;
  return /* @__PURE__ */ (0, import_jsx_runtime5.jsxs)("div", { className: "pc-quote-dock", children: [
    /* @__PURE__ */ (0, import_jsx_runtime5.jsxs)("span", { style: { fontSize: 11, fontWeight: 600, color: "var(--pc-accent)" }, children: [
      "\u{1F4C4} ",
      t("quote.dockTitle"),
      " (",
      quotes.length,
      ")"
    ] }),
    quotes.map((q) => {
      const secStr = q.section ? " \xA7" + (normalizeSectionId(q.section) || q.section) : "";
      return /* @__PURE__ */ (0, import_jsx_runtime5.jsxs)(
        "div",
        {
          className: "pc-quote-pill",
          title: t("quote.jumpBack") + "\n\n" + q.text,
          onClick: () => controller.jumpToPaperLocation(sessionId, {
            pdfPath: q.pdfPath,
            paperTitle: q.paperTitle,
            page: q.page,
            section: q.section,
            rects: q.rects,
            queryText: q.text
          }),
          children: [
            /* @__PURE__ */ (0, import_jsx_runtime5.jsxs)("strong", { children: [
              "p.",
              q.page,
              secStr
            ] }),
            /* @__PURE__ */ (0, import_jsx_runtime5.jsxs)("span", { className: "pc-quote-pill-text", children: [
              "\u201C",
              q.text,
              "\u201D"
            ] }),
            /* @__PURE__ */ (0, import_jsx_runtime5.jsx)(
              "button",
              {
                type: "button",
                style: { border: "none", background: "transparent", color: "var(--pc-text-muted)", cursor: "pointer", padding: "0 2px" },
                onClick: (e) => {
                  e.stopPropagation();
                  controller.removeQuote(sessionId, q.id);
                },
                children: "\u2715"
              }
            )
          ]
        },
        q.id
      );
    }),
    /* @__PURE__ */ (0, import_jsx_runtime5.jsx)(
      "button",
      {
        type: "button",
        className: "pc-btn",
        style: { marginLeft: "auto", padding: "2px 7px", fontSize: 11 },
        onClick: () => controller.clearQuotes(sessionId),
        children: t("quote.clear")
      }
    )
  ] });
}
function createPaperUserTextRule() {
  return {
    key: "dsh-paper-coach-quote",
    match(text, from) {
      const parsed = parsePaperQuoteBlock(text, from);
      if (!parsed) return void 0;
      return {
        start: parsed.start,
        end: parsed.end,
        data: { quotes: parsed.quotes }
      };
    }
  };
}
function createPaperUserQuoteNode(controller) {
  return function PaperUserQuoteNode(props) {
    const data = props?.data;
    const sessionId = props?.session?.sessionId || controller.getActiveSession() || "";
    if (!data?.quotes?.length) return null;
    return /* @__PURE__ */ (0, import_jsx_runtime5.jsx)("div", { style: { display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 6 }, children: data.quotes.map((q) => {
      const secStr = q.section ? " \xA7" + (normalizeSectionId(q.section) || q.section) : "";
      return /* @__PURE__ */ (0, import_jsx_runtime5.jsxs)(
        "span",
        {
          className: "pc-quote-pill",
          title: "\u70B9\u51FB\u5728\u53F3\u4FA7 PDF \u5B9A\u4F4D\u539F\u6587\uFF1A\n" + q.text,
          onClick: () => {
            if (!sessionId) return;
            controller.jumpToPaperLocation(sessionId, {
              pdfPath: q.pdfPath,
              paperTitle: q.paperTitle,
              page: q.page,
              section: q.section,
              rects: q.rects,
              queryText: q.text
            });
          },
          children: [
            /* @__PURE__ */ (0, import_jsx_runtime5.jsxs)("span", { children: [
              "\u{1F4C4} ",
              q.paperTitle,
              " \xB7 p.",
              q.page,
              secStr
            ] }),
            /* @__PURE__ */ (0, import_jsx_runtime5.jsxs)("span", { className: "pc-quote-pill-text", children: [
              "\u201C",
              q.text,
              "\u201D"
            ] })
          ]
        },
        q.id
      );
    }) });
  };
}

// src/client/SettingsView.tsx
var import_react5 = require("react");
var import_react_dom3 = require("react-dom");
var import_jsx_runtime6 = require("react/jsx-runtime");
function SettingsForm({
  controller,
  t,
  onSaved
}) {
  const live = (0, import_react5.useSyncExternalStore)(controller.subscribe, () => controller.getSettings());
  const [translationMode, setTranslationMode] = (0, import_react5.useState)(live.translationMode);
  const [targetLanguage, setTargetLanguage] = (0, import_react5.useState)(live.targetLanguage);
  const [customApiBaseUrl, setCustomApiBaseUrl] = (0, import_react5.useState)(live.customApiBaseUrl);
  const [customApiKey, setCustomApiKey] = (0, import_react5.useState)("");
  const [clearKey, setClearKey] = (0, import_react5.useState)(false);
  const [customApiModel, setCustomApiModel] = (0, import_react5.useState)(live.customApiModel);
  const [hostModelRoute, setHostModelRoute] = (0, import_react5.useState)(live.hostModelRoute);
  const [roadmapDockMode, setRoadmapDockMode] = (0, import_react5.useState)(live.roadmapDockMode);
  const [archiveBackend, setArchiveBackend] = (0, import_react5.useState)(live.archiveBackend);
  const [preferLocalZotero, setPreferLocalZotero] = (0, import_react5.useState)(live.preferLocalZotero);
  const [researchFocusHint, setResearchFocusHint] = (0, import_react5.useState)(live.researchFocusHint);
  const [saving, setSaving] = (0, import_react5.useState)(false);
  const [statusMsg, setStatusMsg] = (0, import_react5.useState)("");
  (0, import_react5.useEffect)(() => {
    setTranslationMode(live.translationMode);
    setTargetLanguage(live.targetLanguage);
    setCustomApiBaseUrl(live.customApiBaseUrl);
    setCustomApiModel(live.customApiModel);
    setHostModelRoute(live.hostModelRoute);
    setRoadmapDockMode(live.roadmapDockMode);
    setArchiveBackend(live.archiveBackend);
    setPreferLocalZotero(live.preferLocalZotero);
    setResearchFocusHint(live.researchFocusHint);
  }, [live]);
  const save = async (e) => {
    e.preventDefault();
    setSaving(true);
    setStatusMsg("");
    try {
      await controller.updateSettings({
        translationMode,
        targetLanguage,
        customApiBaseUrl,
        customApiKey: customApiKey.trim() || void 0,
        clearCustomApiKey: clearKey || void 0,
        customApiModel,
        hostModelRoute,
        roadmapDockMode,
        archiveBackend,
        preferLocalZotero,
        researchFocusHint
      });
      setCustomApiKey("");
      setClearKey(false);
      setStatusMsg(t("settings.saved"));
      onSaved?.();
    } catch (err) {
      setStatusMsg(err instanceof Error ? err.message : String(err));
    } finally {
      setSaving(false);
    }
  };
  return /* @__PURE__ */ (0, import_jsx_runtime6.jsxs)("form", { onSubmit: save, style: { display: "flex", flexDirection: "column", gap: 11 }, children: [
    /* @__PURE__ */ (0, import_jsx_runtime6.jsxs)("div", { className: "pc-field", children: [
      /* @__PURE__ */ (0, import_jsx_runtime6.jsx)("label", { children: t("settings.translationMode") }),
      /* @__PURE__ */ (0, import_jsx_runtime6.jsxs)("select", { className: "pc-select", value: translationMode, onChange: (e) => setTranslationMode(e.target.value), children: [
        /* @__PURE__ */ (0, import_jsx_runtime6.jsx)("option", { value: "host_model", children: t("settings.mode.host") }),
        /* @__PURE__ */ (0, import_jsx_runtime6.jsx)("option", { value: "custom_api", children: t("settings.mode.custom") }),
        /* @__PURE__ */ (0, import_jsx_runtime6.jsx)("option", { value: "main_agent", children: t("settings.mode.main") })
      ] })
    ] }),
    /* @__PURE__ */ (0, import_jsx_runtime6.jsxs)("div", { className: "pc-field", children: [
      /* @__PURE__ */ (0, import_jsx_runtime6.jsx)("label", { children: t("settings.targetLang") }),
      /* @__PURE__ */ (0, import_jsx_runtime6.jsxs)("select", { className: "pc-select", value: targetLanguage, onChange: (e) => setTargetLanguage(e.target.value), children: [
        /* @__PURE__ */ (0, import_jsx_runtime6.jsx)("option", { value: "zh-CN", children: "\u7B80\u4F53\u4E2D\u6587 (zh-CN)" }),
        /* @__PURE__ */ (0, import_jsx_runtime6.jsx)("option", { value: "en", children: "English (en)" }),
        /* @__PURE__ */ (0, import_jsx_runtime6.jsx)("option", { value: "ja", children: "\u65E5\u672C\u8A9E (ja)" })
      ] })
    ] }),
    translationMode === "custom_api" && /* @__PURE__ */ (0, import_jsx_runtime6.jsxs)("div", { style: { padding: 10, borderRadius: 8, background: "var(--pc-bg-subtle)", display: "flex", flexDirection: "column", gap: 9 }, children: [
      /* @__PURE__ */ (0, import_jsx_runtime6.jsxs)("div", { className: "pc-field", children: [
        /* @__PURE__ */ (0, import_jsx_runtime6.jsx)("label", { children: t("settings.apiBaseUrl") }),
        /* @__PURE__ */ (0, import_jsx_runtime6.jsx)("input", { className: "pc-input", value: customApiBaseUrl, onChange: (e) => setCustomApiBaseUrl(e.target.value), placeholder: "https://api.openai.com/v1" })
      ] }),
      /* @__PURE__ */ (0, import_jsx_runtime6.jsxs)("div", { className: "pc-field", children: [
        /* @__PURE__ */ (0, import_jsx_runtime6.jsxs)("label", { style: { display: "flex", justifyContent: "space-between" }, children: [
          /* @__PURE__ */ (0, import_jsx_runtime6.jsx)("span", { children: t("settings.apiKey") }),
          live.hasCustomApiKey && !clearKey && /* @__PURE__ */ (0, import_jsx_runtime6.jsxs)("span", { style: { color: "#10b981", fontWeight: 500 }, children: [
            "\u2713 ",
            t("settings.apiKeyConfigured")
          ] })
        ] }),
        /* @__PURE__ */ (0, import_jsx_runtime6.jsxs)("div", { style: { display: "flex", gap: 6 }, children: [
          /* @__PURE__ */ (0, import_jsx_runtime6.jsx)(
            "input",
            {
              type: "password",
              className: "pc-input",
              style: { flex: 1 },
              value: customApiKey,
              onChange: (e) => {
                setCustomApiKey(e.target.value);
                setClearKey(false);
              },
              placeholder: t("settings.apiKeyPlaceholder")
            }
          ),
          live.hasCustomApiKey && /* @__PURE__ */ (0, import_jsx_runtime6.jsx)("button", { type: "button", className: "pc-btn", onClick: () => setClearKey(true), children: "\u6E05\u9664" })
        ] })
      ] }),
      /* @__PURE__ */ (0, import_jsx_runtime6.jsxs)("div", { className: "pc-field", children: [
        /* @__PURE__ */ (0, import_jsx_runtime6.jsx)("label", { children: t("settings.apiModel") }),
        /* @__PURE__ */ (0, import_jsx_runtime6.jsx)("input", { className: "pc-input", value: customApiModel, onChange: (e) => setCustomApiModel(e.target.value), placeholder: "gpt-4o-mini / deepseek-chat" })
      ] })
    ] }),
    translationMode === "host_model" && /* @__PURE__ */ (0, import_jsx_runtime6.jsxs)("div", { className: "pc-field", children: [
      /* @__PURE__ */ (0, import_jsx_runtime6.jsx)("label", { children: t("settings.hostRoute") }),
      /* @__PURE__ */ (0, import_jsx_runtime6.jsx)("input", { className: "pc-input", value: hostModelRoute, onChange: (e) => setHostModelRoute(e.target.value), placeholder: "\u4F8B\u5982 deepseek-account/deepseek-flash\uFF08\u7559\u7A7A\u81EA\u52A8\u5339\u914D\uFF09" })
    ] }),
    /* @__PURE__ */ (0, import_jsx_runtime6.jsxs)("div", { className: "pc-field", children: [
      /* @__PURE__ */ (0, import_jsx_runtime6.jsx)("label", { children: "\u7CBE\u8BFB\u8DEF\u7EBF\u9762\u677F\u9ED8\u8BA4\u4F4D\u7F6E" }),
      /* @__PURE__ */ (0, import_jsx_runtime6.jsxs)("select", { className: "pc-select", value: roadmapDockMode, onChange: (e) => setRoadmapDockMode(e.target.value), children: [
        /* @__PURE__ */ (0, import_jsx_runtime6.jsx)("option", { value: "float", children: "\u804A\u5929\u533A\u53F3\u4E0A\u89D2\u53EF\u62D6\u62FD\u60AC\u6D6E\u80F6\u56CA" }),
        /* @__PURE__ */ (0, import_jsx_runtime6.jsx)("option", { value: "pdf_top", children: "\u4FA7\u8FB9\u680F PDF \u9605\u8BFB\u5668\u9876\u90E8\u5BFC\u89C8\u680F" })
      ] })
    ] }),
    /* @__PURE__ */ (0, import_jsx_runtime6.jsxs)("div", { className: "pc-field", children: [
      /* @__PURE__ */ (0, import_jsx_runtime6.jsx)("label", { children: t("settings.archiveBackend") }),
      /* @__PURE__ */ (0, import_jsx_runtime6.jsxs)("select", { className: "pc-select", value: archiveBackend, onChange: (e) => setArchiveBackend(e.target.value), children: [
        /* @__PURE__ */ (0, import_jsx_runtime6.jsx)("option", { value: "auto", children: "\u81EA\u52A8\uFF08\u68C0\u6D4B\u5230 OpenViking \u4F18\u5148\uFF0C\u5426\u5219\u672C\u5730 .paper-reading/\uFF09" }),
        /* @__PURE__ */ (0, import_jsx_runtime6.jsx)("option", { value: "openviking", children: "\u4F18\u5148\u4F7F\u7528 OpenViking \u79C1\u6709\u8D44\u6E90\u5E93" }),
        /* @__PURE__ */ (0, import_jsx_runtime6.jsx)("option", { value: "local", children: "\u4F7F\u7528\u5DE5\u4F5C\u533A\u672C\u5730 .paper-reading/ Markdown \u6863\u6848" })
      ] })
    ] }),
    /* @__PURE__ */ (0, import_jsx_runtime6.jsxs)("label", { style: { display: "flex", alignItems: "center", gap: 8, cursor: "pointer", fontSize: 12.5 }, children: [
      /* @__PURE__ */ (0, import_jsx_runtime6.jsx)("input", { type: "checkbox", checked: preferLocalZotero, onChange: (e) => setPreferLocalZotero(e.target.checked) }),
      /* @__PURE__ */ (0, import_jsx_runtime6.jsx)("span", { children: t("settings.preferZotero") })
    ] }),
    /* @__PURE__ */ (0, import_jsx_runtime6.jsxs)("div", { className: "pc-field", children: [
      /* @__PURE__ */ (0, import_jsx_runtime6.jsx)("label", { children: t("settings.researchHint") }),
      /* @__PURE__ */ (0, import_jsx_runtime6.jsx)(
        "textarea",
        {
          className: "pc-textarea",
          rows: 2,
          value: researchFocusHint,
          onChange: (e) => setResearchFocusHint(e.target.value),
          placeholder: "\u4F8B\u5982\uFF1A\u4E3B\u653B\u9065\u611F\u53D8\u5316\u68C0\u6D4B\u4E0E\u591A\u6A21\u6001\u751F\u6210\u65B9\u6CD5\u8FC1\u79FB\uFF08\u7559\u7A7A\u5219\u4E3A\u901A\u7528\u5B66\u672F\u6A21\u5F0F\uFF09"
        }
      )
    ] }),
    /* @__PURE__ */ (0, import_jsx_runtime6.jsxs)("div", { style: { display: "flex", alignItems: "center", justifyContent: "space-between", marginTop: 4 }, children: [
      /* @__PURE__ */ (0, import_jsx_runtime6.jsx)("span", { style: { fontSize: 12, color: statusMsg === t("settings.saved") ? "#10b981" : "#ef4444" }, children: statusMsg }),
      /* @__PURE__ */ (0, import_jsx_runtime6.jsx)("button", { type: "submit", className: "pc-btn pc-btn-primary", disabled: saving, children: saving ? "..." : t("settings.save") })
    ] })
  ] });
}
function SettingsModalHost({
  controller,
  t
}) {
  const open = (0, import_react5.useSyncExternalStore)(controller.subscribe, () => controller.isSettingsModalOpen());
  if (!open) return null;
  return (0, import_react_dom3.createPortal)(
    /* @__PURE__ */ (0, import_jsx_runtime6.jsx)("div", { className: "pc-modal-backdrop", onMouseDown: (e) => {
      if (e.target === e.currentTarget) controller.closeSettingsModal();
    }, children: /* @__PURE__ */ (0, import_jsx_runtime6.jsxs)("div", { className: "pc-modal-card", children: [
      /* @__PURE__ */ (0, import_jsx_runtime6.jsxs)("div", { style: { display: "flex", alignItems: "center", justifyContent: "space-between" }, children: [
        /* @__PURE__ */ (0, import_jsx_runtime6.jsxs)("strong", { style: { fontSize: 15 }, children: [
          "\u2699 ",
          t("settings.title")
        ] }),
        /* @__PURE__ */ (0, import_jsx_runtime6.jsx)("button", { type: "button", className: "pc-btn", onClick: () => controller.closeSettingsModal(), children: "\u2715" })
      ] }),
      /* @__PURE__ */ (0, import_jsx_runtime6.jsx)(SettingsForm, { controller, t, onSaved: () => setTimeout(() => controller.closeSettingsModal(), 450) })
    ] }) }),
    document.body
  );
}

// src/client/index.tsx
var import_jsx_runtime7 = require("react/jsx-runtime");
var inject = ["slots", "locale", "conversation", "sessions"];
function BookOpenIcon({ size = 16 }) {
  return /* @__PURE__ */ (0, import_jsx_runtime7.jsxs)(
    "svg",
    {
      width: size,
      height: size,
      viewBox: "0 0 24 24",
      fill: "none",
      stroke: "currentColor",
      strokeWidth: "1.9",
      strokeLinecap: "round",
      strokeLinejoin: "round",
      children: [
        /* @__PURE__ */ (0, import_jsx_runtime7.jsx)("path", { d: "M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z" }),
        /* @__PURE__ */ (0, import_jsx_runtime7.jsx)("path", { d: "M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z" })
      ]
    }
  );
}
var modalHostClaimed = false;
function SingletonSettingsModal({
  controller,
  t
}) {
  const [owns, setOwns] = import_react6.default.useState(false);
  (0, import_react6.useEffect)(() => {
    if (!modalHostClaimed) {
      modalHostClaimed = true;
      setOwns(true);
      return () => {
        modalHostClaimed = false;
      };
    }
    return void 0;
  }, []);
  if (!owns) return null;
  return /* @__PURE__ */ (0, import_jsx_runtime7.jsx)(SettingsModalHost, { controller, t });
}
function apply(ctx) {
  ctx.effect(() => ctx.locale.register(NS, { zh, en }));
  const t = ctx.locale.bind(NS);
  const slots = ctx.get("slots");
  const sessions = ctx.get("sessions");
  const controller = new PaperCoachClientController();
  void controller.refreshSettings().catch(() => {
  });
  ctx.effect(() => () => controller.dispose());
  const isSubagent = (id) => Boolean(sessions?.subagentAddress?.(id)) || sessions?.list?.getSnapshot?.()?.byId?.[id]?.origin === "subagent";
  ctx.effect(() => {
    const style = document.createElement("style");
    style.dataset.plugin = "dsh-paper-coach";
    style.dataset.pluginCss = "dsh-paper-coach/client.css";
    style.textContent = PAPER_COACH_CSS;
    (document.head ?? document.documentElement).append(style);
    return () => style.remove();
  });
  const attachBetterSidebar = (bs) => {
    if (!bs || typeof bs.registerFileViewer !== "function") return () => {
    };
    controller.setBetterSidebar(bs);
    const offViewer = bs.registerFileViewer({
      id: "paper-coach:pdf",
      title: () => t("viewer.title"),
      icon: (size = 14) => /* @__PURE__ */ (0, import_jsx_runtime7.jsx)(BookOpenIcon, { size }),
      exts: ["pdf"],
      priority: 20,
      fetchStrategy: "mediaUrl",
      detect: (filePath, head) => filePath.toLowerCase().endsWith(".pdf") || head.length >= 4 && head[0] === 37 && head[1] === 80 && head[2] === 68 && head[3] === 70,
      settings: {
        render: () => /* @__PURE__ */ (0, import_jsx_runtime7.jsx)(SettingsForm, { controller, t })
      },
      component: (props) => /* @__PURE__ */ (0, import_jsx_runtime7.jsx)(PaperPdfViewer, { ...props, controller, t })
    });
    return () => {
      try {
        offViewer?.();
      } catch {
      }
      if (controller.getBetterSidebar() === bs) {
        controller.setBetterSidebar(void 0);
      }
    };
  };
  if (typeof ctx.inject === "function") {
    ctx.inject(["betterSidebar"], (scope) => {
      const off = attachBetterSidebar(scope.get("betterSidebar"));
      scope.effect(() => off);
    });
  } else if (ctx.get?.("betterSidebar")) {
    const off = attachBetterSidebar(ctx.get("betterSidebar"));
    ctx.effect(() => off);
  }
  registerNativePdfViewer(ctx, controller, t);
  const userTextRule = createPaperUserTextRule();
  const UserQuoteNode = createPaperUserQuoteNode(controller);
  const attachUserTextRule = (uiConv) => {
    if (uiConv?.userText && typeof uiConv.userText.register === "function") {
      return uiConv.userText.register(userTextRule);
    }
    return void 0;
  };
  if (typeof ctx.inject === "function") {
    ctx.inject(["uiConversation"], (scope) => {
      const off = attachUserTextRule(scope.get("uiConversation"));
      if (typeof off === "function") scope.effect(() => off);
    });
  } else {
    const off = attachUserTextRule(ctx.get?.("uiConversation"));
    if (typeof off === "function") ctx.effect(() => off);
  }
  slots.inject(
    "conversation.user.text.node",
    () => slots.register(
      {
        name: "conversation.user.text.node",
        key: "dsh-paper-coach-quote",
        priority: 100,
        locale: NS
      },
      UserQuoteNode
    )
  );
  function PaperCoachSessionDock(props) {
    const sessionId = String(props?.session?.sessionId || "");
    const subagent = Boolean(props?.session?.subagent) || (sessionId ? isSubagent(sessionId) : false);
    (0, import_react6.useEffect)(() => {
      if (!sessionId || subagent) return void 0;
      controller.setActiveSession(sessionId);
      return controller.retainSession(sessionId);
    }, [sessionId, subagent]);
    if (!sessionId || subagent) return null;
    const sessionScope = sessions?.scope?.(sessionId);
    const input = sessionScope ? ctx.conversation?.input?.for?.(sessionScope) : void 0;
    const boundT = props?.t || t;
    return /* @__PURE__ */ (0, import_jsx_runtime7.jsxs)(import_jsx_runtime7.Fragment, { children: [
      /* @__PURE__ */ (0, import_jsx_runtime7.jsx)(PaperQuoteDock, { controller, sessionId, input, t: boundT }),
      /* @__PURE__ */ (0, import_jsx_runtime7.jsx)(RoadmapPanelContent, { controller, sessionId, docked: false, t: boundT }),
      /* @__PURE__ */ (0, import_jsx_runtime7.jsx)(SingletonSettingsModal, { controller, t: boundT })
    ] });
  }
  slots.inject(
    "conversation.input.dock",
    () => slots.register(
      {
        name: "conversation.input.dock",
        id: "dsh-paper-coach",
        order: -45,
        locale: NS
      },
      PaperCoachSessionDock
    )
  );
  slots.inject(
    "settings.section.icon",
    () => slots.register(
      {
        name: "settings.section.icon",
        id: "paper-coach",
        order: 115,
        label: () => t("settings.title")
      },
      ({ size = 16 }) => /* @__PURE__ */ (0, import_jsx_runtime7.jsx)(BookOpenIcon, { size })
    )
  );
  slots.inject(
    "settings.section",
    () => slots.register(
      {
        name: "settings.section",
        id: "paper-coach",
        order: 115,
        label: () => t("settings.title")
      },
      () => /* @__PURE__ */ (0, import_jsx_runtime7.jsxs)("div", { style: { maxWidth: 640, padding: "16px 20px" }, children: [
        /* @__PURE__ */ (0, import_jsx_runtime7.jsxs)("h3", { style: { margin: "0 0 14px 0", fontSize: 16 }, children: [
          "\u{1F4D6} ",
          t("settings.title")
        ] }),
        /* @__PURE__ */ (0, import_jsx_runtime7.jsx)(SettingsForm, { controller, t })
      ] })
    )
  );
  ctx.effect(() => {
    const onDocClick = (ev) => {
      const target = ev.target;
      const anchor = target?.closest?.("a");
      if (!anchor) return;
      const rawHref = anchor.getAttribute("href") || "";
      let search = "";
      if (/^paper-coach:\/\/loc\b/i.test(rawHref)) {
        const qIdx = rawHref.indexOf("?");
        search = qIdx >= 0 ? rawHref.slice(qIdx + 1) : "";
      } else {
        const markerIdx = rawHref.indexOf("#paper-coach-loc");
        if (markerIdx < 0) return;
        const frag = rawHref.slice(markerIdx + "#paper-coach-loc".length);
        const qIdx = frag.indexOf("?");
        search = qIdx >= 0 ? frag.slice(qIdx + 1) : "";
      }
      ev.preventDefault();
      ev.stopPropagation();
      const params = new URLSearchParams(search);
      const section = params.get("section") || params.get("sec") || void 0;
      const pageRaw = params.get("page") || params.get("p");
      const page = pageRaw && Number.isFinite(Number(pageRaw)) ? Math.max(1, Math.floor(Number(pageRaw))) : void 0;
      const queryText = params.get("q") || params.get("quote") || void 0;
      const pdfPath = params.get("path") || void 0;
      const sessionAttrEl = anchor.closest("[data-session-id]");
      const sessionId = sessionAttrEl?.dataset?.sessionId || controller.getActiveSession();
      if (!sessionId) return;
      controller.jumpToPaperLocation(sessionId, {
        pdfPath,
        section,
        page,
        queryText
      });
    };
    document.addEventListener("click", onDocClick, true);
    return () => document.removeEventListener("click", onDocClick, true);
  });
}
return module.exports;}});
