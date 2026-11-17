// src/index.ts
import { createReadStream } from "node:fs";
import { readFile as readFile3, stat as stat2 } from "node:fs/promises";
import { pipeline } from "node:stream/promises";
import { homedir as homedir3 } from "node:os";
import { isAbsolute as isAbsolute2, resolve as resolve2 } from "node:path";
import { dirname as dirname2, join as join3 } from "node:path";
import { fileURLToPath as fileURLToPath2 } from "node:url";

// src/server/state-store.ts
import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import { homedir } from "node:os";
import { basename, join } from "node:path";

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

// src/server/state-store.ts
function sanitizeFileId(sessionId) {
  return sessionId.replace(/[^a-zA-Z0-9._-]/g, "_").slice(0, 160) || "default";
}
var PaperCoachStore = class {
  baseDir;
  sessionsDir;
  settingsPath;
  settings = { ...DEFAULT_SETTINGS };
  settingsLoaded = false;
  states = /* @__PURE__ */ new Map();
  loadingStates = /* @__PURE__ */ new Map();
  sessionSubscribers = /* @__PURE__ */ new Map();
  globalSubscribers = /* @__PURE__ */ new Set();
  settingsChangeListeners = /* @__PURE__ */ new Set();
  navSeq = 1;
  saveTimers = /* @__PURE__ */ new Map();
  constructor(baseDir = join(homedir(), ".dsh", "paper-coach")) {
    this.baseDir = baseDir;
    this.sessionsDir = join(baseDir, "sessions");
    this.settingsPath = join(baseDir, "settings.json");
  }
  async init() {
    if (this.settingsLoaded) return;
    await mkdir(this.sessionsDir, { recursive: true }).catch(() => {
    });
    try {
      const raw = await readFile(this.settingsPath, "utf8");
      const parsed = JSON.parse(raw);
      this.settings = { ...DEFAULT_SETTINGS, ...parsed };
    } catch {
      this.settings = { ...DEFAULT_SETTINGS };
    }
    this.settingsLoaded = true;
  }
  getRawSettings() {
    return { ...this.settings };
  }
  getRedactedSettings() {
    const copy = {
      ...this.settings,
      hasCustomApiKey: Boolean(this.settings.customApiKey && this.settings.customApiKey.trim().length > 0)
    };
    delete copy.customApiKey;
    return copy;
  }
  onSettingsChange(fn) {
    this.settingsChangeListeners.add(fn);
    return () => this.settingsChangeListeners.delete(fn);
  }
  async updateSettings(patch) {
    await this.init();
    const next = { ...this.settings };
    if (patch.translationMode) next.translationMode = patch.translationMode;
    if (typeof patch.targetLanguage === "string" && patch.targetLanguage.trim()) {
      next.targetLanguage = patch.targetLanguage.trim();
    }
    if (typeof patch.customApiBaseUrl === "string" && patch.customApiBaseUrl.trim()) {
      next.customApiBaseUrl = patch.customApiBaseUrl.trim();
    }
    if (typeof patch.customApiModel === "string" && patch.customApiModel.trim()) {
      next.customApiModel = patch.customApiModel.trim();
    }
    if (typeof patch.hostModelRoute === "string") {
      next.hostModelRoute = patch.hostModelRoute.trim();
    }
    if (patch.roadmapDockMode === "float" || patch.roadmapDockMode === "pdf_top") {
      next.roadmapDockMode = patch.roadmapDockMode;
    }
    if (patch.archiveBackend === "auto" || patch.archiveBackend === "openviking" || patch.archiveBackend === "local") {
      next.archiveBackend = patch.archiveBackend;
    }
    if (typeof patch.preferLocalZotero === "boolean") {
      next.preferLocalZotero = patch.preferLocalZotero;
    }
    if (typeof patch.researchFocusHint === "string") {
      next.researchFocusHint = patch.researchFocusHint;
    }
    if (patch.clearCustomApiKey) {
      delete next.customApiKey;
    } else if (typeof patch.customApiKey === "string" && patch.customApiKey.trim().length > 0) {
      next.customApiKey = patch.customApiKey.trim();
    }
    this.settings = next;
    await mkdir(this.baseDir, { recursive: true }).catch(() => {
    });
    const tmp = `${this.settingsPath}.tmp`;
    await writeFile(tmp, JSON.stringify(this.settings, null, 2), "utf8");
    await rename(tmp, this.settingsPath).catch(() => writeFile(this.settingsPath, JSON.stringify(this.settings, null, 2), "utf8"));
    const redacted = this.getRedactedSettings();
    this.broadcastGlobal({ type: "settings_updated", settings: redacted });
    for (const fn of this.settingsChangeListeners) {
      try {
        fn();
      } catch {
      }
    }
    return redacted;
  }
  async getSessionState(sessionId) {
    await this.init();
    const cached = this.states.get(sessionId);
    if (cached) return cached;
    const pending = this.loadingStates.get(sessionId);
    if (pending) return pending;
    const loadTask = (async () => {
      const filePath = join(this.sessionsDir, `${sanitizeFileId(sessionId)}.json`);
      try {
        const raw = await readFile(filePath, "utf8");
        const parsed = JSON.parse(raw);
        const hydrated = {
          sessionId,
          activePdfPath: parsed.activePdfPath,
          activePaperTitle: parsed.activePaperTitle,
          plan: parsed.plan,
          viewport: parsed.viewport,
          highlights: Array.isArray(parsed.highlights) ? parsed.highlights : [],
          lastNav: parsed.lastNav,
          revision: typeof parsed.revision === "number" ? parsed.revision : 1
        };
        if (hydrated.lastNav && hydrated.lastNav.seq >= this.navSeq) {
          this.navSeq = hydrated.lastNav.seq + 1;
        }
        this.states.set(sessionId, hydrated);
        return hydrated;
      } catch {
        const fresh = {
          sessionId,
          highlights: [],
          revision: 1
        };
        this.states.set(sessionId, fresh);
        return fresh;
      } finally {
        this.loadingStates.delete(sessionId);
      }
    })();
    this.loadingStates.set(sessionId, loadTask);
    return loadTask;
  }
  schedulePersist(sessionId) {
    const existing = this.saveTimers.get(sessionId);
    if (existing) clearTimeout(existing);
    const timer = setTimeout(() => {
      this.saveTimers.delete(sessionId);
      const state = this.states.get(sessionId);
      if (!state) return;
      const filePath = join(this.sessionsDir, `${sanitizeFileId(sessionId)}.json`);
      const tmp = `${filePath}.tmp`;
      mkdir(this.sessionsDir, { recursive: true }).then(() => writeFile(tmp, JSON.stringify(state, null, 2), "utf8")).then(() => rename(tmp, filePath)).catch(() => writeFile(filePath, JSON.stringify(state, null, 2), "utf8").catch(() => {
      }));
    }, 120);
    timer.unref?.();
    this.saveTimers.set(sessionId, timer);
  }
  hasConnectedView(sessionId) {
    const subs = this.sessionSubscribers.get(sessionId);
    return Boolean(subs && subs.size > 0);
  }
  subscribeSession(sessionId, fn) {
    let set = this.sessionSubscribers.get(sessionId);
    if (!set) {
      set = /* @__PURE__ */ new Set();
      this.sessionSubscribers.set(sessionId, set);
    }
    set.add(fn);
    this.globalSubscribers.add(fn);
    return () => {
      set?.delete(fn);
      if (set && set.size === 0) this.sessionSubscribers.delete(sessionId);
      this.globalSubscribers.delete(fn);
    };
  }
  emitSession(sessionId, ev) {
    const subs = this.sessionSubscribers.get(sessionId);
    if (!subs) return;
    for (const fn of subs) {
      try {
        fn(ev);
      } catch {
      }
    }
  }
  broadcastGlobal(ev) {
    for (const fn of this.globalSubscribers) {
      try {
        fn(ev);
      } catch {
      }
    }
  }
  async openPaper(sessionId, input) {
    const state = await this.getSessionState(sessionId);
    const title = input.paperTitle?.trim() || basename(input.pdfPath).replace(/\.pdf$/i, "");
    state.activePdfPath = input.pdfPath;
    state.activePaperTitle = title;
    if (state.plan && !state.plan.pdfPath) {
      state.plan.pdfPath = input.pdfPath;
    }
    const cmd = {
      seq: this.navSeq++,
      pdfPath: input.pdfPath,
      paperTitle: title,
      openInSidebar: true,
      page: input.page,
      section: input.section ? normalizeSectionId(input.section) || input.section : void 0,
      issuedAt: Date.now()
    };
    state.lastNav = cmd;
    state.revision += 1;
    this.schedulePersist(sessionId);
    const delivered = this.hasConnectedView(sessionId);
    this.emitSession(sessionId, { type: "navigate", state, command: cmd });
    return { state, command: cmd, delivered };
  }
  async navigatePaper(sessionId, input) {
    const state = await this.getSessionState(sessionId);
    const targetPath = input.pdfPath || state.activePdfPath || state.plan?.pdfPath;
    if (targetPath) {
      state.activePdfPath = targetPath;
    }
    const newHighlights = (input.highlights ?? []).filter((h) => typeof h.text === "string" && h.text.trim().length > 0).map((h, i) => ({
      id: `hl-${Date.now()}-${i}`,
      text: h.text.trim(),
      page: h.page ?? input.page,
      section: h.section ?? input.section,
      color: h.color ?? "amber",
      label: h.label?.trim() || void 0,
      createdAt: Date.now()
    }));
    if (input.clearPreviousHighlights !== false && newHighlights.length > 0) {
      state.highlights = newHighlights;
    } else if (newHighlights.length > 0) {
      state.highlights = [...state.highlights.slice(-20), ...newHighlights];
    } else if (input.clearPreviousHighlights === true) {
      state.highlights = [];
    }
    const cmd = {
      seq: this.navSeq++,
      pdfPath: targetPath,
      paperTitle: state.activePaperTitle,
      openInSidebar: Boolean(targetPath),
      page: input.page,
      section: input.section ? normalizeSectionId(input.section) || input.section : void 0,
      clearPreviousHighlights: input.clearPreviousHighlights,
      highlights: newHighlights.length > 0 ? newHighlights : void 0,
      issuedAt: Date.now()
    };
    state.lastNav = cmd;
    state.revision += 1;
    this.schedulePersist(sessionId);
    const delivered = this.hasConnectedView(sessionId);
    this.emitSession(sessionId, { type: "navigate", state, command: cmd });
    return { state, command: cmd, delivered };
  }
  async updateReadingPlan(sessionId, input) {
    const state = await this.getSessionState(sessionId);
    if (input.action === "clear") {
      state.plan = void 0;
      state.revision += 1;
      this.schedulePersist(sessionId);
      this.emitSession(sessionId, { type: "state_updated", state });
      return state;
    }
    const prev = input.action === "update" ? state.plan : void 0;
    const goals = input.goals ? input.goals.map((g, idx) => ({
      id: g.id || `goal-${idx + 1}`,
      text: g.text.trim(),
      done: Boolean(g.done)
    })) : prev?.goals ?? [];
    const sections = input.sections ? input.sections.map((s, idx) => ({
      id: s.id || `sec-${idx + 1}`,
      section: normalizeSectionId(s.section) || s.section.trim(),
      title: s.title?.trim() || void 0,
      page: s.page,
      note: s.note?.trim() || void 0,
      status: s.status ?? (idx === 0 ? "current" : "pending")
    })) : prev?.sections ?? [];
    const resolvedPdfPath = input.pdfPath?.trim() || prev?.pdfPath || state.activePdfPath;
    const resolvedTitle = input.paperTitle?.trim() || prev?.paperTitle || state.activePaperTitle || (resolvedPdfPath ? basename(resolvedPdfPath).replace(/\.pdf$/i, "") : "\u5F53\u524D\u7CBE\u8BFB\u8BBA\u6587");
    const nextPlan = {
      paperKey: input.paperKey?.trim() || prev?.paperKey,
      paperTitle: resolvedTitle,
      pdfPath: resolvedPdfPath,
      mode: input.mode ?? prev?.mode ?? (sections.length > 0 ? "targeted" : "full"),
      stage: input.stage ?? prev?.stage ?? (sections.length > 0 ? "reading" : "overview"),
      goals,
      sections,
      updatedAt: Date.now()
    };
    state.plan = nextPlan;
    if (resolvedPdfPath && !state.activePdfPath) state.activePdfPath = resolvedPdfPath;
    if (resolvedTitle && !state.activePaperTitle) state.activePaperTitle = resolvedTitle;
    state.revision += 1;
    this.schedulePersist(sessionId);
    this.emitSession(sessionId, { type: "state_updated", state });
    return state;
  }
  async updateViewport(sessionId, viewport) {
    const state = await this.getSessionState(sessionId);
    state.viewport = { ...viewport, updatedAt: Date.now() };
    if (viewport.pdfPath) state.activePdfPath = viewport.pdfPath;
    if (viewport.paperTitle && !state.activePaperTitle) state.activePaperTitle = viewport.paperTitle;
    this.schedulePersist(sessionId);
    return state;
  }
  async clearHighlights(sessionId) {
    const state = await this.getSessionState(sessionId);
    state.highlights = [];
    state.revision += 1;
    this.schedulePersist(sessionId);
    this.emitSession(sessionId, { type: "state_updated", state });
    return state;
  }
  dispose() {
    for (const timer of this.saveTimers.values()) clearTimeout(timer);
    this.saveTimers.clear();
    this.sessionSubscribers.clear();
    this.globalSubscribers.clear();
    this.settingsChangeListeners.clear();
  }
};

