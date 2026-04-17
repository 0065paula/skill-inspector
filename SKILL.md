---
name: skill-inspector
description: Use for reviewing any unfamiliar skill source and turning it into a structured report with workflow maps, Chinese translation, safety findings, reference tracing, install detection, and publishable HTML. Trigger whenever the user asks to inspect a skill, understand what a skill does, map its workflow, translate a skill into Chinese, score skill quality, trace referenced files or links, or generate a shareable skill review page, even if they only ask for a report, an evaluation, or “what does this skill do?”
---

# Skill Inspector

## Overview

Analyze one skill source at a time and produce:

- a structured `report.json`
- a polished `report.html`

This version is agent-native. Do not rely on Python analysis scripts. Use the templates and schema in this directory and let the current agent perform the analysis.

## Success Criteria

Complete the run when all of these outcomes are present:

- `report.json` exists and matches `templates/report.schema.json`
- `workflow.nodes` and `workflow.edges` express the execution logic clearly
- `translation` preserves commands, paths, URLs, variables, and frontmatter keys in English
- `references`, `safety`, `install`, `score`, and `suggestions` are filled with source-backed content
- `report.html` reflects the final JSON without drifting from it

## Inputs

Supported inputs:

- pasted skill text
- local path to a skill file
- remote skill link

## Required Workflow

### Step 1: Read and normalize the source

Extract:

- title
- frontmatter
- sections
- commands
- file references
- URL references
- workflow signals

Normalization output should stay compact:

- Build a small normalized working set before drafting the final report
- Keep only frontmatter, section headings, commands, file references, URL references, workflow steps, and evidence snippets
- Collect line-numbered evidence only for items that appear in `references`, `safety.findings`, or other report fields that require proof
- When available, use `scripts/normalize-skill.mjs` to produce the compact working set before drafting `report.json`
- Prefer `normalized-source.json.reportSeeds` for deterministic fields such as `summary`, `workflow`, `references`, `translation.mode`, and `source`

Remote link handling:

- When the input is a GitHub file URL in the form `https://github.com/<owner>/<repo>/blob/<branch>/<path>`, rewrite it to `https://raw.githubusercontent.com/<owner>/<repo>/<branch>/<path>` first
- Fetch the raw URL first when the source is a GitHub file link
- Continue with the raw response when it returns the actual Markdown source
- Fall back to the original GitHub page only when the raw URL returns a non-success response, empty body, or HTML page content
- Keep `source.primary_value` as the original user-provided GitHub URL for traceability

Do not generate the final report yet.

### Step 2: Produce structured JSON first

Before generating HTML, create a `report.json` object that conforms to:

`templates/report.schema.json`

The JSON must include, at minimum:

- `summary`
- `workflow`
- `translation`
- `references`
- `safety`
- `install`
- `score`
- `suggestions`
- `source`

Canonical output rules:

- `report.json` must be the first valid canonical artifact
- Do not create a custom intermediate report shape and convert it later
- Do not invent top-level fields or alternate field shapes outside `templates/report.schema.json`
- Treat `report.json` as the only source of truth before any HTML rendering

Workflow rules:

- Use structured workflow data as the canonical representation
- Fill `workflow.nodes` and `workflow.edges`
- Keep `workflow.caption` short and focused on execution logic
- Let the local renderer derive Mermaid from the workflow structure
- Load `prompts/workflow-generation.md` when the workflow graph needs language-level interpretation rather than simple heuristic extraction
- Do not hand-author Mermaid diagrams when structured workflow data can express the same logic
- Treat `workflow.nodes[*].id` as an internal reference key, not as a Mermaid-safe node identifier
- When rendering Mermaid, never pass raw workflow ids through directly; always map them to Mermaid-safe ids first so reserved words such as `style`, `class`, or other syntax-sensitive tokens cannot break the graph
- Keep human-readable and source-language terminology in `workflow.nodes[*].label`, not in the rendered Mermaid node id

Translation rules for report size:

- Use `translation.mode` to control verbosity
- Default to `full` for non-Chinese skills
- Keep `full` as the primary path when the report is meant for human review, comparison across models, or publishable bilingual output
- Use `compact` only when the user explicitly asks for a shorter report or when a downstream consumer requests reduced translation volume
- Use `summary` when the source skill is already primarily Chinese and the report should present a Chinese summary instead of bilingual source/translation rows
- When using overlays, use `translation.coverage: full_human`
- Keep the draft's English rows and let the overlay provide only Chinese `zh`
- Keep `translation.sections[*]` in the standard shape: `title_zh`, `title_en`, `rows[*].zh`, and `rows[*].en`
- For bilingual output, every translated row must preserve the English counterpart in `rows[*].en`
- For `full` output, preserve section count, section order, and row count exactly; do not delete, merge, compress, or skip rows
- For `full` output, treat missing sections, missing rows, or blank `zh` cells as report-breaking errors that must be fixed before rendering
- For `full` output, treat placeholder text such as `（待补充中文翻译）`, `TODO`, or `TBD` as untranslated failure
- For `full` output, treat copying the English sentence into `zh` as untranslated failure unless the row is primarily commands, paths, URLs, variables, or other preserved tokens
- For `full` output, ensure each natural-language row contains meaningful Chinese content rather than only preserved English tokens
- For `summary` output, fill `rows[*].zh` with Chinese summary text and leave `rows[*].en` empty when no source-language counterpart should be shown
- When workflow node labels include domain terms such as `baseline`, `dry_run`, `git revert`, or product names, prefer preserving the original-language term instead of translating it mechanically

Do not skip this step.

Validation rules before rendering:

