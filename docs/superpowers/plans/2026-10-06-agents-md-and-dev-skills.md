# AGENTS.md Migration and Own Dev Skills Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make `AGENTS.md` the canonical agent guide (root + `server`, `client`, `reviewer-core`, `e2e`) with `CLAUDE.md` symlinks, and add three project skills: `frontend-architecture`, `onion-architecture`, `pr-self-review`.

**Architecture:** Step 1 is a rename plus symlink, guarded by the existing `scripts/check-claude-md.mjs`, which is extended so the migration cannot silently regress. Step 2 adds three `SKILL.md` files under `.claude/skills/`, guarded by a new small checker `scripts/check-skills.mjs` (frontmatter, version, catalog row, required terms, dispatcher routing integrity). The two architecture skills are Instruction skills encoding what the repo already does; `pr-self-review` is a Workflow skill that routes the uncommitted diff to the right skill set.

**Tech Stack:** Markdown skills, Node >= 22 ESM scripts (`node:test`, `node:assert`), git symlinks. No new dependencies.

**Spec:** `docs/labs/lab_2/task1/agents_md_migration.md` (Step 1) and `docs/labs/lab_2/task1/own_dev_skills.md` (Step 2). Grading: `docs/labs/lab_2/hw2-acceptance-criteria.md` rows 1-5 and 21.

## Global Constraints