// src/server/skills-provider.ts
import { existsSync } from "node:fs";
import { mkdir as mkdir2, readdir, readFile as readFile2, rm, writeFile as writeFile2 } from "node:fs/promises";
import { homedir as homedir2 } from "node:os";
import { dirname, join as join2 } from "node:path";
import { fileURLToPath } from "node:url";
var PROVIDER_NAME = "dsh-paper-coach";
var PROVIDER_RANK = 200;
var SKILL_NAMES = ["paper-reading-navigator", "coaching-paper-reading"];
var AGY_MANAGED_SKILL_MARKER = "<!-- dsh-paper-coach:managed -->";
var PAPER_COACH_SYSTEM_PROMPT_LINES = [
  "## Academic Paper Sidebar & Reading Panel (dsh-paper-coach)",
  "- When starting or resuming close reading of a local cached PDF paper, call paper_reader_open to open it automatically in the right sidebar, and call paper_reading_plan to display agreed reading sections (e.g. \xA74.1, \xA75.2) and learning goals in the floating panel.",
  "- When answering questions about a specific section or sentence of the open paper, call paper_reader_navigate to scroll the sidebar PDF to that section/page and highlight 1-3 key verbatim sentences, and include clickable location badges like [\u{1F4CD} \xA78 \xB7 p.9](paper-coach://loc?section=8&page=9&q=first%20few%20words) in your explanation.",
  '- User messages starting with "# \u8BBA\u6587\u539F\u6587\u5B9A\u4F4D\u5F15\u7528 (Paper Excerpt)" come from the user selecting text directly inside the sidebar PDF reader with exact page and section coordinates.'
];
function parseSkillMarkdown(raw, filePath) {
  const normalized = raw.replace(/\r\n/g, "\n");
  let name2 = "";
  let description = "";
  let body = normalized;
  if (normalized.startsWith("---\n")) {
    const endIdx = normalized.indexOf("\n---\n", 4);
    if (endIdx > 0) {
      const frontmatter = normalized.slice(4, endIdx);
      body = normalized.slice(endIdx + 5).trim();
      const nameMatch = frontmatter.match(/^name:\s*(.+)$/m);
      if (nameMatch) name2 = nameMatch[1].trim();
      const descMatch = frontmatter.match(/^description:\s*([\s\S]*?)(?=\n[a-zA-Z0-9_-]+:|$)/m);
      if (descMatch) {
        description = descMatch[1].split("\n").map((l) => l.trim()).filter(Boolean).join(" ");
      }
    }
  }
  return { name: name2, description, body, raw: normalized, filePath, dirPath: dirname(filePath) };
}
function resolveSkillsRoot() {
  const here = dirname(fileURLToPath(import.meta.url));
  const fromLib = join2(here, "..", "skills");
  return existsSync(fromLib) ? fromLib : join2(here, "..", "..", "skills");
}
function buildDynamicSettingsBlock(settings) {
  const dynamicNotes = [];
  if (settings.archiveBackend === "local") {
    dynamicNotes.push("- \u5F53\u524D\u63D2\u4EF6\u8BBE\u7F6E\u5F3A\u5236\u4F7F\u7528\u672C\u5730\u5DE5\u4F5C\u533A .paper-reading/ \u4F5C\u4E3A\u6587\u732E\u6863\u6848\u6839\u76EE\u5F55\u3002");
  } else if (settings.archiveBackend === "openviking") {
    dynamicNotes.push("- \u5F53\u524D\u63D2\u4EF6\u8BBE\u7F6E\u4F18\u5148\u4F7F\u7528 OpenViking viking://~/resources/paper-reading/ \u4F5C\u4E3A\u6587\u732E\u6863\u6848\u6839\u76EE\u5F55\u3002");
  }
  if (settings.preferLocalZotero) {
    dynamicNotes.push("- \u5F53\u524D\u7528\u6237\u542F\u7528\u4E86\u201C\u4F18\u5148\u6838\u67E5\u672C\u673A Zotero \u6587\u732E\u5E93\u201D\uFF1A\u7CBE\u8BFB\u83B7\u53D6\u539F\u6587\u65F6\u8BF7\u5148\u68C0\u67E5\u672C\u673A Zotero \u662F\u5426\u5DF2\u6709\u8BE5\u8BBA\u6587 PDF\uFF08Zotero \u672A\u6253\u5F00\u65F6\u5148\u63D0\u9192\u7528\u6237\u6253\u5F00\uFF09\uFF0C\u786E\u8BA4\u65E0\u73B0\u6210 PDF \u540E\u518D\u8054\u7F51\u68C0\u7D22\u3002");
  } else {
    dynamicNotes.push("- \u5F53\u524D\u672A\u5F3A\u5236\u8981\u6C42\u9884\u67E5\u672C\u673A Zotero\uFF0C\u53EF\u76F4\u63A5\u6309\u7528\u6237\u63D0\u4F9B\u7684 PDF\u3001\u5DE5\u4F5C\u533A\u7F13\u5B58\u6216\u516C\u5F00\u94FE\u63A5\u6838\u9A8C\u539F\u6587\u3002");
  }
  if (settings.researchFocusHint && settings.researchFocusHint.trim()) {
    dynamicNotes.push("- \u7528\u6237\u7814\u7A76\u80CC\u666F\u63D0\u793A\uFF1A" + settings.researchFocusHint.trim());
  }
  return dynamicNotes.length > 0 ? "\n\n## \u5F53\u524D\u73AF\u5883\u4E0E\u7528\u6237\u914D\u7F6E\u63D0\u793A\n\n" + dynamicNotes.join("\n") : "";
}
function registerBundledPaperSkills(ctx, store) {
  const skillsService = ctx.skills ?? ctx.get?.("skills");
  if (!skillsService || typeof skillsService.registerProvider !== "function") {
    return () => {
    };
  }
  const root = resolveSkillsRoot();
  const loadSkillFile = async (skillName) => {
    const filePath = join2(root, skillName, "SKILL.md");
    try {
      const raw = await readFile2(filePath, "utf8");
      const parsed = parseSkillMarkdown(raw, filePath);
      if (!parsed.name) parsed.name = skillName;
      if (!parsed.description) parsed.description = "Bundled " + skillName + " skill from dsh-paper-coach";
      return parsed;
    } catch {
      return void 0;
    }
  };
  let offSettings;
  const offProvider = skillsService.registerProvider((control) => {
    offSettings = store.onSettingsChange(() => {
      control?.invalidate?.();
    });
    return {
      name: PROVIDER_NAME,
      async list() {
        const items = [];
        for (const sName of SKILL_NAMES) {
          const parsed = await loadSkillFile(sName);
          if (!parsed) continue;
          items.push({
            name: parsed.name,
            description: parsed.description,
            invocation: { modelInvocable: true, userInvocable: true },
            source: "plugin:dsh-paper-coach",
            provider: PROVIDER_NAME,
            rank: PROVIDER_RANK,
            path: parsed.filePath,
            resourceBase: { kind: "directory", path: parsed.dirPath.replace(/\\/g, "/") },
            locator: sName
          });
        }
        return items;
      },
      async get(candidate) {
        const parsed = await loadSkillFile(candidate.locator || candidate.name);
        if (!parsed) return void 0;
        const extraBlock = buildDynamicSettingsBlock(store.getRedactedSettings());
        return {
          name: parsed.name,
          description: parsed.description,
          invocation: { modelInvocable: true, userInvocable: true },
          source: "plugin:dsh-paper-coach",
          provider: PROVIDER_NAME,
          path: parsed.filePath,
          resourceBase: { kind: "directory", path: parsed.dirPath },
          content: parsed.body + extraBlock
        };
      }
    };
  });
  return () => {
    offSettings?.();
    if (typeof offProvider === "function") offProvider();
  };
}
async function registerAgySkillsSync(store, options) {
  const targetConfigDir = options?.agyConfigDir ?? join2(homedir2(), ".gemini", "config");
  if (!existsSync(targetConfigDir)) {
    return async () => {
    };
  }
  const root = resolveSkillsRoot();
  const agySkillsRoot = join2(targetConfigDir, "skills");
  let disposed = false;
  let syncChain = Promise.resolve();
  const canManageTarget = (existingRaw, bundledRaw) => {
    if (existingRaw === void 0) return true;
    if (existingRaw.includes(AGY_MANAGED_SKILL_MARKER)) return true;
    return existingRaw.replace(/\r\n/g, "\n").trim() === bundledRaw.replace(/\r\n/g, "\n").trim();
  };
  const syncOnce = async () => {
    if (disposed || !existsSync(targetConfigDir)) return;
    const settingsBlock = buildDynamicSettingsBlock(store.getRedactedSettings());
    const sidebarBlock = [
      ...PAPER_COACH_SYSTEM_PROMPT_LINES,
      "- On Antigravity (AGY) sessions where DSH tools are bridged lazily under `dsh-tools-*`, invoke `paper_reader_open`, `paper_reader_navigate`, `paper_reading_plan`, and `paper_reader_status` via `call_mcp_tool` on the `dsh-tools-*` MCP server."
    ].join("\n");
    for (const sName of SKILL_NAMES) {
      if (disposed) return;
      const srcPath = join2(root, sName, "SKILL.md");
      let bundledRaw;
      try {
        bundledRaw = await readFile2(srcPath, "utf8");
      } catch {
        continue;
      }
      const targetDir = join2(agySkillsRoot, sName);
      const targetFile = join2(targetDir, "SKILL.md");
      let existingRaw;
      try {
        existingRaw = await readFile2(targetFile, "utf8");
      } catch {
        existingRaw = void 0;
      }
      if (!canManageTarget(existingRaw, bundledRaw)) {
        continue;
      }
      const rendered = bundledRaw.replace(/\r\n/g, "\n").trimEnd() + "\n\n" + sidebarBlock + settingsBlock + "\n\n" + AGY_MANAGED_SKILL_MARKER + "\n";
      await mkdir2(targetDir, { recursive: true });
      await writeFile2(targetFile, rendered, "utf8");
    }
  };
  const offSettings = store.onSettingsChange(() => {
    if (disposed) return;
    syncChain = syncChain.then(() => syncOnce()).catch(() => {
    });
  });
  syncChain = syncChain.then(() => syncOnce());
  await syncChain;
  return async () => {
    disposed = true;
    offSettings();
    await syncChain.catch(() => {
    });
    for (const sName of SKILL_NAMES) {
      const targetDir = join2(agySkillsRoot, sName);
      const targetFile = join2(targetDir, "SKILL.md");
      try {
        const existingRaw = await readFile2(targetFile, "utf8");
        if (!existingRaw.includes(AGY_MANAGED_SKILL_MARKER)) {
          continue;
        }
        await rm(targetFile, { force: true });
        const remaining = await readdir(targetDir).catch(() => ["__non_empty__"]);
        if (remaining.length === 0) {
          await rm(targetDir, { recursive: true, force: true });
        }
      } catch {
      }
    }
  };
}

