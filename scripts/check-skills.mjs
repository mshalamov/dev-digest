// scripts/check-skills.mjs
import { existsSync, readFileSync } from 'node:fs';
import { join, dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { contentLines } from './claude-md-lib.mjs';

export const OWN_SKILLS = ['frontend-architecture', 'onion-architecture', 'pr-self-review'];

// The dispatcher routes by surface; every target must exist as a skill folder.
export const ROUTES = {
  frontend: ['frontend-architecture', 'react-best-practices', 'react-testing-library'],
  backend: ['onion-architecture', 'fastify-best-practices', 'drizzle-orm-patterns'],
};

// Content each skill must carry (acceptance rows 3-5 plus the Review Focus cases).
export const REQUIRED_TERMS = {
  'frontend-architecture': ['page.tsx', '_components', 'src/components', 'index.ts', '.test.tsx', 'messages/en'],
  'onion-architecture': ['route', 'service', 'domain', 'adapter', 'container', 'legacy', 'container.runBus'],
  'pr-self-review': [
    'disable-model-invocation: true',
    'git status --porcelain --untracked-files=all',
    'untracked',
    'changed lines',
    'Nothing to review',
    'No routed surface',
    'CRITICAL',
    'Unrouted (not reviewed)',
    'does not inherit',
  ],
};

const MAX_LINES = 500;

function frontmatter(raw) {
  const md = raw.replace(/\r\n/g, '\n'); // Windows checkouts may have CRLF
  const m = md.match(/^---\n([\s\S]*?)\n---/);
  if (!m) return null;
  const get = (key) => m[1].match(new RegExp(`^\\s*${key}:\\s*"?([^"\\n]+?)"?\\s*$`, 'm'))?.[1] ?? null;
  return { name: get('name'), description: get('description'), version: get('version') };
}

export function checkSkills(repoRoot) {
  const v = [];
  const dir = join(repoRoot, '.claude', 'skills');
  const catalog = existsSync(join(dir, 'README.md')) ? readFileSync(join(dir, 'README.md'), 'utf8') : '';

  for (const name of OWN_SKILLS) {
    const file = join(dir, name, 'SKILL.md');
    if (!existsSync(file)) {
      v.push(`${name}: SKILL.md missing`);
      continue;
    }
    const md = readFileSync(file, 'utf8');
    const fm = frontmatter(md);
    if (!fm) {
      v.push(`${name}: frontmatter missing`);
      continue;
    }
    if (fm.name !== name) v.push(`${name}: frontmatter name "${fm.name}" does not match the folder`);
    if (!fm.description?.startsWith('Use when')) v.push(`${name}: description must start with "Use when"`);
    else if (fm.description.length > 1024) v.push(`${name}: description > 1024 chars`);
    if (!/^\d+\.\d+\.\d+$/.test(fm.version ?? '')) v.push(`${name}: metadata version (semver) missing`);
    const n = contentLines(md);
    if (n > MAX_LINES) v.push(`${name}: ${n} lines > ${MAX_LINES}`);
    if (!catalog.includes(`](${name}/SKILL.md)`)) v.push(`README.md: catalog has no row for ${name}`);
    for (const term of REQUIRED_TERMS[name] ?? []) {
      if (!md.includes(term)) v.push(`${name}: missing required term "${term}"`);
    }
    if (name === 'pr-self-review') {
      for (const target of [...ROUTES.frontend, ...ROUTES.backend]) {
        if (!md.includes(target)) v.push(`${name}: does not route to ${target}`);
        if (!existsSync(join(dir, target, 'SKILL.md'))) v.push(`${name}: routes to ${target}, which does not exist`);
      }
    }
  }
  return v;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
  const v = checkSkills(repoRoot);
  if (v.length) { console.error(v.join('\n') + `\n\n${v.length} violation(s)`); process.exit(1); }
  console.log('Own skills OK');
}
