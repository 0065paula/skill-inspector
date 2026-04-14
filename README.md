# Skill Inspector

Agent-native skill for analyzing a single skill source and generating:

- `report.json`
- `report.html`

This version does not depend on Python analysis scripts. The agent reads a target skill, produces structured JSON that matches `templates/report.schema.json`, then fills `templates/report.html`.

## Workflow

1. Read the target skill content.
2. Generate `report.json` according to `templates/report.schema.json`.
3. Fill `templates/report.html` using the structured data.
4. Write both outputs to an `out/` directory.

## Key Files

- `SKILL.md`: main workflow and constraints
- `templates/report.html`: final report shell
- `templates/report.schema.json`: required JSON shape
- `templates/report.example.json`: example output
- `prompts/translation.md`: translation rules
- `prompts/insights.md`: suggestion and rationale rules

## Archived Version

The previous Python-heavy implementation is preserved in:

`../skill-inspector-archived/`
