import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';

import { finalizeReport, validateReportShape } from '../scripts/finalize-report.mjs';

const root = process.cwd();
const finalizeScriptPath = path.join(root, 'scripts', 'finalize-report.mjs');

const draft = {
  summary: {
    title: 'Fixture Skill',
    purpose: 'fixture purpose',
    score_total: 0,
    risk_level: '待评估'
  },
  workflow: {
    caption: 'fixture caption',
    nodes: [
      { id: 'step_1', label: 'Read source' },
      { id: 'step_2', label: 'Write report' }
    ],
    edges: [{ from: 'step_1', to: 'step_2' }]
  },
  translation: {
    mode: 'compact',
    sections: []
  },
  references: [
    {
      target: 'docs/ref.md',
      kind: 'file',
      summary: '源 skill 中引用的本地文件。',
      condition: null,
      line: 'L10: docs/ref.md'
    }
  ],
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

test('finalizeReport deep-merges overlay content into the draft report', () => {
  const overlay = {
    summary: {
      score_total: 87,
      risk_level: '低风险'
    },
    translation: {
      sections: [
        {
          title_zh: '概述',
          title_en: 'Overview',
          rows: [{ zh: '中文', en: 'English' }]
        }
      ]
    },
    safety: {
      level_code: 'low',
      level_label: '低风险',
      level_summary: '安全边界清楚。',
      findings: [
        {
          signal: 'file-write',
          severity: 'low',
          meaning: '只写本地文件。',
          evidence: 'L12'
        }
      ]
    },
    suggestions: [
      { title: '补充', detail: '补充说明', priority: 'high' }
    ]
  };

  const result = finalizeReport(draft, overlay);

  assert.equal(result.summary.title, 'Fixture Skill');
  assert.equal(result.summary.score_total, 87);
  assert.equal(result.summary.risk_level, '低风险');
  assert.equal(result.translation.mode, 'compact');
  assert.equal(result.translation.sections.length, 1);
  assert.equal(result.safety.level_code, 'low');
  assert.equal(result.safety.findings.length, 1);
  assert.equal(result.suggestions.length, 1);
  assert.doesNotThrow(() => validateReportShape(result));
});

test('validateReportShape rejects reports with missing required top-level content', () => {
  assert.throws(
    () =>
      validateReportShape({
        ...draft,
        translation: { mode: 'compact' }
      }),
    /Missing required field: translation\.sections/
  );
});

test('finalize-report CLI writes the merged final report', () => {
  const fixtureDir = path.join(root, 'out', 'finalize-fixture');
  const draftPath = path.join(fixtureDir, 'report.draft.json');
  const overlayPath = path.join(fixtureDir, 'report.overlay.json');
  const outputPath = path.join(fixtureDir, 'report.final.json');

  fs.mkdirSync(fixtureDir, { recursive: true });
  fs.writeFileSync(draftPath, `${JSON.stringify(draft, null, 2)}\n`);
  fs.writeFileSync(
    overlayPath,
    `${JSON.stringify(
      {
        summary: { score_total: 91, risk_level: '低风险' },
        translation: {
          sections: [
            {
              title_zh: '概述',
              title_en: 'Overview',
              rows: [{ zh: '中文', en: 'English' }]
            }
          ]
        },
        safety: {
          level_code: 'low',
          level_label: '低风险',
          level_summary: '安全边界清楚。',
          findings: []
        }
      },
      null,
      2
    )}\n`
  );

  execFileSync('node', [finalizeScriptPath, draftPath, overlayPath, outputPath], { cwd: root });

  const output = JSON.parse(fs.readFileSync(outputPath, 'utf8'));

  assert.equal(output.summary.score_total, 91);
  assert.equal(output.translation.sections.length, 1);
  assert.equal(output.safety.level_code, 'low');
});
