---
name: skill-inspector
description: Use when a skill link, skill file, or pasted skill content needs structural analysis, Chinese translation, scoring, safety review, reference tracing, or installation detection
---

# Skill Inspector

## Overview

Analyze one generic skill source at a time and generate a static Chinese-first HTML report plus JSON artifacts.

## When to Use

- A human provides a skill URL, local path, or full text
- The task requires understanding how the skill works
- The task requires reference tracing or safety review
- The task requires checking whether the skill is already installed locally

## Invocation

Run:

```bash
python scripts/skill_inspector.py --input-file examples/sample_generic_skill.md --output-dir out/sample
```

## Agent Bridge

Preferred workflow. When the current agent should generate the translation and suggestions itself, use this two-step flow:

1. Dump a request payload:

```bash
python scripts/skill_inspector.py \
  --input-file SKILL.md \
  --output-dir out/bridge \
  --dump-llm-request out/bridge-request.json
```

2. Read `out/bridge-request.json`, call the current model, and write `out/bridge-response.json` in this shape:

```json
{
  "translations": {
    "line-2": "..."
  },
  "suggestions": [
    {
      "title": "...",
      "detail": "...",
      "priority": "high"
    }
  ]
}
```

3. Re-run the script with the generated response:

```bash
python scripts/skill_inspector.py \
  --input-file SKILL.md \
  --output-dir out/bridge \
  --llm-response-file out/bridge-response.json
```

If no bridge response is provided, the script may use a secondary provider when configured. If neither bridge nor provider is available, it falls back to the built-in translation and suggestion logic.
