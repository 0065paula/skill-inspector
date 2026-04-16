import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';

const root = process.cwd();
const scriptPath = path.join(root, 'scripts', 'render-report.mjs');
const reportPath = path.join(root, 'templates', 'report.example.json');
const outputPath = path.join(root, 'out', 'report.html');

test('rendered report builds mermaid from structured workflow data', () => {
  const fixtureDir = path.join(root, 'out', 'test-fixture');
  const fixtureReportPath = path.join(fixtureDir, 'report.json');
  const fixtureOutputPath = path.join(fixtureDir, 'report.html');

  fs.mkdirSync(fixtureDir, { recursive: true });
  fs.writeFileSync(
    fixtureReportPath,
    JSON.stringify(
      {
        summary: {
          title: 'Fixture Skill',
          purpose: 'fixture purpose',
          score_total: 88,
          risk_level: '低风险'
        },
        workflow: {
          caption: 'fixture caption',
          nodes: [
            { id: 'input', label: 'Read Source' },
            { id: 'normalize', label: 'Normalize' },
            { id: 'report', label: 'Write Report' }
          ],
          edges: [
            { from: 'input', to: 'normalize' },
            { from: 'normalize', to: 'report', label: 'json first' }
          ]
        },
        translation: {
          mode: 'compact',
          sections: [
            {
              title_zh: '概述',
              title_en: 'Overview',
              rows: [{ zh: '简版', en: 'compact' }]
            }
          ]
        },
        references: [],
        safety: {
          level_code: 'low',
          level_label: '低风险',
          level_summary: 'fixture safety',
          findings: []
        },
        install: { items: [] },
        score: { dimensions: [] },
        suggestions: [
          { title: 'one', detail: 'two', priority: 'high' }
        ],
        source: {
          primary_label: '原始链接',
          primary_value: 'https://example.com'
        }
      },
      null,
      2
    )
  );

  execFileSync('node', [scriptPath, fixtureReportPath, fixtureOutputPath], { cwd: root });

  const html = fs.readFileSync(fixtureOutputPath, 'utf8');
  const match = html.match(/<script id="mermaid-source" type="application\/json">([\s\S]*?)<\/script>/);

  assert.ok(match, 'expected mermaid source script block');

  const mermaidSource = match[1];
  const parsed = JSON.parse(mermaidSource);

  assert.equal(typeof parsed, 'string');
  assert.match(parsed, /^flowchart TD/);
  assert.match(parsed, /input\["Read Source"\]/);
  assert.match(parsed, /normalize -->\|json first\| report/);
  assert.match(html, /翻译模式<\/dt>\s*<dd>compact<\/dd>/);
});

