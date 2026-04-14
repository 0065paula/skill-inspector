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
- `score`
- `suggestions`
- `source`

Do not skip this step.

### Step 3: Fill the HTML template

Use:

`templates/report.html`

Rules:

- Preserve the template structure
- Fill placeholders only
- Keep the workflow diagram as the primary section
- Keep translation as the secondary section
- Keep meta sections compact

### Step 4: Write outputs

Write:

- `out/report.json`
- `out/report.html`

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

## Output Constraints

- Generate JSON first
- HTML must reflect the JSON, not a separate interpretation
- Do not invent sections that are unsupported by the source
- Do not translate commands, code, paths, URLs, or frontmatter keys
