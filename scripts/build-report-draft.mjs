import fs from 'node:fs';
import path from 'node:path';

const referenceSummary = (ref) => {
  if (ref.kind === 'file') return '源 skill 中引用的本地文件。';
  if (ref.kind === 'url') return '源 skill 中引用的外部链接。';
  return '源 skill 中引用的外部资源。';
};

export const buildReportDraft = (normalized) => {
  const seeds = normalized.reportSeeds || {};
  const summarySeed = seeds.summary || {};
  const workflowSeed = seeds.workflow || {};
  const translationSeed = seeds.translation || {};
  const sourceSeed = seeds.source || {};
  const referencesSeed = Array.isArray(seeds.references) ? seeds.references : [];

  return {
    summary: {
      title: summarySeed.title || normalized.title || 'Untitled Skill',
      purpose: summarySeed.purpose || normalized.frontmatter?.description || '待补充用途说明。',
      score_total: 0,
      risk_level: '待评估'
    },
    workflow: {
      caption:
        workflowSeed.caption || '待补充执行逻辑说明。',
      nodes: Array.isArray(workflowSeed.nodes) ? workflowSeed.nodes : [],
      edges: Array.isArray(workflowSeed.edges) ? workflowSeed.edges : []
    },
    translation: {
      mode: translationSeed.mode || 'full',
      sections: []
    },
    references: referencesSeed.map((ref) => ({
      target: ref.target,
      kind: ref.kind,
      summary: referenceSummary(ref),
      condition: ref.condition ?? null,
      line: ref.line
    })),
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
      primary_label: sourceSeed.primary_label || '原始来源',
      primary_value:
        sourceSeed.primary_value ||
        normalized.source?.original ||
        normalized.source?.resolved ||
        'unknown'
    }
  };
};

const main = () => {
  const [, , inputArg, outputArg] = process.argv;
  if (!inputArg || !outputArg) {
    console.error('Usage: node scripts/build-report-draft.mjs <normalized-source.json> <report.draft.json>');
    process.exit(1);
  }

  const inputPath = path.resolve(process.cwd(), inputArg);
  const outputPath = path.resolve(process.cwd(), outputArg);
  const normalized = JSON.parse(fs.readFileSync(inputPath, 'utf8'));
  const draft = buildReportDraft(normalized);

  fs.mkdirSync(path.dirname(outputPath), { recursive: true });
  fs.writeFileSync(outputPath, `${JSON.stringify(draft, null, 2)}\n`);
};

if (import.meta.url === new URL(`file://${process.argv[1]}`).href) {
  main();
}
