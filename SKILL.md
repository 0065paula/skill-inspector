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