test('rendered report escapes mermaid-unsafe workflow labels', () => {
  const fixtureDir = path.join(root, 'out', 'mermaid-unsafe-fixture');
  const fixtureReportPath = path.join(fixtureDir, 'report.json');
  const fixtureOutputPath = path.join(fixtureDir, 'report.html');

  fs.mkdirSync(fixtureDir, { recursive: true });
  fs.writeFileSync(
    fixtureReportPath,
    JSON.stringify(
      {
        summary: {
          title: 'Unsafe Mermaid Skill',
          purpose: 'fixture purpose',
          score_total: 80,
          risk_level: '低风险'
        },
        workflow: {
          caption: 'fixture caption',
          nodes: [
            {
              id: 'step_1',
              label: 'Create a `.canvas` file with the base structure `{"nodes": [], "edges": []}`'
            },
            {
              id: 'step_2',
              label: 'Set `fromNode` and `toNode` to the source and target IDs'
            }
          ],
          edges: [{ from: 'step_1', to: 'step_2' }]
        },
        translation: {
          mode: 'compact',
          sections: []
        },
        references: [],
        safety: {
          level_code: 'low',
          level_label: '低风险',
          level_summary: 'fixture safety',
          findings: []
        },
        install: { items: [] },
        score: { dimensions: [] },
        suggestions: [],
        source: {
          primary_label: '原始链接',
          primary_value: 'https://example.com'
        }
      },
      null,
      2
    )
  );

  execFileSync('node', [scriptPath, fixtureReportPath, fixtureOutputPath], { cwd: root });

  const html = fs.readFileSync(fixtureOutputPath, 'utf8');
  const match = html.match(/<script id="mermaid-source" type="application\/json">([\s\S]*?)<\/script>/);

  assert.ok(match, 'expected mermaid source script block');

  const mermaidSource = JSON.parse(match[1]);

  assert.doesNotMatch(mermaidSource, /`/);
  assert.doesNotMatch(mermaidSource, /\{\"nodes\": \[\], \"edges\": \[\]\}/);
  assert.match(mermaidSource, /Create a \.canvas file with the base structure nodes: \[\], edges: \[\]/);
  assert.match(mermaidSource, /Set fromNode and toNode to the source and target IDs/);
});

test('rendered report embeds mermaid JSON that parses successfully', () => {
  execFileSync('node', [scriptPath, reportPath, outputPath], { cwd: root });

  const html = fs.readFileSync(outputPath, 'utf8');
  const match = html.match(/<script id="mermaid-source" type="application\/json">([\s\S]*?)<\/script>/);

  assert.ok(match, 'expected mermaid source script block');

  const mermaidSource = match[1];
  const parsed = JSON.parse(mermaidSource);

  assert.equal(typeof parsed, 'string');
  assert.match(parsed, /^flowchart TD/);
});

test('rendered report shows reference kind and line as compact tags', () => {
  const fixtureDir = path.join(root, 'out', 'reference-tags-fixture');
  const fixtureReportPath = path.join(fixtureDir, 'report.json');
  const fixtureOutputPath = path.join(fixtureDir, 'report.html');

  fs.mkdirSync(fixtureDir, { recursive: true });
  fs.writeFileSync(
    fixtureReportPath,
    JSON.stringify(
      {
        summary: {
          title: 'Reference Tags Skill',
          purpose: 'fixture purpose',
          score_total: 81,
          risk_level: '低风险'
        },
        workflow: {
          caption: 'fixture caption',
          nodes: [
            { id: 'input', label: 'Read source' }
          ],
          edges: []
        },
        translation: {
          mode: 'compact',
          sections: []
        },
        references: [
          {
            target: 'agents/grader.md',
            kind: 'file',
            summary: 'Agent 说明文件，定义特定子任务的执行方式。',
            condition: 'Need examples',
            line: 'L225'
          }
        ],
        safety: {
          level_code: 'low',
          level_label: '低风险',
          level_summary: 'fixture safety',
          findings: []
        },
        install: { items: [] },
        score: { dimensions: [] },
        suggestions: [],
        source: {
          primary_label: '原始链接',
          primary_value: 'https://example.com'
        }
      },
      null,
      2
    )
  );

  execFileSync('node', [scriptPath, fixtureReportPath, fixtureOutputPath], { cwd: root });

  const html = fs.readFileSync(fixtureOutputPath, 'utf8');

  assert.match(html, /reference-tags/);
  assert.match(html, /reference-tags">\s*<span class="reference-tag">file<\/span>\s*<span class="reference-tag">L225<\/span>/);
  assert.match(html, /\.reference-tag \+ \.reference-tag::before\s*\{[^}]*content:\s*"\|"/);
  assert.match(html, />file</);
  assert.match(html, />L225</);
  assert.doesNotMatch(html, /类型:/);
  assert.doesNotMatch(html, /证据:/);
});

test('rendered report hardens side rail text against long unbroken content', () => {
  execFileSync('node', [scriptPath, reportPath, outputPath], { cwd: root });

  const html = fs.readFileSync(outputPath, 'utf8');

  assert.match(html, /\.meta-row,\s*\.status-row,\s*\.score-row,\s*\.source-item\s*\{[^}]*min-width:\s*0;/);
  assert.match(html, /\.meta-row strong,\s*\.source-item strong\s*\{[^}]*overflow-wrap:\s*anywhere;/);
  assert.match(html, /\.meta-copy\s*\{[^}]*overflow-wrap:\s*anywhere;/);
  assert.match(html, /\.reference-tag\s*\{[^}]*overflow-wrap:\s*anywhere;/);
  assert.match(html, /\.reference-tag\s*\{[^}]*white-space:\s*normal;/);
});

test('rendered report moves source info into the hero area and links URLs', () => {
  const fixtureDir = path.join(root, 'out', 'source-inline-fixture');
  const fixtureReportPath = path.join(fixtureDir, 'report.json');
  const fixtureOutputPath = path.join(fixtureDir, 'report.html');

  fs.mkdirSync(fixtureDir, { recursive: true });
  fs.writeFileSync(
    fixtureReportPath,
    JSON.stringify(
      {
        summary: {
          title: 'Source Inline Skill',
          purpose: 'fixture purpose',
          score_total: 81,
          risk_level: '低风险'
        },
        workflow: {
          caption: 'fixture caption',
          nodes: [
            { id: 'input', label: 'Read source' }
          ],
          edges: []
        },
        translation: {
          mode: 'compact',
          sections: []
        },
        references: [],
        safety: {
          level_code: 'low',
          level_label: '低风险',
          level_summary: 'fixture safety',
          findings: []
        },
        install: { items: [] },
        score: { dimensions: [] },
        suggestions: [],
        source: {
          primary_label: '原始链接',
          primary_value: 'https://example.com/source'
        }
      },
      null,
      2
    )
  );

  execFileSync('node', [scriptPath, fixtureReportPath, fixtureOutputPath], { cwd: root });

  const html = fs.readFileSync(fixtureOutputPath, 'utf8');

  assert.match(html, /<strong>Source:<\/strong>/);
  assert.match(html, /href="https:\/\/example\.com\/source"/);
  assert.doesNotMatch(html, /<section class="meta-card" id="source">/);
  assert.doesNotMatch(html, /href="#source"/);
});

test('rendered report uses the paper-column layout shell', () => {
  execFileSync('node', [scriptPath, reportPath, outputPath], { cwd: root });

  const html = fs.readFileSync(outputPath, 'utf8');

  assert.match(html, /class="hero-metrics"/);
  assert.match(html, /class="report-shell"/);
  assert.match(html, /class="side-rail"/);
  assert.match(html, /<section class="panel workflow-panel" id="workflow">/);
});

test('rendered report configures mermaid with the paper-column palette', () => {
  execFileSync('node', [scriptPath, reportPath, outputPath], { cwd: root });

  const html = fs.readFileSync(outputPath, 'utf8');

  assert.match(html, /theme:\s*"base"/);
  assert.match(html, /primaryColor:\s*"#edf4fa"/);
  assert.match(html, /primaryTextColor:\s*"#223446"/);
});

test('rendered report reduces decorative accents and keeps the graph surface white', () => {
  execFileSync('node', [scriptPath, reportPath, outputPath], { cwd: root });

  const html = fs.readFileSync(outputPath, 'utf8');

  assert.doesNotMatch(html, /max-width:\s*12ch/);
  assert.doesNotMatch(html, /\.hero::after/);
  assert.doesNotMatch(html, /\.panel h2::after/);
  assert.doesNotMatch(html, /\.hero-stat\s*\{[^}]*border-top:/);
  assert.match(html, /\.graph-shell\s*\{[\s\S]*background:\s*#fff;/);
});

test('rendered report gives the anchor nav a light translucent background with blur', () => {
  execFileSync('node', [scriptPath, reportPath, outputPath], { cwd: root });

  const html = fs.readFileSync(outputPath, 'utf8');

  assert.match(html, /\.nav-shell\s*\{[^}]*background:\s*rgba\(243, 248, 251, 0\.1\);/);
  assert.match(html, /backdrop-filter:\s*blur\(10px\);/);
});
