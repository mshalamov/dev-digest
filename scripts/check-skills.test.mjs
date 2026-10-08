// scripts/check-skills.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { OWN_SKILLS, ROUTES, REQUIRED_TERMS, checkSkills } from './check-skills.mjs';

const ROUTED = [...ROUTES.frontend, ...ROUTES.backend];

function skillMd(name, { version = '1.0.0', desc = 'Use when testing.', body = '' } = {}) {
  const terms = (REQUIRED_TERMS[name] ?? []).join(' ');
  return `---\nname: ${name}\ndescription: ${desc}\nmetadata:\n  version: "${version}"\n---\n\n# ${name}\n${terms}\n${body}\n`;
}

function fixture() {
  const root = mkdtempSync(join(tmpdir(), 'skills-'));
  const dir = join(root, '.claude', 'skills');
  const names = new Set([...OWN_SKILLS, ...ROUTED]);
  for (const n of names) {
    mkdirSync(join(dir, n), { recursive: true });
    const body = n === 'pr-self-review' ? ROUTED.join(' ') : '';
    writeFileSync(join(dir, n, 'SKILL.md'), skillMd(n, { body }));
  }
  const rows = OWN_SKILLS.map((n) => `| [${n}](${n}/SKILL.md) | x | y |`).join('\n');
  writeFileSync(join(dir, 'README.md'), `# Skills\n${rows}\n`);
  return root;
}

test('a complete fixture has no violations', () => {
  assert.deepEqual(checkSkills(fixture()), []);
});

test('reports a missing own skill', () => {
  const root = fixture();
  rmSync(join(root, '.claude/skills/onion-architecture/SKILL.md'));
  assert.ok(checkSkills(root).includes('onion-architecture: SKILL.md missing'));
});

test('reports a skill without frontmatter', () => {
  const root = fixture();
  writeFileSync(join(root, '.claude/skills/onion-architecture/SKILL.md'), '# no frontmatter\n');
  assert.ok(checkSkills(root).includes('onion-architecture: frontmatter missing'));
});

test('accepts a SKILL.md with CRLF line endings', () => {
  const root = fixture();
  const file = join(root, '.claude/skills/onion-architecture/SKILL.md');
  writeFileSync(file, skillMd('onion-architecture').replace(/\n/g, '\r\n'));
  assert.deepEqual(checkSkills(root), []);
});

test('reports a name that does not match the folder', () => {
  const root = fixture();
  writeFileSync(
    join(root, '.claude/skills/onion-architecture/SKILL.md'),
    skillMd('onion', { body: '' }),
  );
  assert.ok(checkSkills(root).some((x) => x.includes('onion-architecture') && x.includes('name')));
});

test('reports a description that is not a "Use when" trigger', () => {
  const root = fixture();
  writeFileSync(
    join(root, '.claude/skills/frontend-architecture/SKILL.md'),
    skillMd('frontend-architecture', { desc: 'Frontend stuff.' }),
  );
  assert.ok(checkSkills(root).some((x) => x.includes('frontend-architecture') && x.includes('Use when')));
});

test('reports a missing version', () => {
  const root = fixture();
  writeFileSync(
    join(root, '.claude/skills/frontend-architecture/SKILL.md'),
    '---\nname: frontend-architecture\ndescription: Use when x.\n---\n' +
      REQUIRED_TERMS['frontend-architecture'].join(' '),
  );
  assert.ok(checkSkills(root).some((x) => x.includes('frontend-architecture') && x.includes('version')));
});

test('reports a skill over 500 lines', () => {
  const root = fixture();
  writeFileSync(
    join(root, '.claude/skills/onion-architecture/SKILL.md'),
    skillMd('onion-architecture', { body: 'x\n'.repeat(500) }),
  );
  assert.ok(checkSkills(root).some((x) => x.includes('onion-architecture') && x.includes('> 500')));
});

test('reports a skill missing from the README catalog', () => {
  const root = fixture();
  writeFileSync(join(root, '.claude/skills/README.md'), '# Skills\n');
  assert.ok(checkSkills(root).some((x) => x.includes('README.md') && x.includes('pr-self-review')));
});

test('reports a missing required term', () => {
  const root = fixture();
  writeFileSync(
    join(root, '.claude/skills/onion-architecture/SKILL.md'),
    skillMd('onion-architecture').replace('legacy', ''),
  );
  assert.ok(checkSkills(root).some((x) => x.includes('onion-architecture') && x.includes('"legacy"')));
});

test('reports a dispatcher route to a skill folder that does not exist', () => {
  const root = fixture();
  rmSync(join(root, '.claude/skills/react-testing-library'), { recursive: true });
  assert.ok(checkSkills(root).some((x) => x.includes('routes to react-testing-library')));
});

test('reports a dispatcher that no longer names a routed skill', () => {
  const root = fixture();
  writeFileSync(
    join(root, '.claude/skills/pr-self-review/SKILL.md'),
    skillMd('pr-self-review', { body: '' }),
  );
  assert.ok(checkSkills(root).some((x) => x.includes('pr-self-review') && x.includes('drizzle-orm-patterns')));
});
