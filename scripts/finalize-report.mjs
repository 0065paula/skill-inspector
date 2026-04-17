import fs from 'node:fs';
import path from 'node:path';

import { siblingOutputPath } from './output-paths.mjs';

const isPlainObject = (value) =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const PLACEHOLDER_TRANSLATION_RE = /待补充中文翻译|todo|tbd|placeholder/i;
const ENGLISH_LETTER_RE = /[A-Za-z]/;
const CJK_RE = /[\u3400-\u9fff]/;
const PRESERVED_TOKEN_RE = /(`[^`]+`|https?:\/\/\S+|\/?[A-Za-z0-9._~/-]+\.[A-Za-z0-9._-]+|[A-Z0-9_]{2,})/g;
const FAKE_CHINESE_SUFFIX_RE = /（中文|中文）|\(中文\)|（翻译）|\(translation\)$/gi;

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

const normalizeTranslationText = (value) =>
  String(value)
    .replace(FAKE_CHINESE_SUFFIX_RE, ' ')
    .replace(PRESERVED_TOKEN_RE, ' ')
    .replace(/[^\p{L}\p{N}]+/gu, ' ')
    .trim()
    .toLowerCase();

const containsPlaceholderTranslation = (value) => PLACEHOLDER_TRANSLATION_RE.test(String(value));

const isCopiedEnglishProse = (zh, en) => {
  const normalizedZh = normalizeTranslationText(zh);
  const normalizedEn = normalizeTranslationText(en);
  if (!normalizedZh || !normalizedEn) return false;
  if (!ENGLISH_LETTER_RE.test(normalizedZh)) return false;
  return normalizedZh === normalizedEn;
};

const hasEnoughChineseContent = (zh, en) => {
  const zhText = String(zh);
  const enText = String(en);
  const zhCore = normalizeTranslationText(zhText);
  const enCore = normalizeTranslationText(enText);

  if (!zhCore) return false;
  if (!ENGLISH_LETTER_RE.test(enCore)) return true;
  if (CJK_RE.test(zhText)) return true;

  return !isCopiedEnglishProse(zhText, enText);
};

const mergeFullHumanSections = (draftSections, overlaySections) => {
  const merged = draftSections.map((section) => ({ ...section, rows: [...section.rows] }));
  const overlayByTitle = new Map(
    overlaySections.map((section, index) => [section.title_en || `__index_${index}`, section])
  );

  for (let index = 0; index < merged.length; index += 1) {
    const draftSection = merged[index];
    const overlaySection = overlayByTitle.get(draftSection.title_en);
    if (!overlaySection) {
      throw new Error(`Missing translated section: ${draftSection.title_en || `section_${index + 1}`}`);
    }

    const draftRows = Array.isArray(draftSection.rows) ? draftSection.rows : [];
    const overlayRows = Array.isArray(overlaySection.rows) ? overlaySection.rows : [];
    const rows = [];

    for (let rowIndex = 0; rowIndex < draftRows.length; rowIndex += 1) {
      const draftRow = draftRows[rowIndex];
      const overlayRow = overlayRows[rowIndex];
      if (!overlayRow || typeof overlayRow.zh !== 'string' || !overlayRow.zh.trim()) {
        throw new Error(`Missing translated row ${rowIndex + 1} in section: ${draftSection.title_en || `section_${index + 1}`}`);
      }
      if (containsPlaceholderTranslation(overlayRow.zh)) {
        throw new Error(`Placeholder translation in section: ${draftSection.title_en || `section_${index + 1}`}`);
      }
      if (isCopiedEnglishProse(overlayRow.zh, draftRow.en ?? '')) {
        throw new Error(`Untranslated english prose in zh row ${rowIndex + 1} of section: ${draftSection.title_en || `section_${index + 1}`}`);
      }
      if (!hasEnoughChineseContent(overlayRow.zh, draftRow.en ?? '')) {
        throw new Error(`Insufficient Chinese translation in zh row ${rowIndex + 1} of section: ${draftSection.title_en || `section_${index + 1}`}`);
      }
      rows.push({
        zh: overlayRow.zh,
        en: draftRow.en ?? ''
      });
    }

    if (overlayRows.length > draftRows.length) {
      throw new Error(`Extra translated rows in section: ${draftSection.title_en || `section_${index + 1}`}`);
    }

    merged[index] = {
      title_zh: overlaySection.title_zh ?? draftSection.title_zh ?? '',
      title_en: draftSection.title_en || overlaySection.title_en || '',
      rows
    };
  }

  return merged;
};

const mergeTranslation = (draftTranslation = {}, overlayTranslation = {}) => {
  const coverage = overlayTranslation.coverage || 'full_human';

  if (coverage === 'full_human') {
    if (draftTranslation.mode !== 'full') {
      return {
        ...draftTranslation,
        sections: Array.isArray(overlayTranslation.sections) ? overlayTranslation.sections : []
      };
    }

    return {
      ...draftTranslation,
      sections: mergeFullHumanSections(
        Array.isArray(draftTranslation.sections) ? draftTranslation.sections : [],
        Array.isArray(overlayTranslation.sections) ? overlayTranslation.sections : []
      )
    };
  }

  throw new Error(`Unsupported translation.coverage: ${coverage}`);
};

export const validateReportShape = (report) => {
  for (const pathKey of requiredPaths) {
    if (readPath(report, pathKey) === undefined) {
      throw new Error(`Missing required field: ${pathKey}`);
    }
  }

  if (!['compact', 'full', 'summary'].includes(report.translation.mode)) {
    throw new Error('Invalid translation.mode');
  }

  if (report.summary?.purpose === '待补充用途说明。') {
    throw new Error('Fallback summary purpose is not allowed');
  }

  if (!Array.isArray(report.workflow.nodes) || !Array.isArray(report.workflow.edges)) {
    throw new Error('workflow.nodes and workflow.edges must be arrays');
  }

  if (report.translation.mode === 'full') {
    for (const section of report.translation.sections) {
      if (!Array.isArray(section.rows)) {
        throw new Error(`Invalid translation rows in section: ${section.title_en || 'unknown'}`);
      }
      for (const row of section.rows) {
        if (typeof row.zh !== 'string' || !row.zh.trim()) {
          throw new Error(`Missing zh translation in section: ${section.title_en || 'unknown'}`);
        }
        if (containsPlaceholderTranslation(row.zh)) {
          throw new Error(`Placeholder translation in section: ${section.title_en || 'unknown'}`);
        }
        if (typeof row.en !== 'string' || !row.en.trim()) {
          throw new Error(`Missing en source row in section: ${section.title_en || 'unknown'}`);
        }
        if (isCopiedEnglishProse(row.zh, row.en)) {
          throw new Error(`Untranslated english prose in section: ${section.title_en || 'unknown'}`);
        }
        if (!hasEnoughChineseContent(row.zh, row.en)) {
          throw new Error(`Insufficient Chinese translation in section: ${section.title_en || 'unknown'}`);
        }
      }
    }
  }

  return report;
};

export const finalizeReport = (draft, overlay = {}) => {
  const { install: _overlayInstall, ...overlayWithoutInstall } = overlay;
  const merged = deepMerge(draft, {
    ...overlayWithoutInstall,
    translation: mergeTranslation(draft.translation, overlay.translation)
  });
  return validateReportShape(merged);
};

const main = () => {
  const [, , draftArg, overlayArg, outputArg] = process.argv;
  if (!draftArg || !overlayArg) {
    console.error('Usage: node scripts/finalize-report.mjs <report.draft.json> <report.overlay.json> [report.json]');
    process.exit(1);
  }

  const draftPath = path.resolve(process.cwd(), draftArg);
  const overlayPath = path.resolve(process.cwd(), overlayArg);
  const outputPath = outputArg
    ? path.resolve(process.cwd(), outputArg)
    : siblingOutputPath(overlayArg, 'report.json', process.cwd());

  const draft = JSON.parse(fs.readFileSync(draftPath, 'utf8'));
  const overlay = JSON.parse(fs.readFileSync(overlayPath, 'utf8'));
  const report = finalizeReport(draft, overlay);

  fs.mkdirSync(path.dirname(outputPath), { recursive: true });
  fs.writeFileSync(outputPath, `${JSON.stringify(report, null, 2)}\n`);
};

if (import.meta.url === new URL(`file://${process.argv[1]}`).href) {
  main();
}
