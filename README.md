# Skill Inspector

[中文](#中文) | [English](#english)

## 中文

`Skill Inspector` 用来分析一份 skill，并产出一份结构化报告和一份可读报告。

- 在线示例：<https://0065paula.github.io/skill-inspector/>
- 示例 JSON：[`templates/report.example.json`](./templates/report.example.json)
- 示例输入：[`examples/sample-input.md`](./examples/sample-input.md)

### 它解决什么问题

拿到一份陌生 skill 时，大家最常见的问题有五个：

- 这份 skill 的目标是什么
- agent 需要按什么流程执行
- 它引用了哪些文件、命令和链接
- 它有哪些风险和安装依赖
- 它的写法是否清楚，哪些地方值得改

`Skill Inspector` 会把这些信息整理成两份输出：

- `report.json`：给 agent、脚本和后续流程使用
- `report.html`：给人直接阅读和分享

### 这个 skill 的核心能力

1. 结构分析
   提取标题、frontmatter、章节、命令、文件引用、URL 引用和 workflow 信号。

2. 工作流整理
   把 skill 的执行逻辑整理成结构化 workflow，再由本地渲染器生成 Mermaid 图。

3. 中文优先说明
   翻译自然语言内容，保留命令、路径、URL、变量名和 frontmatter key 的英文形式，并支持 `compact` 与 `full` 两种模式。

4. 安全信号识别
   识别命令执行、联网、外部依赖和潜在风险，输出安全结论。

5. 安装状态判断
   生成 `install` 结果，帮助读者理解这份 skill 的落地条件。

6. 评分和建议
   从结构清晰度、边界表达、引用完整度和可维护性给出简短建议。

### 支持的输入

一次分析一个来源，支持三种输入：

- 贴入的 skill 全文
- 本地 skill 文件路径
- 远程 skill 链接

### 工作方式

流程分四步：

1. 读取并整理原始 skill
2. 先整理一份紧凑的归一化结果，只保留章节、命令、引用、工作流和证据片段
3. 按 [`templates/report.schema.json`](./templates/report.schema.json) 生成 `report.json`
4. 用 [`scripts/render-report.mjs`](./scripts/render-report.mjs) 和 [`templates/report.html`](./templates/report.html) 渲染 `report.html`
5. 把结果写入 `out/`

推荐先跑一遍预处理：

```bash
node scripts/normalize-skill.mjs <skill-file-or-url> out/normalized-source.json
node scripts/build-report-draft.mjs out/normalized-source.json out/report.draft.json
node scripts/build-report-overlay-template.mjs out/report.draft.json out/report.overlay.template.json
node scripts/finalize-report.mjs out/report.draft.json out/report.overlay.json out/report.json
```

第一步产出的 `normalized-source.json` 适合给 agent 当主上下文，能减少重复读取原文带来的 token 开销。
第二步产出的 `report.draft.json` 适合当最终报告的起点。
第三步产出的 `report.overlay.template.json` 给 agent 一个稳定的小输入形状。
第四步把 `report.overlay.json` 合并进草稿，生成最终 `report.json`。

当 workflow 图的语义靠规则难以稳定抽取时，推荐让 LLM 直接填写 overlay 里的 `workflow`，并按 [`prompts/workflow-generation.md`](./prompts/workflow-generation.md) 的约束输出结构化图。

它现在还会额外生成 `reportSeeds`，里面预填了这些适合机械抽取的字段：

- `summary`
- `workflow`
- `references`
- `translation.mode`
- `source`

后续分析只需要在这些基础上补 `translation.sections`、`safety`、`score` 和 `suggestions`。

输出规则很明确：

- 先生成 JSON，再生成 HTML
- HTML 与 JSON 保持一致
- `report.json` 是唯一分析真源
- `references` 去重
- 证据行按需补充
- `suggestions` 至少包含一条具体建议
- `install` 始终存在

### 适合谁用

这份 skill 适合下面几类工作：

- 快速看懂一个陌生 skill
- 把 skill 评审结果沉淀成报告
- 检查 skill 的结构、风险和依赖
- 产出可以直接分享的 HTML 页面

### 关键文件

- [`SKILL.md`](./SKILL.md)：主工作流和约束
- [`templates/report.schema.json`](./templates/report.schema.json)：`report.json` 结构定义
- [`templates/report.html`](./templates/report.html)：HTML 模板
- [`templates/report.example.json`](./templates/report.example.json)：示例输出
- [`prompts/translation.md`](./prompts/translation.md)：翻译规则
- [`prompts/insights.md`](./prompts/insights.md)：建议、评分和安全表达规则
- [`prompts/workflow-generation.md`](./prompts/workflow-generation.md)：流程图生成规范
- [`scripts/render-report.mjs`](./scripts/render-report.mjs)：JSON 到 HTML 的渲染脚本
- [`scripts/normalize-skill.mjs`](./scripts/normalize-skill.mjs)：远程抓取和紧凑归一化脚本
- [`scripts/build-report-draft.mjs`](./scripts/build-report-draft.mjs)：从归一化结果生成报告草稿
- [`scripts/build-report-overlay-template.mjs`](./scripts/build-report-overlay-template.mjs)：生成判断型 overlay 模板
- [`scripts/finalize-report.mjs`](./scripts/finalize-report.mjs)：把报告草稿和分析补丁合并成最终报告
- [`templates/report.overlay.example.json`](./templates/report.overlay.example.json)：overlay 示例

### 项目结构

这个仓库采用 skill-native 工作流：

- [`SKILL.md`](./SKILL.md) 定义分析流程
- [`templates/report.schema.json`](./templates/report.schema.json) 定义输出结构
- [`templates/report.html`](./templates/report.html) 定义展示方式
- [`scripts/render-report.mjs`](./scripts/render-report.mjs) 负责渲染已有报告

这个结构适合持续迭代 skill 本身，也方便 agent 复用同一套分析规则。

## English

`Skill Inspector` analyzes one skill source and turns it into a structured report plus a readable report.

- Live example: <https://0065paula.github.io/skill-inspector/>
- Example JSON: [`templates/report.example.json`](./templates/report.example.json)
- Example input: [`examples/sample-input.md`](./examples/sample-input.md)

### What It Solves

When you inherit an unfamiliar skill, you usually need answers to five questions:

- What is this skill trying to achieve
- What execution flow should the agent follow
- Which files, commands, and links does it reference
- Which risks and installation requirements does it carry
- How clear is the writing, and what should improve

`Skill Inspector` packages those answers into two artifacts:

- `report.json`: for agents, scripts, and downstream workflows
- `report.html`: for human reading and sharing

### Core Capabilities

1. Structure analysis
   Extracts the title, frontmatter, sections, commands, file references, URL references, and workflow signals.

2. Workflow mapping
   Organizes execution logic into structured workflow data and lets the local renderer produce Mermaid in HTML.

3. Chinese-first explanation
   Translates natural-language content while preserving commands, paths, URLs, variables, and frontmatter keys in English, with `compact` and `full` modes.

4. Safety review
   Surfaces command execution, network activity, external dependencies, and risk signals.

5. Installation detection
   Produces an `install` result so readers can understand adoption requirements quickly.

6. Scoring and recommendations
   Gives short, concrete feedback on clarity, boundaries, references, and maintainability.

### Supported Inputs

One run handles one source. Supported inputs:

- pasted skill content
- local path to a skill file
- remote skill link

### How It Works

The workflow has four steps:

1. Read and normalize the source
2. Build a compact normalized working set with headings, commands, references, workflow steps, and evidence snippets
3. Generate `report.json` from [`templates/report.schema.json`](./templates/report.schema.json)
4. Render `report.html` with [`scripts/render-report.mjs`](./scripts/render-report.mjs) and [`templates/report.html`](./templates/report.html)
5. Write outputs into `out/`

Recommended preprocessing step:

```bash
node scripts/normalize-skill.mjs <skill-file-or-url> out/normalized-source.json
node scripts/build-report-draft.mjs out/normalized-source.json out/report.draft.json
node scripts/build-report-overlay-template.mjs out/report.draft.json out/report.overlay.template.json
node scripts/finalize-report.mjs out/report.draft.json out/report.overlay.json out/report.json
```

`normalized-source.json` gives the agent a smaller working context and cuts repeated source reads.
`report.draft.json` provides a schema-shaped starting point for the final report.
`report.overlay.template.json` gives the model a stable template for judgment-heavy fields.
`report.overlay.json` stays small and focuses model effort before producing the final `report.json`.

When heuristic workflow extraction becomes too rigid, let the model fill `workflow` directly in the overlay and follow [`prompts/workflow-generation.md`](./prompts/workflow-generation.md).

It also includes `reportSeeds` for deterministic fields:

- `summary`
- `workflow`
- `references`
- `translation.mode`
- `source`

That lets the agent focus on `translation.sections`, `safety`, `score`, and `suggestions`.

The output contract stays simple:

- JSON comes first
- HTML matches the JSON
- `report.json` is the canonical analysis output
- `references` are deduplicated
- evidence lines are added only where proof matters
- `suggestions` includes at least one concrete recommendation
- `install` is always present

### Who It Helps

This skill fits teams and agents that need to:

- understand an unfamiliar skill quickly
- turn skill review into a reusable report
- inspect structure, risk, and dependencies
- publish a report people can read directly

### Key Files

- [`SKILL.md`](./SKILL.md): main workflow and constraints
- [`templates/report.schema.json`](./templates/report.schema.json): schema for `report.json`
- [`templates/report.html`](./templates/report.html): HTML template
- [`templates/report.example.json`](./templates/report.example.json): sample output
- [`prompts/translation.md`](./prompts/translation.md): translation rules
- [`prompts/insights.md`](./prompts/insights.md): scoring, recommendation, and safety-writing rules
- [`prompts/workflow-generation.md`](./prompts/workflow-generation.md): structured workflow generation rules
- [`scripts/render-report.mjs`](./scripts/render-report.mjs): JSON-to-HTML renderer
- [`scripts/normalize-skill.mjs`](./scripts/normalize-skill.mjs): remote fetch and compact normalization helper
- [`scripts/build-report-draft.mjs`](./scripts/build-report-draft.mjs): draft report generator from normalized data
- [`scripts/build-report-overlay-template.mjs`](./scripts/build-report-overlay-template.mjs): overlay template generator
- [`scripts/finalize-report.mjs`](./scripts/finalize-report.mjs): final report merger and shape validator
- [`templates/report.overlay.example.json`](./templates/report.overlay.example.json): example overlay payload

### Project Shape

This repository uses a skill-native workflow:

- [`SKILL.md`](./SKILL.md) defines the analysis process
- [`templates/report.schema.json`](./templates/report.schema.json) defines the output contract
- [`templates/report.html`](./templates/report.html) defines the report presentation
- [`scripts/render-report.mjs`](./scripts/render-report.mjs) renders existing report data

That layout makes the analysis workflow easy to reuse and easy to evolve.
