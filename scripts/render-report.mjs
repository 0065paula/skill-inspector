import fs from 'node:fs';
import path from 'node:path';

import { siblingOutputPath } from './output-paths.mjs';

const [, , reportArg, outputArg] = process.argv;

if (!reportArg) {
  console.error('Usage: node scripts/render-report.mjs <report.json> [report.html]');
  process.exit(1);
}

const cwd = process.cwd();
const reportPath = path.resolve(cwd, reportArg);
const outputPath = outputArg
  ? path.resolve(cwd, outputArg)
  : siblingOutputPath(reportArg, 'report.html', cwd);
const templatePath = path.resolve(cwd, 'templates/report.html');

const report = JSON.parse(fs.readFileSync(reportPath, 'utf8'));
let template = fs.readFileSync(templatePath, 'utf8');

const escapeHtml = (value) =>
  String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');

const escapeJsonForScriptTag = (value) =>
  JSON.stringify(value)
    .replace(/</g, '\\u003c')
    .replace(/>/g, '\\u003e')
    .replace(/&/g, '\\u0026');

const isUrl = (value) => /^https?:\/\//i.test(String(value));

const toMermaidSafeLabel = (value) =>
  String(value)
    .replace(/`/g, '')
    .replace(/[{}"]/g, '')
    .replace(/\s+/g, ' ')
    .trim();

const quoteMermaidLabel = (value) => JSON.stringify(toMermaidSafeLabel(value));
const toMermaidSafeId = (value) =>
  `n_${String(value)
    .replace(/[^A-Za-z0-9_]+/g, '_')
    .replace(/^_+|_+$/g, '') || 'node'}`;

const workflowNodeSyntax = (node, nodeId) => {
  const label = quoteMermaidLabel(node.label);
  switch (node.kind) {
    case 'decision':
      return `${nodeId}{${label}}`;
    case 'terminal':
      return `${nodeId}([${label}])`;
    case 'reference':
      return `${nodeId}[[${label}]]`;
    default:
      return `${nodeId}[${label}]`;
  }
};

const buildMermaidFromWorkflow = (workflow) => {
  if (workflow.mermaid) return workflow.mermaid;

  const nodes = Array.isArray(workflow.nodes) ? workflow.nodes : [];
  const edges = Array.isArray(workflow.edges) ? workflow.edges : [];
  const lines = ['flowchart TD'];
  const idMap = new Map(nodes.map((node) => [node.id, toMermaidSafeId(node.id)]));

  for (const node of nodes) {
    lines.push(workflowNodeSyntax(node, idMap.get(node.id)));
  }

  for (const edge of edges) {
    const label = edge.label ? ` -->|${edge.label}| ` : ' --> ';
    lines.push(`${idMap.get(edge.from) || toMermaidSafeId(edge.from)}${label}${idMap.get(edge.to) || toMermaidSafeId(edge.to)}`);
  }

  return lines.join('\n');
};

const scoreLevelClass = (score) => {
  if (score >= 90) return 'score-summary--excellent';
  if (score >= 80) return 'score-summary--strong';
  return 'score-summary--good';
};

const translationMode = report.translation.mode || 'full';
const workflowMermaid = buildMermaidFromWorkflow(report.workflow);
const translationPanelCopy =
  translationMode === 'summary'
    ? {
        navLabel: '中文总结',
        title: '中文总结',
        subtitle: '按章节提炼中文总结，不显示原文对照。'
      }
    : {
        navLabel: '中文翻译',
        title: '中文翻译',
        subtitle: '按内容段落展开，保持中文与原文左右对照。'
      };

const translationSectionsHtml = report.translation.sections
  .map((section) => {
    const zhRows = section.rows
      .map(
        (row) =>
          `\n              <div class="translation-block-row"><div class="translation-text">${escapeHtml(row.zh)}</div></div>`
      )
      .join('');

    if (translationMode === 'summary') {
      return `
            <article class="translation-block">
              <div class="panel-head">
                <div>
                  <h3>${escapeHtml(section.title_zh || section.title_en)}</h3>
                  <p class="muted">${escapeHtml(section.title_en)}</p>
                </div>
              </div>
              <div class="translation-col">${zhRows}
              </div>
            </article>`;
    }

    const enRows = section.rows
      .map(
        (row) =>
          `\n              <div class="translation-block-row"><div class="translation-original">${escapeHtml(row.en)}</div></div>`
      )
      .join('');

    return `
            <article class="translation-block">
              <div class="panel-head">
                <div>
                  <h3>${escapeHtml(section.title_zh)}</h3>
                  <p class="muted">${escapeHtml(section.title_en)}</p>
                </div>
              </div>
              <div class="translation-compare">
                <div class="translation-col">${zhRows}
                </div>
                <div class="translation-col">${enRows}
                </div>
              </div>
            </article>`;
  })
  .join('\n');

const referencesHtml = `<div class="meta-stack">${report.references
  .map(
    (ref) => `
            <div class="meta-row">
              <strong>${escapeHtml(ref.target)}</strong>
              <div class="meta-copy">${escapeHtml(ref.summary)}</div>
              <div class="reference-tags">
                <span class="reference-tag">${escapeHtml(ref.kind)}</span>
                ${ref.line ? `<span class="reference-tag">${escapeHtml(ref.line)}</span>` : ''}
                ${ref.condition ? `<span class="reference-tag reference-tag--condition">${escapeHtml(ref.condition)}</span>` : ''}
              </div>
            </div>`
  )
  .join('\n')}
            </div>`;

const safetyHtml = `
            <div class="safety-summary tone-${escapeHtml(report.safety.level_code)}">
              <strong>${escapeHtml(report.safety.level_label)}</strong>
              <div class="meta-copy">${escapeHtml(report.safety.level_summary)}</div>
            </div>
            <div class="meta-stack">${report.safety.findings
              .map(
                (finding) => `
              <div class="meta-row">
                <div class="safety-finding-title">
                  <strong>${escapeHtml(finding.signal)}</strong>
                  <span class="safety-severity">${escapeHtml(finding.severity)}</span>
                </div>
                <div class="meta-copy">${escapeHtml(finding.meaning)}</div>
                <div class="muted">证据: ${escapeHtml(finding.evidence)}</div>
              </div>`
              )
              .join('\n')}
            </div>`;

const suggestionsHtml = `<div class="meta-stack">${report.suggestions
  .map(
    (item) => `
            <div class="meta-row">
              <strong>${escapeHtml(item.title)}</strong>
              <div class="meta-copy">${escapeHtml(item.detail)}</div>
              <div class="muted">优先级: ${escapeHtml(item.priority)}</div>
            </div>`
  )
  .join('\n')}
            </div>`;

const installHtml = `<div class="status-grid">${report.install.items
  .map(
    (item) => `
            <div class="status-row">
              <div>
                <strong>${escapeHtml(item.platform)}</strong>
                ${item.note ? `<div class="muted">${escapeHtml(item.note)}</div>` : ''}
              </div>
              <span>${escapeHtml(item.status)}</span>
            </div>`
  )
  .join('\n')}
            </div>`;

const scoreTotal = report.summary.score_total;
const scoreSummary =
  scoreTotal >= 90
    ? '整体质量很强，属于可直接投入使用的高约束技能。'
    : scoreTotal >= 80
      ? '整体质量较强，适合在补齐少量边界说明后稳定使用。'
      : '整体结构可用，但仍需要补足关键说明。';

const scoreHtml = `
            <div class="score-summary ${scoreLevelClass(scoreTotal)}">
              <strong>${escapeHtml(String(scoreTotal))}/100</strong>
              <div class="meta-copy">${escapeHtml(scoreSummary)}</div>
            </div>
            <div class="meta-stack">${report.score.dimensions
              .map(
                (item) => `
              <div class="score-row">
                <div class="score-row-head">
                  <strong class="score-label">${escapeHtml(item.name)}</strong>
                  <span class="score-value">${escapeHtml(String(item.value))}/20</span>
                </div>
                <div class="score-bar ${scoreLevelClass(item.value * 5)}"><span style="width:${item.value * 5}%"></span></div>
                <div class="meta-copy">${escapeHtml(item.rationale)}</div>
              </div>`
              )
              .join('\n')}
            </div>`;

const sourceInline = isUrl(report.source.primary_value)
  ? `<a href="${escapeHtml(report.source.primary_value)}" target="_blank" rel="noreferrer">${escapeHtml(report.source.primary_value)}</a>`
  : escapeHtml(report.source.primary_value);

template = template
  .replaceAll('{{summary.title}}', escapeHtml(report.summary.title))
  .replace('{{workflow.mermaid_json}}', escapeJsonForScriptTag(workflowMermaid))
  .replace('{{summary.purpose}}', escapeHtml(report.summary.purpose))
  .replace('{{summary.score_total}}', escapeHtml(String(report.summary.score_total)))
  .replace('{{summary.risk_level}}', escapeHtml(report.summary.risk_level))
  .replace('{{references_count}}', escapeHtml(String(report.references.length)))
  .replace('{{translation_mode}}', escapeHtml(translationMode))
  .replace('{{translation_nav_label}}', escapeHtml(translationPanelCopy.navLabel))
  .replace('{{translation_panel_title}}', escapeHtml(translationPanelCopy.title))
  .replace('{{translation_panel_subtitle}}', escapeHtml(translationPanelCopy.subtitle))
  .replace('{{workflow.caption}}', escapeHtml(report.workflow.caption))
  .replace('{{source_inline}}', sourceInline)
  .replace('{{translation_sections_html}}', translationSectionsHtml)
  .replace('{{references_html}}', referencesHtml)
  .replace('{{safety_html}}', safetyHtml)
  .replace('{{suggestions_html}}', suggestionsHtml)
  .replace('{{install_html}}', installHtml)
  .replace('{{score_html}}', scoreHtml);

fs.mkdirSync(path.dirname(outputPath), { recursive: true });
fs.writeFileSync(outputPath, template);
