import fs from 'node:fs';
import path from 'node:path';

const GITHUB_BLOB_RE =
  /^https:\/\/github\.com\/([^/]+)\/([^/]+)\/blob\/([^/]+)\/(.+)$/;
const GITLAB_BLOB_RE =
  /^(https?:\/\/[^/]+\/.+)\/-\/blob\/([^/]+)\/(.+)$/;

export const rewriteGitHubBlobToRaw = (input) => {
  const match = String(input).match(GITHUB_BLOB_RE);
  if (!match) return input;

  const [, owner, repo, branch, filePath] = match;
  return `https://raw.githubusercontent.com/${owner}/${repo}/${branch}/${filePath}`;
};

export const rewriteGitLabBlobToRaw = (input) => {
  const match = String(input).match(GITLAB_BLOB_RE);
  if (!match) return input;

  const [, projectRoot, branch, filePath] = match;
  return `${projectRoot}/-/raw/${branch}/${filePath}`;
};

const isLikelyHtml = (text) => /^\s*<!doctype html|^\s*<html[\s>]/i.test(text);

const looksLikeUrl = (input) => /^https?:\/\//i.test(String(input));

const escapeRegExp = (value) => String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

const findLineNumber = (lines, snippet) => {
  const exactIndex = lines.findIndex((line) => line.includes(snippet));
  if (exactIndex >= 0) return exactIndex + 1;
  return null;
};

const uniqueByTarget = (items) => {
  const seen = new Set();
  return items.filter((item) => {
    if (seen.has(item.target)) return false;
    seen.add(item.target);
    return true;
  });
};

const slugify = (value) =>
  String(value)
    .toLowerCase()
    .replace(/^\d+\.\s*/, '')
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '') || 'section';

const cleanSectionLabel = (value) => String(value).replace(/^\d+\.\s*/, '').trim();
const isStepSection = (value) => /^step\s+\d+:/i.test(cleanSectionLabel(value));

const toTitleLabel = (value) =>
  cleanSectionLabel(value)
    .split(/\s+/)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');

const compactWorkflowLabel = (value) => {
  const clean = String(value)
    .replace(/^\d+\.\s*/, '')
    .replace(/^step\s+\d+:\s*/i, '')
    .replace(/\b(a|an|the)\b/gi, ' ')
    .replace(/\b(new|existing)\b/gi, ' ')
    .replace(/\btwo\b/gi, '')
    .replace(/\s+/g, ' ')
    .trim();

  return clean.charAt(0).toUpperCase() + clean.slice(1).toLowerCase();
};

const inferReferenceCondition = (target) => {
  const value = String(target);
  if (/examples/i.test(value)) return 'Need examples';
  if (/spec|schema|jsoncanvas/i.test(value)) return 'Need authoritative rules';
  return null;
};

const compactReferenceLabel = (target) => {
  const value = String(target);
  if (/jsoncanvas\.org\/spec\/1\.0/i.test(value)) return 'JSON Canvas Spec 1.0';
  if (value.startsWith('http')) {
    try {
      const url = new URL(value);
      const tail = url.pathname.split('/').filter(Boolean).pop();
      return tail || url.hostname;
    } catch {
      return value;
    }
  }
  return value;
};

const referenceNodeLabel = (ref) => {
  if (ref.condition === 'Need examples') return 'references/EXAMPLES.md';
  if (ref.condition === 'Need authoritative rules') return compactReferenceLabel(ref.target);
  return ref.target;
};

const referenceNodeId = (ref) => {
  if (ref.condition === 'Need examples') return 'examples';
  if (ref.condition === 'Need authoritative rules') return 'spec';
  return slugify(ref.target);
};

const shouldKeepFileReference = (target) => {
  const value = String(target);
  if (looksLikeUrl(value)) return false;
  if (/\s/.test(value)) return false;
  if (value.startsWith('<') || value.startsWith('</')) return false;
  if (/[<>]/.test(value)) return false;
  return true;
};

const shouldKeepUrlReference = (target, evidence) => {
  const value = String(target);
  if (/[<>]/.test(value)) return false;
  if (/<[^>]+>/.test(String(evidence))) return false;
  return true;
};

const buildLinearWorkflowGraph = (workflowSteps) => ({
  nodes: workflowSteps.map((step, index) => ({
    id: `step_${index + 1}`,
    label: step.text
  })),
  edges: workflowSteps.slice(0, -1).map((step, index) => ({
    from: `step_${index + 1}`,
    to: `step_${index + 2}`
  })),
  caption: '按 workflow steps 生成的线性流程草稿，适合继续补充分支、校验点和引用触发条件。'
});

