// scripts/check-claude-md.mjs
import { existsSync, lstatSync, readFileSync, readlinkSync } from 'node:fs';
import { join, dirname, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { MODULES, findGuides, relativeLinks, contentLines } from './claude-md-lib.mjs';

const ROOT_FILE_BUDGET = 45;
const MODULE_BUDGET = 60;
const REQUIRED_LINKS = ['README.md', 'docs/README.md', 'specs/README.md', 'INSIGHTS.md'];
const READ_WHEN = /\bread\b[^\n]*\b(when|before)\b/i;
const READ_WHEN_MSG = 'has no "Read ... when/before ..." pointer';
const PAIR_MSG = 'must be a symlink to AGENTS.md or contain only "@AGENTS.md"';

// AGENTS.md is canonical; CLAUDE.md is a compatibility alias for Claude Code.
function pairViolation(dir, label) {
  const claude = join(dir, 'CLAUDE.md');
  let st;
  try {
    st = lstatSync(claude);
  } catch {
    return `${label}CLAUDE.md: missing`;
  }
  if (st.isSymbolicLink()) {
    return readlinkSync(claude) === 'AGENTS.md'
      ? null
      : `${label}CLAUDE.md: symlink must point to AGENTS.md`;
  }
  return readFileSync(claude, 'utf8').trim() === '@AGENTS.md' ? null : `${label}CLAUDE.md: ${PAIR_MSG}`;
}

export function check(repoRoot) {
  const v = [];
  const rel = (p) => relative(repoRoot, p);
  const checkLinks = (file, md) => {
    for (const l of relativeLinks(md)) {
      if (!existsSync(resolve(dirname(file), l))) v.push(`${rel(file)}: broken link ${l}`);
    }
  };
  // Verifies the AGENTS.md / CLAUDE.md pair in `dir`; returns AGENTS.md content or null.
  const readGuide = (dir, label) => {
    const pair = pairViolation(dir, label);
    if (pair) v.push(pair);
    const agents = join(dir, 'AGENTS.md');
    if (!existsSync(agents)) {
      v.push(`${label}AGENTS.md: missing`);
      return null;
    }
    const md = readFileSync(agents, 'utf8');
    checkLinks(agents, md);
    return md;
  };

  const rootMd = readGuide(repoRoot, '');
  if (rootMd !== null) {
    for (const m of MODULES) {
      if (!rootMd.includes(`${m}/AGENTS.md`)) v.push(`AGENTS.md: does not link ${m}/AGENTS.md`);
    }
    if (!READ_WHEN.test(rootMd)) v.push(`AGENTS.md: ${READ_WHEN_MSG}`);
    const n = contentLines(rootMd);
    if (n > ROOT_FILE_BUDGET) v.push(`AGENTS.md: ${n} lines > ${ROOT_FILE_BUDGET}`);
  }

  const allowed = new Set(
    ['AGENTS.md', 'CLAUDE.md'].flatMap((f) => [join(repoRoot, f), ...MODULES.map((m) => join(repoRoot, m, f))]),
  );

  for (const m of MODULES) {
    const modDir = join(repoRoot, m);
    for (const f of ['README.md', 'INSIGHTS.md', 'docs/README.md', 'specs/README.md']) {
      const p = join(modDir, f);
      if (!existsSync(p)) v.push(`${m}/${f}: missing`);
      else checkLinks(p, readFileSync(p, 'utf8'));
    }

    const md = readGuide(modDir, `${m}/`);
    if (md !== null) {
      const links = new Set(relativeLinks(md));
      for (const need of REQUIRED_LINKS) {
        if (!links.has(need)) v.push(`${m}/AGENTS.md: does not link ${need}`);
      }
      if (!READ_WHEN.test(md)) v.push(`${m}/AGENTS.md: ${READ_WHEN_MSG}`);
      const n = contentLines(md);
      if (n > MODULE_BUDGET) v.push(`${m}/AGENTS.md: ${n} lines > ${MODULE_BUDGET}`);
    }

    for (const f of findGuides(modDir)) {
      if (!allowed.has(f)) {
        v.push(`${rel(f)}: stray guide (only the repo root and module roots may have AGENTS.md / CLAUDE.md)`);
      }
    }
  }
  return v;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
  const v = check(repoRoot);
  if (v.length) { console.error(v.join('\n') + `\n\n${v.length} violation(s)`); process.exit(1); }
  console.log('AGENTS.md structure OK');
}
