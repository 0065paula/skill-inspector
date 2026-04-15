import fs from 'node:fs';
import path from 'node:path';

export const buildReportOverlayTemplate = (draft) => ({
  summary: {
    score_total: draft.summary?.score_total ?? 0,
    risk_level: draft.summary?.risk_level ?? '待评估'
  },
  workflow: {
    caption: '待补充 workflow 图说明。',
    nodes: [],
    edges: []
  },
  translation: {
    coverage: 'full',
    sections: []
  },
  safety: {
    level_code: draft.safety?.level_code ?? 'medium',
    level_label: draft.safety?.level_label ?? '待评估',
    level_summary: draft.safety?.level_summary ?? '待补充安全边界和风险判断。',
    findings: []
  },
  install: {
    items: []
  },
  score: {
    dimensions: []
  },
  suggestions: []
});

const main = () => {
  const [, , draftArg, outputArg] = process.argv;
  if (!draftArg || !outputArg) {
    console.error('Usage: node scripts/build-report-overlay-template.mjs <report.draft.json> <report.overlay.template.json>');
    process.exit(1);
  }

  const draftPath = path.resolve(process.cwd(), draftArg);
  const outputPath = path.resolve(process.cwd(), outputArg);
  const draft = JSON.parse(fs.readFileSync(draftPath, 'utf8'));
  const overlay = buildReportOverlayTemplate(draft);

  fs.mkdirSync(path.dirname(outputPath), { recursive: true });
  fs.writeFileSync(outputPath, `${JSON.stringify(overlay, null, 2)}\n`);
};

if (import.meta.url === new URL(`file://${process.argv[1]}`).href) {
  main();
}