const buildGroupedWorkflowGraph = (workflowSections, references) => {
  const nodes = [
    { id: 'input', label: 'Receive task' },
    { id: 'parse', label: 'Read and normalize source' },
    { id: 'branch', label: 'Select workflow', kind: 'decision' }
  ];
  const edges = [
    { from: 'input', to: 'parse' },
    { from: 'parse', to: 'branch' }
  ];

  for (const section of workflowSections) {
    const id = slugify(section.label);
    const label = compactWorkflowLabel(section.label);
    nodes.push({ id, label });
    edges.push({ from: 'branch', to: id, label });
  }

  const conditionalReferenceNodes = new Map();
  for (const ref of references.filter((item) => item.condition)) {
    const id = referenceNodeId(ref);
    if (!conditionalReferenceNodes.has(id)) {
      conditionalReferenceNodes.set(id, {
        id,
        label: referenceNodeLabel(ref),
        kind: 'reference'
      });
      edges.push({ from: 'parse', to: id, label: ref.condition });
    }
  }

  nodes.push(...conditionalReferenceNodes.values());

  nodes.push({ id: 'validate', label: 'Validate output' });
  nodes.push({ id: 'write', label: 'Write updated output', kind: 'terminal' });

  for (const section of workflowSections) {
    edges.push({ from: slugify(section.label), to: 'validate' });
  }

  for (const id of conditionalReferenceNodes.keys()) {
    edges.push({ from: id, to: 'validate' });
  }

  return {
    nodes,
    edges: [...edges, { from: 'validate', to: 'write' }],
    caption: '按 workflow 子节生成的高层流程图，优先展示主路径、条件引用和共享校验节点。'
  };
};

const buildSerialWorkflowGraph = (workflowSections, references) => {
  const nodes = [{ id: 'input', label: 'Receive task' }];
  const edges = [];
  const conditionalReferenceNodes = new Map();

  workflowSections.forEach((section, index) => {
    const id = `step_${index + 1}`;
    const label = compactWorkflowLabel(section.label);
    const node = { id, label };
    if (index === workflowSections.length - 1) node.kind = 'terminal';
    nodes.push(node);
    edges.push({
      from: index === 0 ? 'input' : `step_${index}`,
      to: id
    });
  });

  for (const ref of references.filter((item) => item.condition)) {
    const ownerIndex = workflowSections.findIndex(
      (section) => itemLineNumber(ref) >= section.line && itemLineNumber(ref) <= section.endLine
    );
    if (ownerIndex < 0) continue;

    const id = referenceNodeId(ref);
    if (!conditionalReferenceNodes.has(id)) {
      conditionalReferenceNodes.set(id, {
        id,
        label: referenceNodeLabel(ref),
        kind: 'reference'
      });
    }

    edges.push({
      from: `step_${ownerIndex + 1}`,
      to: id,
      label: ref.condition
    });
  }

  nodes.push(...conditionalReferenceNodes.values());

  return {
    nodes,
    edges,
    caption: '按 Step 子节生成的串行流程图，条件引用从对应步骤侧挂出。'
  };
};

const itemLineNumber = (item) => item.lineNumber ?? item.line ?? -1;

const buildReferenceSeeds = (fileReferences, urlReferences) => [
  ...fileReferences.map((item) => ({
    target: item.target,
    kind: 'file',
    condition: inferReferenceCondition(item.target),
    line: `L${item.line}: ${item.evidence}`,
    evidence: item.evidence,
    lineNumber: item.line
  })),
  ...urlReferences.map((item) => ({
    target: item.target,
    kind: 'url',
    condition: inferReferenceCondition(item.target),
    line: `L${item.line}: ${item.evidence}`,
    evidence: item.evidence,
    lineNumber: item.line
  }))
];

