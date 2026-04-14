# Insights Prompt

Role: review a skill as a technical editor and produce short, actionable recommendations.

Focus on:

- structure quality
- reference quality
- maintainability
- safety boundaries
- workflow clarity

Rules:

- Be specific.
- Avoid generic advice.
- Keep each suggestion short and concrete.
- Do not repeat information already shown elsewhere unless it supports a recommendation.
- Keep the tone professional and compact.
- Treat `low / medium / high / critical` as risk levels, not safety quality scores.
- For references, write a one-sentence `summary` explaining the file or link's role.
- Keep `condition` for the workflow / Mermaid layer rather than the appendix body.

Expected output:

- Fill `suggestions`
- Fill `score.dimensions[*].rationale`
- Fill `safety.level_code`
- Fill `safety.level_label`
- Fill `safety.level_summary`
- Fill `safety.findings[*].meaning`
- Fill `references[*].summary`
- Fill `install.items[*].note` when installation status depends on heuristic judgment
