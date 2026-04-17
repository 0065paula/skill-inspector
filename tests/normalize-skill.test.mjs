import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';

import {
  normalizeSkillMarkdown,
  readRemoteSkillSource,
  rewriteGitHubBlobToRaw,
  rewriteGitLabBlobToRaw
} from '../scripts/normalize-skill.mjs';

const root = process.cwd();
const samplePath = path.join(root, 'examples', 'sample-input.md');
const normalizeScriptPath = path.join(root, 'scripts', 'normalize-skill.mjs');
const sampleSource = fs.readFileSync(samplePath, 'utf8');
const groupedWorkflowSource = `---
name: grouped-workflow-skill
description: Use when grouped workflows need structure
---

# Grouped Workflow Skill

## Common Workflows

### 1. Create Canvas

1. Create a \`.canvas\` file
2. Validate the JSON

### 2. Edit Canvas

1. Read the existing file
2. Write the updated JSON back to the file
3. Validate references

## References

- [Examples](references/EXAMPLES.md)
- [Spec](https://jsoncanvas.org/spec/1.0/)
`;

const serialStepWorkflowSource = `---
name: serial-workflow-skill
description: Use when staged reporting needs serial steps
---

# Serial Workflow Skill

## Required Workflow

### Step 1: Read and normalize the source

- Read \`templates/report.schema.json\`

### Step 2: Produce structured JSON first

- Fill \`summary\`

### Step 3: Fill the HTML template

- Use \`templates/report.html\`

### Step 4: Write outputs

- Write \`out/report.json\`

## Notes

- Rewrite \`https://github.com/<owner>/<repo>/blob/<branch>/<path>\` to \`https://raw.githubusercontent.com/<owner>/<repo>/<branch>/<path>\`
- Avoid \`<script type="application/json">\` and \`</script>\` mistakes
- Run \`node scripts/build-report-draft.mjs out/normalized-source.json out/report.draft.json\`
`;

const urlReferenceSource = `---
name: url-reference-skill
description: Use when explicit references should be extracted
---

# URL Reference Skill

## References

- [Spec](https://jsoncanvas.org/spec/1.0/)
- [Repo](https://github.com/obsidianmd/jsoncanvas)

## Example Prompts

- "Review this implementation against https://example.com/design and compare it with http://internal.example.com/page"
`;

const bareFileReferenceSource = `---
name: bare-file-skill
description: Use when bare file names should still count as references
---

# Bare File Skill

Use the reviewer prompt in \`design-reviewer.md\`.
`;

const chineseSummarySource = `---
name: chinese-summary-skill
description: 用于评估中文 skill 的结构质量
---

# Chinese Summary Skill

## Required Workflow

### Baseline 对比

1. 设计测试 prompt
2. 运行 baseline

### Result Card 输出

1. 生成 Result Card
2. 标注 dry_run
`;

test('rewriteGitHubBlobToRaw converts github blob URLs to raw URLs', () => {
  const input = 'https://github.com/kepano/obsidian-skills/blob/main/skills/json-canvas/SKILL.md';
  const output = rewriteGitHubBlobToRaw(input);

  assert.equal(
    output,
    'https://raw.githubusercontent.com/kepano/obsidian-skills/main/skills/json-canvas/SKILL.md'
  );
});

test('rewriteGitLabBlobToRaw converts gitlab blob URLs to raw URLs', () => {
  const input = 'http://gitlab.smartx.com/frontend/claude-code-doc/-/blob/main/skills/figma-design-review/SKILL.md';
  const output = rewriteGitLabBlobToRaw(input);

  assert.equal(
    output,
    'http://gitlab.smartx.com/frontend/claude-code-doc/-/raw/main/skills/figma-design-review/SKILL.md'
  );
});

test('readRemoteSkillSource falls back to the original GitHub URL when raw returns HTML', async () => {
  const calls = [];
  const input = 'https://github.com/kepano/obsidian-skills/blob/main/skills/json-canvas/SKILL.md';

  const fetchImpl = async (url) => {
    calls.push(url);
    if (url.startsWith('https://raw.githubusercontent.com/')) {
      return {
        ok: true,
        text: async () => '<!DOCTYPE html><html><body>blocked</body></html>'
      };
    }

    return {
      ok: true,
      text: async () => '# JSON Canvas Skill\n'
    };
  };

  const result = await readRemoteSkillSource(input, { fetchImpl });

  assert.equal(calls.length, 2);
  assert.equal(calls[0], rewriteGitHubBlobToRaw(input));
  assert.equal(calls[1], input);
  assert.equal(result.text, '# JSON Canvas Skill\n');
  assert.equal(result.resolvedUrl, input);
  assert.equal(result.strategy, 'page-fallback');
});

