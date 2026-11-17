# dsh-paper-coach — DSH 学术论文粗读导读 + 精读伴读全栈插件

`dsh-paper-coach` 是一款面向 **DeepSeek Harness (DSH)** 的学术论文阅读全栈插件，将**粗读导读（`paper-reading-navigator`）**与**教练式精读伴读（`coaching-paper-reading`）**双 Skill 同**交互式侧边栏 PDF 阅读器、划词三通道翻译与精确位置引用胶囊、Agent ↔ PDF 双向定位与原句荧光高亮、定向精读浮动路线面板**打包为开箱即用的一体化体验。

## 核心特性

1. **自动唤起与视口感知（`paper_reader_open` / `paper_reader_status`）**
   - 进入精读伴读时，主代理自动在右侧边栏打开本地缓存或 Zotero 论文 PDF，并实时感知当前阅读页码与所属章节。
   - 同时接管 DSH 原生右侧栏 PDF 资源页签与 `dsh-better-sidebar` 文件预览器，内置离屏位图 LRU 缓存与防抖高清重绘，连续缩放与快速滚动依然清晰流畅。

2. **PDF 划词浮动 `{ 🌐 翻译 | 💬 引用 }` 与三通道翻译**
   - 在侧边栏 PDF 中选中任意句段，选区上方自动弹出 `{ 🌐 翻译 | 💬 引用 }` 工具条：
     - **通道 ① 宿主模型旁路秒翻**：复用 DSH 已配置的快速模型后台直翻，不污染主会话上下文；
     - **通道 ② 自定义 OpenAI 兼容 API**：支持配置任意 Base URL / API Key / Model（含阿里云百炼 `qwen-mt-plus` 等专用翻译接口自适应）；
     - **通道 ③ 发送主会话精讲**：一键携带页码、章节与原文上下文填入输入框交由主代理深度拆解。
   - **精确位置引用胶囊**：点击「💬 引用」后在输入框上方挂起 `p.X §Y` 原文引用胶囊，发送后聊天记录中同样渲染为可点击回跳至 PDF 精确选区的定位胶囊。

3. **Agent ↔ PDF 双向定位与关键句荧光高亮（`paper_reader_navigate` + `paper-coach://loc` 徽章）**
   - 当你围绕某节公式、机制或实验提问时，主代理自动将右侧 PDF 滚动定位到对应章节与句子位置，并在原文关键句上叠加多色荧光高亮与精简标签；
   - 回复正文中附带 `[📍 §3 · p.4](paper-coach://loc?section=3&page=4&q=...)` 可点击定位胶囊，回看历史对话时点击即可一键跳回原文对应句子并脉冲闪烁提示。

4. **定向精读章节路线 & 核心学习目标面板（`paper_reading_plan`）**
   - 常驻展示本篇约定的精读章节队列（`待读 / 当前精读 / 已读完`）与核心待解问题清单；
   - 支持在**聊天右上角可拖拽悬浮胶囊**（仅箭头按钮控制折叠，拖拽标题不误触）与**PDF 阅读器顶部导览栏**之间一键切换。

5. **内置双 Skill + 文献档案存储自适应**
   - 自动向 DSH 注册 `paper-reading-navigator`（原文核验、粗读五问、质量与个人价值研判、定向精读范围建议）与 `coaching-paper-reading`（读前概览、读中答疑、理解检验、一次性学习总结）；
   - 环境装有 OpenViking 时优先沿用 `viking://~/resources/paper-reading/` 文献档案库；未装 OpenViking 时自动回退到工作区 `.paper-reading/` 本地 Markdown 档案库，零外部依赖即可完整运行。

---

## 安装方法

### 环境要求

- **DeepSeek Harness (DSH)** Desktop 或 Web（Node.js `>= 20`）
- 可选增强：建议同时启用 `dsh-better-sidebar`（`>= 0.28.0`）以获得更丰富的侧边栏联动能力（在支持原生右侧资源页签的 DSH 版本中亦可独立接管 PDF 页签）。

### 方式一：克隆仓库安装（推荐）

仓库已包含预构建的 `lib/` 产物，克隆后无需手动编译即可直接挂载：

```bash
git clone https://github.com/bingzzz-cugb/dsh-paper-coach.git
dsh plugin --profile desktop add ./dsh-paper-coach
```

### 方式二：打包 `.tgz` 离线安装

```bash
cd dsh-paper-coach
npm pack
dsh plugin --profile desktop add ./dsh-paper-coach-0.1.0.tgz
```

安装完成后重启 DSH Desktop（或刷新 Web 前端），即可在 **设置 → 论文粗读+精读伴读设置** 或侧边栏 PDF 阅读器右上角 `⚙` 按钮中配置翻译通道、API Key、路线面板默认位置与个人研究方向提示。

### Antigravity (`dsh-agy-link`) 桥接线路兼容说明

如果你在 DSH 中通过 `dsh-agy-link` 使用 Google Antigravity 线路：
- **技能自动同步（零手动拷贝）**：插件启动及修改设置时，会自动检测本机是否存在 `~/.gemini/config`，并将携带最新面板配置与划词引用规则的内置双 Skill 自动同步至 `~/.gemini/config/skills/`（停用插件时自动清理，且不会覆盖你手写的非托管同名技能）；
- **MCP 工具放行**：只需在 `dsh-agy-link` 开启 `mcpBridge` 并在 `mcpToolAllowlist` 中加入 `paper_reader_open,paper_reader_navigate,paper_reading_plan,paper_reader_status`，AGY 即可像原生 DSH 会话一样完整驱动右侧 PDF 阅读器与精读路线面板。

---

## 提供的 Agent 工具与内置技能

| 类型 | 名称 | 说明 |
| --- | --- | --- |
| Tool | `paper_reader_open` | 在右侧边栏打开本地论文 PDF，支持直接跳至指定页码或章节 |
| Tool | `paper_reader_navigate` | 滚动侧边栏 PDF 到指定章节/页码，并在原文 TextLayer 上高亮 1～5 句关键原句与标签 |
| Tool | `paper_reading_plan` | 创建、更新或清空定向精读章节路线与学习目标浮动面板 |
| Tool | `paper_reader_status` | 读取当前打开的 PDF、用户可见页码、当前章节、提取的大纲与精读路线进度 |
| Skill | `paper-reading-navigator` | 候选论文原文核验、粗读五问、质量/价值分档、阅读与收藏分立建议、文献档案协议 |
| Skill | `coaching-paper-reading` | 基于原文证据的读前概览、读中联动答疑、范围理解检验与完成后一次性学习总结 |

---

## 本地开发与构建

```bash
pnpm install        # 安装开发依赖
pnpm run typecheck  # TypeScript 严格类型检查
pnpm test           # 运行 Vitest 单元测试套件
pnpm run build      # 构建服务端 lib/index.js、客户端 lib/client.js 与懒加载 PDF 引擎
pnpm run check      # 一键执行 typecheck + test + build
```

## License

[Apache-2.0](./LICENSE)
