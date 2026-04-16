import path from 'node:path';

export const slugifySkillName = (value) =>
  String(value || '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '') || 'unknown-skill';

export const skillNameFromNormalized = (normalized) =>
  slugifySkillName(normalized?.frontmatter?.name || normalized?.title || '');

export const defaultSkillOutputDir = (skillName, cwd = process.cwd()) =>
  path.resolve(cwd, 'skill-inspector', slugifySkillName(skillName));

export const siblingOutputPath = (inputPath, filename, cwd = process.cwd()) =>
  path.join(path.dirname(path.resolve(cwd, inputPath)), filename);
