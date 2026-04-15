import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';

const root = process.cwd();
const scriptPath = path.join(root, 'scripts', 'render-report.mjs');
const reportPath = path.join(root, 'out', 'report.json');
const outputPath = path.join(root, 'out', 'report.html');

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
