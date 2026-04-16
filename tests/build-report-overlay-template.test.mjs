import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';

import { buildReportOverlayTemplate } from '../scripts/build-report-overlay-template.mjs';

const root = process.cwd();
const overlayScriptPath = path.join(root, 'scripts', 'build-report-overlay-template.mjs');

const draft = {
  summary: {
    title: 'Fixture Skill',
    purpose: 'fixture purpose',
    score_total: 0,
    risk_level: '待评估'
  },
  workflow: {
    caption: 'fixture caption',
    nodes: [{ id: 'step_1', label: 'Read source' }],
    edges: []
  },
  translation: {
    mode: 'compact',
    sections: []
  },
  references: [],
  safety: {
    level_code: 'medium',
    level_label: '待评估',
    level_summary: '待补充安全边界和风险判断。',
    findings: []
  },
  install: {
    items: []
  },
  score: {
    dimensions: []
  },
  suggestions: [],
  source: {
    primary_label: '原始路径',
    primary_value: 'examples/sample-input.md'
  }
};

test('buildReportOverlayTemplate returns a small judgment-only overlay skeleton', () => {
  const overlay = buildReportOverlayTemplate(draft);

  assert.deepEqual(Object.keys(overlay), [
    'summary',
    'workflow',
    'translation',
    'safety',
    'score',
    'suggestions'
  ]);
  assert.deepEqual(Object.keys(overlay.summary), ['score_total', 'risk_level']);
  assert.deepEqual(Object.keys(overlay.workflow), ['caption', 'nodes', 'edges']);
  assert.deepEqual(Object.keys(overlay.translation), ['coverage', 'sections']);
  assert.equal(overlay.translation.coverage, 'full_human');
  assert.deepEqual(Object.keys(overlay.safety), [
    'level_code',
    'level_label',
    'level_summary',
    'findings'
  ]);
  assert.deepEqual(Object.keys(overlay.score), ['dimensions']);
  assert.ok(Array.isArray(overlay.suggestions));
});

test('build-report-overlay-template CLI writes the overlay template file', () => {
  const fixtureDir = path.join(root, 'out', 'overlay-fixture');
  const draftPath = path.join(fixtureDir, 'report.draft.json');
  const overlayPath = path.join(fixtureDir, 'report.overlay.template.json');

  fs.mkdirSync(fixtureDir, { recursive: true });
  fs.writeFileSync(draftPath, `${JSON.stringify(draft, null, 2)}\n`);

  execFileSync('node', [overlayScriptPath, draftPath, overlayPath], { cwd: root });

  const overlay = JSON.parse(fs.readFileSync(overlayPath, 'utf8'));

  assert.equal(overlay.summary.risk_level, '待评估');
  assert.equal(overlay.summary.score_total, 0);
  assert.equal(overlay.workflow.caption, '待补充 workflow 图说明。');
  assert.ok(Array.isArray(overlay.workflow.nodes));
  assert.ok(Array.isArray(overlay.workflow.edges));
  assert.equal(overlay.translation.coverage, 'full_human');
  assert.ok(Array.isArray(overlay.translation.sections));
  assert.ok(Array.isArray(overlay.safety.findings));
  assert.ok(Array.isArray(overlay.score.dimensions));
  assert.ok(Array.isArray(overlay.suggestions));
});

test('build-report-overlay-template CLI writes to the draft file directory by default', () => {
  const fixtureDir = path.join(root, 'out', 'overlay-default-fixture');
  const draftPath = path.join(fixtureDir, 'report.draft.json');
  const overlayPath = path.join(fixtureDir, 'report.overlay.template.json');

  fs.rmSync(fixtureDir, { recursive: true, force: true });
  fs.mkdirSync(fixtureDir, { recursive: true });
  fs.writeFileSync(draftPath, `${JSON.stringify(draft, null, 2)}\n`);

  execFileSync('node', [overlayScriptPath, draftPath], { cwd: root });

  assert.equal(fs.existsSync(overlayPath), true);

  const overlay = JSON.parse(fs.readFileSync(overlayPath, 'utf8'));
  assert.equal(overlay.summary.risk_level, '待评估');
});