- Rename `CLAUDE.md` to `AGENTS.md` and put a symlink `CLAUDE.md` → `AGENTS.md` next to it. (spec Step 1)
- Applies to nested files too: `server`, `client`, `reviewer-core` (and `e2e`, which has one). (spec Step 1; acceptance #2)
- Alternative without a symlink: `CLAUDE.md` containing the single line `@AGENTS.md` (Windows without admin rights). The checker accepts both forms. (spec Step 1)
- Skills live at `.claude/skills/frontend-architecture/SKILL.md`, `.claude/skills/onion-architecture/SKILL.md`, `.claude/skills/pr-self-review/SKILL.md`. (acceptance #3-5)
- Do not duplicate the imported skills (fastify, drizzle, next, typescript, RTL); write only what they do not cover. (spec Step 2)
- `pr-self-review` routing: client → frontend-architecture + react-best-practices + react-testing-library; backend → onion-architecture + fastify-best-practices + drizzle-orm-patterns. A diff touching both loads both sets. (spec Step 2; acceptance #21)
- `pr-self-review` is invoked manually only; no git hook. (acceptance #21)
- Never hand-edit lock files, including `skills-lock.json` (own skills are not in it, like `engineering-insights`). `server/src/db/migrations/` is untouched. (root CLAUDE.md)
- No linter or formatter exists; do not add one. Finish with `node scripts/check-claude-md.mjs`, `node scripts/check-skills.mjs` and both `node --test scripts/*.test.mjs`. (root CLAUDE.md)
- Before writing the architecture skills read `server/INSIGHTS.md` and `client/INSIGHTS.md`; treat entries as high-confidence. (root CLAUDE.md)
- `AGENTS.md` budgets from the checker still hold: root <= 45 content lines, module <= 60. (`scripts/check-claude-md.mjs`)

## Review Focus

Failure modes the spec implies but the happy path does not exercise, most likely first. Each has a test in the task that owns the code.

1. **`CLAUDE.md` is later replaced by a regular copy** (editor save, Windows checkout without `core.symlinks`), so two diverging guides exist. The checker must flag a regular file that is not exactly `@AGENTS.md`, and a symlink with the wrong target. Tests: Task 1.
2. **Dangling or missing pair**: `AGENTS.md` deleted but `CLAUDE.md` left, or `CLAUDE.md` deleted. Both reported. Tests: Task 1.
3. **Mixed diff and untracked files**: a diff touching `client/` and `server/` loads both full skill sets (all six skills, none dropped), and every file inside a brand-new untracked folder counts as part of the diff (`--untracked-files=all`). Tests: Task 5 (required terms) plus the manual dry run.
4. **Empty or unrouted diff**: no changes says "Nothing to review", and a diff that only touches `docs/`, `e2e/` or `reviewer-core/` says "No routed surface" instead of reporting a false PASS. Tests: Task 5.
5. **Legacy code in a touched file**: `pulls`, `polling` and `settings` routes already call `container.github()` or `db` directly. The onion skill must forbid copying that pattern without telling a reviewer to flag untouched lines. Tests: Task 4 (required term `legacy`), Task 5 (required term `changed lines`).

---

### Task 1: Migrate guides to AGENTS.md, guarded by the checker

**Files:**
- Modify: `scripts/claude-md-lib.mjs`
- Modify: `scripts/check-claude-md.mjs`
- Modify: `scripts/check-claude-md.test.mjs`
- Rename: `CLAUDE.md`, `server/CLAUDE.md`, `client/CLAUDE.md`, `reviewer-core/CLAUDE.md`, `e2e/CLAUDE.md` → `AGENTS.md` (git mv), then create symlinks `CLAUDE.md` → `AGENTS.md` in the same five directories
- Modify: `AGENTS.md` (root; link targets and prose), `TESTING.md:76,99,102`

**Interfaces:**
- Consumes: nothing.
- Produces: `findGuides(dir): string[]` in `scripts/claude-md-lib.mjs` (replaces `findClaudeMd`; matches both `AGENTS.md` and `CLAUDE.md`); `check(repoRoot): string[]` unchanged signature. The repo invariant: every guide dir has a real `AGENTS.md` and a `CLAUDE.md` that is a symlink to `AGENTS.md` or contains only `@AGENTS.md`.

- [ ] **Step 1: Write the failing tests**

Replace the whole of `scripts/check-claude-md.test.mjs` with:

```js
// scripts/check-claude-md.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  mkdtempSync, mkdirSync, writeFileSync, rmSync, symlinkSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { isExcluded, relativeLinks, contentLines } from './claude-md-lib.mjs';
import { check } from './check-claude-md.mjs';

const MODULES = ['server', 'client', 'reviewer-core', 'e2e'];
const MODULE_MD =
  '# m\nRead [r](README.md) when starting.\n[d](docs/README.md)\n[s](specs/README.md)\n[i](INSIGHTS.md)\n';
const ROOT_LINKS = MODULES.map((m) => `[${m}](${m}/AGENTS.md)`).join('\n') + '\n';
const ROOT_MD = ROOT_LINKS + 'Read the module guides when working in that module.\n';

/** Writes AGENTS.md and the CLAUDE.md → AGENTS.md symlink next to it. */
function writeGuide(dir, content) {
  writeFileSync(join(dir, 'AGENTS.md'), content);
  rmSync(join(dir, 'CLAUDE.md'), { force: true });
  symlinkSync('AGENTS.md', join(dir, 'CLAUDE.md'));
}

function fixture() {
  const root = mkdtempSync(join(tmpdir(), 'cmd-'));
  writeGuide(root, ROOT_MD);
  for (const m of MODULES) {
    mkdirSync(join(root, m, 'src', 'a'), { recursive: true });
    mkdirSync(join(root, m, 'docs'));
    mkdirSync(join(root, m, 'specs'));
    writeFileSync(join(root, m, 'README.md'), '# r\n');
    writeFileSync(join(root, m, 'docs', 'README.md'), '# d\n');
    writeFileSync(join(root, m, 'specs', 'README.md'), '# s\n');
    writeFileSync(join(root, m, 'INSIGHTS.md'), '# i\n');
    writeGuide(join(root, m), MODULE_MD);
  }
  return root;
}

test('isExcluded skips build and dot dirs', () => {
  for (const n of ['node_modules', 'dist', '.next', 'clones', 'coverage', '.git']) {
    assert.equal(isExcluded(n), true, n);
  }
  assert.equal(isExcluded('modules'), false);
});

test('relativeLinks keeps relative targets only, strips anchors', () => {
  const md = '[a](../README.md#x) [b](https://x.io) [c](docs/) [d](mailto:a@b.c)';
  assert.deepEqual(relativeLinks(md), ['../README.md', 'docs/']);
});

test('contentLines ignores blanks', () => {
  assert.equal(contentLines('a\n\n\nb\n'), 2);
});

test('a complete fixture has no violations', () => {
  assert.deepEqual(check(fixture()), []);
});

test('reports a root AGENTS.md that does not link the module guides', () => {
  const root = fixture();
  writeGuide(root, '');
  const v = check(root);
  assert.ok(v.some((x) => x.includes('does not link server/AGENTS.md')), v.join('\n'));
});

test('reports a missing root AGENTS.md', () => {
  const root = fixture();
  rmSync(join(root, 'AGENTS.md'));
  assert.ok(check(root).some((x) => x === 'AGENTS.md: missing'));
});

test('reports a module without AGENTS.md', () => {
  const root = fixture();
  rmSync(join(root, 'client', 'AGENTS.md'));
  assert.ok(check(root).some((x) => x === 'client/AGENTS.md: missing'));
});

test('reports a module without the CLAUDE.md pair', () => {
  const root = fixture();
  rmSync(join(root, 'client', 'CLAUDE.md'));
  assert.ok(check(root).some((x) => x === 'client/CLAUDE.md: missing'));
});

test('accepts a CLAUDE.md that only imports @AGENTS.md', () => {
  const root = fixture();
  rmSync(join(root, 'server', 'CLAUDE.md'));
  writeFileSync(join(root, 'server', 'CLAUDE.md'), '@AGENTS.md\n');
  assert.deepEqual(check(root), []);
});

test('reports a CLAUDE.md that is a diverging regular copy', () => {
  const root = fixture();
  rmSync(join(root, 'server', 'CLAUDE.md'));
  writeFileSync(join(root, 'server', 'CLAUDE.md'), MODULE_MD);
  const v = check(root);
  assert.ok(v.some((x) => x.startsWith('server/CLAUDE.md') && x.includes('symlink')), v.join('\n'));
});

test('reports a CLAUDE.md symlink pointing elsewhere', () => {
  const root = fixture();
  writeFileSync(join(root, 'server', 'OTHER.md'), '# other\n');
  rmSync(join(root, 'server', 'CLAUDE.md'));
  symlinkSync('OTHER.md', join(root, 'server', 'CLAUDE.md'));
  const v = check(root);
  assert.ok(v.some((x) => x.startsWith('server/CLAUDE.md') && x.includes('AGENTS.md')), v.join('\n'));
});

test('reports a dangling CLAUDE.md when AGENTS.md is gone', () => {
  const root = fixture();
  rmSync(join(root, 'e2e', 'AGENTS.md'));
  const v = check(root);
  assert.ok(v.includes('e2e/AGENTS.md: missing'), v.join('\n'));
});

test('reports a broken link', () => {
  const root = fixture();
  writeGuide(join(root, 'server'), MODULE_MD + '[x](nope.md)\n');
  assert.ok(check(root).some((x) => x.includes('broken link') && x.includes('nope.md')));
});

test('reports a module guide missing a required link', () => {
  const root = fixture();
  writeGuide(
    join(root, 'server'),
    '# m\nRead [r](README.md) when starting.\n[d](docs/README.md)\n[s](specs/README.md)\n',
  );
  assert.ok(check(root).some((x) => x.includes('server/AGENTS.md') && x.includes('INSIGHTS.md')));
});

test('reports a module guide over the line budget', () => {
  const root = fixture();
  writeGuide(join(root, 'server'), MODULE_MD + 'x\n'.repeat(60));
  assert.ok(check(root).some((x) => x.includes('server/AGENTS.md') && x.includes('> 60')));
});

test('reports a root guide over the line budget', () => {
  const root = fixture();
  writeGuide(root, ROOT_MD + 'x\n'.repeat(45));
  assert.ok(check(root).some((x) => x.startsWith('AGENTS.md') && x.includes('> 45')));
});

test('reports a root guide with no Read pointer', () => {
  const root = fixture();
  writeGuide(root, ROOT_LINKS);
  assert.ok(check(root).some((x) => x.startsWith('AGENTS.md') && x.includes('Read')));
});

test('reports a module guide with no Read pointer', () => {
  const root = fixture();
  writeGuide(
    join(root, 'server'),
    '# m\n[r](README.md)\n[d](docs/README.md)\n[s](specs/README.md)\n[i](INSIGHTS.md)\n',
  );
  assert.ok(check(root).some((x) => x.includes('server/AGENTS.md') && x.includes('Read')));
});

test('reports an AGENTS.md in a subfolder', () => {
  const root = fixture();
  writeFileSync(join(root, 'server', 'src', 'a', 'AGENTS.md'), '# stray\n');
  assert.ok(check(root).some((x) => x.includes('server/src/a/AGENTS.md') && x.includes('stray')));
});

test('reports a CLAUDE.md in a subfolder', () => {
  const root = fixture();
  writeFileSync(join(root, 'server', 'src', 'a', 'CLAUDE.md'), '# stray\n');
  assert.ok(check(root).some((x) => x.includes('server/src/a/CLAUDE.md') && x.includes('stray')));
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `node --test scripts/check-claude-md.test.mjs`
Expected: FAIL (the checker still reads `CLAUDE.md`, so e.g. "does not link server/AGENTS.md" and "AGENTS.md: missing" assertions fail).

- [ ] **Step 3: Implement the library change**

In `scripts/claude-md-lib.mjs` replace `findClaudeMd` with:

```js
const GUIDE_NAMES = new Set(['AGENTS.md', 'CLAUDE.md']);

export function findGuides(dir) {
  const out = [];
  const walk = (d) => {
    for (const e of readdirSync(d, { withFileTypes: true })) {
      if (e.isDirectory()) {
        if (!isExcluded(e.name)) walk(join(d, e.name));
      } else if (GUIDE_NAMES.has(e.name)) {
        out.push(join(d, e.name));
      }
    }
  };
  walk(dir);
  return out.sort();
}
```

(A symlink to a file is reported by `readdirSync` as a non-directory entry, so `CLAUDE.md` symlinks are found too.)

- [ ] **Step 4: Implement the checker change**

Replace the whole of `scripts/check-claude-md.mjs` with:

```js
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
```

Note the stray message must still contain the word `stray` (tests assert it).

- [ ] **Step 5: Run the tests to verify they pass**

Run: `node --test scripts/check-claude-md.test.mjs`
Expected: PASS, all tests green.

- [ ] **Step 6: Perform the rename and create the symlinks**

```bash
cd /home/ubuntu/Projects/dev-digest
for d in . server client reviewer-core e2e; do
  git mv "$d/CLAUDE.md" "$d/AGENTS.md"
  ln -s AGENTS.md "$d/CLAUDE.md"
done
ls -la CLAUDE.md */CLAUDE.md
```

Expected: five lines like `CLAUDE.md -> AGENTS.md`.

- [ ] **Step 7: Point the guides at AGENTS.md**

In root `AGENTS.md`:
- Table rows (lines 7-10): change each link to `[server/AGENTS.md](server/AGENTS.md)`, `[client/AGENTS.md](client/AGENTS.md)`, `[reviewer-core/AGENTS.md](reviewer-core/AGENTS.md)`, `[e2e/AGENTS.md](e2e/AGENTS.md)`.
- Line 13: `see each module's CLAUDE.md` → `see each module's AGENTS.md`.
- Line 27: `(see its CLAUDE.md)` → `(see its AGENTS.md)`.
- Line 30: `see [server/CLAUDE.md](server/CLAUDE.md)` → `see [server/AGENTS.md](server/AGENTS.md)`.
- Line 34: ``Read `<module>/CLAUDE.md` before editing that module.`` → ``Read `<module>/AGENTS.md` before editing that module.``
- Under `## Do not touch`, add one bullet: ``- `CLAUDE.md` in the repo root and each module root is a symlink to `AGENTS.md` (Claude Code compatibility). Edit `AGENTS.md`; on Windows without symlink rights use a `CLAUDE.md` containing only `@AGENTS.md`.``

In `TESTING.md`:
- Line 76: `# repo-level: CLAUDE.md structure check (CLAUDE.md only at the repo root and module roots)` → `# repo-level: AGENTS.md structure check (AGENTS.md and its CLAUDE.md symlink only at the repo root and module roots)`.
- Line 99: `- **CLAUDE.md files** exist only at the repo root and the four module roots` → `- **AGENTS.md files** (each with a \`CLAUDE.md\` symlink to it) exist only at the repo root and the four module roots`.
- Line 102: `CLAUDE.md in the same change` → `AGENTS.md in the same change`.

- [ ] **Step 8: Verify against the real repo**

Run: `node scripts/check-claude-md.mjs && node --test scripts/check-claude-md.test.mjs`
Expected: `AGENTS.md structure OK`, all tests pass.

After `git add` of the ten guide paths, `git status --short -- '*AGENTS.md' '*CLAUDE.md'` shows, per directory, `A  <dir>/AGENTS.md` and `T  <dir>/CLAUDE.md` (a typechange: same path, regular file → symlink). It does **not** show `R`, because `CLAUDE.md` still exists in the index; this is expected. History still follows: after the commit, `git log --follow --oneline AGENTS.md | head -3` lists the earlier `CLAUDE.md` commits.

Also confirm git stores the symlink: `git ls-files -s CLAUDE.md` Expected: mode `120000`.

- [ ] **Step 9: Commit**

```bash
git add AGENTS.md CLAUDE.md server/AGENTS.md server/CLAUDE.md client/AGENTS.md client/CLAUDE.md \
  reviewer-core/AGENTS.md reviewer-core/CLAUDE.md e2e/AGENTS.md e2e/CLAUDE.md \
  TESTING.md scripts/claude-md-lib.mjs scripts/check-claude-md.mjs scripts/check-claude-md.test.mjs
git commit -m "chore(docs): make AGENTS.md canonical, keep CLAUDE.md as symlink"
```

---

### Task 2: Skills checker (`scripts/check-skills.mjs`)

**Files:**
- Create: `scripts/check-skills.mjs`
- Test: `scripts/check-skills.test.mjs`

**Interfaces:**
- Consumes: nothing.
- Produces: `OWN_SKILLS: string[]`, `ROUTES: Record<'frontend' | 'backend', string[]>`, `checkSkills(repoRoot): string[]` (violation strings; empty means OK). Tasks 3-5 make the real repo pass it.

- [ ] **Step 1: Write the failing test**

Create `scripts/check-skills.test.mjs`:

```js
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
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `node --test scripts/check-skills.test.mjs`
Expected: FAIL with `Cannot find module './check-skills.mjs'` (ERR_MODULE_NOT_FOUND).

- [ ] **Step 3: Write the implementation**

Create `scripts/check-skills.mjs`:

```js
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
  'onion-architecture': ['route', 'service', 'domain', 'adapter', 'container', 'legacy'],
  'pr-self-review': [
    'git status --porcelain --untracked-files=all',
    'untracked',
    'changed lines',
    'Nothing to review',
    'No routed surface',
    'CRITICAL',
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
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `node --test scripts/check-skills.test.mjs`
Expected: PASS.

- [ ] **Step 5: Run the checker on the real repo (expected to fail until Tasks 3-5)**

Run: `node scripts/check-skills.mjs`
Expected: exit 1, violations for all three own skills (`SKILL.md missing`). Nothing about the six imported skills.

- [ ] **Step 6: Document and commit**

In `TESTING.md` under the "repo-level" block of "Running locally", after the `check-claude-md` line add:

```sh
node scripts/check-skills.mjs               # own skills (frontend-architecture, onion-architecture, pr-self-review)
node --test scripts/*.test.mjs              # tests of both checkers
```

```bash
git add scripts/check-skills.mjs scripts/check-skills.test.mjs TESTING.md
git commit -m "test(skills): add a checker for the project's own skills"
```

---

### Task 3: `frontend-architecture` skill

**Files:**
- Create: `.claude/skills/frontend-architecture/SKILL.md`
- Modify: `.claude/skills/README.md` (catalog row)

**Interfaces:**
- Consumes: `REQUIRED_TERMS['frontend-architecture']` from Task 2.
- Produces: skill name `frontend-architecture`, used by Task 5's routing table.

- [ ] **Step 1: Read module memory**

Read `client/INSIGHTS.md` and `client/AGENTS.md`. If an INSIGHTS entry contradicts a rule below, follow the entry and adjust the rule.

- [ ] **Step 2: Confirm the checker fails for this skill**

Run: `node scripts/check-skills.mjs 2>&1 | grep frontend-architecture`
Expected: `frontend-architecture: SKILL.md missing`.

- [ ] **Step 3: Write the skill**

Create `.claude/skills/frontend-architecture/SKILL.md`:

````markdown
---
name: frontend-architecture
description: Use when adding, moving or reviewing client code in client/src — pages, route components, shared components, hooks, constants, strings or tests — to decide where it lives and how it is named.
metadata:
  version: "1.0.0"
---

# Frontend Architecture (client)

Where things go in `client/` (Next.js 15 App Router). This skill covers placement and naming only. For React patterns use `react-best-practices`; for test writing use `react-testing-library`; for Next.js APIs use `next-best-practices`.

## Placement

| What | Where |
|---|---|
| A route | `src/app/<route>/page.tsx`; dynamic segments as `[repoId]`, `[id]`, `[number]` |
| A component used by one route | `src/app/<route>/_components/<Name>/` |
| A component used inside another component only | `<Name>/_components/<Inner>/` (nest, same shape) |
| A component used by sibling or nested routes of one segment | `_components/<Name>/` of their nearest common segment (e.g. `src/app/agents/_components/AgentCard` serves `/agents` and `/agents/[id]`) |
| A component used by unrelated route trees | `src/components/<kebab-name>/` |
| A TanStack Query hook | `src/lib/hooks/<area>.ts` (kebab file per area), exported from `src/lib/hooks/index.ts` |
| HTTP calls | `src/lib/api.ts` only; hooks call it, components never `fetch` |
| User-visible strings | `messages/en/<feature>.json` through next-intl |
| Providers, theme, helpers used app-wide | `src/lib/` |
| Test setup | `src/test/setup.ts` |
| Vendored `@devdigest/shared`, `@devdigest/ui` | `src/vendor/` — never edit |

## Component folder shape

```
_components/PRRow/
  PRRow.tsx          the component
  index.ts           re-export: export { PRRow } from "./PRRow";
  PRRow.test.tsx     colocated test (Vitest + Testing Library)
  constants.ts       static values, option lists, ids (optional)
  helpers.ts         pure functions with no React (optional)
  styles.ts          style objects (optional)
  _components/       private children (optional)
```

- Folder and component file are PascalCase: `PRRow/PRRow.tsx`. Shared folders under `src/components/` are kebab-case (`app-shell`, `run-cost-badge`).
- Hooks are `useXxx.ts`. Import a component through its folder (`../_components/PRRow`), not its file.
- Create `constants.ts`, `helpers.ts`, `styles.ts` only when there is content for them.

## Rules

1. **Pages are thin.** `page.tsx` reads params, composes `_components`, and wires hooks. Feature logic, markup beyond layout, and state live in `_components/<Name>/`.
2. **Hoist to the nearest common owner.** A route may import from `_components` of its own segment or an ancestor segment (`agents/[id]/page.tsx` → `../_components/AgentCard` is correct). When a component is needed by a route outside that subtree, move it to `src/components/<kebab-name>/`; never import from a sibling tree's `_components`.
3. **Logic leaves JSX.** Pure computation and formatting go to `helpers.ts` (or `format.ts` in a shared component) and are unit-tested without rendering. Data fetching goes to a hook, not an effect in a component.
4. **Constants are not inline.** Repeated or configurable literals go to the component's `constants.ts`.
5. **Strings are translated.** No hard-coded user-visible text in new code; add keys to `messages/en/<feature>.json`.
6. **Tests live next to the component** as `<Name>.test.tsx`; `fetch` is mocked, no API or DB. Hook and helper tests sit next to their file.
7. **No barrel sprawl.** One `index.ts` per component folder; no catch-all barrels in `src/components`.

## Good

```
src/app/repos/[repoId]/pulls/[number]/
  page.tsx                                   # composes, no feature logic
  _components/VerdictBanner/
    VerdictBanner.tsx
    VerdictBanner.test.tsx
    index.ts
src/components/run-cost-badge/               # used by PR list and PR detail
  RunCostBadge.tsx  format.ts  index.ts  RunCostBadge.test.tsx
```

## Bad

```
src/app/repos/[repoId]/pulls/page.tsx         # 400 lines of JSX, fetch() and formatting inline
src/app/agents/page.tsx imports ../repos/[repoId]/pulls/_components/PRRow   # import from an unrelated tree: move it to src/components
src/components/RunCostBadge.tsx               # PascalCase file with no folder, no index.ts, no test
```

## Existing code that breaks these rules

Some older pages (for example `src/app/agents/[id]/page.tsx`) hold layout, inline styles and literal strings. Do not copy that style, and do not refactor it as a side effect of an unrelated change. When you must touch such a file, put new logic in a colocated `_components/<Name>/`.
````

- [ ] **Step 4: Add the catalog row**

In `.claude/skills/README.md`, add after the `react-testing-library` row:

```markdown
| [frontend-architecture](frontend-architecture/SKILL.md) | Frontend | Where client code lives: app-router pages, colocated `_components`, shared components, naming, tests |
```

- [ ] **Step 5: Verify**

Run: `node scripts/check-skills.mjs 2>&1 | grep frontend-architecture; echo "exit=$?"`
Expected: no output from grep (`exit=1`), meaning no violations for this skill (the other two skills still report).

- [ ] **Step 6: Commit**

```bash
git add .claude/skills/frontend-architecture .claude/skills/README.md
git commit -m "feat(skills): add the frontend-architecture skill"
```

---

### Task 4: `onion-architecture` skill

**Files:**
- Create: `.claude/skills/onion-architecture/SKILL.md`
- Modify: `.claude/skills/README.md` (catalog row)

**Interfaces:**
- Consumes: `REQUIRED_TERMS['onion-architecture']` from Task 2.
- Produces: skill name `onion-architecture`, used by Task 5's routing table.

- [ ] **Step 1: Read module memory**

Read `server/INSIGHTS.md` and `server/AGENTS.md`. Re-check the cited files still exist: `server/src/platform/container.ts`, `server/src/modules/_shared/context.ts`, `server/src/modules/reviews/{routes,service,repository,helpers,diff-loader,run-executor}.ts`, `server/src/adapters/depgraph/index.ts`, `server/src/adapters/llm/pricing.ts`. The "Good" example quotes `reviews/routes.ts`, `diff-loader.ts` and `run-executor.ts`; confirm `loadDiff(this.container, this.repo, workspaceId, pull, repo)`, `this.repo.insertReview` and `this.repo.markReviewed` still exist with those signatures (`grep -n "loadDiff\|insertReview\|markReviewed" server/src/modules/reviews/*.ts`).

- [ ] **Step 2: Confirm the checker fails for this skill**

Run: `node scripts/check-skills.mjs 2>&1 | grep onion-architecture`
Expected: `onion-architecture: SKILL.md missing`.

- [ ] **Step 3: Write the skill**

Create `.claude/skills/onion-architecture/SKILL.md`:

````markdown
---
name: onion-architecture
description: Use when adding or reviewing server code in server/src — a route, service, repository, domain logic or an integration with git, GitHub, an LLM, the code index or secrets — to keep layers separate and dependencies pointing inward.
metadata:
  version: "1.0.0"
---

# Onion Architecture (server)

Layers for `server/` (Fastify 5, Drizzle, Zod). This skill covers layering only. For Fastify mechanics use `fastify-best-practices`; for Drizzle queries and schema use `drizzle-orm-patterns`.

## Layers (outside → inside)

| Layer | Lives in | Job | May import |
|---|---|---|---|
| route | `src/modules/<name>/routes.ts` | HTTP edge: parse params/body with Zod contracts from `@devdigest/shared`, call `getContext`, call **service methods only** (no orchestration, no branching on I/O results), shape the response | service, `_shared`, shared contracts, `platform/errors` |
| service | `src/modules/<name>/service.ts` (+ `run-executor.ts`, `findings.ts` style helpers) | Orchestrates a use case; owns transactions and the order of steps | domain, repositories, interfaces from `@devdigest/shared`, the `Container` |
| domain | pure functions: `helpers.ts`, `constants.ts`, `src/platform/grounding.ts`, `reviewer-core` (note: `src/adapters/llm/pricing.ts` is pure price math that sits under `adapters/` for historical reasons; treat it as domain, do not add I/O to it) | Business rules; no I/O, no clock/random unless passed in | other domain code and types only |
| repository | `src/modules/<name>/repository.ts`, `repository/*.repo.ts` | The only code that runs Drizzle queries | `src/db/*`, row types |
| adapter | `src/adapters/<name>/` | Implements an interface (`GitClient`, `GitHubClient`, `SecretsProvider`, `LLMProvider`, `CodeIndex`, `Embedder`) against a real system | the third-party SDK, interface types |
| container | `src/platform/container.ts` | Composition root: builds adapters and repositories lazily, accepts `ContainerOverrides` for tests | everything (it is the only place that does) |

## Dependency rule

Imports point inward only: route → service → domain, and service → repository / interface. Domain imports nothing from Fastify, `src/db`, `src/adapters` or `process.env`. Adapters and repositories depend on interfaces and row types, never on a route or service.

## Rules

1. **A route never calls an adapter or `db` directly.** `container.github()`, `container.git`, `container.secrets`, `container.llm()`, `container.codeIndex` and `import * as t from '../../db/schema.js'` do not appear in `routes.ts`. Put the call in a service method and call that. The one sanctioned exception is `getContext(container, req)` from `_shared/context.ts`: it reads `container.auth` to resolve tenancy and every route must call it.
2. **Adapters are reached through the container,** by interface type. Never `new OctokitGitHubClient(...)` or `import { SimpleGitClient }` in a service. Tests substitute `Mock*` classes from `src/adapters/mocks.ts` via `ContainerOverrides`.
3. **A new integration is an interface plus an adapter.** Reuse an interface that `@devdigest/shared` already exports (`GitClient`, `GitHubClient`, `LLMProvider`, …) when one fits; `src/vendor/shared` is vendored, so never add to it here (see `server/AGENTS.md`). Otherwise follow the `depgraph` / `tokenizer` pattern: export the interface type and its implementation from `src/adapters/<name>/index.ts` (as `DepGraph` + `DepCruiseGraph` do). Then add a lazy getter and an override slot in `container.ts`, and add a `Mock*` double.
4. **Decisions are domain functions.** Scoring, ranking, grounding, price math and formatting are pure and unit-tested without a container or database.
5. **Repositories return rows or plain data,** never Fastify types; services map rows to DTOs.
6. **Routes stay declarative.** Validation is the Zod schema in the route options. Errors are thrown as `AppError` subclasses from `platform/errors.ts` (`NotFoundError`, `ConfigError`, …), never sent with a hand-built error body. Setting a success status (`reply.status(201)`, `reply.code(202)`) is fine.
7. **Modules do not import each other's internals.** Shared entities are exposed as container repositories (`container.agentsRepo`, `container.reviewRepo`).

## Good

```ts
// reviews/routes.ts — edge only: context, parse, service calls, response shape
app.post('/pulls/:id/review', { schema: { params: IdParams } }, async (req) => {
  const { workspaceId } = await getContext(container, req);
  const body = RunRequest.parse(req.body ?? {});
  const targets = await service.resolveTargets(workspaceId, body);
  const { runs, reviews } = await service.runReview(workspaceId, req.params.id, targets, req.log);
  return { pr_id: req.params.id, runs, reviews };
});

// reviews/diff-loader.ts — the adapter is reached through the container, by interface
const diff = await container.git.diff({ owner: repoRow.owner, name: repoRow.name }, pull.base, pull.headSha);

// reviews/run-executor.ts — service-side orchestration; the repository does the SQL
diff = await loadDiff(this.container, this.repo, workspaceId, pull, repo);
const review = await this.repo.insertReview({ /* … */ });
await this.repo.markReviewed(pull.id, pull.headSha);
```

## Bad

```ts
// routes.ts
import * as t from '../../db/schema.js';                       // SQL in the edge layer
const gh = await container.github();                           // adapter called from a route
const pr = await gh.getPull(owner, repo, n);
await db.insert(t.pulls).values(map(pr));                      // orchestration + persistence in a route

// service.ts
import { OctokitGitHubClient } from '../../adapters/github/octokit.js';
const gh = new OctokitGitHubClient(token);                     // bypasses the container; untestable
```

## Legacy code

`pulls/routes.ts`, `polling/routes.ts` and `settings/routes.ts` already call `container.github()`, `container.secrets` and `db` directly. That is legacy. Do not copy the pattern into new code, do not widen it, and do not refactor it as a side effect of an unrelated change. When you add or change a handler in such a file, put the new logic in a service method and have the route call that. A review flags only lines that the diff adds or changes.
````

- [ ] **Step 4: Add the catalog row**

In `.claude/skills/README.md`, add after the `postgresql-table-design` row:

```markdown
| [onion-architecture](onion-architecture/SKILL.md) | Backend | Layers route → service → domain via the container; adapters at the edge; dependencies point inward |
```

- [ ] **Step 5: Verify**

Run: `node scripts/check-skills.mjs 2>&1 | grep onion-architecture; echo "exit=$?"`
Expected: no grep output (`exit=1`).

Spot-check claims against the code: `grep -n "container\.github()" server/src/modules/*/routes.ts | wc -l` should be non-zero (the "Legacy code" paragraph stays true).

- [ ] **Step 6: Commit**

```bash
git add .claude/skills/onion-architecture .claude/skills/README.md
git commit -m "feat(skills): add the onion-architecture skill"
```

---

### Task 5: `pr-self-review` dispatcher skill

**Files:**
- Create: `.claude/skills/pr-self-review/SKILL.md`
- Modify: `.claude/skills/README.md` (catalog row)

**Interfaces:**
- Consumes: skills `frontend-architecture` (Task 3), `onion-architecture` (Task 4), and the imported `react-best-practices`, `react-testing-library`, `fastify-best-practices`, `drizzle-orm-patterns`.
- Produces: a Workflow skill invoked manually (`/pr-self-review`); output is a findings list plus a verdict.

- [ ] **Step 1: Confirm the checker fails for this skill**

Run: `node scripts/check-skills.mjs 2>&1 | grep pr-self-review`
Expected: `pr-self-review: SKILL.md missing`.

- [ ] **Step 2: Write the skill**

Create `.claude/skills/pr-self-review/SKILL.md`:

````markdown
---
name: pr-self-review
description: Use when your changes are about to be marked ready for review, or when asked to self-review local changes — runs the uncommitted diff through a second pass and routes it to the architecture and best-practice skills for each surface it touches.
metadata:
  version: "1.0.0"
---

# PR Self-Review (dispatcher)

A second, fresh-eyes pass over **local uncommitted changes** before they are called ready. It does not review by itself: it detects which surfaces changed and applies the matching skills. Invoke it manually; there is no git hook.

## 1. Collect the diff

```bash
git status --porcelain --untracked-files=all
git diff HEAD
```

`--untracked-files=all` lists every file inside a new folder (plain `--porcelain` collapses it to `?? dir/`, which hides new `_components/<Name>/` and skill folders). `git diff HEAD` omits untracked files: for every `??` line, read the file and treat it as an all-added diff. Staged and unstaged edits are both in `git diff HEAD`.

If `git status --porcelain --untracked-files=all` prints nothing, stop with: `Nothing to review.` Do not print a verdict.

## 2. Route by surface

Classify each changed path by prefix. One diff can hit several surfaces; load **every** matching set, together.

| Changed path | Surface | Skills to load and apply |
|---|---|---|
| `client/**` | client | `frontend-architecture` + `react-best-practices` + `react-testing-library` |
| `server/**` | backend | `onion-architecture` + `fastify-best-practices` + `drizzle-orm-patterns` |
| anything else (`reviewer-core/`, `e2e/`, `docs/`, `scripts/`, root files) | none | no skill set |

A surface always loads its **whole** set: any `server/**` change loads all three backend skills, any `client/**` change loads all three client skills. Never drop a skill from a set because the diff looks unrelated to it.

**How to load a skill:** invoke it with the Skill tool when your harness has one; otherwise (Cursor, Codex and other `AGENTS.md` readers, or a subagent without the tool) read `.claude/skills/<name>/SKILL.md` in full, plus any file it says to read for the rules you apply.

State the routing before reviewing, for example: `Surfaces: client, backend → frontend-architecture, react-best-practices, react-testing-library, onion-architecture, fastify-best-practices, drizzle-orm-patterns.`

If the diff touches only the "none" row, report `No routed surface: <paths>` and review nothing further. Do not report a clean pass.

## 3. Second pass

Run this as a separate pass from the work that produced the diff. Use a fresh subagent when one is available and give it the diff plus the loaded skills; otherwise re-read the diff top to bottom as a reviewer, not as the author. Read each loaded skill fully before judging.

Review the **changed lines only**. Code a touched file already had (see "Legacy code" in `onion-architecture`) is not a finding unless the diff adds to the pattern. Every finding must cite `path:line` of a line in the diff and name the skill rule it breaks.

## 4. Report

One line per finding, grouped by severity:

- **CRITICAL** — breaks a layering or placement rule of an architecture skill (adapter or `db` call in a route, import from an unrelated route tree's `_components`, vendored code edited, an existing migration in `server/src/db/migrations/` modified or deleted), or introduces a defect. Blocks "ready". A **new** migration file is expected when the same diff changes `server/src/db/schema*` (it comes from `pnpm db:generate`); a new migration without a schema change is MAJOR (likely hand-written).
- **MAJOR** — violates a best-practice rule with real cost (missing test for new logic, untranslated user-visible string, effect used for data fetching).
- **MINOR** — naming, folder shape, small cleanups.

End with a verdict line:

- Any CRITICAL → `VERDICT: BLOCK — fix the CRITICAL findings, then run this skill again.`
- Otherwise → `VERDICT: PASS` followed by the MAJOR count.

Do not fix anything unless the user asks. Do not push, commit or open a PR.
````

- [ ] **Step 3: Add the catalog row**

In `.claude/skills/README.md`, add after the `engineering-insights` row:

```markdown
| [pr-self-review](pr-self-review/SKILL.md) | Workflow | Manual pre-ready pass over the uncommitted diff; routes client → frontend-architecture + react + RTL, backend → onion-architecture + fastify + drizzle |
```

- [ ] **Step 4: Run all checks**

Run: `node scripts/check-skills.mjs && node --test scripts/*.test.mjs && node scripts/check-claude-md.mjs`
Expected: `Own skills OK`, all tests pass, `AGENTS.md structure OK`.

- [ ] **Step 5: Dry run on a mixed diff (acceptance #21)**

0. Precondition: a clean working tree, so the dry-run paths are the only changes. Run `git status --porcelain --untracked-files=all`; if it prints anything (for example the uncommitted `docs/labs/lab_2/` material or this plan), commit it or `git stash push -u -m pre-dry-run` first, and `git stash pop` after step 6.
1. Make throwaway edits: append a comment line `// self-review dry run` to `client/src/app/agents/page.tsx` and to `server/src/modules/agents/routes.ts`, and create an untracked folder with a file, `server/src/modules/dry-run/probe.ts`, containing `import * as t from '../../db/schema.js';`.
2. In Claude Code run `/pr-self-review`.
3. Expected: it states `Surfaces: client, backend` and loads all six skills (`frontend-architecture`, `react-best-practices`, `react-testing-library`, `onion-architecture`, `fastify-best-practices`, `drizzle-orm-patterns`); it lists and reads `server/src/modules/dry-run/probe.ts` (not just `dry-run/`); it does not report the unchanged legacy calls elsewhere in `agents/routes.ts` or other routes; it ends with a `VERDICT` line.
4. Revert only the client edit (`git checkout -- client/src/app/agents/page.tsx`) and run it again; expected: surfaces list is `backend` only, still all three backend skills.
5. Revert the rest (step 6 commands), then `touch docs/dry-run.md` and run it again: expected `No routed surface: docs/dry-run.md` and no verdict.
6. Clean up: `git checkout -- client/src/app/agents/page.tsx server/src/modules/agents/routes.ts && rm -rf server/src/modules/dry-run docs/dry-run.md`. Then `git status --porcelain --untracked-files=all` must print nothing (before any `git stash pop` from step 0).

If a dry-run expectation fails, fix the skill text (not the checker) and repeat the failing case.

- [ ] **Step 6: Commit**

```bash
git add .claude/skills/pr-self-review .claude/skills/README.md
git commit -m "feat(skills): add the pr-self-review dispatcher skill"
```

---

## Self-Review

**Spec coverage.** Step 1: rename plus symlink at root and nested modules (Task 1), the `@AGENTS.md` alternative (checker accepts it, Global Constraints). Step 2: UI-architecture skill (Task 3), onion skill with route → service → domain via container, adapters at the edge, inward dependencies, no adapter call from a route (Task 4), `pr-self-review` Workflow with client and backend routing (Task 5). Acceptance #21 (manual run on a mixed diff, no hook) is the Task 5 dry run.

**Placeholder scan.** No TBD/TODO; every code and skill body is written out.

**Type and name consistency.** `findGuides` (Task 1) is used only inside `check-claude-md.mjs`; `OWN_SKILLS`, `ROUTES`, `REQUIRED_TERMS`, `checkSkills` match between Task 2's test and implementation; skill folder names match the `OWN_SKILLS` and `ROUTES` lists and the catalog rows.

**Review Focus.** Items 1-2 are tests in Task 1, item 3 is the Task 5 required terms and dry run, item 4 is required terms plus dry run steps 5, item 5 is the `legacy` and `changed lines` required terms.
