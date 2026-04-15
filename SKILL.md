---
name: skill-inspector
description: Use when a skill link, skill file, or pasted skill content needs structural analysis, Chinese translation, scoring, safety review, reference tracing, or installation detection
---

# Skill Inspector

## Overview

Analyze one skill source at a time and produce:

- a structured `report.json`
- a polished `report.html`

This version is agent-native. Do not rely on Python analysis scripts. Use the templates and schema in this directory and let the current agent perform the analysis.

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

Workflow rules:

- Use structured workflow data as the canonical representation
- Fill `workflow.nodes` and `workflow.edges`
- Keep `workflow.caption` short and focused on execution logic
- Let the local renderer derive Mermaid from the workflow structure
- Load `prompts/workflow-generation.md` when the workflow graph needs language-level interpretation rather than simple heuristic extraction

Translation rules for report size:

- Use `translation.mode` to control verbosity
- Prefer `compact` for routine inspections
- Use `full` only when side-by-side translation of most sections materially helps the reader
- When using overlays, prefer layered translation coverage:
  - `full_auto`: reuse the draft's English section skeleton without adding manual translation rows
  - `full_human`: keep the draft's English rows and let the overlay provide only Chinese `zh`
  - `full_override`: let the overlay fully replace both Chinese and English rows when the draft structure is insufficient

Do not skip this step.

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

### Step 4: Write outputs

Write:

- `out/report.json`
- `out/report.html`

Optional preprocessing helper:

- `node scripts/normalize-skill.mjs <input> out/normalized-source.json`
- Use the generated normalized JSON as the primary working context for extraction-heavy tasks
- Reuse `reportSeeds` first, then spend model work on `translation.sections`, `safety`, `score`, and `suggestions`
- `node scripts/build-report-draft.mjs out/normalized-source.json out/report.draft.json`
- Use the generated draft report as the starting point for the final `report.json`
- `node scripts/build-report-overlay-template.mjs out/report.draft.json out/report.overlay.template.json`
- Use the overlay template as the preferred model input shape for judgment-heavy fields
- Let the model fill `workflow` in the overlay when heuristic workflow extraction is too rigid or inaccurate
- Prefer `translation.coverage: full_human` for complete translation with lower output token cost
- Let the model write a small `report.overlay.json` that focuses on judgment-heavy fields
- `node scripts/finalize-report.mjs out/report.draft.json out/report.overlay.json out/report.json`

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
- Prefer compact translation and compact evidence selection when they preserve meaning
- Always provide at least one concrete suggestion
- Always provide an `install` result, even when it is heuristic or `unknown`
- When HTML includes embedded JSON for client-side rendering, verify the generated payload can be parsed successfully rather than assuming escaped text will work
