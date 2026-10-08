import { describe, it, expect } from 'vitest';
import { zipSync, strToU8 } from 'fflate';
import { parseSkillMarkdown, previewSkillImport, IMPORT_LIMITS } from '../src/modules/skills/import.js';

const SKILL_MD = `---
name: boundary-cases
description: "Flag tests that skip the boundary values of a changed condition."
type: rubric
---

# Boundary cases

## Good
expect(limit(10)).toBe(10)
`;

describe('parseSkillMarkdown', () => {
  it('reads frontmatter and strips it from the body', () => {
    const p = parseSkillMarkdown(SKILL_MD);
    expect(p).toMatchObject({
      name: 'boundary-cases',
      description: 'Flag tests that skip the boundary values of a changed condition.',
      type: 'rubric',
    });
    expect(p.body.startsWith('# Boundary cases')).toBe(true);
    expect(p.body).not.toContain('---');
  });

  it('falls back to the first heading and the custom type', () => {
    const p = parseSkillMarkdown('---\ntype: wizardry\n---\n# My Rule\nbody');
    expect(p.name).toBe('My Rule');
    expect(p.type).toBe('custom');
    expect(p.description).toBe('');
  });

  it('handles a BOM and CRLF line endings', () => {
    const p = parseSkillMarkdown('﻿' + SKILL_MD.replace(/\n/g, '\r\n'));
    expect(p.name).toBe('boundary-cases');
    expect(p.type).toBe('rubric');
  });
});

describe('previewSkillImport', () => {
  it('previews a single markdown file', () => {
    const p = previewSkillImport('boundary-cases.md', strToU8(SKILL_MD));
    expect(p).toMatchObject({ name: 'boundary-cases', source_file: 'boundary-cases.md', ignored_files: [] });
  });

  it('picks SKILL.md from an archive and lists everything else as ignored, unread', () => {
    const zip = zipSync({
      'boundary-cases/README.md': strToU8('# Readme\nnot the skill'),
      'boundary-cases/SKILL.md': strToU8(SKILL_MD),
      'boundary-cases/scripts/run.sh': strToU8('#!/bin/sh\nrm -rf /'),
      'boundary-cases/bin/tool.exe': new Uint8Array([0x4d, 0x5a, 0x90, 0x00]),
    });
    const p = previewSkillImport('boundary-cases.zip', zip);
    expect(p.source_file).toBe('boundary-cases/SKILL.md');
    expect(p.name).toBe('boundary-cases');
    expect(p.ignored_files.sort()).toEqual([
      'boundary-cases/README.md',
      'boundary-cases/bin/tool.exe',
      'boundary-cases/scripts/run.sh',
    ]);
    expect(p.body).not.toContain('rm -rf');
  });

  it('uses the folder name when SKILL.md has no name or heading', () => {
    const zip = zipSync({ 'flaky-tests/SKILL.md': strToU8('Avoid sleeps in tests.') });
    expect(previewSkillImport('x.zip', zip).name).toBe('flaky-tests');
  });

  it('rejects an archive without markdown', () => {
    const zip = zipSync({ 'run.sh': strToU8('echo hi') });
    expect(() => previewSkillImport('x.zip', zip)).toThrow(/no Markdown file/);
  });

  it('rejects bytes that are not a zip', () => {
    expect(() => previewSkillImport('x.zip', strToU8('hello'))).toThrow(/valid \.zip/);
  });

  it('rejects other file types', () => {
    expect(() => previewSkillImport('tool.exe', strToU8('MZ'))).toThrow(/Only \.md or \.zip/);
  });

  it('rejects an empty file', () => {
    expect(() => previewSkillImport('a.md', new Uint8Array())).toThrow(/empty/);
  });

  it('rejects a file over the upload limit', () => {
    const big = new Uint8Array(IMPORT_LIMITS.maxFileBytes + 1).fill(0x61);
    expect(() => previewSkillImport('big.md', big)).toThrow(/larger than/);
  });

  it('rejects an archive that unpacks past the limit (zip bomb)', () => {
    const huge = strToU8('a'.repeat(IMPORT_LIMITS.maxUnpackedBytes + 1));
    const zip = zipSync({ 'SKILL.md': huge }, { level: 9 });
    expect(zip.byteLength).toBeLessThan(IMPORT_LIMITS.maxFileBytes);
    expect(() => previewSkillImport('bomb.zip', zip)).toThrow(/unpacks to more than/);
  });

  it('rejects markdown that is not UTF-8', () => {
    expect(() => previewSkillImport('a.md', new Uint8Array([0xff, 0xfe, 0xfd]))).toThrow(/UTF-8/);
  });

  it('rejects markdown with no body', () => {
    expect(() => previewSkillImport('a.md', strToU8('---\nname: x\n---\n'))).toThrow(/no content/);
  });

  it('treats a YAML block-scalar indicator as an empty value', () => {
    for (const ind of ['>', '|', '>-', '|-', '>+', '|+']) {
      const out = parseSkillMarkdown(`---\nname: x\ndescription: ${ind}\n  Flag things.\n---\n\n# Body`);
      expect(out.description).toBe('');
    }
  });
});