const extractFrontmatter = (markdown) => {
  const match = markdown.match(/^---\n([\s\S]*?)\n---\n?/);
  if (!match) return { frontmatter: {}, body: markdown };

  const frontmatter = {};
  for (const rawLine of match[1].split('\n')) {
    const line = rawLine.trim();
    if (!line || line.startsWith('#')) continue;
    const pair = line.match(/^([A-Za-z0-9_-]+):\s*(.*)$/);
    if (!pair) continue;
    const [, key, value] = pair;
    frontmatter[key] = value.replace(/^['"]|['"]$/g, '');
  }

  return {
    frontmatter,
    body: markdown.slice(match[0].length)
  };
};

const extractHeadings = (lines) =>
  lines
    .map((line, index) => {
      const match = line.match(/^(#{1,6})\s+(.+)$/);
      if (!match) return null;
      return {
        level: match[1].length,
        text: match[2].trim(),
        line: index + 1
      };
    })
    .filter(Boolean);

const extractCommands = (lines) => {
  const commands = [];
  let inFence = false;
  let language = '';
  let startLine = 0;
  let buffer = [];

  lines.forEach((line, index) => {
    const fence = line.match(/^```([A-Za-z0-9_-]*)\s*$/);
    if (fence) {
      if (!inFence) {
        inFence = true;
        language = fence[1] || 'plain';
        startLine = index + 1;
        buffer = [];
      } else {
        commands.push({
          language,
          code: buffer.join('\n'),
          line: startLine
        });
        inFence = false;
        language = '';
        startLine = 0;
        buffer = [];
      }
      return;
    }

    if (inFence) buffer.push(line);
  });

  return commands;
};

const extractWorkflowSteps = (lines, headings) => {
  const workflowHeadings = headings.filter((item) => item.level > 1 && /workflow/i.test(item.text));
  if (workflowHeadings.length === 0) return [];

  const steps = [];

  for (const heading of workflowHeadings) {
    const startIndex = heading.line;
    const nextHeading = headings.find((item) => item.line > heading.line && item.level <= heading.level);
    const endIndex = nextHeading ? nextHeading.line - 1 : lines.length;

    for (let index = startIndex; index < endIndex; index += 1) {
      const line = lines[index];
      const bullet = line.match(/^\s*(?:[-*]|\d+\.)\s+(.+)$/);
      if (!bullet) continue;
      steps.push({
        section: heading.text,
        text: bullet[1].trim(),
        line: index + 1
      });
    }
  }

  return steps;
};

const extractTranslationSections = (lines, headings) => {
  const sections = [];

  for (const heading of headings.filter((item) => item.level >= 2)) {
    const endLine =
      headings.find((item) => item.line > heading.line && item.level <= heading.level)?.line - 1 || lines.length;
    const rows = [];
    let inFence = false;

    for (let index = heading.line; index < endLine; index += 1) {
      const line = lines[index];
      if (/^```/.test(line.trim())) {
        inFence = !inFence;
        continue;
      }
      if (inFence) continue;
      if (!line.trim()) continue;
      if (/^\|(?:[-:\s|]+)\|?$/.test(line.trim())) continue;

      const cleaned = line
        .replace(/^\s*(?:[-*]|\d+\.)\s+/, '')
        .trim();

      if (!cleaned) continue;

      rows.push({
        zh: '',
        en: cleaned
      });
    }

    sections.push({
      title_zh: '',
      title_en: heading.text,
      rows
    });
  }

  return sections;
};

const extractWorkflowSections = (lines, headings) => {
  const workflowParents = headings.filter((item) => item.level > 1 && /workflow/i.test(item.text));
  const sections = [];

  for (const parent of workflowParents) {
    const parentEnd =
      headings.find((item) => item.line > parent.line && item.level <= parent.level)?.line - 1 || lines.length;
    const children = headings.filter(
      (item) =>
        item.line > parent.line &&
        item.line <= parentEnd &&
        item.level === parent.level + 1
    );

    for (const child of children) {
      const childEnd =
        headings.find(
          (item) =>
            item.line > child.line &&
            item.line <= parentEnd &&
            item.level <= child.level
        )?.line - 1 || parentEnd;
      const steps = [];

      for (let index = child.line; index < childEnd; index += 1) {
        const line = lines[index];
        const bullet = line.match(/^\s*(?:[-*]|\d+\.)\s+(.+)$/);
        if (!bullet) continue;
        steps.push({
          text: bullet[1].trim(),
          line: index + 1
        });
      }

      if (steps.length > 0) {
        sections.push({
          parent: parent.text,
          label: cleanSectionLabel(child.text),
          line: child.line,
          endLine: childEnd,
          steps
        });
      }
    }
  }

  return sections;
};

const extractFileReferences = (lines) => {
  const matches = [];
  const mdLinkRe = /\[[^\]]+\]\((?!https?:\/\/)([^)]+)\)/g;
  const codePathRe = /`([A-Za-z0-9._~/-]*\/[A-Za-z0-9._~/-]+)`/g;
  const codeFileRe = /`([A-Za-z0-9._-]+\.(?:md|json|html|py|mjs|js|sh))`/g;

  lines.forEach((line, index) => {
    for (const match of line.matchAll(mdLinkRe)) {
      if (!shouldKeepFileReference(match[1])) continue;
      matches.push({ target: match[1], line: index + 1, evidence: line.trim() });
    }
    for (const match of line.matchAll(codePathRe)) {
      if (!shouldKeepFileReference(match[1])) continue;
      matches.push({ target: match[1], line: index + 1, evidence: line.trim() });
    }
    for (const match of line.matchAll(codeFileRe)) {
      if (!shouldKeepFileReference(match[1])) continue;
      matches.push({ target: match[1], line: index + 1, evidence: line.trim() });
    }
  });

  return uniqueByTarget(matches);
};

const extractUrlReferences = (lines) => {
  const matches = [];
  const mdUrlLinkRe = /\[[^\]]+\]\((https?:\/\/[^)\s]+)\)/g;

  lines.forEach((line, index) => {
    for (const match of line.matchAll(mdUrlLinkRe)) {
      if (!shouldKeepUrlReference(match[1], line)) continue;
      matches.push({ target: match[1], line: index + 1, evidence: line.trim() });
    }
  });

  return uniqueByTarget(matches);
};

