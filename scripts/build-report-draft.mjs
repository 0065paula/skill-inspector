import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const referenceSummary = (ref) => {
  const target = String(ref.target || '');

  if (target.startsWith('agents/')) {
    return 'Agent 说明文件，定义特定子任务的执行方式。';
  }
  if (target.startsWith('references/')) {
    return '参考文档文件，用于补充规范、模式或数据结构说明。';
  }
  if (target.startsWith('assets/')) {
    return '界面模板文件，用于生成或展示评审页面。';
  }
  if (target.startsWith('eval-viewer/') || target.startsWith('scripts/') || /\.(py|mjs|js|sh)$/i.test(target)) {
    return '脚本文件，用于执行自动化步骤或生成结果。';
  }
  if (target.startsWith('evals/')) {
    return '评测定义文件，用于保存测试用例或断言数据。';
  }
  if (target.startsWith('/')) {
    if (target.split('/').filter(Boolean).length === 1) {
      return 'Slash command 名称，用于说明某个命令应避免或应触发。';
    }
    return '临时或用户目录路径，用于 staging、下载或可写副本。';
  }
  if (target.startsWith('out/')) {
    return '输出结果路径，用于保存生成后的报告或中间产物。';
  }
  if (target.endsWith('/outputs/')) {
    return '运行结果目录，用于保存某类配置下的输出文件。';
  }
  if (target.startsWith('/tmp/') || target.startsWith('~/')) {
    return '临时或用户目录路径，用于 staging、下载或可写副本。';
  }
  if (ref.kind === 'file') {
    return '本地文档文件，用于补充执行时需要读取的内容。';
  }
  if (ref.kind === 'url') {
    return '外部链接，用于补充执行时需要访问的在线内容。';
  }
  return '外部资源，用于补充执行时的依赖信息。';
};

const compactReferenceLine = (ref) => {
  const line = String(ref.line || '');
  const match = line.match(/^L(\d+):/);
  if (!match) return line;
  return `L${match[1]}`;
};

export const buildInstallItems = (skillName, options = {}) => {
  const homeDir = options.homeDir || os.homedir();
  const codexBase = options.codexBase || path.join(homeDir, '.codex', 'skills');
  const agentsBase = options.agentsBase || path.join(homeDir, '.agents', 'skills');
  const existsSync = options.existsSync || fs.existsSync;

  if (!skillName) {
    return [
      { platform: 'Codex', status: '未知', note: codexBase },
      { platform: 'Agents', status: '未知', note: agentsBase }
    ];
  }

  const codexPath = path.join(codexBase, skillName);
  const agentsPath = path.join(agentsBase, skillName);

  return [
    {
      platform: 'Codex',
      status: existsSync(codexPath) ? '已安装' : '未安装',
      note: codexPath
    },
    {
      platform: 'Agents',
      status: existsSync(agentsPath) ? '已安装' : '未安装',
      note: agentsPath
    }
  ];
};

export const buildReportDraft = (normalized) => {
  const seeds = normalized.reportSeeds || {};
  const summarySeed = seeds.summary || {};
  const workflowSeed = seeds.workflow || {};
  const translationSeed = seeds.translation || {};
  const sourceSeed = seeds.source || {};
  const referencesSeed = Array.isArray(seeds.references) ? seeds.references : [];
  const skillName = normalized.frontmatter?.name || normalized.title || '';

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
      sections: Array.isArray(translationSeed.sections) ? translationSeed.sections : []
    },
    references: referencesSeed.map((ref) => ({
      target: ref.target,
      kind: ref.kind,
      summary: referenceSummary(ref),
      condition: ref.condition ?? null,
      line: compactReferenceLine(ref)
    })),
    safety: {
      level_code: 'medium',
      level_label: '待评估',
      level_summary: '待补充安全边界和风险判断。',
      findings: []
    },
    install: {
      items: buildInstallItems(skillName)
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
