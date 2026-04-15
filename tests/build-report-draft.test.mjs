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
  assert.ok(Array.isArray(draft.translation.sections));
  assert.deepEqual(
    draft.workflow.nodes.map((item) => item.id),
    ['step_1', 'step_2', 'step_3']
  );
  assert.equal(draft.references.length, 1);
  assert.equal(draft.references[0].summary, '本地文档文件，用于补充执行时需要读取的内容。');
  assert.equal(draft.references[0].line, 'L10');
  assert.equal(draft.source.primary_value, samplePath);
});

test('buildReportDraft generates one-line reference intros from common file patterns', () => {
  const normalized = {
    title: 'Fixture Skill',
    frontmatter: { description: 'fixture purpose' },
    source: { original: 'fixture.md', resolved: 'fixture.md' },
    reportSeeds: {
      summary: { title: 'Fixture Skill', purpose: 'fixture purpose' },
      workflow: { caption: 'fixture', nodes: [], edges: [] },
      references: [
        {
          target: 'agents/grader.md',
          kind: 'file',
          condition: null,
          line: 'L12: reads `agents/grader.md`',
          evidence: 'reads `agents/grader.md`'
        },
        {
          target: 'assets/eval_review.html',
          kind: 'file',
          condition: null,
          line: 'L14: read the template',
          evidence: 'read the template'
        },
        {
          target: 'eval-viewer/generate_review.py',
          kind: 'file',
          condition: null,
          line: 'L16: use the script',
          evidence: 'use the script'
        },
        {
          target: '/skill-test',
          kind: 'file',
          condition: null,
          line: 'L18: do not use /skill-test',
          evidence: 'do not use /skill-test'
        },
        {
          target: 'without_skill/outputs/',
          kind: 'file',
          condition: null,
          line: 'L20: save to without_skill/outputs/',
          evidence: 'save to without_skill/outputs/'
        }
      ],
      translation: { mode: 'full' },
      source: { primary_label: '原始路径', primary_value: 'fixture.md' }
    }
  };

  const draft = buildReportDraft(normalized);

  assert.equal(draft.references[0].summary, 'Agent 说明文件，定义特定子任务的执行方式。');
  assert.equal(draft.references[1].summary, '界面模板文件，用于生成或展示评审页面。');
  assert.equal(draft.references[2].summary, '脚本文件，用于执行自动化步骤或生成结果。');
  assert.equal(draft.references[3].summary, 'Slash command 名称，用于说明某个命令应避免或应触发。');
  assert.equal(draft.references[4].summary, '运行结果目录，用于保存某类配置下的输出文件。');
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
  assert.ok(Array.isArray(draft.translation.sections));
  assert.ok(Array.isArray(draft.references));
  assert.ok(Array.isArray(draft.suggestions));
  assert.equal(draft.translation.mode, 'full');
});
