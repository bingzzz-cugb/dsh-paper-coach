export const PAPER_COACH_CSS = `
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

/* Floating Selection Toolbar { 翻译 ; 引用 } */
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

/* Assistant Inline Anchor Badge [📍 §8 · p.9](#paper-coach-loc?...) */
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
`