// src/server/tools.ts
import { defineTool } from "@deepseek-ai/dsh-tools";
import { stat } from "node:fs/promises";
import { isAbsolute, resolve } from "node:path";
function sessionIdOf(exec) {
  const id = exec?.agent?.session?.id;
  if (typeof id !== "string" || !id) {
    throw new Error("paper_reader tools require an active Agent session");
  }
  return id;
}
async function resolveSessionCwd(ctx, sessionId) {
  const session = ctx.get?.("sessions")?.get?.(sessionId);
  if (session) {
    const cwd = ctx.get?.("workingDirectory")?.get?.(session) ?? session.header?.cwd;
    if (typeof cwd === "string" && cwd.length > 0) return cwd;
  }
  const defDir = ctx.get?.("workingDirectory")?.defaultDirectory;
  if (typeof defDir === "string" && defDir.length > 0) return defDir;
  return process.cwd();
}
async function resolvePdfFilePath(ctx, sessionId, rawPath) {
  const trimmed = rawPath.trim();
  if (!trimmed) throw new Error("PDF path must not be empty");
  const cwd = await resolveSessionCwd(ctx, sessionId);
  const abs = isAbsolute(trimmed) ? resolve(trimmed) : resolve(cwd, trimmed);
  const info = await stat(abs).catch(() => null);
  if (!info || !info.isFile()) {
    throw new Error("PDF file not found or not a regular file: " + abs);
  }
  return abs;
}
function textRender(fn) {
  return (_args, value) => [{ type: "text", text: fn(value) }];
}
function cleanJson(value) {
  return JSON.parse(JSON.stringify(value));
}
function registerPaperCoachTools(ctx, store) {
  const tools = ctx.tools ?? ctx.get?.("tools");
  if (!tools || typeof tools.register !== "function") return () => {
  };
  const disposers = [];
  disposers.push(
    tools.register(defineTool({
      name: "paper_reader_open",
      description: 'Open a local academic paper PDF in the calling conversation sidebar enhanced PDF reader (dsh-paper-coach), optionally jumping directly to a target page or section (e.g. "4.1" or "8"). Call this when guided close reading starts so the user immediately has the cached PDF open beside the chat.',
      parameters: {
        path: { type: "string", required: true, description: "Absolute or session-cwd-relative path to the local PDF file." },
        title: { type: "string", description: "Optional short paper title displayed on the reader header and quote chips." },
        page: { type: "number", description: "Optional 1-based page number to scroll to upon opening." },
        section: { type: "string", description: 'Optional section identifier to jump to upon opening (e.g. "4.1", "\xA75.2", "8").' }
      },
      output: {
        schema: {
          type: "object",
          additionalProperties: false,
          properties: {
            pdfPath: { type: "string", required: true },
            paperTitle: { type: "string", required: true },
            delivered: { type: "boolean", required: true }
          }
        },
        render: textRender(
          (v) => v.delivered ? 'Opened paper PDF "' + v.paperTitle + '" (' + v.pdfPath + ") in the sidebar reader." : 'Queued opening paper PDF "' + v.paperTitle + '" (' + v.pdfPath + ") \u2014 will appear when the session view connects."
        )
      },
      execute: async (args, exec) => {
        exec.signal?.throwIfAborted?.();
        const sessionId = sessionIdOf(exec);
        const absPath = await resolvePdfFilePath(ctx, sessionId, String(args.path));
        const { state, delivered } = await store.openPaper(sessionId, {
          pdfPath: absPath,
          paperTitle: typeof args.title === "string" ? args.title : void 0,
          page: typeof args.page === "number" ? Math.max(1, Math.floor(args.page)) : void 0,
          section: typeof args.section === "string" ? args.section : void 0
        });
        return { pdfPath: absPath, paperTitle: state.activePaperTitle || "Paper", delivered };
      }
    }))
  );
  disposers.push(
    tools.register(defineTool({
      name: "paper_reader_navigate",
      description: 'Scroll the sidebar PDF reader to a specific section (e.g. "8", "4.1", "Conclusion") or 1-based page number, and optionally highlight 1-5 key verbatim sentences on the PDF page.',
      parameters: {
        section: { type: "string", description: 'Target section number or heading (e.g. "8", "4.1", "\xA75.2", "Appendix A").' },
        page: { type: "number", description: "Target 1-based PDF page number." },
        path: { type: "string", description: "Optional PDF path if switching papers; defaults to active paper." },
        clearPreviousHighlights: { type: "boolean", description: "Whether to clear previous model highlights before applying new ones." },
        highlights: {
          type: "array",
          description: "Key verbatim sentences/phrases from the paper to highlight in the PDF TextLayer.",
          items: {
            type: "object",
            additionalProperties: false,
            properties: {
              text: { type: "string", required: true, description: "Exact verbatim sentence or clause from the PDF." },
              page: { type: "number", description: "Optional 1-based page hint where this sentence appears." },
              color: { type: "string", enum: ["amber", "blue", "green", "rose"], description: "Highlight color theme (default: amber)." },
              label: { type: "string", description: "Short note badge shown beside the highlight." }
            }
          }
        }
      },
      output: {
        schema: {
          type: "object",
          additionalProperties: false,
          properties: {
            pdfPath: { type: "string" },
            section: { type: "string" },
            page: { type: "number" },
            highlightCount: { type: "number", required: true },
            delivered: { type: "boolean", required: true }
          }
        },
        render: textRender(
          (v) => "Navigated PDF reader (section=" + (v.section ?? "-") + ", page=" + (v.page ?? "-") + ", highlights=" + v.highlightCount + ", delivered=" + v.delivered + ")."
        )
      },
      execute: async (args, exec) => {
        exec.signal?.throwIfAborted?.();
        const sessionId = sessionIdOf(exec);
        const absPath = typeof args.path === "string" && args.path.trim() ? await resolvePdfFilePath(ctx, sessionId, args.path) : void 0;
        const { command, delivered } = await store.navigatePaper(sessionId, {
          pdfPath: absPath,
          page: typeof args.page === "number" ? Math.max(1, Math.floor(args.page)) : void 0,
          section: typeof args.section === "string" ? args.section : void 0,
          clearPreviousHighlights: typeof args.clearPreviousHighlights === "boolean" ? args.clearPreviousHighlights : void 0,
          highlights: Array.isArray(args.highlights) ? args.highlights : void 0
        });
        return cleanJson({
          pdfPath: command.pdfPath,
          section: command.section,
          page: command.page,
          highlightCount: command.highlights?.length ?? 0,
          delivered
        });
      }
    }))
  );
  disposers.push(
    tools.register(defineTool({
      name: "paper_reading_plan",
      description: "Create, update, or clear the persistent Floating Reading Roadmap & Learning Goals Panel for the current session. Displays agreed reading sections (e.g. \xA74.1 -> \xA75.2) and core learning goals.",
      parameters: {
        action: { type: "string", required: true, enum: ["set", "update", "clear"], description: "set initializes/replaces; update patches; clear removes." },
        paperTitle: { type: "string", description: "Title or short alias of the paper." },
        paperKey: { type: "string", description: "Optional archive paper-key." },
        pdfPath: { type: "string", description: "Optional local PDF path." },
        mode: { type: "string", enum: ["targeted", "full"], description: "Reading mode." },
        stage: { type: "string", enum: ["overview", "reading", "quiz", "summary", "completed"], description: "Current workflow stage." },
        goals: {
          type: "array",
          description: "Concrete learning objectives / questions to resolve.",
          items: {
            type: "object",
            additionalProperties: false,
            properties: {
              id: { type: "string" },
              text: { type: "string", required: true },
              done: { type: "boolean" }
            }
          }
        },
        sections: {
          type: "array",
          description: "Ordered list of agreed sections to study.",
          items: {
            type: "object",
            additionalProperties: false,
            properties: {
              id: { type: "string" },
              section: { type: "string", required: true },
              title: { type: "string" },
              page: { type: "number" },
              note: { type: "string" },
              status: { type: "string", enum: ["pending", "current", "done"] }
            }
          }
        }
      },
      output: {
        schema: {
          type: "object",
          additionalProperties: false,
          properties: {
            active: { type: "boolean", required: true },
            paperTitle: { type: "string" },
            stage: { type: "string" },
            goalCount: { type: "number", required: true },
            sectionCount: { type: "number", required: true }
          }
        },
        render: textRender(
          (v) => v.active ? 'Updated reading roadmap panel for "' + v.paperTitle + '" (stage=' + v.stage + ", goals=" + v.goalCount + ", sections=" + v.sectionCount + ")." : "Cleared reading roadmap panel."
        )
      },
      execute: async (args, exec) => {
        exec.signal?.throwIfAborted?.();
        const sessionId = sessionIdOf(exec);
        const absPdf = typeof args.pdfPath === "string" && args.pdfPath.trim() ? await resolvePdfFilePath(ctx, sessionId, args.pdfPath).catch(() => args.pdfPath) : void 0;
        const state = await store.updateReadingPlan(sessionId, {
          action: args.action,
          paperKey: args.paperKey,
          paperTitle: args.paperTitle,
          pdfPath: absPdf,
          mode: args.mode,
          stage: args.stage,
          goals: args.goals,
          sections: args.sections
        });
        return cleanJson({
          active: Boolean(state.plan),
          paperTitle: state.plan?.paperTitle,
          stage: state.plan?.stage,
          goalCount: state.plan?.goals.length ?? 0,
          sectionCount: state.plan?.sections.length ?? 0
        });
      }
    }))
  );
  disposers.push(
    tools.register(defineTool({
      name: "paper_reader_status",
      description: "Read the current state of the sidebar paper PDF reader and reading roadmap panel for this conversation (currently open PDF path, user visible page, current section, detected outline sections, and roadmap progress).",
      parameters: {},
      output: {
        schema: {
          type: "object",
          additionalProperties: true,
          properties: {
            connected: { type: "boolean", required: true },
            activePdfPath: { type: "string" },
            activePaperTitle: { type: "string" }
          }
        },
        render: textRender((v) => JSON.stringify(v, null, 2))
      },
      execute: async (_args, exec) => {
        exec.signal?.throwIfAborted?.();
        const sessionId = sessionIdOf(exec);
        const state = await store.getSessionState(sessionId);
        return cleanJson({
          connected: store.hasConnectedView(sessionId),
          activePdfPath: state.activePdfPath,
          activePaperTitle: state.activePaperTitle,
          viewport: state.viewport,
          plan: state.plan,
          activeHighlightCount: state.highlights.length
        });
      }
    }))
  );
  return () => {
    for (const d of disposers) {
      try {
        d();
      } catch {
      }
    }
  };
}

