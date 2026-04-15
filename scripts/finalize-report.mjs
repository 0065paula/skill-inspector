import fs from 'node:fs';
import path from 'node:path';

const isPlainObject = (value) =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const deepMerge = (base, overlay) => {
  if (Array.isArray(base) && Array.isArray(overlay)) return overlay;
  if (!isPlainObject(base) || !isPlainObject(overlay)) return overlay;

  const result = { ...base };
  for (const [key, value] of Object.entries(overlay)) {
    if (key in base) {
      result[key] = deepMerge(base[key], value);
    } else {
      result[key] = value;
    }
  }
  return result;
};

const requiredPaths = [
  'summary',
  'summary.title',
  'summary.purpose',
  'summary.score_total',
  'summary.risk_level',
  'workflow',
  'workflow.caption',
  'workflow.nodes',
  'workflow.edges',
  'translation',
  'translation.mode',
  'translation.sections',
  'references',
  'safety',
  'safety.level_code',
  'safety.level_label',
  'safety.level_summary',
  'safety.findings',
  'install',
  'install.items',
  'score',
  'score.dimensions',
  'suggestions',
  'source',
  'source.primary_label',
  'source.primary_value'
];

const readPath = (input, pathKey) =>
  pathKey.split('.').reduce((current, part) => (current == null ? undefined : current[part]), input);

export const validateReportShape = (report) => {
  for (const pathKey of requiredPaths) {
    if (readPath(report, pathKey) === undefined) {
      throw new Error(`Missing required field: ${pathKey}`);
    }
  }

  if (!['compact', 'full'].includes(report.translation.mode)) {
    throw new Error('Invalid translation.mode');
  }

  if (!Array.isArray(report.workflow.nodes) || !Array.isArray(report.workflow.edges)) {
    throw new Error('workflow.nodes and workflow.edges must be arrays');
  }

  return report;
};

export const finalizeReport = (draft, overlay = {}) => {
  const merged = deepMerge(draft, overlay);
  return validateReportShape(merged);
};

const main = () => {
  const [, , draftArg, overlayArg, outputArg] = process.argv;
  if (!draftArg || !overlayArg || !outputArg) {
    console.error('Usage: node scripts/finalize-report.mjs <report.draft.json> <report.overlay.json> <report.json>');
    process.exit(1);
  }

  const draftPath = path.resolve(process.cwd(), draftArg);
  const overlayPath = path.resolve(process.cwd(), overlayArg);
  const outputPath = path.resolve(process.cwd(), outputArg);

  const draft = JSON.parse(fs.readFileSync(draftPath, 'utf8'));
  const overlay = JSON.parse(fs.readFileSync(overlayPath, 'utf8'));
  const report = finalizeReport(draft, overlay);

  fs.mkdirSync(path.dirname(outputPath), { recursive: true });
  fs.writeFileSync(outputPath, `${JSON.stringify(report, null, 2)}\n`);
};

if (import.meta.url === new URL(`file://${process.argv[1]}`).href) {
  main();
}