- Verify that `report.json` already conforms to `templates/report.schema.json`
- Verify that `translation.sections[*].rows[*]` contains both `zh` and `en` when bilingual output is expected
- Verify that `full` translation output preserves one-to-one section and row alignment with the draft English skeleton
- Verify that `workflow.nodes` and `workflow.edges` exist before Mermaid rendering
- Verify that Mermaid generation uses safe mapped node ids rather than raw workflow ids whenever structured workflow data is converted into Mermaid text
- If any of these checks fail, return to JSON correction before attempting HTML rendering

Install rules:

- `install` is a deterministic local-environment check, not a free-form analysis field
- Detect whether the skill is installed in the current system's agent skill directories
- At minimum, check `~/.codex/skills/<skill-name>` and `~/.agents/skills/<skill-name>`
- Keep `install` generated by scripts rather than by overlay prose whenever possible

### Step 3: Fill the HTML template

Use:

`templates/report.html`

Rules:

- The local renderer should fill the HTML template from `report.json`
- Preserve the template structure
- Fill placeholders only
- Keep the workflow diagram as the primary section
- Keep translation as the secondary section
- Keep meta sections compact
- Keep the install section visible in the meta area
- If embedding Mermaid or other JSON payloads inside `<script type="application/json">`, do not use HTML entity escaping for the JSON body; keep it `JSON.parse`-compatible and only escape script-context hazards such as `<`, `>`, `&`, or `</script>`
- Do not hand-build a standalone HTML report layout outside `templates/report.html`
- Do not override the template's visual system with custom page-level styles when placeholder filling is sufficient
- Validate that `report.json` already conforms to schema before writing `report.html`

Forbidden shortcuts:

- Do not hand-write `workflow.mermaid` as the default path when structured graph data is available
- Do not generate a custom `report.v2.json` or similar conversion artifact as the primary report path
- Do not use custom translation field shapes such as `heading_zh`, `heading_en`, or `content_zh` in place of standard rows
- Do not render HTML from any object that has not already passed the canonical `report.json` shape checks

### Step 4: Write outputs

Write:

- `%当前目录%/skill-inspector/%skill-name%/report.json`
- `%当前目录%/skill-inspector/%skill-name%/report.html`

Default output directory rule:

- Use `%当前目录%/skill-inspector/%skill-name%/` as the default artifact root
- Keep `normalized-source.json`, `report.draft.json`, `report.overlay.template.json`, `report.json`, and `report.html` under that directory
- Respect explicit output paths when the caller provides them

Optional preprocessing helper:

- `node scripts/normalize-skill.mjs <input>`
- Use the generated normalized JSON as the primary working context for extraction-heavy tasks
- Reuse `reportSeeds` first, then spend model work on `translation.sections`, `safety`, `score`, and `suggestions`
- `node scripts/build-report-draft.mjs skill-inspector/<skill-name>/normalized-source.json`
- Use the generated draft report as the starting point for the final `report.json`
- `node scripts/build-report-overlay-template.mjs skill-inspector/<skill-name>/report.draft.json`
- Use the overlay template as the preferred model input shape for judgment-heavy fields
- Let the model fill `workflow` in the overlay when heuristic workflow extraction is too rigid or inaccurate
- Prefer `translation.coverage: full_human` for complete translation with lower output token cost
- Let the model write a small `report.overlay.json` that focuses on judgment-heavy fields
- In `full` mode, keep `report.overlay.json.translation.sections[*]` limited to `title_zh` and row-level `zh`; do not rewrite English rows in the overlay
- `node scripts/finalize-report.mjs skill-inspector/<skill-name>/report.draft.json skill-inspector/<skill-name>/report.overlay.json`

## Evaluation Hints

Use these prompts as the primary pressure tests for this skill:

- Inspect a pasted skill and produce `report.json` plus `report.html`
- Read a local `SKILL.md`, map its workflow, and explain what triggers it
- Review a remote GitHub skill link, trace references, evaluate safety, and summarize whether the skill is worth using

Strong runs share three characteristics:

- they keep `report.json` as the canonical output
- they express trigger conditions and reference conditions explicitly
- they keep translation concise while preserving technical identifiers exactly

## Translation Rules

Load:

`prompts/translation.md`

Requirements:

- Chinese should be concise, accurate, and readable
- Product names, framework names, tool names, commands, paths, URLs, variables, and frontmatter keys stay in English
- Do not summarize
- Do not add explanation

## Insight Rules

Load:

`prompts/insights.md`

Requirements:

- Suggestions must be concrete and short
- Focus on structure, references, safety boundaries, and maintainability
- Avoid generic advice

Reference presentation rules:

- `summary` is the primary appendix description for each reference
- `condition` should be reflected primarily in the workflow / Mermaid layer
- when a reference has a trigger condition, prefer showing it on Mermaid edges instead of repeating it in appendix prose

## Workflow Rules

Load:

`prompts/workflow-generation.md`

Requirements:

- Prefer execution structure over document structure
- Use serial, branch, dependency, and terminal semantics intentionally
- Keep the graph compact and readable

## Output Constraints

- Generate JSON first
- Treat `report.json` as the only canonical analysis output
- HTML must reflect the JSON, not a separate interpretation
- Do not invent sections that are unsupported by the source
- Do not translate commands, code, paths, URLs, or frontmatter keys
- Deduplicate repeated references while preserving the most useful evidence line
- For summary fields, never emit placeholder scalars such as bare `>` or `|`; use a complete one-sentence purpose statement grounded in the source
- Prefer complete bilingual translation over compact translation unless the user explicitly requests compression
- Always provide at least one concrete suggestion
- Always provide an `install` result, even when it is heuristic or `unknown`
- When HTML includes embedded JSON for client-side rendering, verify the generated payload can be parsed successfully rather than assuming escaped text will work