// src/server/translate.ts
import { randomUUID } from "node:crypto";
function buildAcademicTranslationPrompt(input, defaultLang) {
  const lang = input.targetLanguage || defaultLang || "zh-CN";
  const langName = lang.toLowerCase().startsWith("zh") ? "\u7B80\u4F53\u4E2D\u6587" : lang.toLowerCase().startsWith("en") ? "English" : lang;
  const locHints = [];
  if (input.paperTitle) locHints.push(`\u8BBA\u6587\uFF1A\u300A${input.paperTitle}\u300B`);
  if (input.section) locHints.push(`\u7AE0\u8282\uFF1A${input.section}`);
  if (input.page) locHints.push(`\u9875\u7801\uFF1Ap.${input.page}`);
  const contextLine = locHints.length > 0 ? `\u51FA\u5904\u4E0A\u4E0B\u6587\uFF1A${locHints.join(" \xB7 ")}
` : "";
  return [
    `\u4F60\u662F\u4E00\u4F4D\u4E25\u8C28\u7684\u5B66\u672F\u8BBA\u6587\u4F34\u8BFB\u7FFB\u8BD1\u52A9\u624B\u3002\u8BF7\u5C06\u4E0B\u65B9\u9009\u4E2D\u7684\u8BBA\u6587\u6BB5\u843D\u51C6\u786E\u3001\u6D41\u7545\u5730\u7FFB\u8BD1\u4E3A${langName}\u3002`,
    "\u7FFB\u8BD1\u8981\u6C42\uFF1A",
    "1. \u4FDD\u6301\u5B66\u672F\u8868\u8FBE\u51C6\u786E\u81EA\u7136\uFF0C\u5173\u952E\u4E13\u4E1A\u672F\u8BED\u53EF\u5728\u9996\u6B21\u51FA\u73B0\u65F6\u4FDD\u7559\u82F1\u6587\u539F\u8BCD\u62EC\u6CE8\uFF08\u5982\uFF1A\u6761\u4EF6\u6CC4\u9732 condition leakage\uFF09\uFF1B",
    "2. \u4E25\u683C\u4FDD\u7559\u539F\u6587\u4E2D\u7684\u6240\u6709\u6570\u5B66\u7B26\u53F7\u3001\u53D8\u91CF\u540D\u4E0E\u516C\u5F0F\u6807\u8BB0\uFF08\u5982 $x_t$\u3001\\alpha\u3001\u4E0B\u6807\u7B49\uFF09\uFF0C\u4E0D\u8981\u7834\u574F\u516C\u5F0F\u7ED3\u6784\uFF1B",
    "3. \u4FEE\u590D PDF \u53CC\u680F\u6392\u7248\u4EA7\u751F\u7684\u65AD\u884C\u8FDE\u5B57\u7B26\uFF08\u5982 trans-\nformer \u5E94\u8FD8\u539F\u4E3A transformer \u7FFB\u8BD1\uFF09\uFF1B",
    "4. \u76F4\u63A5\u8F93\u51FA\u8BD1\u6587\u6B63\u6587\uFF0C\u4E0D\u8981\u8F93\u51FA\u4EFB\u4F55\u5BD2\u6684\u3001\u89E3\u91CA\u524D\u7F00\u6216\u591A\u4F59\u5305\u88F9\u3002",
    "",
    contextLine + "\u5F85\u8BD1\u539F\u6587\uFF1A",
    input.text.trim()
  ].join("\n");
}
function cleanPdfSourceText(raw) {
  return raw.replace(/([A-Za-z])-\s*\r?\n\s*([a-z])/g, "$1$2").trim();
}
function resolveOpenAiChatEndpoints(baseUrl) {
  const cleanBase = baseUrl.trim().replace(/\/+$/, "");
  if (!cleanBase) return ["https://api.openai.com/v1/chat/completions"];
  if (/\/chat\/completions$/i.test(cleanBase)) {
    return [cleanBase];
  }
  if (/\/v\d+(?:beta\d*)?$/i.test(cleanBase)) {
    return [`${cleanBase}/chat/completions`];
  }
  return [`${cleanBase}/v1/chat/completions`, `${cleanBase}/chat/completions`];
}
function isQwenMtModel(model) {
  return /^(?:.*\/)?qwen-mt(?:-|$)/i.test(model.trim());
}
function resolveQwenMtTargetLang(rawLang) {
  const norm = (rawLang || "zh-CN").trim().toLowerCase();
  if (norm === "zh-tw" || norm === "zh-hk" || norm === "zh-hant") return "Traditional Chinese";
  if (norm.startsWith("zh")) return "Chinese";
  if (norm.startsWith("en")) return "English";
  if (norm.startsWith("ja")) return "Japanese";
  if (norm.startsWith("ko")) return "Korean";
  if (norm.startsWith("fr")) return "French";
  if (norm.startsWith("de")) return "German";
  if (norm.startsWith("es")) return "Spanish";
  if (norm.startsWith("ru")) return "Russian";
  return rawLang || "Chinese";
}
function buildQwenMtDomainsHint(input) {
  const contextParts = [];
  if (input.paperTitle) contextParts.push(`Paper: ${input.paperTitle}`);
  if (input.section) contextParts.push(`Section: ${input.section}`);
  const ctxSuffix = contextParts.length > 0 ? ` (${contextParts.join("; ")})` : "";
  return `Academic research paper${ctxSuffix}. Translate accurately and fluently in scholarly register, preserving mathematical variables, symbols, and formulas verbatim.`;
}
async function callOpenAiCompatible(options) {
  const endpoints = resolveOpenAiChatEndpoints(options.baseUrl);
  const useQwenMt = isQwenMtModel(options.model);
  const targetLang = options.inputMeta.targetLanguage || options.defaultLang || "zh-CN";
  const primaryPayload = useQwenMt ? {
    model: options.model,
    stream: false,
    messages: [{ role: "user", content: options.sourceText }],
    translation_options: {
      source_lang: "auto",
      target_lang: resolveQwenMtTargetLang(targetLang),
      domains: buildQwenMtDomainsHint(options.inputMeta)
    }
  } : {
    model: options.model,
    temperature: 0.2,
    stream: false,
    messages: [{ role: "user", content: options.prompt }]
  };
  const postOnce = (endpoint, payload) => fetch(endpoint, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      authorization: `Bearer ${options.apiKey}`
    },
    body: JSON.stringify(payload),
    signal: options.signal
  });
  let chosenEndpoint = endpoints[0];
  let res = await postOnce(chosenEndpoint, primaryPayload);
  if (res.status === 404 && endpoints.length > 1 && !options.signal?.aborted) {
    chosenEndpoint = endpoints[1];
    res = await postOnce(chosenEndpoint, primaryPayload);
  }
  if (useQwenMt && res.status === 400 && !options.signal?.aborted) {
    res = await postOnce(chosenEndpoint, {
      model: options.model,
      temperature: 0.2,
      stream: false,
      messages: [{ role: "user", content: options.prompt }]
    });
  }
  if (!res.ok) {
    const bodyText = await res.text().catch(() => "");
    throw new Error(`\u81EA\u5B9A\u4E49\u7FFB\u8BD1 API \u8BF7\u6C42\u5931\u8D25 (HTTP ${res.status}): ${bodyText.slice(0, 240) || res.statusText}`);
  }
  const data = await res.json();
  const rawContent = data.choices?.[0]?.message?.content;
  const text = typeof rawContent === "string" ? rawContent.trim() : Array.isArray(rawContent) ? rawContent.map((p) => p.text ?? "").join("").trim() : "";
  if (!text) {
    throw new Error("\u81EA\u5B9A\u4E49\u7FFB\u8BD1 API \u8FD4\u56DE\u5185\u5BB9\u4E3A\u7A7A\uFF0C\u8BF7\u68C0\u67E5\u6A21\u578B\u540D\u79F0\u4E0E\u63A5\u53E3\u517C\u5BB9\u6027");
  }
  return {
    translation: text,
    providerUsed: "custom_api",
    modelUsed: data.model || options.model
  };
}
async function resolveHostModelRoute(ctx, sessionId, preferredRoute) {
  if (preferredRoute && preferredRoute.includes("/")) {
    const slash = preferredRoute.indexOf("/");
    const p = preferredRoute.slice(0, slash).trim();
    const m = preferredRoute.slice(slash + 1).trim();
    if (p && m) return { provider: p, model: m };
  }
  const llm = ctx.llm ?? ctx.get?.("llm");
  if (!llm || typeof llm.listProviders !== "function") {
    throw new Error("\u5BBF\u4E3B\u672A\u6302\u8F7D dsh-llm \u670D\u52A1\uFF0C\u8BF7\u5728\u63D2\u4EF6\u8BBE\u7F6E\u4E2D\u914D\u7F6E\u81EA\u5B9A\u4E49\u7FFB\u8BD1 API");
  }
  const providers = llm.listProviders() ?? [];
  const providerSet = new Set(providers);
  if (sessionId) {
    const agent = (ctx.agents ?? ctx.get?.("agents"))?.get?.(sessionId);
    const agentModel = agent?.model ?? agent?.route ?? agent?.config?.model;
    if (agentModel && typeof agentModel === "object" && agentModel.provider && agentModel.model && providerSet.has(String(agentModel.provider))) {
      return { provider: String(agentModel.provider), model: String(agentModel.model) };
    }
    const session = (ctx.sessions ?? ctx.get?.("sessions"))?.get?.(sessionId);
    const header = session?.header;
    if (header?.provider && header?.model && providerSet.has(String(header.provider))) {
      return { provider: String(header.provider), model: String(header.model) };
    }
  }
  const candidates = [];
  for (const p of providers) {
    try {
      const models = await llm.listModels(p);
      if (Array.isArray(models)) {
        for (const item of models) {
          const id = typeof item === "string" ? item : item?.id ?? item?.model;
          if (typeof id === "string" && id) {
            candidates.push({ provider: p, model: id });
          }
        }
      }
    } catch {
    }
  }
  if (candidates.length === 0) {
    throw new Error("\u672A\u53D1\u73B0\u53EF\u7528\u7684\u5BBF\u4E3B\u6A21\u578B\u8DEF\u7531\uFF0C\u8BF7\u5728\u8BBE\u7F6E\u4E2D\u914D\u7F6E\u81EA\u5B9A\u4E49\u7FFB\u8BD1 API \u6216\u6307\u5B9A\u6A21\u578B\u8DEF\u7531");
  }
  const fast = candidates.find((c) => /flash|mini|lite|haiku|fast/i.test(c.model));
  return fast ?? candidates[0];
}
async function translateExcerpt(ctx, sessionId, settings, input) {
  if (!input.text || !input.text.trim()) {
    throw new Error("\u5F85\u7FFB\u8BD1\u6587\u672C\u4E0D\u80FD\u4E3A\u7A7A");
  }
  const clipped = input.text.trim().slice(0, 8e3);
  const cleanedSource = cleanPdfSourceText(clipped);
  const prompt = buildAcademicTranslationPrompt({ ...input, text: clipped }, settings.targetLanguage);
  const mode = input.modeOverride ?? (settings.translationMode === "custom_api" ? "custom_api" : "host_model");
  if (mode === "custom_api") {
    if (!settings.customApiKey || !settings.customApiKey.trim()) {
      throw new Error("\u5C1A\u672A\u586B\u5199\u81EA\u5B9A\u4E49\u7FFB\u8BD1 API Key\uFF0C\u8BF7\u5728\u4FA7\u8FB9\u680F\u6216\u8BBA\u6587\u4F34\u8BFB\u8BBE\u7F6E\u4E2D\u586B\u5199 API Key\uFF0C\u6216\u5207\u6362\u4E3A\u5BBF\u4E3B\u6A21\u578B\u7FFB\u8BD1");
    }
    return callOpenAiCompatible({
      baseUrl: settings.customApiBaseUrl || "https://api.openai.com/v1",
      apiKey: settings.customApiKey.trim(),
      model: settings.customApiModel || "gpt-4o-mini",
      prompt,
      sourceText: cleanedSource,
      inputMeta: input,
      defaultLang: settings.targetLanguage,
      signal: input.signal
    });
  }
  const llm = ctx.llm ?? ctx.get?.("llm");
  if (!llm || typeof llm.stream !== "function") {
    if (settings.customApiKey?.trim()) {
      return callOpenAiCompatible({
        baseUrl: settings.customApiBaseUrl || "https://api.openai.com/v1",
        apiKey: settings.customApiKey.trim(),
        model: settings.customApiModel || "gpt-4o-mini",
        prompt,
        sourceText: cleanedSource,
        inputMeta: input,
        defaultLang: settings.targetLanguage,
        signal: input.signal
      });
    }
    throw new Error("\u5F53\u524D\u73AF\u5883\u65E0\u6CD5\u8C03\u7528\u5BBF\u4E3B\u6A21\u578B\uFF0C\u8BF7\u914D\u7F6E\u81EA\u5B9A\u4E49\u7FFB\u8BD1 API");
  }
  const route = await resolveHostModelRoute(ctx, sessionId, settings.hostModelRoute);
  let output = "";
  const stream = llm.stream({
    provider: route.provider,
    model: route.model,
    messages: [
      {
        id: randomUUID(),
        role: "user",
        content: [{ type: "text", text: prompt }],
        source: { kind: "user" }
      }
    ],
    signal: input.signal
  });
  for await (const chunk of stream) {
    if (input.signal?.aborted) throw new Error("\u7FFB\u8BD1\u5DF2\u53D6\u6D88");
    if (chunk && chunk.type === "text-delta" && typeof chunk.text === "string") {
      output += chunk.text;
    } else if (chunk && chunk.type === "finish" && chunk.reason?.kind === "error") {
      throw new Error(chunk.reason.failure?.message || "\u5BBF\u4E3B\u6A21\u578B\u6D41\u5F0F\u7FFB\u8BD1\u5931\u8D25");
    } else if (chunk && chunk.type === "error") {
      throw new Error(chunk.error?.message || chunk.message || "\u5BBF\u4E3B\u6A21\u578B\u6D41\u5F0F\u7FFB\u8BD1\u5931\u8D25");
    }
  }
  const trimmed = output.trim();
  if (!trimmed) {
    throw new Error(`\u6A21\u578B (${route.provider}/${route.model}) \u672A\u8FD4\u56DE\u8BD1\u6587\u5185\u5BB9`);
  }
  return {
    translation: trimmed,
    providerUsed: route.provider,
    modelUsed: route.model
  };
}

