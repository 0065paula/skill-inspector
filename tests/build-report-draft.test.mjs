import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';

import { normalizeSkillMarkdown } from '../scripts/normalize-skill.mjs';
import { buildReportDraft } from '../scripts/build-report-draft.mjs';

const root = process.cwd();
const normalizeScriptPath = path.join(root, 'scripts', 'normalize-skill.mjs');
const draftScriptPath = path.join(root, 'scripts', 'build-report-draft.mjs');
const samplePath = path.join(root, 'examples', 'sample-input.md');
const sampleSource = fs.readFileSync(samplePath, 'utf8');

test('buildReportDraft seeds deterministic report fields from normalized skill data', () => {
  const normalized = normalizeSkillMarkdown(sampleSource, {
    originalSource: samplePath,
    resolvedSource: samplePath
  });

  const draft = buildReportDraft(normalized);

  assert.equal(draft.summary.title, 'Sample Generic Skill');
  assert.equal(draft.summary.purpose, 'Use when a simple workflow needs examples');
  assert.equal(draft.summary.score_total, 0);
  assert.equal(draft.summary.risk_level, '待评估');
  assert.equal(draft.translation.mode, 'full');
  assert.deepEqual(
    draft.workflow.nodes.map((item) => item.id),
    ['step_1', 'step_2', 'step_3']
  );
  assert.equal(draft.references.length, 2);
  assert.equal(draft.references[0].summary, '源 skill 中引用的本地文件。');
  assert.equal(draft.references[1].summary, '源 skill 中引用的外部链接。');
  assert.equal(draft.source.primary_value, samplePath);
});

test('build-report-draft CLI writes a schema-shaped draft report', () => {
  const fixtureDir = path.join(root, 'out', 'draft-fixture');
  const normalizedPath = path.join(fixtureDir, 'normalized-source.json');
  const draftPath = path.join(fixtureDir, 'report.draft.json');

  fs.mkdirSync(fixtureDir, { recursive: true });

  execFileSync('node', [normalizeScriptPath, samplePath, normalizedPath], { cwd: root });
  execFileSync('node', [draftScriptPath, normalizedPath, draftPath], { cwd: root });

  const draft = JSON.parse(fs.readFileSync(draftPath, 'utf8'));

  assert.equal(draft.summary.title, 'Sample Generic Skill');
  assert.ok(Array.isArray(draft.workflow.nodes));
  assert.ok(Array.isArray(draft.workflow.edges));
  assert.ok(Array.isArray(draft.references));
  assert.ok(Array.isArray(draft.suggestions));
  assert.equal(draft.translation.mode, 'full');
});
