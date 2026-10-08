import { unzipSync } from 'fflate';
import type { SkillImportPreview, SkillType } from '@devdigest/shared';
import { ValidationError } from '../../platform/errors.js';

/**
 * Skill import parsing — pure, no I/O. An uploaded skill is untrusted input:
 * only ONE markdown file is ever decoded (SKILL.md preferred); every other
 * archive entry is listed back as ignored and never read or executed.
 */

export const IMPORT_LIMITS = {
  maxFileBytes: 512 * 1024,
  maxUnpackedBytes: 2 * 1024 * 1024,
  maxEntries: 200,
} as const;

const SKILL_TYPES: readonly SkillType[] = ['rubric', 'convention', 'security', 'custom'];
const MD_EXT = /\.(md|markdown)$/i;

export interface ParsedSkillMarkdown {
  name: string | null;
  description: string;
  type: SkillType;
  body: string;
}

/** Split optional `---` frontmatter (name / description / type) from the body. */
export function parseSkillMarkdown(text: string): ParsedSkillMarkdown {
  const src = text.replace(/^﻿/, '').replace(/\r\n/g, '\n');
  const fm = src.match(/^---\n([\s\S]*?)\n---(?:\n|$)/);
  const meta: Record<string, string> = {};
  if (fm) {
    for (const line of fm[1]!.split('\n')) {
      const m = line.match(/^([A-Za-z_-]+):\s*(.*)$/);
      if (!m) continue;
      let value = m[2]!.trim().replace(/^(['"])(.*)\1$/, '$2');
      // A YAML block scalar (`>-`, `|`, ...) spans lines we do not parse: leave it empty.
      if (/^[>|][+-]?$/.test(value)) value = '';
      meta[m[1]!.toLowerCase()] = value;
    }
  }
  const body = (fm ? src.slice(fm[0].length) : src).trim();
  const heading = body.match(/^#\s+(.+)$/m)?.[1]?.trim() ?? null;
  const type = (SKILL_TYPES as readonly string[]).includes(meta.type ?? '')
    ? (meta.type as SkillType)
    : 'custom';
  return { name: meta.name || heading, description: meta.description ?? '', type, body };
}

/** Parse an uploaded `.md` / `.markdown` / `.zip` into an unsaved preview. */
export function previewSkillImport(filename: string, bytes: Uint8Array): SkillImportPreview {
  if (bytes.byteLength === 0) throw new ValidationError('The file is empty');
  if (bytes.byteLength > IMPORT_LIMITS.maxFileBytes) {
    throw new ValidationError(`File is larger than ${IMPORT_LIMITS.maxFileBytes / 1024} KiB`);
  }
  if (MD_EXT.test(filename)) return toPreview(filename, decodeUtf8(bytes, filename), []);
  if (/\.zip$/i.test(filename)) return fromZip(bytes);
  throw new ValidationError('Only .md or .zip files can be imported');
}

function fromZip(bytes: Uint8Array): SkillImportPreview {
  const entries: string[] = [];
  let unpacked = 0;
  let files: Record<string, Uint8Array>;
  try {
    files = unzipSync(bytes, {
      // Called once per entry BEFORE inflating; returning false skips the entry.
      filter: (f) => {
        entries.push(f.name);
        if (entries.length > IMPORT_LIMITS.maxEntries) {
          throw new ValidationError(`Archive has more than ${IMPORT_LIMITS.maxEntries} entries`);
        }
        if (f.name.endsWith('/') || isJunk(f.name) || !MD_EXT.test(f.name)) return false;
        unpacked += f.originalSize;
        if (unpacked > IMPORT_LIMITS.maxUnpackedBytes) {
          throw new ValidationError(
            `Archive unpacks to more than ${IMPORT_LIMITS.maxUnpackedBytes / (1024 * 1024)} MiB`,
          );
        }
        return true;
      },
    });
  } catch (err) {
    if (err instanceof ValidationError) throw err;
    throw new ValidationError('Not a valid .zip archive');
  }
  const chosen = Object.keys(files).sort(byPreference)[0];
  if (!chosen) throw new ValidationError('The archive contains no Markdown file');
  const ignored = entries.filter((n) => n !== chosen && !n.endsWith('/'));
  return toPreview(chosen, decodeUtf8(files[chosen]!, chosen), ignored);
}

function toPreview(sourceFile: string, text: string, ignored: string[]): SkillImportPreview {
  const parsed = parseSkillMarkdown(text);
  if (!parsed.body) throw new ValidationError(`${sourceFile} has no content`);
  const parts = sourceFile.split('/');
  const base = parts[parts.length - 1]!.replace(MD_EXT, '');
  // "dir/SKILL.md" → "dir"; "boundary-cases.md" → "boundary-cases".
  const fallback = /^skill$/i.test(base) && parts.length > 1 ? parts[parts.length - 2]! : base;
  return {
    name: parsed.name || fallback,
    description: parsed.description,
    type: parsed.type,
    body: parsed.body,
    source_file: sourceFile,
    ignored_files: ignored,
  };
}

function decodeUtf8(bytes: Uint8Array, name: string): string {
  try {
    return new TextDecoder('utf-8', { fatal: true }).decode(bytes);
  } catch {
    throw new ValidationError(`${name} is not UTF-8 text`);
  }
}

function isJunk(name: string): boolean {
  return name.startsWith('__MACOSX/') || (name.split('/').pop() ?? '').startsWith('._');
}

/** SKILL.md first, then the shallowest path, then alphabetical. */
function byPreference(a: string, b: string): number {
  const rank = (p: string) => (/(^|\/)skill\.md$/i.test(p) ? 0 : 1);
  const depth = (p: string) => p.split('/').length;
  return rank(a) - rank(b) || depth(a) - depth(b) || a.localeCompare(b);
}
