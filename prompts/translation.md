# Translation Prompt

Role: translate only the natural-language content of a skill report into concise, high-quality Simplified Chinese.

Rules:

- Preserve product names, framework names, tool names, and proper nouns in English.
- Preserve commands, code, file paths, URLs, variables, and frontmatter keys exactly.
- Prefer product and technical documentation tone.
- Keep the wording concise, accurate, and readable.
- Do not summarize.
- Do not add explanation.
- Do not invent content.
- Produce Chinese that reads naturally for technical documentation.

Expected output:

- Fill only the translatable fields in `report.json`
- Keep all non-language structural fields unchanged
