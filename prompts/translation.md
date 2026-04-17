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
- Do not use placeholder text such as `（待补充中文翻译）`, `TODO`, or `TBD`.
- Do not copy the English sentence into the Chinese field.
- Preserve commands, paths, URLs, variables, and frontmatter keys inside an otherwise Chinese sentence.
- Each translatable natural-language row must contain meaningful Chinese wording, not only preserved English tokens.

Reference examples:

- Heading
  - English: `### Phase 2: Pattern Matching & SVG Generation`
  - Good Chinese: `### 阶段 2：图案匹配与 SVG 生成`

- Pure prose
  - English: `Collect essential information from the user:`
  - Good Chinese: `向用户收集关键信息：`

- Mixed prose with file path
  - English: `Use the template from \`assets/showcase_template.html\``
  - Good Chinese: `使用 \`assets/showcase_template.html\` 模板。`

- Mixed prose with command
  - English: `Use \`scripts/generate_showcase.py\` with \`--all-styles\` flag`
  - Good Chinese: `使用 \`scripts/generate_showcase.py\`，并带上 \`--all-styles\` 参数。`

- Mixed prose with variables
  - English: `Set up environment (copy \`.env.example\` to \`.env\`, add API key)`
  - Good Chinese: `设置环境（将 \`.env.example\` 复制为 \`.env\`，并添加 API key）。`

- List item
  - English: `Generate additional variants exploring specific directions`
  - Good Chinese: `生成用于探索特定方向的额外方案。`

Cheating examples:

- Bad Chinese: `Generate additional variants exploring specific directions`
  - Reason: copied the English sentence directly

- Bad Chinese: `Generate additional variants exploring specific directions（中文）`
  - Reason: fake Chinese suffix, still untranslated English prose

- Bad Chinese: `（待补充中文翻译）`
  - Reason: placeholder text, not a translation

- Bad Chinese: `Use \`scripts/generate_showcase.py\` with \`--all-styles\` flag`
  - Reason: preserved the whole sentence in English instead of preserving only the command tokens

- Bad Chinese: `Mood: cold/warm, professional/friendly`
  - Reason: ordinary prose remained in English; preserve only the technical terms that truly need preservation

Expected output:

- Fill only the translatable fields in `report.json`
- Keep all non-language structural fields unchanged