export const normalizeSkillMarkdown = (markdown, source = {}) => {
  const { frontmatter, body } = extractFrontmatter(markdown);
  const lines = markdown.split('\n');
  const headings = extractHeadings(lines);
  const commands = extractCommands(lines);
  const workflowSteps = extractWorkflowSteps(lines, headings);
  const workflowSections = extractWorkflowSections(lines, headings);
  const translationSections = extractTranslationSections(lines, headings);
  const fileReferences = extractFileReferences(lines);
  const urlReferences = extractUrlReferences(lines);
  const referenceSeeds = buildReferenceSeeds(fileReferences, urlReferences);
  const workflowGraph =
    workflowSections.length >= 2
      ? workflowSections.every((section) => isStepSection(section.label))
        ? buildSerialWorkflowGraph(workflowSections, referenceSeeds)
        : buildGroupedWorkflowGraph(workflowSections, referenceSeeds)
      : buildLinearWorkflowGraph(workflowSteps);
  const title = headings[0]?.text || frontmatter.name || 'Untitled Skill';
  const purpose = frontmatter.description || title;
  const reportSource =
    source.originalSource && looksLikeUrl(source.originalSource)
      ? {
          primary_label: '原始链接',
          primary_value: source.originalSource
        }
      : {
          primary_label: '原始路径',
          primary_value: source.originalSource || source.resolvedSource || 'unknown'
        };

  return {
    source: {
      original: source.originalSource || null,
      resolved: source.resolvedSource || source.originalSource || null
    },
    title,
    frontmatter,
    headings,
    commands,
    fileReferences,
    urlReferences,
    workflowSteps,
    workflowSections,
    reportSeeds: {
      summary: {
        title,
        purpose
      },
      workflow: {
        ...workflowGraph
      },
      references: referenceSeeds,
      translation: {
        mode: 'full',
        sections: translationSections
      },
      source: reportSource
    }
  };
};

export const readRemoteSkillSource = async (input, options = {}) => {
  const fetchImpl = options.fetchImpl || globalThis.fetch;
  if (typeof fetchImpl !== 'function') {
    throw new Error('fetch is unavailable in the current runtime');
  }

  const rawUrl = rewriteGitLabBlobToRaw(rewriteGitHubBlobToRaw(input));
  const candidates =
    rawUrl !== input
      ? [
          { url: rawUrl, strategy: 'raw-candidate' },
          { url: input, strategy: 'page-fallback' }
        ]
      : [{ url: input, strategy: 'direct-url' }];

  for (const candidate of candidates) {
    const response = await fetchImpl(candidate.url);
    if (!response.ok) continue;
    const text = await response.text();
    if (!text.trim()) continue;
    if (candidate.strategy === 'raw-candidate' && isLikelyHtml(text)) continue;

    return {
      text,
      resolvedUrl: candidate.url,
      strategy: candidate.strategy
    };
  }

  throw new Error(`Unable to read remote skill source: ${input}`);
};

const readLocalSkillSource = (input) => ({
  text: fs.readFileSync(input, 'utf8'),
  resolvedPath: path.resolve(process.cwd(), input),
  strategy: 'local-file'
});

const main = async () => {
  const [, , inputArg, outputArg] = process.argv;
  if (!inputArg || !outputArg) {
    console.error('Usage: node scripts/normalize-skill.mjs <input> <output.json>');
    process.exit(1);
  }

  const source = looksLikeUrl(inputArg)
    ? await readRemoteSkillSource(inputArg)
    : readLocalSkillSource(inputArg);

  const normalized = normalizeSkillMarkdown(source.text, {
    originalSource: inputArg,
    resolvedSource: source.resolvedUrl || source.resolvedPath
  });

  fs.mkdirSync(path.dirname(path.resolve(process.cwd(), outputArg)), { recursive: true });
  fs.writeFileSync(path.resolve(process.cwd(), outputArg), `${JSON.stringify(normalized, null, 2)}\n`);
};

if (import.meta.url === new URL(`file://${process.argv[1]}`).href) {
  await main();
}
