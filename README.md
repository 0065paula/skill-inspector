# Skill Inspector

[中文](#中文) | [English](#english)

## 中文

`Skill Inspector` 是一套面向 agent 的 skill 分析流程。它接收一份 skill 来源，提取结构、工作流、引用、安全信号、翻译内容、安装状态和评分建议，然后输出一份结构化 `report.json` 与一份可直接阅读的 `report.html`。

- 在线示例：<https://0065paula.github.io/skill-inspector/>
- 示例输入：[`examples/sample-input.md`](./examples/sample-input.md)
- 示例报告：[`templates/report.example.json`](./templates/report.example.json)

### 当前版本的核心作用

当前版本聚焦四件事：

1. 快速看懂一份陌生 skill
   它会提取标题、frontmatter、章节、命令、文件引用、URL 引用和 workflow 信号。

2. 生成一份适合继续加工的结构化报告
   它先产出稳定的 JSON，再由本地渲染器生成 HTML。

3. 把机械抽取和判断型分析拆开
   它用 `normalized-source.json`、`report.draft.json`、`report.overlay.template.json` 三层中间产物，把确定性字段和判断性字段分开处理。

4. 让 agent 与人类共享同一份分析真源
   `report.json` 是唯一分析真源，`report.html` 完整继承 `report.json` 的内容和结构。

### 它解决的问题

拿到一份陌生 skill 时，团队通常需要快速回答这些问题：

- 这份 skill 服务什么任务
- agent 应该按什么步骤执行
- skill 依赖哪些文件、链接和外部规范
- 它的风险边界在哪里
- 它是否已经安装在常见 skill 目录里
- 它的写法是否清楚，哪些地方值得优化

`Skill Inspector` 会把这些判断沉淀成可复用产物：

- `report.json`
  面向 agent、脚本、自动化流程和后续加工
- `report.html`
  面向人类阅读、分享和评审

## 工作原理

### 总体流程

当前工作流分成五段：

1. 读取来源
   输入可以是粘贴的 skill 全文、本地文件路径、远程链接。

2. 归一化来源
   `scripts/normalize-skill.mjs` 会把原始内容整理成一个紧凑工作集，只保留后续分析真正需要的信号。

3. 生成报告草稿
   `scripts/build-report-draft.mjs` 基于归一化结果和 `reportSeeds` 生成一份 schema 形状完整的草稿报告。

4. 生成 overlay 模板并补判断型字段
   `scripts/build-report-overlay-template.mjs` 给模型一个稳定的小输入形状，随后由 overlay 补充 workflow、翻译、安全、评分和建议等判断型内容。

5. 合并并渲染最终报告
   `scripts/finalize-report.mjs` 合并草稿与 overlay，完成 shape 校验；`scripts/render-report.mjs` 再把 `report.json` 渲染成 `report.html`。

### 为什么要拆成多层中间产物

这套拆分服务三个目标：

- 降低 token 成本
  `normalized-source.json` 比完整 skill 更短，更适合作为 agent 的主上下文。

- 提高输出稳定性
  `report.draft.json` 先把字段骨架补齐，后续只需要关注真正需要判断的部分。

- 提高人工与模型协作效率
  `report.overlay.template.json` 给判断型字段一个固定形状，便于人工编辑、LLM 生成和脚本合并。

### 每一层产物负责什么

#### 1. `normalized-source.json`

这份文件负责“压缩原文并保留分析信号”。当前会包含这些信息：

- `source`
- `title`
- `frontmatter`
- `headings`
- `commands`
- `fileReferences`
- `urlReferences`
- `workflowSteps`
- `reportSeeds`

其中 `reportSeeds` 是当前版本的重要设计。它会预填这些适合机械抽取的字段：

- `summary`
- `workflow`
- `references`
- `translation.mode`
- `source`

这让后续步骤可以把模型算力集中在真正需要主观判断的部分。

#### 2. `report.draft.json`

这份文件负责“生成完整骨架”。它已经具备最终报告的主字段：

- `summary`
- `workflow`
- `translation`
- `references`
- `safety`
- `install`
- `score`
- `suggestions`
- `source`

它的价值在于：

- 字段形状稳定
- `install` 直接做本机目录检测
- `references` 已经有首轮摘要
- 后续 overlay 可以只补内容，不需要再处理结构
- 它也是 HTML 渲染前唯一允许继续补充的 canonical JSON 形状

#### 3. `report.overlay.template.json`

这份文件负责“给判断型分析一个标准输入壳”。它主要包含：

- `summary.score_total`
- `summary.risk_level`
- `workflow`
- `translation`
- `safety`
- `score`
- `suggestions`

overlay 模板的重点是输入稳定、尺寸小、可直接交给 LLM 或人工填写。

#### 4. `report.json`

这份文件负责“承载最终分析结果”。它是当前版本唯一的分析真源。

所有后续消费都应该围绕它展开：

- HTML 渲染
- agent 继续推理
- 结果存档
- 结果分享
- 自动化检查

#### 5. `report.html`

这份文件负责“把结构化报告转成可读页面”。当前页面强调：

- 首屏标题和核心指标
- workflow 图作为第一主区块
- translation 作为第二主区块
- references / safety / install / score / suggestions 作为紧凑附录区

当前模板采用明亮、清晰、研究型的信息布局，适合做评审页和分享页。

## 输入与输出

### 输入形式

一次运行分析一个来源，当前支持三种输入：

- 粘贴的 skill 全文
- 本地 `SKILL.md` 文件路径
- 远程 skill 链接

### 输出文件

默认输出位于 `%当前目录%/skill-inspector/%skill-name%/`：

- `skill-inspector/%skill-name%/normalized-source.json`
- `skill-inspector/%skill-name%/report.draft.json`
- `skill-inspector/%skill-name%/report.overlay.template.json`
- `skill-inspector/%skill-name%/report.json`
- `skill-inspector/%skill-name%/report.html`

显式传入输出路径时，脚本会继续使用你给定的地址。

### 输出契约

当前输出契约有三条核心原则：

1. 先有 JSON，后有 HTML
2. `report.json` 承担唯一分析真源
3. HTML 完整继承 JSON 的分析结果

## 当前版本的详细能力

### 1. 结构分析

`Skill Inspector` 会读取 skill 文本并提取：

- 标题
- frontmatter
- 章节层级
- code block 命令
- 文件引用
- URL 引用
- workflow steps

### 2. 工作流建模

当前版本把 workflow 视作结构化图数据，核心字段是：

- `workflow.caption`
- `workflow.nodes`
- `workflow.edges`

渲染器会优先使用结构化图数据生成 Mermaid。`render-report.mjs` 也支持直接读取 `workflow.mermaid`。

当来源信号更适合规则抽取时，`normalize-skill.mjs` 会自动生成线性图、分组图或串行图草稿。
当来源语义更复杂时，overlay 可以直接补完整的 `workflow.nodes` 与 `workflow.edges`。

### 3. 中文翻译层

翻译层的目标是“让中文读者快速读懂自然语言部分，同时保留命令和标识符的精确性”。

当前翻译规则保持这些对象的英文形式：

- 命令
- 路径
- URL
- 变量名
- frontmatter key
- 产品名和框架名

当前支持两种最终模式：

- `compact`
- `full`

overlay 侧支持三种覆盖策略：

- `full_human`
  overlay 只补中文 `zh`，英文 `en` 从 draft 继承

翻译层约束：

- `translation.sections[*]` 必须使用 `title_zh`、`title_en`、`rows[*].zh`、`rows[*].en`
- 需要中英对照时，每一行中文都要保留对应英文 `en`
- 不使用自定义翻译字段形状代替标准 rows 结构

执行鲁棒性约束：

- 先得到通过 schema 校验的 `report.json`，再继续 HTML 渲染
- 不先生成自定义 report 结构再二次转换成标准结构
- bilingual 输出时，`translation.sections[*].rows[*]` 同时保留 `zh` 与 `en`
- 结构化 `workflow.nodes` / `workflow.edges` 是 Mermaid 的默认来源
- 不把手写 Mermaid 或自定义 HTML 页面作为主路径

### 4. 引用关系整理

引用层会把文件和 URL 统一整理进 `references`，并保留：

- `target`
- `kind`
- `summary`
- `condition`
- `line`

当前版本会对 `references` 去重，并优先保留最有用的证据行。

### 5. 安全评估

安全层输出：

- 总体风险等级
- 风险说明
- 逐条安全发现

每条 finding 包含：

- `signal`
- `severity`
- `meaning`
- `evidence`

### 6. 安装状态判断

`install` 是当前版本的确定性字段，脚本会直接检查本地目录。

默认检查：

- `~/.codex/skills/<skill-name>`
- `~/.agents/skills/<skill-name>`

这让报告可以直接反映“当前机器是否已经装了这份 skill”。

### 7. 评分与建议

评分层输出维度化结果：

- `name`
- `value`
- `rationale`

建议层输出可执行建议：

- `title`
- `detail`
- `priority`

## 脚本分工

### `scripts/normalize-skill.mjs`

负责：

- 读取本地文件或远程链接
- GitHub blob 链接改写成 raw 链接
- GitLab blob 链接改写成 raw 链接
- 提取 headings / commands / references / workflow steps
- 生成 `reportSeeds`

这个脚本决定“后续分析的主上下文长什么样”。

### `scripts/build-report-draft.mjs`

负责：

- 基于归一化结果生成完整草稿报告
- 为 `references` 生成默认摘要
- 为 `install` 生成当前机器的检测结果
- 为 `summary` / `workflow` / `translation` / `safety` / `score` 建立稳定骨架

这个脚本决定“最终报告的字段结构和默认初值”。

### `scripts/build-report-overlay-template.mjs`

负责：

- 生成一份小而稳定的 overlay 模板
- 把模型需要判断的字段集中起来

这个脚本决定“LLM 或人工补充内容时的输入形状”。

### `scripts/finalize-report.mjs`

负责：

- 深度合并 draft 与 overlay
- 对 `translation` 做覆盖策略合并
- 校验最终 report shape

这个脚本决定“最终 JSON 是否结构正确、字段完整”。

### `scripts/render-report.mjs`

负责：

- 从 `report.json` 渲染 HTML
- 为 workflow 生成 Mermaid 文本
- 对 JSON 与 HTML 内容做安全转义
- 把 report 中的各个区块填入模板

渲染约束：

- HTML 只从标准 `report.json` 渲染
- Mermaid 优先由结构化 `workflow.nodes` 与 `workflow.edges` 推导
- 模板页面只填占位符，不另起一套自定义 HTML 报告布局
- 渲染前先检查 `report.json`、translation rows 和 workflow graph 数据是否完整

这个脚本决定“结构化报告如何变成一页可读文档”。

## 数据结构

### `report.json` 顶层字段

当前 schema 顶层字段如下：

```json
{
  "summary": {},
  "workflow": {},
  "translation": {},
  "references": [],
  "safety": {},
  "install": {},
  "score": {},
  "suggestions": [],
  "source": {}
}
```

### `workflow` 结构

```json
{
  "caption": "主流程说明",
  "nodes": [
    { "id": "input", "label": "Receive task" }
  ],
  "edges": [
    { "from": "input", "to": "parse", "label": "normalize" }
  ]
}
```

### `translation.sections` 结构

```json
{
  "mode": "full",
  "sections": [
    {
      "title_zh": "概述",
      "title_en": "Overview",
      "rows": [
        { "zh": "中文内容", "en": "English content" }
      ]
    }
  ]
}
```

## 推荐使用方式

### 方式一：完整流水线

适合正式分析和产出最终报告。

```bash
node scripts/normalize-skill.mjs <skill-file-or-url>
node scripts/build-report-draft.mjs skill-inspector/<skill-name>/normalized-source.json
node scripts/build-report-overlay-template.mjs skill-inspector/<skill-name>/report.draft.json
node scripts/finalize-report.mjs skill-inspector/<skill-name>/report.draft.json skill-inspector/<skill-name>/report.overlay.json
node scripts/render-report.mjs skill-inspector/<skill-name>/report.json
```

### 方式二：先机械抽取，再交给 agent

适合 token 敏感场景。

```bash
node scripts/normalize-skill.mjs <skill-file-or-url>
node scripts/build-report-draft.mjs skill-inspector/<skill-name>/normalized-source.json
node scripts/build-report-overlay-template.mjs skill-inspector/<skill-name>/report.draft.json
```

这时 agent 可以直接读取：

- `skill-inspector/<skill-name>/normalized-source.json`
- `skill-inspector/<skill-name>/report.draft.json`
- `skill-inspector/<skill-name>/report.overlay.template.json`

然后只补这些判断型字段：

- `workflow`
- `translation.sections`
- `safety`
- `score`
- `suggestions`

### 方式三：复用现成 `report.json`

适合只想重新渲染页面的场景。

```bash
node scripts/render-report.mjs skill-inspector/<skill-name>/report.json
```

## 当前工作方式的设计重点

这份 skill 当前采用“确定性脚本 + 判断型 overlay + 最终合并渲染”的架构。这个设计带来三类收益：

1. 分析成本可控
   机械抽取交给脚本，主观判断集中在小而稳定的输入上。

2. 报告结构稳定
   schema、draft 和 finalize 三层共同保证最终形状一致。

3. 协作效率高
   agent、脚本和人工都围绕同一个 `report.json` 工作。

## 关键文件

- [`SKILL.md`](./SKILL.md)
- [`templates/report.schema.json`](./templates/report.schema.json)
- [`templates/report.html`](./templates/report.html)
- [`templates/report.example.json`](./templates/report.example.json)
- [`templates/report.overlay.example.json`](./templates/report.overlay.example.json)
- [`prompts/translation.md`](./prompts/translation.md)
- [`prompts/insights.md`](./prompts/insights.md)
- [`prompts/workflow-generation.md`](./prompts/workflow-generation.md)
- [`scripts/normalize-skill.mjs`](./scripts/normalize-skill.mjs)
- [`scripts/build-report-draft.mjs`](./scripts/build-report-draft.mjs)
- [`scripts/build-report-overlay-template.mjs`](./scripts/build-report-overlay-template.mjs)
- [`scripts/finalize-report.mjs`](./scripts/finalize-report.mjs)
- [`scripts/render-report.mjs`](./scripts/render-report.mjs)

## 适合谁用

这份 skill 适合这些场景：

- 快速理解陌生 skill
- 给 skill 做结构化评审
- 沉淀可分享的 skill 报告
- 为 skill 设计和质量治理建立统一输出层

## 推荐下一步

先用一份真实 `SKILL.md` 跑完整流水线，再根据你的团队习惯固定 overlay 填写方式和评分维度。

---

## English

`Skill Inspector` is an agent-native analysis workflow for one skill source at a time. It reads a skill, extracts structure and execution signals, builds a stable JSON report, and renders a polished HTML report for human review.

- Live example: <https://0065paula.github.io/skill-inspector/>
- Example input: [`examples/sample-input.md`](./examples/sample-input.md)
- Example report: [`templates/report.example.json`](./templates/report.example.json)

### Current Role

The current version focuses on four jobs:

1. Understand an unfamiliar skill quickly
2. Produce a structured report that downstream agents can reuse
3. Separate deterministic extraction from judgment-heavy analysis
4. Keep `report.json` as the canonical analysis artifact for both agents and humans

### What It Produces

The workflow produces two primary outputs:

- `report.json`
  for agents, scripts, and downstream automation
- `report.html`
  for direct reading and sharing

## How It Works

### Pipeline

The current pipeline has five stages:

1. Read one source
2. Normalize the source into a compact working set
3. Build a schema-shaped draft report
4. Generate an overlay template and fill judgment-heavy fields
5. Finalize `report.json` and render `report.html`

### Why the workflow uses intermediate artifacts

The intermediate files serve three goals:

- lower token cost
- keep the output structure stable
- make human editing and model editing easier

### Intermediate artifacts

#### `normalized-source.json`

This file keeps the compact analysis context. It includes:

- source metadata
- title and frontmatter
- headings
- commands
- file references
- URL references
- workflow steps
- `reportSeeds`

`reportSeeds` pre-fills deterministic fields such as:

- `summary`
- `workflow`
- `references`
- `translation.mode`
- `source`

#### `report.draft.json`

This file provides a complete report skeleton with stable top-level fields:

- `summary`
- `workflow`
- `translation`
- `references`
- `safety`
- `install`
- `score`
- `suggestions`
- `source`

It also performs deterministic install checks for common skill directories.

#### `report.overlay.template.json`

This file gives the model a small and stable shape for judgment-heavy content:

- score and risk summary
- workflow graph
- translation sections
- safety findings
- score dimensions
- suggestions

#### `report.json`

This file is the canonical analysis artifact.

Everything else builds from it:

- HTML rendering
- further agent reasoning
- report storage
- report sharing

#### `report.html`

This file turns the structured report into a readable document with:

- a title and metric rail
- workflow as the primary section
- translation as the secondary section
- compact appendix sections for references, safety, install, score, and suggestions

## Current Capabilities

### Structure extraction

The workflow extracts:

- title
- frontmatter
- headings
- commands
- file references
- URL references
- workflow signals

### Workflow modeling

Workflow is represented as structured graph data:

- `workflow.caption`
- `workflow.nodes`
- `workflow.edges`

The renderer derives Mermaid from that graph structure.

### Translation layer

The translation layer keeps natural-language content readable in Chinese while preserving technical identifiers in English.

Current output modes:

- `compact`
- `full`

Current overlay coverage mode:

- `full_human`

### Reference tracing

Each reference item carries:

- `target`
- `kind`
- `summary`
- `condition`
- `line`

### Safety review

The safety section includes:

- overall level
- level summary
- structured findings with evidence

### Install detection

Install detection checks common local directories:

- `~/.codex/skills/<skill-name>`
- `~/.agents/skills/<skill-name>`

### Scoring and suggestions

Scoring is dimension-based.
Suggestions are short, concrete, and prioritized.

## Script Responsibilities

### `scripts/normalize-skill.mjs`

Responsible for:

- reading local files and remote links
- rewriting GitHub and GitLab blob URLs to raw URLs
- extracting structural signals
- generating `reportSeeds`

### `scripts/build-report-draft.mjs`

Responsible for:

- building the draft report skeleton
- generating default reference summaries
- generating deterministic install items

### `scripts/build-report-overlay-template.mjs`

Responsible for:

- creating a stable overlay input shape for judgment-heavy fields

### `scripts/finalize-report.mjs`

Responsible for:

- merging draft and overlay
- resolving translation coverage strategies
- validating the final report shape

### `scripts/render-report.mjs`

Responsible for:

- rendering HTML from `report.json`
- generating Mermaid text from workflow data
- escaping HTML and script-embedded JSON safely

## Recommended Usage

### Full pipeline

```bash
node scripts/normalize-skill.mjs <skill-file-or-url>
node scripts/build-report-draft.mjs skill-inspector/<skill-name>/normalized-source.json
node scripts/build-report-overlay-template.mjs skill-inspector/<skill-name>/report.draft.json
node scripts/finalize-report.mjs skill-inspector/<skill-name>/report.draft.json skill-inspector/<skill-name>/report.overlay.json
node scripts/render-report.mjs skill-inspector/<skill-name>/report.json
```

### Extraction-first workflow

This path works well when you want the agent to focus on reasoning fields only:

```bash
node scripts/normalize-skill.mjs <skill-file-or-url>
node scripts/build-report-draft.mjs skill-inspector/<skill-name>/normalized-source.json
node scripts/build-report-overlay-template.mjs skill-inspector/<skill-name>/report.draft.json
```

### Render from an existing report

```bash
node scripts/render-report.mjs skill-inspector/<skill-name>/report.json
```

## Key Files

- [`SKILL.md`](./SKILL.md)
- [`templates/report.schema.json`](./templates/report.schema.json)
- [`templates/report.html`](./templates/report.html)
- [`templates/report.example.json`](./templates/report.example.json)
- [`templates/report.overlay.example.json`](./templates/report.overlay.example.json)
- [`prompts/translation.md`](./prompts/translation.md)
- [`prompts/insights.md`](./prompts/insights.md)
- [`prompts/workflow-generation.md`](./prompts/workflow-generation.md)
- [`scripts/normalize-skill.mjs`](./scripts/normalize-skill.mjs)
- [`scripts/build-report-draft.mjs`](./scripts/build-report-draft.mjs)
- [`scripts/build-report-overlay-template.mjs`](./scripts/build-report-overlay-template.mjs)
- [`scripts/finalize-report.mjs`](./scripts/finalize-report.mjs)
- [`scripts/render-report.mjs`](./scripts/render-report.mjs)

## Recommended Next Step

Run the full pipeline on one real `SKILL.md`, then lock your team’s preferred overlay workflow and score dimensions.
