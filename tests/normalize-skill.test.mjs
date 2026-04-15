import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

import {
  normalizeSkillMarkdown,
  readRemoteSkillSource,
  rewriteGitHubBlobToRaw
} from '../scripts/normalize-skill.mjs';

const root = process.cwd();
const samplePath = path.join(root, 'examples', 'sample-input.md');
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

test('rewriteGitHubBlobToRaw converts github blob URLs to raw URLs', () => {
  const input = 'https://github.com/kepano/obsidian-skills/blob/main/skills/json-canvas/SKILL.md';
  const output = rewriteGitHubBlobToRaw(input);

  assert.equal(
    output,
    'https://raw.githubusercontent.com/kepano/obsidian-skills/main/skills/json-canvas/SKILL.md'
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
  assert.equal(result.strategy, 'github-page-fallback');
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
  assert.deepEqual(normalized.urlReferences.map((item) => item.target), ['https://example.com']);
  assert.equal(normalized.urlReferences[0].line, 11);
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
  assert.equal(normalized.reportSeeds.references.length, 2);
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
    'Create canvas'
  );
  assert.equal(
    normalized.reportSeeds.workflow.nodes.find((item) => item.id === 'edit_canvas')?.label,
    'Edit canvas'
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
      ['branch', 'create_canvas', 'Create canvas'],
      ['branch', 'edit_canvas', 'Edit canvas'],
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