test('normalizeSkillMarkdown returns a compact working set', () => {
  const normalized = normalizeSkillMarkdown(sampleSource, {
    originalSource: samplePath,
    resolvedSource: samplePath
  });

  assert.equal(normalized.title, 'Sample Generic Skill');
  assert.equal(normalized.frontmatter.name, 'sample-generic-skill');
  assert.equal(normalized.headings.length, 2);
  assert.deepEqual(normalized.headings.map((item) => item.text), [
    'Sample Generic Skill',
    'Workflow'
  ]);
  assert.equal(normalized.commands.length, 1);
  assert.match(normalized.commands[0].code, /python scripts\/run_example\.py --check/);
  assert.deepEqual(normalized.fileReferences.map((item) => item.target), ['docs/reference.md']);
  assert.equal(normalized.fileReferences[0].line, 10);
  assert.deepEqual(normalized.urlReferences.map((item) => item.target), []);
  assert.deepEqual(normalized.workflowSteps.map((item) => item.text), [
    'Read `docs/reference.md` when examples are requested',
    'Visit https://example.com when local documentation is unavailable',
    'Run:'
  ]);
  assert.equal(normalized.reportSeeds.summary.title, 'Sample Generic Skill');
  assert.equal(
    normalized.reportSeeds.summary.purpose,
    'Use when a simple workflow needs examples'
  );
  assert.equal(normalized.reportSeeds.translation.mode, 'full');
  assert.equal(normalized.reportSeeds.references.length, 1);
  assert.deepEqual(
    normalized.reportSeeds.workflow.nodes.map((item) => item.id),
    ['step_1', 'step_2', 'step_3']
  );
  assert.deepEqual(
    normalized.reportSeeds.workflow.edges.map((item) => [item.from, item.to]),
    [
      ['step_1', 'step_2'],
      ['step_2', 'step_3']
    ]
  );
});

test('normalizeSkillMarkdown builds grouped workflow graphs for multi-section workflows', () => {
  const normalized = normalizeSkillMarkdown(groupedWorkflowSource, {
    originalSource: 'grouped-source.md',
    resolvedSource: 'grouped-source.md'
  });

  assert.deepEqual(
    normalized.reportSeeds.workflow.nodes.map((item) => item.id),
    ['input', 'parse', 'branch', 'create_canvas', 'edit_canvas', 'examples', 'spec', 'validate', 'write']
  );
  assert.equal(
    normalized.reportSeeds.workflow.nodes.find((item) => item.id === 'branch')?.kind,
    'decision'
  );
  assert.equal(
    normalized.reportSeeds.workflow.nodes.find((item) => item.id === 'create_canvas')?.label,
    'Create Canvas'
  );
  assert.equal(
    normalized.reportSeeds.workflow.nodes.find((item) => item.id === 'edit_canvas')?.label,
    'Edit Canvas'
  );
  assert.equal(
    normalized.reportSeeds.workflow.nodes.find((item) => item.id === 'examples')?.kind,
    'reference'
  );
  assert.equal(
    normalized.reportSeeds.workflow.nodes.find((item) => item.id === 'examples')?.label,
    'references/EXAMPLES.md'
  );
  assert.equal(
    normalized.reportSeeds.workflow.nodes.find((item) => item.id === 'spec')?.kind,
    'reference'
  );
  assert.equal(
    normalized.reportSeeds.workflow.nodes.find((item) => item.id === 'spec')?.label,
    'JSON Canvas Spec 1.0'
  );
  assert.equal(
    normalized.reportSeeds.workflow.nodes.find((item) => item.id === 'write')?.kind,
    'terminal'
  );
  assert.deepEqual(
    normalized.reportSeeds.workflow.edges.map((item) => [item.from, item.to, item.label || null]),
    [
      ['input', 'parse', null],
      ['parse', 'branch', null],
      ['branch', 'create_canvas', 'Create Canvas'],
      ['branch', 'edit_canvas', 'Edit Canvas'],
      ['parse', 'examples', 'Need examples'],
      ['parse', 'spec', 'Need authoritative rules'],
      ['create_canvas', 'validate', null],
      ['edit_canvas', 'validate', null],
      ['examples', 'validate', null],
      ['spec', 'validate', null],
      ['validate', 'write', null]
    ]
  );
  assert.equal(
    normalized.reportSeeds.references.find((item) => item.target === 'references/EXAMPLES.md')?.condition,
    'Need examples'
  );
  assert.equal(
    normalized.reportSeeds.references.find((item) => item.target === 'https://jsoncanvas.org/spec/1.0/')?.condition,
    'Need authoritative rules'
  );
});