// src/index.ts
var name = "dsh-paper-coach";
function writeJson(res, status, body) {
  if (res.headersSent) return;
  const payload = JSON.stringify(body);
  res.writeHead(status, {
    "content-type": "application/json; charset=utf-8",
    "cache-control": "no-store"
  });
  res.end(payload);
}
async function readJsonBody(req, maxBytes = 512 * 1024) {
  const chunks = [];
  let total = 0;
  for await (const chunk of req) {
    const buf = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
    total += buf.length;
    if (total > maxBytes) throw new Error("Request body too large");
    chunks.push(buf);
  }
  const raw = Buffer.concat(chunks).toString("utf8");
  return raw.trim() ? JSON.parse(raw) : {};
}
function apply(ctx, options) {
  const store = new PaperCoachStore(options?.storeDir);
  const initPromise = store.init();
  const resolvedAgyConfigDir = options?.agyConfigDir === false ? void 0 : typeof options?.agyConfigDir === "string" ? options.agyConfigDir : !options?.storeDir ? join3(homedir3(), ".gemini", "config") : void 0;
  let agyDisposed = false;
  let cleanupAgy;
  if (resolvedAgyConfigDir) {
    void initPromise.then(async () => {
      if (agyDisposed) return;
      cleanupAgy = await registerAgySkillsSync(store, { agyConfigDir: resolvedAgyConfigDir });
      if (agyDisposed && cleanupAgy) {
        await cleanupAgy();
      }
    }).catch(() => {
    });
  }
  ctx.effect(() => () => {
    agyDisposed = true;
    void cleanupAgy?.();
    store.dispose();
  });
  if (typeof ctx.inject === "function") {
    ctx.inject(["skills"], (sctx) => {
      const off = registerBundledPaperSkills(sctx, store);
      sctx.effect(() => off);
    });
    ctx.inject(["tools"], (tctx) => {
      const off = registerPaperCoachTools(tctx, store);
      tctx.effect(() => off);
    });
    ctx.inject(["systemPrompt"], (spCtx) => {
      const sp = spCtx.systemPrompt ?? spCtx.get?.("systemPrompt");
      if (!sp || typeof sp.section !== "function") return;
      const rawOrder = typeof sp.getSectionOrder === "function" ? sp.getSectionOrder("TOOLS_SDK") ?? sp.getSectionOrder("MCP_SERVERS") ?? sp.getSectionOrder("tools") : void 0;
      const order = typeof rawOrder === "number" && Number.isFinite(rawOrder) ? rawOrder + 5 : 5005;
      const off = sp.section({
        name: "dsh-paper-coach",
        order,
        text: PAPER_COACH_SYSTEM_PROMPT_LINES.join("\n")
      });
      spCtx.effect(() => off);
    });
  } else {
    ctx.effect(() => registerBundledPaperSkills(ctx, store));
    ctx.effect(() => registerPaperCoachTools(ctx, store));
  }
  const registerWebRoutes = (wctx) => {
    const webServer = wctx.webServer ?? wctx.get?.("webServer");
    if (!webServer || typeof webServer.register !== "function") return () => {
    };
    const activeSseResponses = /* @__PURE__ */ new Set();
    const libDir = dirname2(fileURLToPath2(import.meta.url));
    const fence = (req) => {
      const conn = wctx.get?.("connection") ?? ctx.get?.("connection");
      if (!conn || typeof conn.requestRejection !== "function") return true;
      return conn.requestRejection(req) === void 0;
    };
    const offRoute = webServer.register({
      kind: "prefix",
      path: "/paper-coach",
      handler: async (req, res) => {
        if (!fence(req)) {
          writeJson(res, 403, { ok: false, error: "forbidden" });
          return;
        }
        const parsedUrl = new URL(req.url ?? "/", "http://dsh.internal");
        const pathname = parsedUrl.pathname;
        if (req.method === "GET" && pathname.startsWith("/paper-coach/assets/")) {
          const assetName = pathname.slice("/paper-coach/assets/".length);
          if (assetName !== "pdf-runtime.mjs" && assetName !== "pdf.worker.mjs") {
            writeJson(res, 404, { ok: false, error: "unknown asset" });
            return;
          }
          try {
            const bytes = await readFile3(join3(libDir, assetName));
            res.writeHead(200, {
              "content-type": "text/javascript; charset=utf-8",
              "cache-control": "public, max-age=3600"
            });
            res.end(bytes);
          } catch (err) {
            writeJson(res, 500, { ok: false, error: String(err) });
          }
          return;
        }
        if (req.method === "GET" && pathname === "/paper-coach/pdf") {
          const rawPath = parsedUrl.searchParams.get("path") || "";
          if (!rawPath || !rawPath.toLowerCase().endsWith(".pdf")) {
            writeJson(res, 400, { ok: false, error: "valid .pdf path is required" });
            return;
          }
          try {
            const absPath = isAbsolute2(rawPath) ? resolve2(rawPath) : resolve2(process.cwd(), rawPath);
            const info = await stat2(absPath);
            if (!info.isFile()) {
              writeJson(res, 404, { ok: false, error: "PDF file not found" });
              return;
            }
            const stream = createReadStream(absPath);
            res.writeHead(200, {
              "content-type": "application/pdf",
              "content-length": String(info.size),
              "cache-control": "no-cache"
            });
            await pipeline(stream, res);
          } catch (err) {
            if (!res.headersSent) writeJson(res, 404, { ok: false, error: String(err) });
            else res.destroy();
          }
          return;
        }
        if (req.method === "GET" && pathname === "/paper-coach/events") {
          const sessionId = parsedUrl.searchParams.get("sessionId") || "";
          if (!sessionId) {
            writeJson(res, 400, { ok: false, error: "sessionId is required" });
            return;
          }
          res.writeHead(200, {
            "content-type": "text/event-stream; charset=utf-8",
            "cache-control": "no-cache, no-transform",
            connection: "keep-alive",
            "x-accel-buffering": "no"
          });
          const sendEvent = (event) => {
            if (res.writableEnded || res.destroyed) return;
            res.write("data: " + JSON.stringify(event) + "\n\n");
          };
          const initialState = await store.getSessionState(sessionId);
          sendEvent({
            type: "snapshot",
            state: initialState,
            settings: store.getRedactedSettings()
          });
          const unsub = store.subscribeSession(sessionId, sendEvent);
          const heartbeat = setInterval(() => {
            if (!res.writableEnded && !res.destroyed) {
              res.write(": ping\n\n");
            }
          }, 2e4);
          heartbeat.unref?.();
          activeSseResponses.add(res);
          let sseClosed = false;
          const cleanupSse = () => {
            if (sseClosed) return;
            sseClosed = true;
            activeSseResponses.delete(res);
            clearInterval(heartbeat);
            unsub();
          };
          req.on("aborted", cleanupSse);
          res.on("close", cleanupSse);
          return;
        }
        if (req.method !== "POST" || !pathname.startsWith("/paper-coach/api/")) {
          writeJson(res, 404, { ok: false, error: "not found" });
          return;
        }
        const action = pathname.slice("/paper-coach/api/".length);
        const abortCtrl = new AbortController();
        req.on("aborted", () => abortCtrl.abort());
        res.on("close", () => {
          if (!res.writableEnded) abortCtrl.abort();
        });
        try {
          const body = await readJsonBody(req);
          switch (action) {
            case "state.get": {
              const sessionId = String(body.sessionId || "");
              if (!sessionId) throw new Error("sessionId is required");
              const state = await store.getSessionState(sessionId);
              writeJson(res, 200, { ok: true, state, settings: store.getRedactedSettings() });
              return;
            }
            case "settings.get": {
              await store.init();
              writeJson(res, 200, { ok: true, settings: store.getRedactedSettings() });
              return;
            }
            case "settings.update": {
              const settings = await store.updateSettings(body ?? {});
              writeJson(res, 200, { ok: true, settings });
              return;
            }
            case "viewport.update": {
              const sessionId = String(body.sessionId || "");
              if (!sessionId || !body.viewport) throw new Error("sessionId and viewport required");
              const state = await store.updateViewport(sessionId, body.viewport);
              writeJson(res, 200, { ok: true, state });
              return;
            }
            case "plan.update": {
              const sessionId = String(body.sessionId || "");
              if (!sessionId) throw new Error("sessionId required");
              const state = await store.updateReadingPlan(sessionId, body);
              writeJson(res, 200, { ok: true, state });
              return;
            }
            case "highlights.clear": {
              const sessionId = String(body.sessionId || "");
              if (!sessionId) throw new Error("sessionId required");
              const state = await store.clearHighlights(sessionId);
              writeJson(res, 200, { ok: true, state });
              return;
            }
            case "translate": {
              await store.init();
              const result = await translateExcerpt(
                ctx,
                typeof body.sessionId === "string" ? body.sessionId : void 0,
                store.getRawSettings(),
                {
                  text: String(body.text || ""),
                  paperTitle: body.paperTitle,
                  page: body.page,
                  section: body.section,
                  targetLanguage: body.targetLanguage,
                  modeOverride: body.modeOverride,
                  signal: abortCtrl.signal
                }
              );
              writeJson(res, 200, { ok: true, ...result });
              return;
            }
            default:
              writeJson(res, 404, { ok: false, error: "Unknown action: " + action });
          }
        } catch (err) {
          writeJson(res, 400, {
            ok: false,
            error: err instanceof Error ? err.message : String(err)
          });
        }
      }
    });
    return () => {
      for (const sseRes of activeSseResponses) {
        try {
          sseRes.end();
        } catch {
        }
      }
      activeSseResponses.clear();
      offRoute?.();
    };
  };
  if (typeof ctx.inject === "function") {
    ctx.inject(["webServer"], (wctx) => {
      const off = registerWebRoutes(wctx);
      wctx.effect(() => off);
    });
  } else {
    ctx.effect(() => registerWebRoutes(ctx));
  }
}
export {
  apply,
  name
};
