import fs from 'node:fs';
import path from 'node:path';

const [, , reportArg, outputArg] = process.argv;

if (!reportArg || !outputArg) {
  console.error('Usage: node scripts/render-report.mjs <report.json> <report.html>');
  process.exit(1);
}

const cwd = process.cwd();
const reportPath = path.resolve(cwd, reportArg);
const outputPath = path.resolve(cwd, outputArg);
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

const scoreLevelClass = (score) => {
  if (score >= 90) return 'score-summary--excellent';
  if (score >= 80) return 'score-summary--strong';
  return 'score-summary--good';
};

const translationSectionsHtml = report.translation.sections
  .map((section) => {
    const zhRows = section.rows
      .map(
        (row) =>
          `\n              <div class="translation-block-row"><div class="translation-text">${escapeHtml(row.zh)}</div></div>`
      )
      .join('');
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
              <div class="muted">类型: ${escapeHtml(ref.kind)}${
                ref.condition ? ` · 条件: ${escapeHtml(ref.condition)}` : ''
              }</div>
              <div class="muted">证据: ${escapeHtml(ref.line)}</div>
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

const sourceHtml = `<div class="source-list">
            <div class="source-item">
              <span>${escapeHtml(report.source.primary_label)}</span>
              <strong>${escapeHtml(report.source.primary_value)}</strong>
            </div>
          </div>`;

template = template
  .replaceAll('{{summary.title}}', escapeHtml(report.summary.title))
  .replace('{{workflow.mermaid_json}}', escapeJsonForScriptTag(report.workflow.mermaid))
  .replace('{{summary.purpose}}', escapeHtml(report.summary.purpose))
  .replace('{{summary.score_total}}', escapeHtml(String(report.summary.score_total)))
  .replace('{{summary.risk_level}}', escapeHtml(report.summary.risk_level))
  .replace('{{references_count}}', escapeHtml(String(report.references.length)))
  .replace('{{workflow.caption}}', escapeHtml(report.workflow.caption))
  .replace('{{translation_sections_html}}', translationSectionsHtml)
  .replace('{{references_html}}', referencesHtml)
  .replace('{{safety_html}}', safetyHtml)
  .replace('{{suggestions_html}}', suggestionsHtml)
  .replace('{{install_html}}', installHtml)
  .replace('{{score_html}}', scoreHtml)
  .replace('{{source_html}}', sourceHtml);

fs.mkdirSync(path.dirname(outputPath), { recursive: true });
fs.writeFileSync(outputPath, template);