test('normalizeSkillMarkdown builds serial workflow graphs for step-based sections', () => {
  const normalized = normalizeSkillMarkdown(serialStepWorkflowSource, {
    originalSource: 'serial-source.md',
    resolvedSource: 'serial-source.md'
  });

  assert.deepEqual(
    normalized.reportSeeds.workflow.nodes.map((item) => item.id),
    ['input', 'step_1', 'step_2', 'step_3', 'step_4', 'spec']
  );
  assert.deepEqual(
    normalized.reportSeeds.workflow.edges
      .map((item) => [item.from, item.to, item.label || null])
      .sort(),
    [
      ['input', 'step_1', null],
      ['step_1', 'spec', 'Need authoritative rules'],
      ['step_1', 'step_2', null],
      ['step_2', 'step_3', null],
      ['step_3', 'step_4', null]
    ].sort()
  );
  assert.equal(
    normalized.reportSeeds.workflow.nodes.find((item) => item.id === 'step_1')?.label,
    'Read and normalize the source'
  );
  assert.equal(
    normalized.reportSeeds.workflow.nodes.find((item) => item.id === 'step_4')?.label,
    'Write outputs'
  );
  assert.equal(
    normalized.reportSeeds.workflow.nodes.find((item) => item.id === 'step_4')?.kind,
    'terminal'
  );
  assert.equal(
    normalized.reportSeeds.workflow.nodes.find((item) => item.id === 'spec')?.label,
    'templates/report.schema.json'
  );
});

test('normalizeSkillMarkdown excludes placeholder URLs, script tags, and command snippets from file references', () => {
  const normalized = normalizeSkillMarkdown(serialStepWorkflowSource, {
    originalSource: 'serial-source.md',
    resolvedSource: 'serial-source.md'
  });

  assert.deepEqual(
    normalized.fileReferences.map((item) => item.target),
    ['templates/report.schema.json', 'templates/report.html', 'out/report.json']
  );
  assert.deepEqual(
    normalized.urlReferences.map((item) => item.target),
    []
  );
});

test('normalizeSkillMarkdown only extracts explicit markdown-link URLs, not example bare URLs', () => {
  const normalized = normalizeSkillMarkdown(urlReferenceSource, {
    originalSource: 'url-source.md',
    resolvedSource: 'url-source.md'
  });

  assert.deepEqual(
    normalized.urlReferences.map((item) => item.target),
    [
      'https://jsoncanvas.org/spec/1.0/',
      'https://github.com/obsidianmd/jsoncanvas'
    ]
  );
});

test('normalizeSkillMarkdown extracts bare markdown file names used as references', () => {
  const normalized = normalizeSkillMarkdown(bareFileReferenceSource, {
    originalSource: 'bare-file-source.md',
    resolvedSource: 'bare-file-source.md'
  });

  assert.deepEqual(
    normalized.fileReferences.map((item) => item.target),
    ['design-reviewer.md']
  );
});

test('normalizeSkillMarkdown uses summary mode for primarily Chinese source text', () => {
  const normalized = normalizeSkillMarkdown(chineseSummarySource, {
    originalSource: 'chinese-summary-source.md',
    resolvedSource: 'chinese-summary-source.md'
  });

  assert.equal(normalized.reportSeeds.translation.mode, 'summary');
  assert.deepEqual(
    normalized.reportSeeds.workflow.nodes.map((item) => item.label),
    [
      'Receive task',
      'Read and normalize source',
      'Select workflow',
      'Baseline 对比',
      'Result Card 输出',
      'Validate output',
      'Write updated output'
    ]
  );
});

test('normalize-skill CLI writes to ./skill-inspector/<skill-name>/normalized-source.json by default', () => {
  const cwd = path.join(root, 'out', 'normalize-default-dir');
  const expectedPath = path.join(
    cwd,
    'skill-inspector',
    'sample-generic-skill',
    'normalized-source.json'
  );

  fs.rmSync(cwd, { recursive: true, force: true });
  fs.mkdirSync(cwd, { recursive: true });

  execFileSync('node', [normalizeScriptPath, samplePath], { cwd });

  assert.equal(fs.existsSync(expectedPath), true);

  const normalized = JSON.parse(fs.readFileSync(expectedPath, 'utf8'));
  assert.equal(normalized.frontmatter.name, 'sample-generic-skill');
});
