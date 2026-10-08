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
