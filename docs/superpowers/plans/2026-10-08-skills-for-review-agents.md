# Skills for Review Agents Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let users write, import, version and manage markdown skills, attach them to review agents in a chosen order, and see each enabled skill injected into the review prompt (with its token cost) in the run trace and log.

**Architecture:** The DB tables (`skills`, `skill_versions`, `agent_skills`), the agent↔skill link routes and reviewer-core's `skills` prompt slot already exist; nothing connects them. We add a `skills` server module (CRUD, versions, restore, import preview with a pure `.md`/`.zip` parser), make `run-executor.ts` pass the agent's linked + enabled skills (in link order) to the engine and log one line per skill, then build the client: a Skills Lab sidebar section, a Skills grid with a side preview panel, create/import modals, a `/skills/:id` page (Config / Preview / Versioning), a Skills tab in the agent editor (toggle, filter, drag to reorder), and token counts on the trace's prompt blocks. A content task adds the Test Quality and API Contract skill files and the control-experiment runbook.

**Tech Stack:** Fastify 5 + Drizzle (Postgres) + Zod, Vitest (+ Testcontainers for `*.it.test.ts`), `fflate` (new, zip reading); Next.js 15 App Router, React 19, TanStack Query 5, next-intl, Vitest + Testing Library (jsdom).

**Spec:** `docs/labs/lab_2/task2/skills_feature_implementation.md`. Product framing: `docs/labs/lab_2/lab-product-requirements.md`. Grading: `docs/labs/lab_2/hw2-acceptance-criteria.md` rows 6–37 and 43 (rows 38–53 except 43 are the Conventions feature, a separate task). Mockup: `docs/labs/lab_2/images/agents-skills-tab.png`.

## Global Constraints

- Server module with CRUD over the skills table; the database is the source of truth. (spec: Storage)
- Skills page: grid of cards (name, type, description, "enabled" toggle); click opens a preview in a side panel; an "add" button offering "create / import". (spec; acceptance #9–11)
- Skill form: name, description, type, body in markdown. The description is phrased as a directive, with a caption under the field saying so. (spec: Skill editor; #12)
- Agent editor Skills tab: link, enable/disable, reorder; order determines the sequence of blocks in the prompt. (spec; #13, #14)
- Import: markdown file or archive (`.zip` is enough, #15); show a preview; save only after confirmation; executable parts of the archive are not processed. (spec: Import)
- Card shows current version and agent count; delete button with a confirm modal (confirm / cancel / X). (#22–24)
- `/skills/:id` has tabs Config, Preview (rendered markdown), Versioning (list, Diff vs current, Restore). (#25–29)
- Agent Skills tab lists ALL skills, each with a toggle and a type label; search by name; drag only enabled skills. (#30, #31, #37)
- Agent tile: name, description, model, toggle, linked-skill count; delete with confirm modal. (#32–34) `/agents/:id` has exactly two tabs: Config and Skills. (#35)
- Trace prompt-assembly shows a separate skills block with the token count of that block only (`length / 4` is acceptable). (#19) An enabled skill is a separate block in the logs; a disabled one has no block. (#20)
- Sidebar: Skills and Agents under SKILLS LAB, not WORKSPACE. (#6)
- `pr-self-review` exists with auto-invocation disabled. (spec: Final check; #21)
- Route response shapes are Zod contracts from `@devdigest/shared`; request bodies may be local Zod schemas (as `agents/routes.ts` does). (server/AGENTS.md)
- Never hand-edit `server/src/db/migrations/`; change `src/db/schema/*.ts`, then `pnpm db:generate`. (AGENTS.md)
- User-visible client strings go through next-intl `messages/en/*.json`. (client/AGENTS.md)
- Placement follows `.claude/skills/frontend-architecture/SKILL.md` and `.claude/skills/onion-architecture/SKILL.md`. (project skills)
- No linter/formatter; verify with `pnpm typecheck` + `pnpm test` per module and `node scripts/check-claude-md.mjs` + `node scripts/check-skills.mjs`. (AGENTS.md)
- Before starting a task in a module, read that module's `INSIGHTS.md`. (AGENTS.md)

## Decisions (approve before Task 1)

1. **Vendored contracts are edited (both copies, additive only).** `server/src/vendor/shared/contracts/knowledge.ts` and `client/src/vendor/shared/contracts/knowledge.ts` get: `'imported_file'` in `SkillSource`; optional `agent_ids` / `agent_count` on `Skill`; new `SkillVersion` and `SkillImportPreview`. Both AGENTS.md files say "do not edit vendor here", but route responses must be shared contracts and there is no sync script. Edits are identical in both copies.
2. **Vendored nav is edited.** `client/src/vendor/ui/nav.ts` gains a `SKILLS LAB` group (Skills, Agents); Agents leaves `WORKSPACE`. `Sidebar.tsx` imports `NAV` directly and takes no override, so there is no other way to satisfy #6.
3. **New server dependency `fflate`** (zero-dependency zip reader), added with `pnpm add fflate` so only the package manager touches `server/pnpm-lock.yaml`.
4. **Trust model.** An imported skill is saved with `source: 'imported_file'` and `enabled: false`. Enabling it is the user's vetting step. Enabled skills go into the prompt as trusted rules (not wrapped as untrusted data, because the injection guard would tell the model to ignore them). Archive entries other than the chosen markdown file are never read into the skill, never executed, and are listed back as "ignored".
5. **"Enabled for this agent" = linked.** The agent Skills tab checkbox links/unlinks (`agent_skills`). A skill reaches the prompt only if it is linked to the agent AND globally enabled (`skills.enabled`), in `agent_skills.order`.
6. **Versioning.** A new version is created only when the body changes (the `skill_versions` table stores bodies). Renames and toggles keep the version. Restore never rewrites history: it saves the old body as a new version.
7. **Token counts.** The server logs one line per loaded skill with its tiktoken count (`container.tokenizer`). The trace UI shows `~N tokens` per prompt block using `ceil(length / 4)`, which the grading criteria accept.
8. **`client/messages/en/skills.json` is replaced.** It holds unused starter keys (URL / community import) that no component reads.
9. **Skill names are unique per workspace** (case-insensitive). A duplicate name on create, rename or import returns 422. Names identify blocks in the prompt and the log.

## Review Focus

Failure modes the spec implies that the happy paths do not cover, most likely first. Each has a test in the owning task.

1. **Hostile or broken uploads**: a zip holding scripts/binaries, a zip bomb, a non-UTF-8 file, a zip with no markdown, a `.exe`, a corrupt zip. The preview never executes or returns non-markdown content, lists ignored entries, rejects the rest with 422, and saves nothing. Tests: Task 2, Task 3.
2. **Order and disabled skills in the prompt**: after reordering in the UI, the next run's skills block follows the new order; a linked but globally disabled skill appears in neither the prompt nor the log. Tests: Task 4.
3. **Bad link requests**: linking an unknown or other-workspace skill id, or the same id twice, returns 422 / is de-duplicated, never a 500. Tests: Task 4.
4. **Deleting a linked skill**: links disappear with it, agent skill counts drop, the next run does not mention it. Tests: Task 3, Task 4.
5. **Incomplete or clashing imports**: an imported file with no description or a name that already exists cannot be saved until fixed; the form shows the field error and the server returns 422 for a duplicate. Tests: Task 3, Task 7.

## File Map

Server (`server/`):
- `src/vendor/shared/contracts/knowledge.ts` — contracts (Task 1); same edit in `client/src/vendor/shared/contracts/knowledge.ts`.
- `src/db/schema/skills.ts` — `imported_file` source (Task 1).
- `src/modules/skills/import.ts` — pure `.md` / `.zip` parsing (Task 2).
- `src/modules/skills/{repository,helpers,service,routes}.ts` — the module (Task 3); registered in `src/modules/index.ts`.
- `src/modules/reviews/skill-blocks.ts` — pure prompt-block formatting (Task 4); used by `run-executor.ts`.
- `src/modules/agents/{service,repository}.ts` — link validation (Task 4).
- Tests: `test/contracts.test.ts`, `test/skills-import.test.ts`, `test/skills.it.test.ts`, `test/skill-blocks.test.ts`, `test/reviews.it.test.ts`, `test/skill-docs.test.ts`.

Client (`client/`):
- `src/vendor/ui/nav.ts` — SKILLS LAB group (Task 5).
- `src/lib/hooks/skills.ts` (new), `src/lib/hooks/agents.ts` — data hooks (Task 5).
- `src/components/confirm-dialog/` — shared confirm modal used by skills and agents (Task 5).
- `src/app/agents/_components/AgentCard/` — count + confirm delete (Task 5); `AgentsListView`, `src/app/agents/[id]/page.tsx` pass counts.
- `src/app/skills/page.tsx`, `src/app/skills/_components/{SkillsListView,SkillCard,SkillPreviewPanel}/` (Task 6).
- `src/app/skills/_components/{SkillFormFields,CreateSkillModal,ImportSkillModal}/` (Task 7).
- `src/app/skills/[id]/page.tsx`, `src/app/skills/[id]/_components/SkillDetail/` with `_components/{ConfigTab,PreviewTab,VersioningTab}` (Task 8).
- `src/app/agents/[id]/_components/AgentEditor/_components/SkillsTab/` (Task 9).
- `src/app/repos/[repoId]/pulls/[number]/_components/RunTraceDrawer/` — token counts (Task 10).
- `messages/en/{skills,agents,runs}.json`.

Content: `docs/labs/lab_2/skills/{test-quality,api-contract}/*.md`, `docs/labs/lab_2/task2/control-experiment.md`, `.claude/skills/pr-self-review/SKILL.md`, `scripts/check-skills.mjs` (Task 11).

---

### Task 1: Skill contracts and the `imported_file` source

**Files:**
- Modify: `server/src/vendor/shared/contracts/knowledge.ts:118-132`
- Modify: `client/src/vendor/shared/contracts/knowledge.ts` (the same `// ---- Skills ----` block)
- Modify: `server/src/db/schema/skills.ts:13-15`
- Test: `server/test/contracts.test.ts`

**Interfaces:**
- Consumes: nothing.
- Produces (from `@devdigest/shared`): `SkillSource` = `'manual' | 'imported_url' | 'imported_file' | 'extracted' | 'community'`; `Skill` with optional `agent_ids?: string[]`, `agent_count?: number`; `SkillVersion { skill_id: string; version: number; body: string; created_at: string }`; `SkillImportPreview { name: string; description: string; type: SkillType; body: string; source_file: string; ignored_files: string[] }`.

- [ ] **Step 1: Read module memory**

Read `server/INSIGHTS.md` and `client/INSIGHTS.md`. The 2026-10-05 entries say the two vendored `trace.ts` copies already differ in comments; `knowledge.ts` differs too (agent comments and `AgentVersionConfig`), so edit each copy by hand, never copy one file over the other.

- [ ] **Step 2: Write the failing test**

Append to `server/test/contracts.test.ts` (add `Skill, SkillVersion, SkillImportPreview` to its `@devdigest/shared` import):

```ts
describe('Skills contracts', () => {
  it('Skill accepts the imported_file source and agent link fields', () => {
    const skill = Skill.parse({
      id: 's1',
      name: 'boundary-cases',
      description: 'Flag tests that skip the boundary values of a changed condition.',
      type: 'rubric',
      source: 'imported_file',
      body: '# Boundary cases',
      enabled: false,
      version: 1,
      agent_ids: ['a1'],
      agent_count: 1,
    });
    expect(skill.source).toBe('imported_file');
    expect(skill.agent_count).toBe(1);
  });

  it('SkillVersion and SkillImportPreview parse', () => {
    expect(
      SkillVersion.parse({ skill_id: 's1', version: 2, body: 'b', created_at: '2026-10-08T10:00:00.000Z' })
        .version,
    ).toBe(2);
    const preview = SkillImportPreview.parse({
      name: 'breaking-change',
      description: 'Flag removed or renamed public fields.',
      type: 'convention',
      body: '# Breaking change',
      source_file: 'breaking-change/SKILL.md',
      ignored_files: ['breaking-change/run.sh'],
    });
    expect(preview.ignored_files).toEqual(['breaking-change/run.sh']);
  });
});
```

- [ ] **Step 3: Run it to verify it fails**

Run: `cd server && pnpm exec vitest run test/contracts.test.ts`
Expected: FAIL — `SkillVersion` / `SkillImportPreview` are not exported (`Cannot read properties of undefined (reading 'parse')`), and `Skill.parse` rejects `imported_file`.

- [ ] **Step 4: Edit the server contract copy**

In `server/src/vendor/shared/contracts/knowledge.ts`, replace the block from `export const SkillSource` through `export type Skill = z.infer<typeof Skill>;` with:

```ts
export const SkillSource = z.enum(['manual', 'imported_url', 'imported_file', 'extracted', 'community']);
export type SkillSource = z.infer<typeof SkillSource>;

export const Skill = z.object({
  id: z.string(),
  name: z.string(),
  description: z.string(),
  type: SkillType,
  source: SkillSource,
  body: z.string(),
  enabled: z.boolean(),
  version: z.number().int(),
  evidence_files: z.array(z.string()).nullish(),
  /** Agents this skill is linked to (set on /skills responses). */
  agent_ids: z.array(z.string()).optional(),
  agent_count: z.number().int().optional(),
});
export type Skill = z.infer<typeof Skill>;

/** One immutable body snapshot from `skill_versions`. */
export const SkillVersion = z.object({
  skill_id: z.string(),
  version: z.number().int(),
  body: z.string(),
  created_at: z.string(),
});
export type SkillVersion = z.infer<typeof SkillVersion>;

/** A parsed upload (.md / .zip). Nothing is saved until the user confirms. */
export const SkillImportPreview = z.object({
  name: z.string(),
  description: z.string(),
  type: SkillType,
  body: z.string(),
  source_file: z.string(),
  /** Archive entries that were not read into the skill (scripts, binaries, other files). */
  ignored_files: z.array(z.string()),
});
export type SkillImportPreview = z.infer<typeof SkillImportPreview>;
```

- [ ] **Step 5: Make the identical edit in the client copy**

Apply exactly the Step 4 replacement to the same block in `client/src/vendor/shared/contracts/knowledge.ts`. Then confirm the two Skills blocks match:

Run: `diff <(sed -n '/---- Skills ----/,/---- Conventions ----/p' server/src/vendor/shared/contracts/knowledge.ts) <(sed -n '/---- Skills ----/,/---- Conventions ----/p' client/src/vendor/shared/contracts/knowledge.ts) && echo SAME`
Expected: `SAME`

- [ ] **Step 6: Add the source to the DB schema**

In `server/src/db/schema/skills.ts` change the `source` column to:

```ts
  source: text('source', {
    enum: ['manual', 'imported_url', 'imported_file', 'extracted', 'community'],
  }).notNull(),
```

Run: `cd server && pnpm db:generate`
Expected: drizzle-kit reports no SQL changes (a `text` enum is a TypeScript-only constraint). If it does write a migration, keep the generated files exactly as written and commit them with this task; never edit them.

- [ ] **Step 7: Run tests and type-checks**

Run: `cd server && pnpm exec vitest run test/contracts.test.ts && pnpm typecheck && cd ../client && pnpm typecheck && cd ../reviewer-core && npm run typecheck`
Expected: PASS everywhere (reviewer-core imports the server's vendored shared, so it must still compile).

- [ ] **Step 8: Commit**

```bash
git add server/src/vendor/shared/contracts/knowledge.ts client/src/vendor/shared/contracts/knowledge.ts server/src/db/schema/skills.ts server/test/contracts.test.ts
git add server/src/db/migrations 2>/dev/null || true
git commit -m "feat(skills): add skill version, import preview and imported_file contracts"
```

---

### Task 2: Pure `.md` / `.zip` import parser

**Files:**
- Modify: `server/package.json`, `server/pnpm-lock.yaml` (via `pnpm add` only)
- Create: `server/src/modules/skills/import.ts`
- Test: `server/test/skills-import.test.ts`

**Interfaces:**
- Consumes: `SkillImportPreview`, `SkillType` (Task 1); `ValidationError` from `src/platform/errors.ts` (422).
- Produces: `parseSkillMarkdown(text: string): ParsedSkillMarkdown` (`{ name: string | null; description: string; type: SkillType; body: string }`); `previewSkillImport(filename: string, bytes: Uint8Array): SkillImportPreview` (throws `ValidationError`); `IMPORT_LIMITS = { maxFileBytes: 524288, maxUnpackedBytes: 2097152, maxEntries: 200 }`.

- [ ] **Step 1: Add the dependency**

Run: `cd server && pnpm add fflate`
Expected: `fflate` appears under `dependencies` in `server/package.json`; only pnpm modified `pnpm-lock.yaml`. pnpm may still exit non-zero with `ERR_PNPM_IGNORED_BUILDS` (it lists other packages' skipped build scripts, as every install in this repo does); that is not a failure. Confirm with `ls node_modules/fflate`.

- [ ] **Step 2: Write the failing tests**

Create `server/test/skills-import.test.ts`:

```ts
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
});
```

- [ ] **Step 3: Run them to verify they fail**

Run: `cd server && pnpm exec vitest run test/skills-import.test.ts`
Expected: FAIL — `Cannot find module '../src/modules/skills/import.js'`.

- [ ] **Step 4: Write the implementation**

Create `server/src/modules/skills/import.ts`:

```ts
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
      if (m) meta[m[1]!.toLowerCase()] = m[2]!.trim().replace(/^(['"])(.*)\1$/, '$2');
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
```

- [ ] **Step 5: Run the tests to verify they pass**

Run: `cd server && pnpm exec vitest run test/skills-import.test.ts`
Expected: PASS (14 tests).

- [ ] **Step 6: Commit**

```bash
git add server/package.json server/pnpm-lock.yaml server/src/modules/skills/import.ts server/test/skills-import.test.ts
git commit -m "feat(skills): parse uploaded skill markdown and zip archives safely"
```

---

### Task 3: Skills module — CRUD, versions, restore, import preview

**Files:**
- Create: `server/src/modules/skills/repository.ts`, `server/src/modules/skills/helpers.ts`, `server/src/modules/skills/service.ts`, `server/src/modules/skills/routes.ts`
- Modify: `server/src/modules/index.ts`, `server/README.md` (API map)
- Test: `server/test/skills.it.test.ts`

**Interfaces:**
- Consumes: Task 1 contracts; `previewSkillImport` (Task 2).
- Produces (HTTP, all workspace-scoped):
  - `GET /skills` → `Skill[]` sorted by name, each with `agent_ids`, `agent_count`
  - `GET /skills/:id` → `Skill`
  - `POST /skills` body `{ name, description, type, body, source?: 'manual'|'imported_file', enabled? }` → 201 `Skill` (v1; imported defaults to `enabled: false`)
  - `PUT /skills/:id` body any of `{ name, description, type, body, enabled }` → `Skill` (body change → version + 1)
  - `DELETE /skills/:id` → `{ ok: true }`
  - `GET /skills/:id/versions` → `SkillVersion[]` newest first
  - `POST /skills/:id/versions/:version/restore` → `Skill`
  - `POST /skills/import/preview` body `{ filename, content_base64 }` → `SkillImportPreview` (no DB write)
  - Errors: unknown id → 404; schema failure → 422; duplicate name → 422; bad upload → 422.

- [ ] **Step 1: Write the failing integration tests**

Create `server/test/skills.it.test.ts`:

```ts
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { eq } from 'drizzle-orm';
import { zipSync, strToU8 } from 'fflate';
import { startPg, dockerAvailable, type PgFixture } from './helpers/pg.js';
import { buildApp } from '../src/app.js';
import { loadConfig } from '../src/platform/config.js';
import { seed } from '../src/db/seed.js';
import * as t from '../src/db/schema.js';
import { MockGitClient, MockGitHubClient } from '../src/adapters/mocks.js';

const hasDocker = await dockerAvailable();
const d = hasDocker ? describe : describe.skip;
if (!hasDocker) {
  // eslint-disable-next-line no-console
  console.warn('[skills] Docker not available — skipping integration tests.');
}

let seq = 0;
const draft = (over: Record<string, unknown> = {}) => ({
  name: `skill-${++seq}`,
  description: 'Flag tests that only cover the happy path.',
  type: 'rubric',
  body: '# Rule\nCover the error branch.',
  ...over,
});

d('skills module (Testcontainers pg)', () => {
  let pg: PgFixture;

  beforeAll(async () => {
    pg = await startPg();
    await seed(pg.handle.db);
  });
  afterAll(async () => {
    await pg?.stop();
  });

  function makeApp() {
    const config = loadConfig({ ...process.env, NODE_ENV: 'test' } as NodeJS.ProcessEnv);
    return buildApp({
      config,
      db: pg.handle.db,
      overrides: { git: new MockGitClient(), github: new MockGitHubClient() },
    });
  }

  it('creates a manual skill at v1 and persists it in Postgres', async () => {
    const app = await makeApp();
    const res = await app.inject({ method: 'POST', url: '/skills', payload: draft({ name: 'happy-path' }) });
    expect(res.statusCode).toBe(201);
    const skill = res.json();
    expect(skill).toMatchObject({ name: 'happy-path', source: 'manual', enabled: true, version: 1, agent_count: 0 });

    const [row] = await pg.handle.db.select().from(t.skills).where(eq(t.skills.id, skill.id));
    expect(row?.body).toBe('# Rule\nCover the error branch.');
    const versions = await pg.handle.db.select().from(t.skillVersions).where(eq(t.skillVersions.skillId, skill.id));
    expect(versions.map((v) => v.version)).toEqual([1]);

    const list = (await app.inject({ method: 'GET', url: '/skills' })).json();
    expect(list.some((s: { id: string }) => s.id === skill.id)).toBe(true);
    await app.close();
  });

  it('a body edit bumps the version; a rename or toggle does not', async () => {
    const app = await makeApp();
    const id = (await app.inject({ method: 'POST', url: '/skills', payload: draft() })).json().id;

    const renamed = (await app.inject({ method: 'PUT', url: `/skills/${id}`, payload: { name: `renamed-${seq}`, enabled: false } })).json();
    expect(renamed).toMatchObject({ version: 1, enabled: false });

    const edited = (await app.inject({ method: 'PUT', url: `/skills/${id}`, payload: { body: '# Rule v2' } })).json();
    expect(edited).toMatchObject({ version: 2, body: '# Rule v2' });

    const versions = (await app.inject({ method: 'GET', url: `/skills/${id}/versions` })).json();
    expect(versions.map((v: { version: number }) => v.version)).toEqual([2, 1]);
    expect(versions[1].body).toBe('# Rule\nCover the error branch.');
    await app.close();
  });

  it('restore saves the old body as a new version', async () => {
    const app = await makeApp();
    const id = (await app.inject({ method: 'POST', url: '/skills', payload: draft() })).json().id;
    await app.inject({ method: 'PUT', url: `/skills/${id}`, payload: { body: '# Changed' } });

    const restored = await app.inject({ method: 'POST', url: `/skills/${id}/versions/1/restore` });
    expect(restored.statusCode).toBe(200);
    expect(restored.json()).toMatchObject({ version: 3, body: '# Rule\nCover the error branch.' });

    const missing = await app.inject({ method: 'POST', url: `/skills/${id}/versions/99/restore` });
    expect(missing.statusCode).toBe(404);
    await app.close();
  });

  it('reports agent links and drops them when the skill is deleted', async () => {
    const app = await makeApp();
    const skillId = (await app.inject({ method: 'POST', url: '/skills', payload: draft() })).json().id;
    const agentId = (
      await app.inject({
        method: 'POST',
        url: '/agents',
        payload: { name: `Agent ${seq}`, provider: 'openai', model: 'gpt-4.1', system_prompt: 'Review.' },
      })
    ).json().id;
    await app.inject({ method: 'POST', url: `/agents/${agentId}/skills`, payload: { skill_ids: [skillId] } });

    const linked = (await app.inject({ method: 'GET', url: `/skills/${skillId}` })).json();
    expect(linked).toMatchObject({ agent_count: 1, agent_ids: [agentId] });

    const del = await app.inject({ method: 'DELETE', url: `/skills/${skillId}` });
    expect(del.json()).toEqual({ ok: true });
    expect((await app.inject({ method: 'GET', url: `/skills/${skillId}` })).statusCode).toBe(404);
    expect((await app.inject({ method: 'GET', url: `/agents/${agentId}/skills` })).json()).toEqual([]);
    await app.close();
  });

  it('a row deleted directly in Postgres disappears from GET /skills', async () => {
    const app = await makeApp();
    const id = (await app.inject({ method: 'POST', url: '/skills', payload: draft() })).json().id;
    await pg.handle.db.delete(t.skills).where(eq(t.skills.id, id));
    const list = (await app.inject({ method: 'GET', url: '/skills' })).json();
    expect(list.some((s: { id: string }) => s.id === id)).toBe(false);
    await app.close();
  });

  it('validates input (incl. single-line names) and rejects duplicate names (case-insensitive)', async () => {
    const app = await makeApp();
    expect((await app.inject({ method: 'POST', url: '/skills', payload: draft({ name: '' }) })).statusCode).toBe(422);
    expect((await app.inject({ method: 'POST', url: '/skills', payload: draft({ type: 'wizardry' }) })).statusCode).toBe(422);
    expect((await app.inject({ method: 'POST', url: '/skills', payload: draft({ description: ' ' }) })).statusCode).toBe(422);
    expect((await app.inject({ method: 'POST', url: '/skills', payload: draft({ name: 'two\nlines' }) })).statusCode).toBe(422);

    await app.inject({ method: 'POST', url: '/skills', payload: draft({ name: 'Unique-Name' }) });
    const dup = await app.inject({ method: 'POST', url: '/skills', payload: draft({ name: 'unique-name' }) });
    expect(dup.statusCode).toBe(422);
    expect(dup.json().error.message).toMatch(/already exists/);

    const other = (await app.inject({ method: 'POST', url: '/skills', payload: draft() })).json();
    const clash = await app.inject({ method: 'PUT', url: `/skills/${other.id}`, payload: { name: 'UNIQUE-NAME' } });
    expect(clash.statusCode).toBe(422);
    await app.close();
  });

  it('returns 404 for unknown skills', async () => {
    const app = await makeApp();
    const id = '00000000-0000-4000-8000-000000000000';
    for (const [method, url] of [
      ['GET', `/skills/${id}`],
      ['PUT', `/skills/${id}`],
      ['DELETE', `/skills/${id}`],
      ['GET', `/skills/${id}/versions`],
      ['POST', `/skills/${id}/versions/1/restore`],
    ] as const) {
      const res = await app.inject({ method, url, ...(method === 'PUT' ? { payload: { enabled: true } } : {}) });
      expect(res.statusCode, `${method} ${url}`).toBe(404);
    }
    await app.close();
  });

  it('previews an import without saving, then saves it disabled as imported_file', async () => {
    const app = await makeApp();
    const before = (await app.inject({ method: 'GET', url: '/skills' })).json().length;
    const zip = zipSync({
      'edge-skill/SKILL.md': strToU8('---\nname: edge-skill\ndescription: Flag missing edge cases.\ntype: rubric\n---\n# Edge\nTest 0 and max.'),
      'edge-skill/run.sh': strToU8('#!/bin/sh\necho pwned'),
    });
    const res = await app.inject({
      method: 'POST',
      url: '/skills/import/preview',
      payload: { filename: 'edge-skill.zip', content_base64: Buffer.from(zip).toString('base64') },
    });
    expect(res.statusCode).toBe(200);
    const preview = res.json();
    expect(preview).toMatchObject({ name: 'edge-skill', type: 'rubric', ignored_files: ['edge-skill/run.sh'] });
    expect((await app.inject({ method: 'GET', url: '/skills' })).json()).toHaveLength(before);

    const saved = await app.inject({
      method: 'POST',
      url: '/skills',
      payload: { name: preview.name, description: preview.description, type: preview.type, body: preview.body, source: 'imported_file' },
    });
    expect(saved.statusCode).toBe(201);
    expect(saved.json()).toMatchObject({ source: 'imported_file', enabled: false, version: 1 });
    await app.close();
  });

  it('rejects an upload that is not a skill', async () => {
    const app = await makeApp();
    const res = await app.inject({
      method: 'POST',
      url: '/skills/import/preview',
      payload: { filename: 'tool.exe', content_base64: Buffer.from('MZ').toString('base64') },
    });
    expect(res.statusCode).toBe(422);
    await app.close();
  });
});
```

- [ ] **Step 2: Run them to verify they fail**

Run: `cd server && pnpm exec vitest run test/skills.it.test.ts`
Expected: FAIL — every `/skills` request returns 404 (route not registered). If Docker is unavailable the suite is skipped; start Docker first (`docker info` must succeed), because this task's tests need it.

- [ ] **Step 3: Write the repository**

Create `server/src/modules/skills/repository.ts`:

```ts
import { and, asc, desc, eq, inArray, ne, sql } from 'drizzle-orm';
import type { Db } from '../../db/client.js';
import * as t from '../../db/schema.js';

export type SkillRow = typeof t.skills.$inferSelect;
export type SkillVersionRow = typeof t.skillVersions.$inferSelect;
export type NewSkillRow = Pick<
  typeof t.skills.$inferInsert,
  'workspaceId' | 'name' | 'description' | 'type' | 'source' | 'body' | 'enabled'
>;
export type SkillPatch = Partial<Pick<SkillRow, 'name' | 'description' | 'type' | 'body' | 'enabled'>>;

/** The only code that queries `skills` / `skill_versions`. Workspace-scoped. */
export class SkillsRepository {
  constructor(private db: Db) {}

  list(workspaceId: string): Promise<SkillRow[]> {
    return this.db
      .select()
      .from(t.skills)
      .where(eq(t.skills.workspaceId, workspaceId))
      .orderBy(asc(t.skills.name));
  }

  async getById(workspaceId: string, id: string): Promise<SkillRow | undefined> {
    const [row] = await this.db
      .select()
      .from(t.skills)
      .where(and(eq(t.skills.workspaceId, workspaceId), eq(t.skills.id, id)));
    return row;
  }

  /** True when another skill in the workspace already uses `name` (case-insensitive). */
  async nameTaken(workspaceId: string, name: string, exceptId?: string): Promise<boolean> {
    const rows = await this.db
      .select({ id: t.skills.id })
      .from(t.skills)
      .where(
        and(
          eq(t.skills.workspaceId, workspaceId),
          sql`lower(${t.skills.name}) = lower(${name})`,
          ...(exceptId ? [ne(t.skills.id, exceptId)] : []),
        ),
      );
    return rows.length > 0;
  }

  /** skillId → linked agent ids (every requested id is present, possibly with []). */
  async agentIdsBySkill(skillIds: string[]): Promise<Map<string, string[]>> {
    const map = new Map(skillIds.map((id) => [id, [] as string[]]));
    if (skillIds.length === 0) return map;
    const rows = await this.db
      .select({ skillId: t.agentSkills.skillId, agentId: t.agentSkills.agentId })
      .from(t.agentSkills)
      .where(inArray(t.agentSkills.skillId, skillIds));
    for (const r of rows) map.get(r.skillId)?.push(r.agentId);
    return map;
  }

  /** Insert at v1 and record the v1 body snapshot. */
  insert(values: NewSkillRow): Promise<SkillRow> {
    return this.db.transaction(async (tx) => {
      const [row] = await tx.insert(t.skills).values({ ...values, version: 1 }).returning();
      await tx.insert(t.skillVersions).values({ skillId: row!.id, version: 1, body: row!.body });
      return row!;
    });
  }

  /** Apply a patch; a changed body bumps `version` and records a snapshot. */
  update(workspaceId: string, id: string, patch: SkillPatch): Promise<SkillRow | undefined> {
    return this.db.transaction(async (tx) => {
      const where = and(eq(t.skills.workspaceId, workspaceId), eq(t.skills.id, id));
      const [current] = await tx.select().from(t.skills).where(where);
      if (!current) return undefined;
      const bodyChanged = patch.body !== undefined && patch.body !== current.body;
      const version = bodyChanged ? current.version + 1 : current.version;
      const [row] = await tx.update(t.skills).set({ ...patch, version }).where(where).returning();
      if (bodyChanged) await tx.insert(t.skillVersions).values({ skillId: id, version, body: patch.body! });
      return row;
    });
  }

  /** Delete (versions and agent links cascade). */
  async deleteById(workspaceId: string, id: string): Promise<boolean> {
    const rows = await this.db
      .delete(t.skills)
      .where(and(eq(t.skills.workspaceId, workspaceId), eq(t.skills.id, id)))
      .returning({ id: t.skills.id });
    return rows.length > 0;
  }

  listVersions(skillId: string): Promise<SkillVersionRow[]> {
    return this.db
      .select()
      .from(t.skillVersions)
      .where(eq(t.skillVersions.skillId, skillId))
      .orderBy(desc(t.skillVersions.version));
  }

  async getVersion(skillId: string, version: number): Promise<SkillVersionRow | undefined> {
    const [row] = await this.db
      .select()
      .from(t.skillVersions)
      .where(and(eq(t.skillVersions.skillId, skillId), eq(t.skillVersions.version, version)));
    return row;
  }
}
```

- [ ] **Step 4: Write the DTO helpers**

Create `server/src/modules/skills/helpers.ts`:

```ts
import type { Skill, SkillSource, SkillType, SkillVersion } from '@devdigest/shared';
import type { SkillRow, SkillVersionRow } from './repository.js';

/** Pure row → DTO mapping for the skills module. */
export function toSkillDto(row: SkillRow, agentIds: string[] = []): Skill {
  return {
    id: row.id,
    name: row.name,
    description: row.description,
    type: row.type as SkillType,
    source: row.source as SkillSource,
    body: row.body,
    enabled: row.enabled,
    version: row.version,
    evidence_files: row.evidenceFiles ?? null,
    agent_ids: agentIds,
    agent_count: agentIds.length,
  };
}

export function toSkillVersionDto(row: SkillVersionRow): SkillVersion {
  return {
    skill_id: row.skillId,
    version: row.version,
    body: row.body,
    created_at: row.createdAt.toISOString(),
  };
}
```

- [ ] **Step 5: Write the service**

Create `server/src/modules/skills/service.ts`:

```ts
import type { Container } from '../../platform/container.js';
import type { Skill, SkillImportPreview, SkillType, SkillVersion } from '@devdigest/shared';
import { ValidationError } from '../../platform/errors.js';
import { SkillsRepository, type SkillPatch } from './repository.js';
import { toSkillDto, toSkillVersionDto } from './helpers.js';
import { previewSkillImport } from './import.js';

export interface CreateSkillInput {
  name: string;
  description: string;
  type: SkillType;
  body: string;
  source?: 'manual' | 'imported_file';
  enabled?: boolean;
}

/**
 * Skills service — the Skills Lab use cases. Imported skills start disabled:
 * enabling one is the user's decision to trust its instructions in a prompt.
 */
export class SkillsService {
  private repo: SkillsRepository;

  constructor(container: Container) {
    this.repo = new SkillsRepository(container.db);
  }

  async list(workspaceId: string): Promise<Skill[]> {
    const rows = await this.repo.list(workspaceId);
    const links = await this.repo.agentIdsBySkill(rows.map((r) => r.id));
    return rows.map((r) => toSkillDto(r, links.get(r.id)));
  }

  async get(workspaceId: string, id: string): Promise<Skill | undefined> {
    const row = await this.repo.getById(workspaceId, id);
    if (!row) return undefined;
    const links = await this.repo.agentIdsBySkill([id]);
    return toSkillDto(row, links.get(id));
  }

  async create(workspaceId: string, input: CreateSkillInput): Promise<Skill> {
    await this.assertNameFree(workspaceId, input.name);
    const source = input.source ?? 'manual';
    const row = await this.repo.insert({
      workspaceId,
      name: input.name,
      description: input.description,
      type: input.type,
      source,
      body: input.body,
      enabled: input.enabled ?? source !== 'imported_file',
    });
    return toSkillDto(row);
  }

  async update(workspaceId: string, id: string, patch: SkillPatch): Promise<Skill | undefined> {
    if (patch.name !== undefined) await this.assertNameFree(workspaceId, patch.name, id);
    const row = await this.repo.update(workspaceId, id, patch);
    return row ? this.get(workspaceId, id) : undefined;
  }

  delete(workspaceId: string, id: string): Promise<boolean> {
    return this.repo.deleteById(workspaceId, id);
  }

  async listVersions(workspaceId: string, id: string): Promise<SkillVersion[] | undefined> {
    if (!(await this.repo.getById(workspaceId, id))) return undefined;
    return (await this.repo.listVersions(id)).map(toSkillVersionDto);
  }

  /** Save `version`'s body as a NEW version; history is never rewritten. */
  async restore(workspaceId: string, id: string, version: number): Promise<Skill | undefined> {
    if (!(await this.repo.getById(workspaceId, id))) return undefined;
    const snapshot = await this.repo.getVersion(id, version);
    if (!snapshot) return undefined;
    return this.update(workspaceId, id, { body: snapshot.body });
  }

  previewImport(filename: string, contentBase64: string): SkillImportPreview {
    return previewSkillImport(filename, Buffer.from(contentBase64, 'base64'));
  }

  private async assertNameFree(workspaceId: string, name: string, exceptId?: string): Promise<void> {
    if (await this.repo.nameTaken(workspaceId, name, exceptId)) {
      throw new ValidationError(`A skill named "${name}" already exists`);
    }
  }
}
```

- [ ] **Step 6: Write the routes and register the module**

Create `server/src/modules/skills/routes.ts`:

```ts
import type { FastifyInstance } from 'fastify';
import type { ZodTypeProvider } from 'fastify-type-provider-zod';
import { z } from 'zod';
import { SkillType } from '@devdigest/shared';
import { getContext } from '../_shared/context.js';
import { IdParams } from '../_shared/schemas.js';
import { NotFoundError } from '../../platform/errors.js';
import { SkillsService } from './service.js';

/**
 * skills module (Skills Lab).
 *   GET    /skills                                 → list (+ agent_ids / agent_count)
 *   GET    /skills/:id                             → one skill
 *   POST   /skills                                 → create (manual or confirmed import)
 *   PUT    /skills/:id                             → edit / toggle (body edit = new version)
 *   DELETE /skills/:id                             → delete (links + versions cascade)
 *   GET    /skills/:id/versions                    → body history, newest first
 *   POST   /skills/:id/versions/:version/restore   → save that body as a new version
 *   POST   /skills/import/preview                  → parse .md/.zip; nothing is saved
 */

const Fields = {
  // One line: the name becomes the `### Skill: <name>` header in the prompt.
  name: z.string().trim().min(1).max(80).regex(/^[^\r\n]+$/, 'Name must be a single line'),
  description: z.string().trim().min(1).max(500),
  type: SkillType,
  body: z.string().trim().min(1).max(50_000),
};

const CreateSkillBody = z.object({
  ...Fields,
  source: z.enum(['manual', 'imported_file']).optional(),
  enabled: z.boolean().optional(),
});

const UpdateSkillBody = z.object({
  name: Fields.name.optional(),
  description: Fields.description.optional(),
  type: Fields.type.optional(),
  body: Fields.body.optional(),
  enabled: z.boolean().optional(),
});

const VersionParams = z.object({
  id: z.string().uuid(),
  version: z.coerce.number().int().positive(),
});

const ImportPreviewBody = z.object({
  filename: z.string().min(1).max(255),
  content_base64: z.string().min(1),
});

export default async function skillsRoutes(appBase: FastifyInstance) {
  const app = appBase.withTypeProvider<ZodTypeProvider>();
  const service = new SkillsService(app.container);

  app.get('/skills', async (req) => {
    const { workspaceId } = await getContext(app.container, req);
    return service.list(workspaceId);
  });

  app.get('/skills/:id', { schema: { params: IdParams } }, async (req) => {
    const { workspaceId } = await getContext(app.container, req);
    const skill = await service.get(workspaceId, req.params.id);
    if (!skill) throw new NotFoundError('Skill not found');
    return skill;
  });

  app.post('/skills', { schema: { body: CreateSkillBody } }, async (req, reply) => {
    const { workspaceId } = await getContext(app.container, req);
    const skill = await service.create(workspaceId, req.body);
    reply.status(201);
    return skill;
  });

  app.put('/skills/:id', { schema: { params: IdParams, body: UpdateSkillBody } }, async (req) => {
    const { workspaceId } = await getContext(app.container, req);
    const skill = await service.update(workspaceId, req.params.id, req.body);
    if (!skill) throw new NotFoundError('Skill not found');
    return skill;
  });

  app.delete('/skills/:id', { schema: { params: IdParams } }, async (req) => {
    const { workspaceId } = await getContext(app.container, req);
    if (!(await service.delete(workspaceId, req.params.id))) throw new NotFoundError('Skill not found');
    return { ok: true };
  });

  app.get('/skills/:id/versions', { schema: { params: IdParams } }, async (req) => {
    const { workspaceId } = await getContext(app.container, req);
    const versions = await service.listVersions(workspaceId, req.params.id);
    if (!versions) throw new NotFoundError('Skill not found');
    return versions;
  });

  app.post(
    '/skills/:id/versions/:version/restore',
    { schema: { params: VersionParams } },
    async (req) => {
      const { workspaceId } = await getContext(app.container, req);
      const skill = await service.restore(workspaceId, req.params.id, req.params.version);
      if (!skill) throw new NotFoundError('Skill version not found');
      return skill;
    },
  );

  app.post('/skills/import/preview', { schema: { body: ImportPreviewBody } }, async (req) => {
    await getContext(app.container, req);
    return service.previewImport(req.body.filename, req.body.content_base64);
  });
}
```

In `server/src/modules/index.ts` add `import skills from './skills/routes.js';` after the `agents` import, and `skills,` after `agents,` in the `modules` object.

In `server/README.md`, in the `## API map (starter)` mermaid chart, replace the `Agents` subgraph line `agents["agents<br/>/agents · /agents/:id"]` with these two lines:

```
    agents["agents<br/>/agents · /agents/:id · /agents/:id/skills"]
    skills["skills<br/>/skills · /skills/:id · /skills/:id/versions · /skills/import/preview"]
```

- [ ] **Step 7: Run the tests to verify they pass**

Run: `cd server && pnpm exec vitest run test/skills.it.test.ts`
Expected: PASS (9 tests).

- [ ] **Step 8: Run the whole server suite and type-check**

Run: `cd server && pnpm typecheck && pnpm test`
Expected: PASS (all suites; integration suites need Docker).

- [ ] **Step 9: Commit**

```bash
git add server/src/modules/skills server/src/modules/index.ts server/test/skills.it.test.ts server/README.md
git commit -m "feat(skills): add the skills module with versions, restore and import preview"
```

---

### Task 4: Linked, enabled skills reach the review prompt

**Files:**
- Create: `server/src/modules/reviews/skill-blocks.ts`
- Modify: `server/src/modules/reviews/run-executor.ts` (before the `reviewPullRequest({` call, ~line 186)
- Modify: `server/src/modules/agents/service.ts` (`setSkills`, `linkSkill`), `server/src/modules/agents/repository.ts` (new `countSkillsInWorkspace`)
- Test: `server/test/skill-blocks.test.ts`, `server/test/reviews.it.test.ts`, `server/test/skills.it.test.ts`

**Interfaces:**
- Consumes: `AgentsRepository.linkedSkills(agentId): Promise<{ skill: SkillRow; order: number }[]>` (existing, ordered); `container.tokenizer.count(text): number` (existing); `reviewPullRequest({ skills?: string[] })` (existing).
- Produces: `toSkillBlocks(linked: readonly PromptSkill[]): SkillBlock[]`, `formatSkillBlock(skill): string` where `PromptSkill = { name: string; description: string; body: string; enabled: boolean }` and `SkillBlock = { name: string; text: string }`. Each block starts with `### Skill: <name>`. Run log lines: `Skill loaded: <name> (~<n> tokens)` per skill; `No enabled skills linked to this agent` when none. `POST /agents/:id/skills` returns 422 for unknown or foreign skill ids and de-duplicates repeats.

- [ ] **Step 1: Write the failing unit test**

Create `server/test/skill-blocks.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { formatSkillBlock, toSkillBlocks } from '../src/modules/reviews/skill-blocks.js';

const skill = (name: string, enabled = true) => ({
  name,
  description: `Flag ${name} problems.`,
  body: `Rules for ${name}.`,
  enabled,
});

describe('skill blocks', () => {
  it('formats one block with a header, the description and the body', () => {
    expect(formatSkillBlock(skill('boundary-cases'))).toBe(
      '### Skill: boundary-cases\n\n> Flag boundary-cases problems.\n\nRules for boundary-cases.',
    );
  });

  it('keeps link order and drops globally disabled skills', () => {
    const blocks = toSkillBlocks([skill('beta'), skill('gamma', false), skill('alpha')]);
    expect(blocks.map((b) => b.name)).toEqual(['beta', 'alpha']);
    expect(blocks[0]!.text.startsWith('### Skill: beta')).toBe(true);
  });

  it('omits an empty description line', () => {
    expect(formatSkillBlock({ name: 'x', description: '  ', body: 'b' })).toBe('### Skill: x\n\nb');
  });

  it('returns no blocks when nothing is linked', () => {
    expect(toSkillBlocks([])).toEqual([]);
  });
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `cd server && pnpm exec vitest run test/skill-blocks.test.ts`
Expected: FAIL — `Cannot find module '../src/modules/reviews/skill-blocks.js'`.

- [ ] **Step 3: Implement the formatter**

Create `server/src/modules/reviews/skill-blocks.ts`:

```ts
/**
 * Skills → prompt blocks (pure). The caller passes the agent's linked skills in
 * `agent_skills.order`; globally disabled skills are dropped here, so a disabled
 * skill never reaches the prompt or the run log.
 */
export interface PromptSkill {
  name: string;
  description: string;
  body: string;
  enabled: boolean;
}

export interface SkillBlock {
  name: string;
  text: string;
}

export function formatSkillBlock(skill: Pick<PromptSkill, 'name' | 'description' | 'body'>): string {
  const description = skill.description.trim();
  return [`### Skill: ${skill.name}`, description ? `> ${description}` : null, skill.body.trim()]
    .filter((part): part is string => part !== null)
    .join('\n\n');
}

export function toSkillBlocks(linked: readonly PromptSkill[]): SkillBlock[] {
  return linked.filter((s) => s.enabled).map((s) => ({ name: s.name, text: formatSkillBlock(s) }));
}
```

- [ ] **Step 4: Run it to verify it passes**

Run: `cd server && pnpm exec vitest run test/skill-blocks.test.ts`
Expected: PASS (4 tests).

- [ ] **Step 5: Write the failing integration tests**

In `server/test/reviews.it.test.ts`, add inside the `d('A2 reviews + agents (Testcontainers pg)', ...)` block (after the existing tests):

```ts
  it('injects linked, enabled skills in link order and logs each one', async () => {
    const app = await appWith(REVIEW_FIXTURE);
    const { pr } = await setupRepoAndPr(pg.handle.db, workspaceId);
    const mk = async (name: string, enabled = true) =>
      (
        await app.inject({
          method: 'POST',
          url: '/skills',
          payload: { name, description: `Flag ${name}.`, type: 'rubric', body: `Rules for ${name}.`, enabled },
        })
      ).json().id as string;
    const alpha = await mk(`alpha-${pr.id}`);
    const beta = await mk(`beta-${pr.id}`);
    const gamma = await mk(`gamma-${pr.id}`, false);
    const agent = (
      await app.inject({
        method: 'POST',
        url: '/agents',
        payload: { name: `Skilled ${pr.id}`, provider: 'openai', model: 'gpt-4.1', system_prompt: 'sec' },
      })
    ).json();

    const runWith = async (skillIds: string[], expected: number) => {
      await app.inject({ method: 'POST', url: `/agents/${agent.id}/skills`, payload: { skill_ids: skillIds } });
      const res = await app.inject({ method: 'POST', url: `/pulls/${pr.id}/review`, payload: { agentId: agent.id } });
      await waitForPrRuns(pg.handle.db, pr.id, { expected });
      return fetchTrace(app, res.json().runs[0].run_id);
    };

    const first = await runWith([beta, alpha, gamma], 1);
    const skills1: string = first.prompt_assembly.skills;
    expect(skills1.indexOf(`### Skill: beta-${pr.id}`)).toBeGreaterThanOrEqual(0);
    expect(skills1.indexOf(`### Skill: beta-${pr.id}`)).toBeLessThan(skills1.indexOf(`### Skill: alpha-${pr.id}`));
    expect(skills1).not.toContain(`gamma-${pr.id}`);
    const msgs1 = first.log.map((l: { msg: string }) => l.msg);
    expect(msgs1.some((m: string) => m.startsWith(`Skill loaded: beta-${pr.id} (~`))).toBe(true);
    expect(msgs1.some((m: string) => m.startsWith(`Skill loaded: alpha-${pr.id} (~`))).toBe(true);
    expect(msgs1.some((m: string) => m.includes(`gamma-${pr.id}`))).toBe(false);

    // Reordering in the agent's Skills tab flips the blocks in the next run.
    const second = await runWith([alpha, beta], 2);
    const skills2: string = second.prompt_assembly.skills;
    expect(skills2.indexOf(`### Skill: alpha-${pr.id}`)).toBeLessThan(skills2.indexOf(`### Skill: beta-${pr.id}`));

    // No linked skills → no skills block at all.
    const third = await runWith([], 3);
    expect(third.prompt_assembly.skills).toBeNull();
    expect(third.log.some((l: { msg: string }) => l.msg === 'No enabled skills linked to this agent')).toBe(true);
    await app.close();
  });
```

In `server/test/skills.it.test.ts`, add inside the `d(...)` block:

```ts
  it('rejects unknown skill ids on an agent and de-duplicates repeats', async () => {
    const app = await makeApp();
    const skillId = (await app.inject({ method: 'POST', url: '/skills', payload: draft() })).json().id;
    const agentId = (
      await app.inject({
        method: 'POST',
        url: '/agents',
        payload: { name: `Linker ${seq}`, provider: 'openai', model: 'gpt-4.1', system_prompt: 'Review.' },
      })
    ).json().id;

    const unknown = await app.inject({
      method: 'POST',
      url: `/agents/${agentId}/skills`,
      payload: { skill_ids: ['00000000-0000-4000-8000-000000000000'] },
    });
    expect(unknown.statusCode).toBe(422);
    const unknownOne = await app.inject({
      method: 'POST',
      url: `/agents/${agentId}/skills`,
      payload: { skill_id: '00000000-0000-4000-8000-000000000000' },
    });
    expect(unknownOne.statusCode).toBe(422);

    const dup = await app.inject({
      method: 'POST',
      url: `/agents/${agentId}/skills`,
      payload: { skill_ids: [skillId, skillId] },
    });
    expect(dup.statusCode).toBe(200);
    expect(dup.json()).toEqual([{ agent_id: agentId, skill_id: skillId, order: 0 }]);
    await app.close();
  });
```

- [ ] **Step 6: Run them to verify they fail**

Run: `cd server && pnpm exec vitest run test/reviews.it.test.ts test/skills.it.test.ts`
Expected: FAIL — the skills test sees `prompt_assembly.skills` = `null` (indexOf -1); the link test gets 500 (FK violation / duplicate key) instead of 422 / 200.

- [ ] **Step 7: Pass skills from the run executor**

In `server/src/modules/reviews/run-executor.ts` add the import next to the other local imports:

```ts
import { toSkillBlocks } from './skill-blocks.js';
```

Directly before `const task = taskLine(pull) + rankNote;` add:

```ts
      // Skills — linked to this agent (agent_skills.order) AND enabled globally.
      // One log line per loaded skill makes each enabled skill visible in the
      // run log; a disabled skill produces no line and no prompt block.
      const linkedSkills = await this.agents.linkedSkills(agent.id);
      const skillBlocks = toSkillBlocks(linkedSkills.map((l) => l.skill));
      for (const block of skillBlocks) {
        runLog.info(`Skill loaded: ${block.name} (~${this.container.tokenizer.count(block.text)} tokens)`);
      }
      if (skillBlocks.length === 0) runLog.info('No enabled skills linked to this agent');
```

In the `reviewPullRequest({ ... })` argument object, after the `prDescription` spread, add:

```ts
        // Each skill is its own `### Skill:` block inside "## Skills / rules".
        ...(skillBlocks.length > 0 ? { skills: skillBlocks.map((b) => b.text) } : {}),
```

- [ ] **Step 8: Validate skill links on the agent side**

In `server/src/modules/agents/repository.ts`, add `inArray` to the `drizzle-orm` import and add this method in the `agent_skills` section:

```ts
  /** How many of `skillIds` exist in this workspace (used to reject foreign ids). */
  async countSkillsInWorkspace(workspaceId: string, skillIds: string[]): Promise<number> {
    if (skillIds.length === 0) return 0;
    const rows = await this.db
      .select({ id: t.skills.id })
      .from(t.skills)
      .where(and(eq(t.skills.workspaceId, workspaceId), inArray(t.skills.id, skillIds)));
    return rows.length;
  }
```

In `server/src/modules/agents/service.ts`, add `import { ValidationError } from '../../platform/errors.js';`, then replace the bodies of `setSkills` and `linkSkill`:

```ts
  async setSkills(
    workspaceId: string,
    agentId: string,
    skillIds: string[],
  ): Promise<AgentSkillLink[] | undefined> {
    const agent = await this.repo.getById(workspaceId, agentId);
    if (!agent) return undefined;
    const ids = [...new Set(skillIds)];
    await this.assertSkillsInWorkspace(workspaceId, ids);
    await this.repo.setSkills(agentId, ids);
    return this.skillLinks(agentId);
  }

  /** Link a single skill (append or set order) — additive to existing links. */
  async linkSkill(
    workspaceId: string,
    agentId: string,
    skillId: string,
    order?: number,
  ): Promise<AgentSkillLink[] | undefined> {
    const agent = await this.repo.getById(workspaceId, agentId);
    if (!agent) return undefined;
    await this.assertSkillsInWorkspace(workspaceId, [skillId]);
    const existing = await this.repo.linkedSkills(agentId);
    const resolvedOrder = order ?? existing.length;
    await this.repo.linkSkill(agentId, skillId, resolvedOrder);
    return this.skillLinks(agentId);
  }

  private async assertSkillsInWorkspace(workspaceId: string, skillIds: string[]): Promise<void> {
    const found = await this.repo.countSkillsInWorkspace(workspaceId, skillIds);
    if (found !== skillIds.length) throw new ValidationError('Unknown skill id for this workspace');
  }
```

- [ ] **Step 9: Run the tests to verify they pass**

Run: `cd server && pnpm exec vitest run test/skill-blocks.test.ts test/reviews.it.test.ts test/skills.it.test.ts`
Expected: PASS.

- [ ] **Step 10: Run the server suite and the engine suite**

Run: `cd server && pnpm typecheck && pnpm test && cd ../reviewer-core && npm test`
Expected: PASS.

- [ ] **Step 11: Commit**

```bash
git add server/src/modules/reviews/skill-blocks.ts server/src/modules/reviews/run-executor.ts server/src/modules/agents/service.ts server/src/modules/agents/repository.ts server/test/skill-blocks.test.ts server/test/reviews.it.test.ts server/test/skills.it.test.ts
git commit -m "feat(reviews): inject linked, enabled skills into the prompt in agent order"
```

---

### Task 5: Client data layer, Skills Lab nav, confirm dialog, agent tile count

**Files:**
- Modify: `client/src/vendor/ui/nav.ts` (`NAV`, `SHORTCUTS`)
- Create: `client/src/lib/hooks/skills.ts`
- Modify: `client/src/lib/hooks/agents.ts` (append two hooks)
- Create: `client/src/lib/hooks/agents.test.tsx`
- Create: `client/src/components/confirm-dialog/ConfirmDialog.tsx`, `index.ts`, `ConfirmDialog.test.tsx`
- Modify: `client/src/app/agents/_components/AgentCard/AgentCard.tsx`, `helpers.ts`, `index.ts`, `AgentCard.test.tsx`
- Create: `client/src/app/agents/_components/AgentCard/helpers.test.ts`, `client/src/components/app-shell/nav.test.ts`
- Modify: `client/src/app/agents/_components/AgentsListView/AgentsListView.tsx`, `client/src/app/agents/[id]/page.tsx`
- Modify: `client/messages/en/agents.json` (`card` keys)

**Interfaces:**
- Consumes: Task 1 contracts; HTTP from Tasks 3–4.
- Produces:
  - `hooks/skills.ts`: `SkillDraft { name; description; type: SkillType; body }`; `useSkills()`, `useSkill(id)`, `useCreateSkill()` (input `SkillDraft & { source?: "manual" | "imported_file" }`), `useUpdateSkill()` (`{ id, patch: Partial<SkillDraft> & { enabled?: boolean } }`), `useDeleteSkill()` (id), `useSkillVersions(id)`, `useRestoreSkillVersion()` (`{ id, version }`), `usePreviewSkillImport()` (`{ filename, content_base64 }`). Query keys: `["skills"]`, `["skill", id]`, `["skill-versions", id]`, `["agent-skills", agentId]`.
  - `hooks/agents.ts`: `useAgentSkills(agentId)` → `AgentSkillLink[]`; `useSetAgentSkills()` (`{ agentId, skillIds }`) — updates the `["agent-skills", agentId]` cache before the request, runs saves one at a time (mutation `scope`), and refetches only after the last queued save settles.
  - `ConfirmDialog({ title, body, confirmLabel, cancelLabel, pending?, onConfirm, onCancel })` from `src/components/confirm-dialog`.
  - `skillCountFor(agentId: string, skills: Skill[] | undefined): number | undefined` exported from `src/app/agents/_components/AgentCard`.

- [ ] **Step 1: Read module memory**

Read `client/INSIGHTS.md`. The 2026-10-07 entry applies here: a click inside a popover/modal still bubbles through the React tree to the row's `onClick`, so wrap any dialog rendered inside a clickable card in a `stopPropagation` element.

- [ ] **Step 2: Write the failing tests**

Create `client/src/components/app-shell/nav.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { NAV } from "@devdigest/ui";

describe("sidebar nav", () => {
  it("lists Skills and Agents under SKILLS LAB, not WORKSPACE", () => {
    const lab = NAV.find((g) => g.section === "SKILLS LAB");
    expect(lab?.items.map((i) => [i.key, i.href])).toEqual([
      ["skills", "/skills"],
      ["agents", "/agents"],
    ]);
    const workspace = NAV.find((g) => g.section === "WORKSPACE");
    expect(workspace?.items.map((i) => i.key)).not.toContain("agents");
  });
});
```

Create `client/src/components/confirm-dialog/ConfirmDialog.test.tsx`:

```tsx
import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, fireEvent, cleanup } from "@testing-library/react";
import { ConfirmDialog } from "./ConfirmDialog";

afterEach(cleanup);

describe("ConfirmDialog", () => {
  it("confirms, cancels, and closes with the X", () => {
    const onConfirm = vi.fn();
    const onCancel = vi.fn();
    render(
      <ConfirmDialog
        title="Delete skill?"
        body="It is linked to 2 agents."
        confirmLabel="Delete"
        cancelLabel="Cancel"
        onConfirm={onConfirm}
        onCancel={onCancel}
      />,
    );
    expect(screen.getByText("Delete skill?")).toBeInTheDocument();
    expect(screen.getByText("It is linked to 2 agents.")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Delete" }));
    expect(onConfirm).toHaveBeenCalledTimes(1);

    fireEvent.click(screen.getByRole("button", { name: "Cancel" }));
    fireEvent.click(screen.getByRole("button", { name: "Close" }));
    expect(onCancel).toHaveBeenCalledTimes(2);
  });
});
```

Create `client/src/app/agents/_components/AgentCard/helpers.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import type { Skill } from "@devdigest/shared";
import { skillCountFor } from "./helpers";

const skill = (id: string, agent_ids: string[]): Skill => ({
  id,
  name: id,
  description: "d",
  type: "rubric",
  source: "manual",
  body: "b",
  enabled: true,
  version: 1,
  agent_ids,
  agent_count: agent_ids.length,
});

describe("skillCountFor", () => {
  it("counts the skills linked to one agent", () => {
    const skills = [skill("s1", ["a1", "a2"]), skill("s2", ["a2"]), skill("s3", [])];
    expect(skillCountFor("a2", skills)).toBe(2);
    expect(skillCountFor("a1", skills)).toBe(1);
    expect(skillCountFor("a9", skills)).toBe(0);
  });

  it("is undefined while skills are loading", () => {
    expect(skillCountFor("a1", undefined)).toBeUndefined();
  });
});
```

Replace `client/src/app/agents/_components/AgentCard/AgentCard.test.tsx` with:

```tsx
import { describe, it, expect, afterEach, vi } from "vitest";
import { render, screen, cleanup, fireEvent } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import type { Agent } from "@devdigest/shared";
import messages from "../../../../../messages/en/agents.json";

const { mutate } = vi.hoisted(() => ({ mutate: vi.fn() }));
vi.mock("../../../../lib/hooks/agents", () => ({
  useDeleteAgent: () => ({ mutate, isPending: false }),
}));

import { AgentCard } from "./AgentCard";

afterEach(() => {
  cleanup();
  mutate.mockReset();
});

const AGENT: Agent = {
  id: "ag1",
  name: "Security Reviewer",
  description: "Flags secrets and injection",
  provider: "openai",
  model: "gpt-4.1",
  system_prompt: "You are a security reviewer.",
  output_schema: null,
  strategy: "single-pass",
  ci_fail_on: "critical",
  repo_intel: true,
  enabled: true,
  version: 1,
};

function renderWithIntl(ui: React.ReactElement) {
  return render(
    <NextIntlClientProvider locale="en" messages={{ agents: messages }}>
      {ui}
    </NextIntlClientProvider>,
  );
}

describe("AgentCard", () => {
  it("renders the agent name, model chip and skill count", () => {
    renderWithIntl(<AgentCard ag={AGENT} skillCount={3} />);
    expect(screen.getByText("Security Reviewer")).toBeInTheDocument();
    expect(screen.getByText("gpt-4.1")).toBeInTheDocument();
    expect(screen.getByText("3 skills")).toBeInTheDocument();
  });

  it("falls back to a translated placeholder when description is empty", () => {
    renderWithIntl(<AgentCard ag={{ ...AGENT, description: "" }} />);
    expect(screen.getByText("No description")).toBeInTheDocument();
  });

  it("asks for confirmation in a modal before deleting", () => {
    const onClick = vi.fn();
    const { container } = renderWithIntl(<AgentCard ag={{ ...AGENT, enabled: false }} onClick={onClick} />);

    fireEvent.click(screen.getByRole("button", { name: "Delete agent" }));
    expect(screen.getByText("Delete agent?")).toBeInTheDocument();
    // Rendered beside the card, so a disabled agent's 0.6 opacity does not dim it.
    expect(container.firstChild).not.toContainElement(screen.getByRole("dialog"));
    fireEvent.click(screen.getByRole("button", { name: "Cancel" }));
    expect(screen.queryByText("Delete agent?")).not.toBeInTheDocument();
    expect(mutate).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole("button", { name: "Delete agent" }));
    fireEvent.click(screen.getByRole("button", { name: "Delete" }));
    expect(mutate).toHaveBeenCalledWith("ag1", expect.anything());
    expect(onClick).not.toHaveBeenCalled();
  });
});
```

Create `client/src/lib/hooks/agents.test.tsx` — quick clicks in the agent Skills tab must not lose a change:

```tsx
import { describe, it, expect, vi } from "vitest";
import React from "react";
import { renderHook, act, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

const { post, get } = vi.hoisted(() => ({ post: vi.fn(), get: vi.fn() }));
vi.mock("../api", () => ({ api: { post, get } }));

import { useSetAgentSkills } from "./agents";

const link = (skill_id: string, order: number) => ({ agent_id: "a1", skill_id, order });

describe("useSetAgentSkills", () => {
  it("updates links optimistically and saves quick clicks one at a time, in order", async () => {
    const qc = new QueryClient();
    qc.setQueryData(["agent-skills", "a1"], []);
    let releaseFirst!: (value: unknown) => void;
    post.mockImplementationOnce(() => new Promise((resolve) => (releaseFirst = resolve)));
    post.mockImplementationOnce(async () => [link("s1", 0), link("s2", 1)]);
    get.mockResolvedValue([link("s1", 0), link("s2", 1)]);
    const wrapper = ({ children }: { children: React.ReactNode }) => (
      <QueryClientProvider client={qc}>{children}</QueryClientProvider>
    );
    const { result } = renderHook(() => useSetAgentSkills(), { wrapper });

    act(() => result.current.mutate({ agentId: "a1", skillIds: ["s1"] }));
    await waitFor(() => expect(post).toHaveBeenCalledTimes(1));
    expect(qc.getQueryData(["agent-skills", "a1"])).toEqual([link("s1", 0)]);

    // Second click while the first save is in flight: cache shows both at once…
    act(() => result.current.mutate({ agentId: "a1", skillIds: ["s1", "s2"] }));
    await waitFor(() => expect(qc.getQueryData(["agent-skills", "a1"])).toEqual([link("s1", 0), link("s2", 1)]));
    // …but the request waits for the first one.
    await new Promise((r) => setTimeout(r, 20));
    expect(post).toHaveBeenCalledTimes(1);

    releaseFirst([link("s1", 0)]);
    await waitFor(() => expect(post).toHaveBeenCalledTimes(2));
    expect(post).toHaveBeenLastCalledWith("/agents/a1/skills", { skill_ids: ["s1", "s2"] });
    // The first save's response never rolls the list back to [s1].
    expect(qc.getQueryData(["agent-skills", "a1"])).toEqual([link("s1", 0), link("s2", 1)]);
  });
});
```

- [ ] **Step 3: Run them to verify they fail**

Run: `cd client && pnpm exec vitest run src/components/app-shell/nav.test.ts src/components/confirm-dialog src/app/agents/_components/AgentCard src/lib/hooks/agents.test.tsx`
Expected: FAIL — no `SKILLS LAB` group; `./ConfirmDialog` and `skillCountFor` not found; the delete test finds no "Delete agent?" text (the card still uses `window.confirm`); `useSetAgentSkills` is not exported.

- [ ] **Step 4: Move Agents into a SKILLS LAB group**

In `client/src/vendor/ui/nav.ts` replace the `NAV` constant with:

```ts
export const NAV: NavGroup[] = [
  {
    section: "WORKSPACE",
    items: [
      { key: "pulls", label: "Pull Requests", icon: "GitPullRequest", href: "/repos/:repoId/pulls", gKey: "p" },
    ],
  },
  {
    section: "SKILLS LAB",
    items: [
      { key: "skills", label: "Skills", icon: "Sparkles", href: "/skills", gKey: "s" },
      { key: "agents", label: "Agents", icon: "Cpu", href: "/agents", gKey: "a" },
    ],
  },
];
```

and add `{ keys: "g s", label: "Go to Skills", group: "Navigation" },` to `SHORTCUTS` after the `g p` entry.

- [ ] **Step 5: Add the skills hooks**

Create `client/src/lib/hooks/skills.ts`:

```ts
/* hooks/skills.ts — React Query hooks for the Skills Lab (list, detail, versions, import). */
"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "../api";
import type { Skill, SkillImportPreview, SkillType, SkillVersion } from "@devdigest/shared";

/** The editable fields of a skill (create form, config tab, import preview). */
export interface SkillDraft {
  name: string;
  description: string;
  type: SkillType;
  body: string;
}

export function useSkills() {
  return useQuery({ queryKey: ["skills"], queryFn: () => api.get<Skill[]>("/skills") });
}

export function useSkill(id: string | null | undefined) {
  return useQuery({
    queryKey: ["skill", id],
    queryFn: () => api.get<Skill>(`/skills/${id}`),
    enabled: !!id,
  });
}

export function useCreateSkill() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: SkillDraft & { source?: "manual" | "imported_file" }) =>
      api.post<Skill>("/skills", input),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["skills"] }),
  });
}

export function useUpdateSkill() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, patch }: { id: string; patch: Partial<SkillDraft> & { enabled?: boolean } }) =>
      api.put<Skill>(`/skills/${id}`, patch),
    onSuccess: (data) => {
      qc.setQueryData(["skill", data.id], data);
      qc.invalidateQueries({ queryKey: ["skills"] });
      qc.invalidateQueries({ queryKey: ["skill-versions", data.id] });
    },
  });
}

export function useDeleteSkill() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.del<{ ok: boolean }>(`/skills/${id}`),
    onSuccess: (_d, id) => {
      qc.removeQueries({ queryKey: ["skill", id] });
      qc.invalidateQueries({ queryKey: ["skills"] });
      qc.invalidateQueries({ queryKey: ["agent-skills"] });
    },
  });
}

export function useSkillVersions(id: string | null | undefined) {
  return useQuery({
    queryKey: ["skill-versions", id],
    queryFn: () => api.get<SkillVersion[]>(`/skills/${id}/versions`),
    enabled: !!id,
  });
}

export function useRestoreSkillVersion() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, version }: { id: string; version: number }) =>
      api.post<Skill>(`/skills/${id}/versions/${version}/restore`),
    onSuccess: (data) => {
      qc.setQueryData(["skill", data.id], data);
      qc.invalidateQueries({ queryKey: ["skills"] });
      qc.invalidateQueries({ queryKey: ["skill-versions", data.id] });
    },
  });
}

/** Parse an upload server-side. Nothing is saved; `useCreateSkill` confirms. */
export function usePreviewSkillImport() {
  return useMutation({
    mutationFn: (input: { filename: string; content_base64: string }) =>
      api.post<SkillImportPreview>("/skills/import/preview", input),
  });
}
```

Append to `client/src/lib/hooks/agents.ts` (add `AgentSkillLink` to its `@devdigest/shared` type import):

```ts
/** The agent's linked skills, in prompt order. */
export function useAgentSkills(agentId: string | null | undefined) {
  return useQuery({
    queryKey: ["agent-skills", agentId],
    queryFn: () => api.get<AgentSkillLink[]>(`/agents/${agentId}/skills`),
    enabled: !!agentId,
  });
}

/**
 * Replace the agent's linked skills with `skillIds`, in that order.
 * - The cache is updated before the request, so a second quick click in the
 *   Skills tab builds on the first instead of on stale server data.
 * - Saves share one `scope`, so they reach the server one at a time, in click order.
 * - Only after the LAST queued save settles do we refetch, so an earlier save's
 *   response never rolls the list back while a later one is still pending.
 */
export function useSetAgentSkills() {
  const qc = useQueryClient();
  return useMutation({
    mutationKey: ["set-agent-skills"],
    scope: { id: "set-agent-skills" },
    mutationFn: ({ agentId, skillIds }: { agentId: string; skillIds: string[] }) =>
      api.post<AgentSkillLink[]>(`/agents/${agentId}/skills`, { skill_ids: skillIds }),
    onMutate: async ({ agentId, skillIds }) => {
      await qc.cancelQueries({ queryKey: ["agent-skills", agentId] });
      qc.setQueryData<AgentSkillLink[]>(
        ["agent-skills", agentId],
        skillIds.map((skill_id, order) => ({ agent_id: agentId, skill_id, order })),
      );
    },
    onSettled: (_data, _error, { agentId }) => {
      // This mutation still counts as pending here; 1 means no other save is queued.
      if (qc.isMutating({ mutationKey: ["set-agent-skills"] }) <= 1) {
        void qc.invalidateQueries({ queryKey: ["agent-skills", agentId] });
        void qc.invalidateQueries({ queryKey: ["skills"] });
      }
    },
  });
}
```

- [ ] **Step 6: Add the shared confirm dialog**

Create `client/src/components/confirm-dialog/ConfirmDialog.tsx`:

```tsx
/* ConfirmDialog — a destructive-action confirmation (confirm / cancel / X).
   Used by skill and agent cards. Callers pass translated labels. */
"use client";

import React from "react";
import { Button, Modal } from "@devdigest/ui";

export function ConfirmDialog({
  title,
  body,
  confirmLabel,
  cancelLabel,
  pending,
  onConfirm,
  onCancel,
}: {
  title: string;
  body: React.ReactNode;
  confirmLabel: string;
  cancelLabel: string;
  pending?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  return (
    <Modal
      width={440}
      title={title}
      onClose={onCancel}
      footer={
        <div style={{ display: "flex", gap: 8, justifyContent: "flex-end", width: "100%" }}>
          <Button kind="secondary" onClick={onCancel}>
            {cancelLabel}
          </Button>
          <Button kind="danger" loading={pending} onClick={onConfirm}>
            {confirmLabel}
          </Button>
        </div>
      }
    >
      <p style={{ margin: 0, fontSize: 13, lineHeight: 1.5, color: "var(--text-secondary)" }}>{body}</p>
    </Modal>
  );
}
```

Create `client/src/components/confirm-dialog/index.ts`:

```ts
export { ConfirmDialog } from "./ConfirmDialog";
```

- [ ] **Step 7: Agent card — count helper and modal delete**

Append to `client/src/app/agents/_components/AgentCard/helpers.ts` (add `import type { Skill } from "@devdigest/shared";` at the top):

```ts
/** Skills linked to `agentId`; undefined while the skills list is loading. */
export function skillCountFor(agentId: string, skills: Skill[] | undefined): number | undefined {
  if (!skills) return undefined;
  return skills.filter((s) => s.agent_ids?.includes(agentId)).length;
}
```

Add to `client/src/app/agents/_components/AgentCard/index.ts`:

```ts
export { skillCountFor } from "./helpers";
```

Replace `client/src/app/agents/_components/AgentCard/AgentCard.tsx` with the version below. The confirm modal renders next to the card (a fragment), not inside it: inside, it would inherit `opacity: 0.6` on disabled agents and bubble clicks to the card's `onClick`.

```tsx
/* AgentCard — model chip, skills count, enabled toggle, delete with a confirm
   modal. The modal renders NEXT TO the card, not inside it, so it neither
   inherits the card's opacity (disabled agents) nor bubbles events into it. */
"use client";

import React from "react";
import { useTranslations } from "next-intl";
import { Icon, Badge, Toggle } from "@devdigest/ui";
import type { Agent } from "@devdigest/shared";
import { useDeleteAgent } from "../../../../lib/hooks/agents";
import { ConfirmDialog } from "../../../../components/confirm-dialog";
import { modelColor } from "./helpers";
import { s } from "./styles";

export function AgentCard({
  ag,
  active,
  skillCount,
  onClick,
  onToggle,
}: {
  ag: Agent;
  active?: boolean;
  skillCount?: number;
  onClick?: () => void;
  onToggle?: (enabled: boolean) => void;
}) {
  const t = useTranslations("agents");
  const del = useDeleteAgent();
  const color = modelColor(ag.model);
  const [confirming, setConfirming] = React.useState(false);
  return (
    <>
      <div onClick={onClick} style={s.card(!!active, ag.enabled)}>
        <div style={s.headerRow}>
          <div style={s.iconBox}>
            <Icon.Cpu size={15} />
          </div>
          <span style={s.name}>{ag.name}</span>
          {onToggle && (
            <div onClick={(e) => e.stopPropagation()}>
              <Toggle on={ag.enabled} onChange={onToggle} size={14} />
            </div>
          )}
          <button
            onClick={(e) => {
              e.stopPropagation();
              setConfirming(true);
            }}
            disabled={del.isPending}
            title={t("card.delete")}
            aria-label={t("card.delete")}
            style={{
              background: "none",
              border: "none",
              cursor: del.isPending ? "not-allowed" : "pointer",
              color: "var(--text-muted)",
              display: "inline-flex",
              padding: 4,
            }}
          >
            <Icon.Trash size={14} style={del.isPending ? { animation: "ddspin 1s linear infinite" } : undefined} />
          </button>
        </div>
        <div style={s.description}>{ag.description || t("card.noDescription")}</div>
        <div style={s.metaRow}>
          <span className="mono" style={s.modelChip(color)}>
            {ag.model}
          </span>
          {skillCount != null && (
            <Badge color="var(--text-secondary)" icon="Sparkles">
              {t("card.skillCount", { count: skillCount })}
            </Badge>
          )}
        </div>
      </div>
      {confirming && (
        <ConfirmDialog
          title={t("card.deleteTitle")}
          body={t("card.deleteBody", { name: ag.name })}
          confirmLabel={t("card.deleteConfirm")}
          cancelLabel={t("card.cancel")}
          pending={del.isPending}
          onCancel={() => setConfirming(false)}
          onConfirm={() => del.mutate(ag.id, { onSuccess: () => setConfirming(false) })}
        />
      )}
    </>
  );
}
```

Add to the `card` object in `client/messages/en/agents.json`:

```json
    "delete": "Delete agent",
    "deleteTitle": "Delete agent?",
    "deleteBody": "“{name}” and its skill links will be removed. This cannot be undone.",
    "deleteConfirm": "Delete",
    "cancel": "Cancel"
```

- [ ] **Step 8: Pass skill counts to agent tiles**

In `client/src/app/agents/_components/AgentsListView/AgentsListView.tsx`:
- import `{ useSkills } from "../../../../lib/hooks/skills"` and change the `AgentCard` import to `import { AgentCard, skillCountFor } from "../AgentCard";`
- add `const { data: skills } = useSkills();` next to the other hooks
- add `skillCount={skillCountFor(a.id, skills)}` to the `<AgentCard ...>` in the grid.

In `client/src/app/agents/[id]/page.tsx`:
- import `{ useSkills } from "../../../lib/hooks/skills"` and change the `AgentCard` import to `import { AgentCard, skillCountFor } from "../_components/AgentCard";`
- add `const { data: skills } = useSkills();` after `const update = useUpdateAgent();`
- add `skillCount={skillCountFor(a.id, skills)}` to the `<AgentCard ...>` in the left list.

- [ ] **Step 9: Run the tests to verify they pass**

Run: `cd client && pnpm exec vitest run src/components/app-shell/nav.test.ts src/components/confirm-dialog src/app/agents/_components/AgentCard`
Expected: PASS.

- [ ] **Step 10: Run the client suite and type-check**

Run: `cd client && pnpm typecheck && pnpm test`
Expected: PASS.

- [ ] **Step 11: Commit**

```bash
git add client/src/vendor/ui/nav.ts client/src/lib/hooks client/src/components/confirm-dialog client/src/components/app-shell/nav.test.ts client/src/app/agents client/messages/en/agents.json
git commit -m "feat(client): skills data hooks, Skills Lab nav, confirm-before-delete on agent tiles"
```

---

### Task 6: Skills page — card grid and side preview panel

**Files:**
- Create: `client/src/app/skills/page.tsx`
- Create: `client/src/app/skills/_components/SkillsListView/{SkillsListView.tsx,index.ts,helpers.ts,styles.ts,SkillsListView.test.tsx}`
- Create: `client/src/components/skill-type-badge/{SkillTypeBadge.tsx,index.ts}` (shared: the skills pages and the agent Skills tab both use it)
- Create: `client/src/app/skills/_components/SkillCard/{SkillCard.tsx,index.ts,styles.ts,SkillCard.test.tsx}`
- Create: `client/src/app/skills/_components/SkillPreviewPanel/{SkillPreviewPanel.tsx,index.ts}`
- Replace: `client/messages/en/skills.json` (Decision 8; holds the strings for Tasks 6–8)

**Interfaces:**
- Consumes: `useSkills`, `useUpdateSkill`, `useDeleteSkill` (Task 5); `ConfirmDialog` (Task 5).
- Produces: route `/skills`; `SkillsListView()` (no props; rendered inside `AppShell` by the page); `SkillCard({ skill, active?, onOpen, onToggle, onDelete, deleting? })`; `SkillPreviewPanel({ skill, onClose })`; `filterSkills(skills: Skill[], query: string): Skill[]`; `SkillTypeBadge({ type }: { type: SkillType })` from `src/components/skill-type-badge` (label from `skills.type.*`).

- [ ] **Step 1: Write the strings**

Replace `client/messages/en/skills.json` with:

```json
{
  "page": {
    "crumbLab": "Skills Lab",
    "heading": "Skills",
    "subtitle": "Reusable rules in markdown. Attach them to agents; each enabled skill becomes its own block in the review prompt.",
    "searchPlaceholder": "Search skills…",
    "add": "Add skill",
    "addCreate": "Create skill",
    "addImport": "Import from file (.md / .zip)",
    "loadError": "Could not load skills.",
    "noMatch": "No skills match “{q}”.",
    "empty": {
      "title": "No skills yet",
      "body": "Create a skill, or import one from a markdown file or a .zip archive."
    }
  },
  "type": { "rubric": "rubric", "convention": "convention", "security": "security", "custom": "custom" },
  "source": {
    "manual": "Manual",
    "imported_file": "Imported",
    "imported_url": "Imported (URL)",
    "extracted": "Extracted",
    "community": "Community"
  },
  "card": {
    "noDescription": "No description",
    "version": "v{version}",
    "agentCount": "{count, plural, one {# agent} other {# agents}}",
    "delete": "Delete skill",
    "deleteTitle": "Delete skill?",
    "deleteBody": "“{name}” will be detached from {count, plural, one {# agent} other {# agents}} and its version history deleted. This cannot be undone.",
    "deleteConfirm": "Delete",
    "cancel": "Cancel"
  },
  "panel": {
    "open": "Open skill",
    "description": "Description",
    "disabled": "Disabled — not added to any prompt"
  },
  "form": {
    "name": "Name",
    "namePlaceholder": "boundary-cases",
    "nameHint": "Short, unique, kebab-case. Shown as the block header in the prompt.",
    "description": "Description",
    "descriptionPlaceholder": "Flag tests that only cover the happy path of a changed branch.",
    "descriptionHint": "This is the skill's interface: phrase it as a directive — what should the agent do, and when?",
    "type": "Type",
    "body": "Body (Markdown)",
    "bodyPlaceholder": "# Rule\nWhat to check, why it matters, and a good / bad example.",
    "bodyHint": "Inserted verbatim into the prompt of every agent this skill is attached to.",
    "errors": {
      "required": "Required.",
      "tooLong": "Too long."
    }
  },
  "create": {
    "title": "Create skill",
    "subtitle": "Write a rule your agents should check against.",
    "submit": "Create skill",
    "cancel": "Cancel",
    "failed": "Could not create the skill."
  },
  "import": {
    "title": "Import skill",
    "subtitle": "Upload a .md file or a .zip archive. Nothing is saved until you confirm.",
    "fileLabel": "Skill file",
    "fileHint": ".md or .zip, up to 512 KiB. From an archive only the markdown file is read (SKILL.md first); scripts and other files are ignored and never run.",
    "parsing": "Reading the file…",
    "failed": "Could not read this file.",
    "trustNotice": "Someone else's skill is someone else's instructions inside your agent's prompt. It is saved disabled; read it before you enable it.",
    "sourceFile": "Read from {file}",
    "ignored": "Ignored {count, plural, one {# file} other {# files}} (not read, not executed):",
    "rendered": "Rendered preview",
    "confirm": "Import skill",
    "cancel": "Cancel"
  },
  "detail": {
    "crumbSkill": "Skill",
    "back": "← All skills",
    "loadError": "Could not load this skill.",
    "notFoundTitle": "Skill not found",
    "notFoundBody": "It may have been deleted.",
    "tabs": { "config": "Config", "preview": "Preview", "versioning": "Versioning" }
  },
  "config": {
    "enabled": "Enabled",
    "enabledHint": "A disabled skill stays attached to agents but is left out of their prompts.",
    "save": "Save",
    "saved": "Saved · v{version}",
    "versionHint": "Saving a changed body creates a new version.",
    "failed": "Could not save the skill."
  },
  "versioning": {
    "hint": "Every body change is a version. Restore saves an old body as a new version; nothing is overwritten.",
    "current": "current",
    "diff": "Diff",
    "hideDiff": "Hide diff",
    "restore": "Restore",
    "diffTitle": "v{version} → current",
    "loadError": "Could not load versions.",
    "tooLarge": "Too large to diff line by line; showing both bodies in full."
  }
}
```

- [ ] **Step 2: Write the failing tests**

Create `client/src/app/skills/_components/SkillCard/SkillCard.test.tsx`:

```tsx
import { describe, it, expect, afterEach, vi } from "vitest";
import { render, screen, cleanup, fireEvent, within } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import type { Skill } from "@devdigest/shared";
import messages from "../../../../../messages/en/skills.json";
import { SkillCard } from "./SkillCard";

afterEach(cleanup);

const SKILL: Skill = {
  id: "s1",
  name: "boundary-cases",
  description: "Flag tests that skip boundary values.",
  type: "rubric",
  source: "imported_file",
  body: "# Boundary",
  enabled: true,
  version: 3,
  agent_ids: ["a1", "a2"],
  agent_count: 2,
};

function setup(over: Partial<React.ComponentProps<typeof SkillCard>> = {}) {
  const props = { skill: SKILL, onOpen: vi.fn(), onToggle: vi.fn(), onDelete: vi.fn(), ...over };
  render(
    <NextIntlClientProvider locale="en" messages={{ skills: messages }}>
      <SkillCard {...props} />
    </NextIntlClientProvider>,
  );
  return props;
}

describe("SkillCard", () => {
  it("shows name, type, description, version, agent count and source", () => {
    setup();
    expect(screen.getByText("boundary-cases")).toBeInTheDocument();
    expect(screen.getByText("rubric")).toBeInTheDocument();
    expect(screen.getByText("Flag tests that skip boundary values.")).toBeInTheDocument();
    expect(screen.getByText("v3")).toBeInTheDocument();
    expect(screen.getByText("2 agents")).toBeInTheDocument();
    expect(screen.getByText("Imported")).toBeInTheDocument();
  });

  it("toggles without opening the preview", () => {
    const p = setup();
    fireEvent.click(screen.getByRole("switch"));
    expect(p.onToggle).toHaveBeenCalledWith(false);
    expect(p.onOpen).not.toHaveBeenCalled();
  });

  it("opens on click", () => {
    const p = setup();
    fireEvent.click(screen.getByText("boundary-cases"));
    expect(p.onOpen).toHaveBeenCalled();
  });

  it("deletes only after the modal is confirmed", () => {
    const p = setup();
    fireEvent.click(screen.getByRole("button", { name: "Delete skill" }));
    const dialog = screen.getByRole("dialog");
    // Rendered beside the card, so it does not inherit a disabled card's opacity.
    expect(dialog.closest('[role="button"]')).toBeNull();
    expect(within(dialog).getByText(/detached from 2 agents/)).toBeInTheDocument();
    fireEvent.click(within(dialog).getByRole("button", { name: "Cancel" }));
    expect(p.onDelete).not.toHaveBeenCalled();
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Delete skill" }));
    fireEvent.keyDown(screen.getByRole("button", { name: "Delete" }), { key: "Enter" });
    fireEvent.click(screen.getByRole("button", { name: "Delete" }));
    expect(p.onDelete).toHaveBeenCalledTimes(1);
    expect(p.onOpen).not.toHaveBeenCalled();
  });

  it("opens on Enter only when the card itself has focus", () => {
    const p = setup();
    fireEvent.keyDown(screen.getByRole("button", { name: "Delete skill" }), { key: "Enter" });
    expect(p.onOpen).not.toHaveBeenCalled();
    fireEvent.keyDown(screen.getByText("boundary-cases").closest('[role="button"]')!, { key: "Enter" });
    expect(p.onOpen).toHaveBeenCalledTimes(1);
  });
});
```

Create `client/src/app/skills/_components/SkillsListView/SkillsListView.test.tsx`:

```tsx
import { describe, it, expect, afterEach, vi } from "vitest";
import { render, screen, cleanup, fireEvent, within } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import type { Skill } from "@devdigest/shared";
import messages from "../../../../../messages/en/skills.json";
import { filterSkills } from "./helpers";

const { skills, update, del } = vi.hoisted(() => ({
  skills: { current: [] as Skill[] },
  update: vi.fn(),
  del: vi.fn(),
}));
vi.mock("../../../../lib/hooks/skills", () => ({
  useSkills: () => ({ data: skills.current, isLoading: false, isError: false, refetch: vi.fn() }),
  useUpdateSkill: () => ({ mutate: update, isPending: false }),
  useDeleteSkill: () => ({ mutate: del, isPending: false, variables: undefined }),
}));
vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn() }) }));

import { SkillsListView } from "./SkillsListView";

const mk = (id: string, name: string, enabled = true): Skill => ({
  id,
  name,
  description: `About ${name}`,
  type: "convention",
  source: "manual",
  body: `# ${name} heading\n\nRule text.`,
  enabled,
  version: 1,
  agent_ids: [],
  agent_count: 0,
});

afterEach(() => {
  cleanup();
  update.mockReset();
  del.mockReset();
});

function renderView() {
  return render(
    <NextIntlClientProvider locale="en" messages={{ skills: messages }}>
      <SkillsListView />
    </NextIntlClientProvider>,
  );
}

describe("SkillsListView", () => {
  it("renders a card per skill and opens a side preview with the rendered body", () => {
    skills.current = [mk("s1", "no-then-chains"), mk("s2", "secret-leakage")];
    renderView();
    expect(screen.getByText("no-then-chains")).toBeInTheDocument();
    expect(screen.getByText("secret-leakage")).toBeInTheDocument();

    fireEvent.click(screen.getByText("secret-leakage"));
    const panel = screen.getByRole("dialog");
    expect(within(panel).getByRole("heading", { name: "secret-leakage heading" })).toBeInTheDocument();
    expect(within(panel).getByRole("button", { name: "Open skill" })).toBeInTheDocument();
  });

  it("toggles a skill and filters by search text", () => {
    skills.current = [mk("s1", "no-then-chains"), mk("s2", "secret-leakage")];
    renderView();
    fireEvent.click(screen.getAllByRole("switch")[0]!);
    expect(update).toHaveBeenCalledWith({ id: "s1", patch: { enabled: false } });

    fireEvent.change(screen.getByPlaceholderText("Search skills…"), { target: { value: "secret" } });
    expect(screen.queryByText("no-then-chains")).not.toBeInTheDocument();
    expect(screen.getByText("secret-leakage")).toBeInTheDocument();
  });

  it("shows the empty state when there are no skills", () => {
    skills.current = [];
    renderView();
    expect(screen.getByText("No skills yet")).toBeInTheDocument();
  });
});

describe("filterSkills", () => {
  it("matches name or description, case-insensitively", () => {
    const list = [mk("s1", "no-then-chains"), mk("s2", "secret-leakage")];
    expect(filterSkills(list, "  SECRET ").map((s) => s.id)).toEqual(["s2"]);
    expect(filterSkills(list, "about no").map((s) => s.id)).toEqual(["s1"]);
    expect(filterSkills(list, "")).toHaveLength(2);
  });
});
```

- [ ] **Step 3: Run them to verify they fail**

Run: `cd client && pnpm exec vitest run src/app/skills`
Expected: FAIL — `./SkillCard`, `./SkillsListView` and `./helpers` cannot be resolved.

- [ ] **Step 4: Write the skill card**

Create `client/src/components/skill-type-badge/SkillTypeBadge.tsx`:

```tsx
/* SkillTypeBadge — coloured type label (rubric / convention / security / custom).
   Shared by the Skills pages and the agent editor's Skills tab. */
"use client";

import React from "react";
import { useTranslations } from "next-intl";
import { Badge } from "@devdigest/ui";
import type { SkillType } from "@devdigest/shared";

/** Type label colours, as in the Skills tab mockup. */
const TYPE_COLORS: Record<SkillType, string> = {
  rubric: "var(--accent)",
  convention: "var(--success, #3fb950)",
  security: "var(--danger, #f85149)",
  custom: "var(--text-secondary)",
};

export function SkillTypeBadge({ type }: { type: SkillType }) {
  const t = useTranslations("skills");
  return <Badge color={TYPE_COLORS[type]}>{t(`type.${type}`)}</Badge>;
}
```

Create `client/src/components/skill-type-badge/index.ts`:

```ts
export { SkillTypeBadge } from "./SkillTypeBadge";
```

Create `client/src/app/skills/_components/SkillCard/styles.ts`:

```ts
import type React from "react";

export const s = {
  card: (active: boolean, enabled: boolean): React.CSSProperties => ({
    display: "flex",
    flexDirection: "column",
    gap: 10,
    padding: 14,
    borderRadius: 10,
    border: `1px solid ${active ? "var(--accent)" : "var(--border)"}`,
    background: "var(--bg-surface)",
    cursor: "pointer",
    opacity: enabled ? 1 : 0.65,
  }),
  head: { display: "flex", alignItems: "center", gap: 8 } as React.CSSProperties,
  name: { flex: 1, fontSize: 14, fontWeight: 600, overflow: "hidden", textOverflow: "ellipsis" } as React.CSSProperties,
  description: {
    fontSize: 12.5,
    color: "var(--text-secondary)",
    display: "-webkit-box",
    WebkitLineClamp: 2,
    WebkitBoxOrient: "vertical",
    overflow: "hidden",
  } as React.CSSProperties,
  meta: { display: "flex", alignItems: "center", gap: 8, fontSize: 12, color: "var(--text-muted)" } as React.CSSProperties,
  iconBtn: {
    background: "none",
    border: "none",
    cursor: "pointer",
    color: "var(--text-muted)",
    display: "inline-flex",
    padding: 4,
  } as React.CSSProperties,
};
```

Create `client/src/app/skills/_components/SkillCard/SkillCard.tsx`:

```tsx
/* SkillCard — one skill in the Skills grid: name, type, description, version,
   agent count, enabled toggle, delete (with confirmation). Click or Enter on the
   card → preview. The confirm modal renders next to the card, not inside it, so
   it neither inherits the card's opacity nor bubbles clicks/keys into it. */
"use client";

import React from "react";
import { useTranslations } from "next-intl";
import { Badge, Icon, Toggle } from "@devdigest/ui";
import type { Skill } from "@devdigest/shared";
import { ConfirmDialog } from "../../../../components/confirm-dialog";
import { SkillTypeBadge } from "../../../../components/skill-type-badge";
import { s } from "./styles";

export function SkillCard({
  skill,
  active,
  onOpen,
  onToggle,
  onDelete,
  deleting,
}: {
  skill: Skill;
  active?: boolean;
  onOpen: () => void;
  onToggle: (enabled: boolean) => void;
  onDelete: () => void;
  deleting?: boolean;
}) {
  const t = useTranslations("skills");
  const [confirming, setConfirming] = React.useState(false);
  const agents = skill.agent_count ?? 0;
  return (
    <>
      <div
        role="button"
        tabIndex={0}
        onClick={onOpen}
        onKeyDown={(e) => {
          // Only when the card itself has focus — not Enter on the toggle or trash button.
          if (e.key === "Enter" && e.target === e.currentTarget) onOpen();
        }}
        style={s.card(!!active, skill.enabled)}
      >
        <div style={s.head}>
          <Icon.Sparkles size={15} />
          <span className="mono" style={s.name}>
            {skill.name}
          </span>
          <div onClick={(e) => e.stopPropagation()}>
            <Toggle on={skill.enabled} onChange={onToggle} size={14} />
          </div>
          <button
            type="button"
            aria-label={t("card.delete")}
            title={t("card.delete")}
            onClick={(e) => {
              e.stopPropagation();
              setConfirming(true);
            }}
            style={s.iconBtn}
          >
            <Icon.Trash size={14} />
          </button>
        </div>
        <div style={s.description}>{skill.description || t("card.noDescription")}</div>
        <div style={s.meta}>
          <SkillTypeBadge type={skill.type} />
          <span className="mono">{t("card.version", { version: skill.version })}</span>
          <span>{t("card.agentCount", { count: agents })}</span>
          {skill.source === "imported_file" && <Badge icon="Upload">{t("source.imported_file")}</Badge>}
        </div>
      </div>
      {confirming && (
        <ConfirmDialog
          title={t("card.deleteTitle")}
          body={t("card.deleteBody", { name: skill.name, count: agents })}
          confirmLabel={t("card.deleteConfirm")}
          cancelLabel={t("card.cancel")}
          pending={deleting}
          onCancel={() => setConfirming(false)}
          onConfirm={() => {
            onDelete();
            setConfirming(false);
          }}
        />
      )}
    </>
  );
}
```

Create `client/src/app/skills/_components/SkillCard/index.ts`:

```ts
export { SkillCard } from "./SkillCard";
```

- [ ] **Step 5: Write the preview panel**

Create `client/src/app/skills/_components/SkillPreviewPanel/SkillPreviewPanel.tsx`:

```tsx
/* SkillPreviewPanel — right-hand side panel with a skill's rendered body. */
"use client";

import React from "react";
import { useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import { Badge, Button, Drawer, Markdown } from "@devdigest/ui";
import type { Skill } from "@devdigest/shared";
import { SkillTypeBadge } from "../../../../components/skill-type-badge";

export function SkillPreviewPanel({ skill, onClose }: { skill: Skill; onClose: () => void }) {
  const t = useTranslations("skills");
  const router = useRouter();
  return (
    <Drawer
      width={560}
      title={<span className="mono">{skill.name}</span>}
      subtitle={
        <span style={{ display: "inline-flex", gap: 8, alignItems: "center" }}>
          <SkillTypeBadge type={skill.type} />
          <span className="mono">{t("card.version", { version: skill.version })}</span>
          <span>{t("card.agentCount", { count: skill.agent_count ?? 0 })}</span>
        </span>
      }
      onClose={onClose}
      footer={
        <Button kind="primary" icon="ExternalLink" onClick={() => router.push(`/skills/${skill.id}`)}>
          {t("panel.open")}
        </Button>
      }
    >
      <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
        {!skill.enabled && <Badge color="var(--text-muted)">{t("panel.disabled")}</Badge>}
        <div>
          <div style={{ fontSize: 12, color: "var(--text-muted)", marginBottom: 4 }}>{t("panel.description")}</div>
          <div style={{ fontSize: 13 }}>{skill.description || t("card.noDescription")}</div>
        </div>
        <Markdown>{skill.body}</Markdown>
      </div>
    </Drawer>
  );
}
```

Create `client/src/app/skills/_components/SkillPreviewPanel/index.ts`:

```ts
export { SkillPreviewPanel } from "./SkillPreviewPanel";
```

- [ ] **Step 6: Write the list view and the page**

Create `client/src/app/skills/_components/SkillsListView/helpers.ts`:

```ts
import type { Skill } from "@devdigest/shared";

/** Case-insensitive match on name or description; blank query keeps all. */
export function filterSkills(skills: Skill[], query: string): Skill[] {
  const q = query.trim().toLowerCase();
  if (!q) return skills;
  return skills.filter((sk) => sk.name.toLowerCase().includes(q) || sk.description.toLowerCase().includes(q));
}
```

Create `client/src/app/skills/_components/SkillsListView/styles.ts`:

```ts
import type React from "react";

export const s = {
  page: { padding: "24px 28px", display: "flex", flexDirection: "column", gap: 16 } as React.CSSProperties,
  header: { display: "flex", alignItems: "flex-start", gap: 16 } as React.CSSProperties,
  titleBlock: { flex: 1 } as React.CSSProperties,
  title: { fontSize: 20, fontWeight: 700, margin: 0 } as React.CSSProperties,
  subtitle: { fontSize: 13, color: "var(--text-secondary)", margin: "4px 0 0" } as React.CSSProperties,
  search: { maxWidth: 360 } as React.CSSProperties,
  grid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))",
    gap: 12,
  } as React.CSSProperties,
  noMatch: { fontSize: 13, color: "var(--text-muted)" } as React.CSSProperties,
};
```

Create `client/src/app/skills/_components/SkillsListView/SkillsListView.tsx`:

```tsx
/* SkillsListView — the Skills Lab grid: search, cards (toggle / delete),
   and a side preview panel for the selected skill. */
"use client";

import React from "react";
import { useTranslations } from "next-intl";
import { EmptyState, ErrorState, Skeleton, TextInput } from "@devdigest/ui";
import { useDeleteSkill, useSkills, useUpdateSkill } from "../../../../lib/hooks/skills";
import { SkillCard } from "../SkillCard";
import { SkillPreviewPanel } from "../SkillPreviewPanel";
import { filterSkills } from "./helpers";
import { s } from "./styles";

export function SkillsListView() {
  const t = useTranslations("skills");
  const { data, isLoading, isError, refetch } = useSkills();
  const update = useUpdateSkill();
  const del = useDeleteSkill();
  const [query, setQuery] = React.useState("");
  const [openId, setOpenId] = React.useState<string | null>(null);

  const all = data ?? [];
  const list = filterSkills(all, query);
  const open = all.find((sk) => sk.id === openId) ?? null;

  return (
    <div style={s.page}>
      <div style={s.header}>
        <div style={s.titleBlock}>
          <h1 style={s.title}>{t("page.heading")}</h1>
          <p style={s.subtitle}>{t("page.subtitle")}</p>
        </div>
      </div>
      <div style={s.search}>
        <TextInput value={query} onChange={setQuery} placeholder={t("page.searchPlaceholder")} />
      </div>

      {isLoading && (
        <div style={s.grid}>
          <Skeleton height={120} />
          <Skeleton height={120} />
          <Skeleton height={120} />
        </div>
      )}
      {isError && <ErrorState body={t("page.loadError")} onRetry={() => refetch()} />}
      {!isLoading && !isError && all.length === 0 && (
        <EmptyState icon="Sparkles" title={t("page.empty.title")} body={t("page.empty.body")} />
      )}
      {all.length > 0 && list.length === 0 && <div style={s.noMatch}>{t("page.noMatch", { q: query })}</div>}
      {list.length > 0 && (
        <div style={s.grid}>
          {list.map((sk) => (
            <SkillCard
              key={sk.id}
              skill={sk}
              active={sk.id === openId}
              onOpen={() => setOpenId(sk.id)}
              onToggle={(enabled) => update.mutate({ id: sk.id, patch: { enabled } })}
              onDelete={() => {
                del.mutate(sk.id);
                if (openId === sk.id) setOpenId(null);
              }}
              deleting={del.isPending && del.variables === sk.id}
            />
          ))}
        </div>
      )}

      {open && <SkillPreviewPanel skill={open} onClose={() => setOpenId(null)} />}
    </div>
  );
}
```

Create `client/src/app/skills/_components/SkillsListView/index.ts`:

```ts
export { SkillsListView } from "./SkillsListView";
```

Create `client/src/app/skills/page.tsx`:

```tsx
/* /skills — Skills Lab: the skills grid. Thin page: shell + view. */
"use client";

import React from "react";
import { useTranslations } from "next-intl";
import { AppShell } from "../../components/app-shell";
import { SkillsListView } from "./_components/SkillsListView";

export default function SkillsPage() {
  const t = useTranslations("skills");
  return (
    <AppShell crumb={[{ label: t("page.crumbLab") }, { label: t("page.heading") }]}>
      <SkillsListView />
    </AppShell>
  );
}
```

- [ ] **Step 7: Run the tests to verify they pass**

Run: `cd client && pnpm exec vitest run src/app/skills`
Expected: PASS. If `getByRole("heading", { name: "secret-leakage heading" })` fails, check that `Markdown` renders `# …` as an `h1` (it wraps `react-markdown`); do not weaken the test to a text match.

- [ ] **Step 8: Run the client suite and type-check**

Run: `cd client && pnpm typecheck && pnpm test`
Expected: PASS.

- [ ] **Step 9: Commit**

```bash
git add client/src/app/skills client/src/components/skill-type-badge client/messages/en/skills.json
git commit -m "feat(client): skills page with cards, toggle, delete confirmation and side preview"
```

---

### Task 7: Create and import modals behind the "Add skill" menu

**Files:**
- Create: `client/src/app/skills/_components/SkillFormFields/{SkillFormFields.tsx,index.ts,constants.ts,helpers.ts,helpers.test.ts,SkillFormFields.test.tsx}`
- Create: `client/src/app/skills/_components/CreateSkillModal/{CreateSkillModal.tsx,index.ts,CreateSkillModal.test.tsx}`
- Create: `client/src/app/skills/_components/ImportSkillModal/{ImportSkillModal.tsx,index.ts,helpers.ts,helpers.test.ts,ImportSkillModal.test.tsx}`
- Modify: `client/src/app/skills/_components/SkillsListView/SkillsListView.tsx`, `SkillsListView.test.tsx`

**Interfaces:**
- Consumes: `SkillDraft`, `useCreateSkill`, `usePreviewSkillImport` (Task 5); strings `skills.form.*`, `skills.create.*`, `skills.import.*` (Task 6).
- Produces: `SkillFormFields({ value: SkillDraft; onChange: (d: SkillDraft) => void; errors?: SkillDraftErrors })`; `validateSkillDraft(d: SkillDraft): SkillDraftErrors` (`Partial<Record<"name" | "description" | "body", "required" | "tooLong">>`); `toDraft(skill: Skill): SkillDraft`; `EMPTY_DRAFT`; `SKILL_TYPES`; `DRAFT_LIMITS = { name: 80, description: 500, body: 50000 }` (same limits as the server); `CreateSkillModal({ onClose, onCreated: (s: Skill) => void })`; `ImportSkillModal({ onClose, onImported: (s: Skill) => void })`; `fileToBase64(file: Blob): Promise<string>`.

- [ ] **Step 1: Write the failing tests**

Create `client/src/app/skills/_components/SkillFormFields/helpers.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { validateSkillDraft, toDraft, EMPTY_DRAFT, DRAFT_LIMITS } from "./helpers";

describe("validateSkillDraft", () => {
  it("requires name, description and body (whitespace does not count)", () => {
    expect(validateSkillDraft({ ...EMPTY_DRAFT, name: "  " })).toEqual({
      name: "required",
      description: "required",
      body: "required",
    });
  });

  it("accepts a complete draft and flags over-long fields", () => {
    const ok = { name: "x", description: "Flag y.", type: "rubric" as const, body: "# z" };
    expect(validateSkillDraft(ok)).toEqual({});
    expect(validateSkillDraft({ ...ok, name: "n".repeat(DRAFT_LIMITS.name + 1) })).toEqual({ name: "tooLong" });
  });
});

describe("toDraft", () => {
  it("keeps only the editable fields", () => {
    expect(
      toDraft({
        id: "s1",
        name: "a",
        description: "b",
        type: "security",
        source: "manual",
        body: "c",
        enabled: true,
        version: 2,
      }),
    ).toEqual({ name: "a", description: "b", type: "security", body: "c" });
  });
});
```

Create `client/src/app/skills/_components/SkillFormFields/SkillFormFields.test.tsx`:

```tsx
import { describe, it, expect, afterEach, vi } from "vitest";
import { render, screen, cleanup, fireEvent } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import messages from "../../../../../messages/en/skills.json";
import { SkillFormFields } from "./SkillFormFields";
import { EMPTY_DRAFT } from "./helpers";

afterEach(cleanup);

describe("SkillFormFields", () => {
  it("renders name, description (with the directive caption), type and markdown body", () => {
    const onChange = vi.fn();
    render(
      <NextIntlClientProvider locale="en" messages={{ skills: messages }}>
        <SkillFormFields value={EMPTY_DRAFT} onChange={onChange} errors={{ name: "required" }} />
      </NextIntlClientProvider>,
    );
    expect(screen.getByText("Name")).toBeInTheDocument();
    expect(screen.getByText(/phrase it as a directive/)).toBeInTheDocument();
    expect(screen.getByRole("combobox")).toHaveValue("custom");
    expect(screen.getByText("Body (Markdown)")).toBeInTheDocument();
    expect(screen.getByRole("alert")).toHaveTextContent("Required.");

    fireEvent.change(screen.getByRole("combobox"), { target: { value: "security" } });
    expect(onChange).toHaveBeenCalledWith({ ...EMPTY_DRAFT, type: "security" });
  });
});
```

Create `client/src/app/skills/_components/CreateSkillModal/CreateSkillModal.test.tsx`:

```tsx
import { describe, it, expect, afterEach, vi } from "vitest";
import { render, screen, cleanup, fireEvent } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import messages from "../../../../../messages/en/skills.json";

const { create } = vi.hoisted(() => ({ create: vi.fn() }));
vi.mock("../../../../lib/hooks/skills", () => ({
  useCreateSkill: () => ({ mutate: create, isPending: false, isError: false, error: null }),
}));

import { CreateSkillModal } from "./CreateSkillModal";

afterEach(() => {
  cleanup();
  create.mockReset();
});

function setup() {
  const onCreated = vi.fn();
  render(
    <NextIntlClientProvider locale="en" messages={{ skills: messages }}>
      <CreateSkillModal onClose={vi.fn()} onCreated={onCreated} />
    </NextIntlClientProvider>,
  );
  return { onCreated };
}

describe("CreateSkillModal", () => {
  it("blocks an incomplete skill, then creates a complete one", () => {
    const { onCreated } = setup();
    fireEvent.click(screen.getByRole("button", { name: "Create skill" }));
    expect(create).not.toHaveBeenCalled();
    expect(screen.getAllByRole("alert")).toHaveLength(3);

    fireEvent.change(screen.getByPlaceholderText("boundary-cases"), { target: { value: "boundary-cases" } });
    fireEvent.change(screen.getByPlaceholderText(/Flag tests that only cover/), {
      target: { value: "Flag tests that skip boundary values." },
    });
    fireEvent.change(screen.getByPlaceholderText(/# Rule/), { target: { value: "# Boundaries\nTest 0 and max." } });
    fireEvent.change(screen.getByRole("combobox"), { target: { value: "rubric" } });

    create.mockImplementation((_input, opts) => opts.onSuccess({ id: "s9" }));
    fireEvent.click(screen.getByRole("button", { name: "Create skill" }));
    expect(create).toHaveBeenCalledWith(
      {
        name: "boundary-cases",
        description: "Flag tests that skip boundary values.",
        type: "rubric",
        body: "# Boundaries\nTest 0 and max.",
      },
      expect.anything(),
    );
    expect(onCreated).toHaveBeenCalledWith({ id: "s9" });
  });
});
```

Create `client/src/app/skills/_components/ImportSkillModal/helpers.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { fileToBase64 } from "./helpers";

describe("fileToBase64", () => {
  it("returns the file's bytes as base64 without the data-URL prefix", async () => {
    expect(await fileToBase64(new File(["# hi"], "a.md", { type: "text/markdown" }))).toBe("IyBoaQ==");
  });
});
```

Create `client/src/app/skills/_components/ImportSkillModal/ImportSkillModal.test.tsx`:

```tsx
import { describe, it, expect, afterEach, vi } from "vitest";
import { render, screen, cleanup, fireEvent, waitFor } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import type { SkillImportPreview } from "@devdigest/shared";
import messages from "../../../../../messages/en/skills.json";

const PREVIEW: SkillImportPreview = {
  name: "boundary-cases",
  description: "",
  type: "rubric",
  body: "# Boundary cases\n\nTest 0 and max.",
  source_file: "boundary-cases/SKILL.md",
  ignored_files: ["boundary-cases/run.sh"],
};
const { preview, create } = vi.hoisted(() => ({ preview: vi.fn(), create: vi.fn() }));
vi.mock("../../../../lib/hooks/skills", () => ({
  usePreviewSkillImport: () => ({ mutate: preview, reset: vi.fn(), isPending: false, isError: false, error: null }),
  useCreateSkill: () => ({ mutate: create, isPending: false, isError: false, error: null }),
}));

import { ImportSkillModal } from "./ImportSkillModal";

afterEach(() => {
  cleanup();
  preview.mockReset();
  create.mockReset();
});

describe("ImportSkillModal", () => {
  it("previews the upload, requires a description, and saves only on confirm", async () => {
    preview.mockImplementation((_input, opts) => opts.onSuccess(PREVIEW));
    const onImported = vi.fn();
    render(
      <NextIntlClientProvider locale="en" messages={{ skills: messages }}>
        <ImportSkillModal onClose={vi.fn()} onImported={onImported} />
      </NextIntlClientProvider>,
    );
    expect(screen.getByRole("button", { name: "Import skill" })).toBeDisabled();

    const file = new File(["zip-bytes"], "boundary-cases.zip", { type: "application/zip" });
    fireEvent.change(screen.getByLabelText("Skill file"), { target: { files: [file] } });

    await waitFor(() =>
      expect(preview).toHaveBeenCalledWith(
        { filename: "boundary-cases.zip", content_base64: btoa("zip-bytes") },
        expect.anything(),
      ),
    );
    expect(await screen.findByRole("heading", { name: "Boundary cases" })).toBeInTheDocument();
    expect(screen.getByText("boundary-cases/run.sh")).toBeInTheDocument();
    expect(screen.getByText(/someone else's instructions/)).toBeInTheDocument();
    expect(create).not.toHaveBeenCalled();

    // The archive had no description → confirm is blocked until it is filled in.
    fireEvent.click(screen.getByRole("button", { name: "Import skill" }));
    expect(create).not.toHaveBeenCalled();
    expect(screen.getByRole("alert")).toHaveTextContent("Required.");

    fireEvent.change(screen.getByPlaceholderText(/Flag tests that only cover/), {
      target: { value: "Flag tests that skip boundary values." },
    });
    create.mockImplementation((_input, opts) => opts.onSuccess({ id: "s1" }));
    fireEvent.click(screen.getByRole("button", { name: "Import skill" }));
    expect(create).toHaveBeenCalledWith(
      {
        name: "boundary-cases",
        description: "Flag tests that skip boundary values.",
        type: "rubric",
        body: "# Boundary cases\n\nTest 0 and max.",
        source: "imported_file",
      },
      expect.anything(),
    );
    expect(onImported).toHaveBeenCalledWith({ id: "s1" });
  });
});
```

In `client/src/app/skills/_components/SkillsListView/SkillsListView.test.tsx`, replace the `vi.mock("../../../../lib/hooks/skills", ...)` block with:

```tsx
vi.mock("../../../../lib/hooks/skills", () => ({
  useSkills: () => ({ data: skills.current, isLoading: false, isError: false, refetch: vi.fn() }),
  useUpdateSkill: () => ({ mutate: update, isPending: false }),
  useDeleteSkill: () => ({ mutate: del, isPending: false, variables: undefined }),
  useCreateSkill: () => ({ mutate: vi.fn(), isPending: false, isError: false, error: null }),
  usePreviewSkillImport: () => ({ mutate: vi.fn(), reset: vi.fn(), isPending: false, isError: false, error: null }),
}));
```

and add this test inside `describe("SkillsListView", ...)`:

```tsx
  it("offers create or import from the Add menu, each in a modal", () => {
    skills.current = [mk("s1", "no-then-chains")];
    renderView();
    fireEvent.click(screen.getByRole("button", { name: "Add skill" }));
    fireEvent.click(screen.getByRole("button", { name: "Create skill" }));
    expect(within(screen.getByRole("dialog")).getByPlaceholderText("boundary-cases")).toBeInTheDocument();
    fireEvent.click(within(screen.getByRole("dialog")).getByRole("button", { name: "Cancel" }));
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Add skill" }));
    fireEvent.click(screen.getByRole("button", { name: "Import from file (.md / .zip)" }));
    expect(within(screen.getByRole("dialog")).getByLabelText("Skill file")).toBeInTheDocument();
  });
```

- [ ] **Step 2: Run them to verify they fail**

Run: `cd client && pnpm exec vitest run src/app/skills`
Expected: FAIL — `SkillFormFields`, `CreateSkillModal`, `ImportSkillModal` modules missing; the Add-menu test finds no "Add skill" button.

- [ ] **Step 3: Write the shared form**

Create `client/src/app/skills/_components/SkillFormFields/constants.ts`:

```ts
import type { SkillType } from "@devdigest/shared";

export const SKILL_TYPES: readonly SkillType[] = ["rubric", "convention", "security", "custom"];

/** Same limits as the server's request schema (server/src/modules/skills/routes.ts). */
export const DRAFT_LIMITS = { name: 80, description: 500, body: 50_000 } as const;
```

Create `client/src/app/skills/_components/SkillFormFields/helpers.ts`:

```ts
import type { Skill } from "@devdigest/shared";
import type { SkillDraft } from "../../../../lib/hooks/skills";
import { DRAFT_LIMITS } from "./constants";

export { DRAFT_LIMITS };

export type SkillDraftErrors = Partial<Record<"name" | "description" | "body", "required" | "tooLong">>;

export const EMPTY_DRAFT: SkillDraft = { name: "", description: "", type: "custom", body: "" };

export function toDraft(skill: Skill): SkillDraft {
  return { name: skill.name, description: skill.description, type: skill.type, body: skill.body };
}

export function validateSkillDraft(draft: SkillDraft): SkillDraftErrors {
  const errors: SkillDraftErrors = {};
  for (const key of ["name", "description", "body"] as const) {
    const value = draft[key].trim();
    if (!value) errors[key] = "required";
    else if (value.length > DRAFT_LIMITS[key]) errors[key] = "tooLong";
  }
  return errors;
}
```

Create `client/src/app/skills/_components/SkillFormFields/SkillFormFields.tsx`:

```tsx
/* SkillFormFields — name, directive description, type, markdown body.
   Shared by the create modal, the import preview and the skill Config tab. */
"use client";

import React from "react";
import { useTranslations } from "next-intl";
import { FormField, SelectInput, TextInput, Textarea } from "@devdigest/ui";
import type { SkillType } from "@devdigest/shared";
import type { SkillDraft } from "../../../../lib/hooks/skills";
import { SKILL_TYPES } from "./constants";
import type { SkillDraftErrors } from "./helpers";

export function SkillFormFields({
  value,
  onChange,
  errors = {},
}: {
  value: SkillDraft;
  onChange: (draft: SkillDraft) => void;
  errors?: SkillDraftErrors;
}) {
  const t = useTranslations("skills");
  const set =
    <K extends keyof SkillDraft>(key: K) =>
    (v: SkillDraft[K]) =>
      onChange({ ...value, [key]: v });
  const hint = (key: keyof SkillDraftErrors, fallback: string) =>
    errors[key] ? (
      <span role="alert" style={{ color: "var(--danger, #f85149)" }}>
        {t(`form.errors.${errors[key]}`)}
      </span>
    ) : (
      fallback
    );

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
      <FormField label={t("form.name")} required hint={hint("name", t("form.nameHint"))}>
        <TextInput mono value={value.name} onChange={set("name")} placeholder={t("form.namePlaceholder")} />
      </FormField>
      <FormField label={t("form.description")} required hint={hint("description", t("form.descriptionHint"))}>
        <TextInput
          value={value.description}
          onChange={set("description")}
          placeholder={t("form.descriptionPlaceholder")}
        />
      </FormField>
      <FormField label={t("form.type")}>
        <SelectInput
          value={value.type}
          onChange={(v) => set("type")(v as SkillType)}
          options={SKILL_TYPES.map((v) => ({ value: v, label: t(`type.${v}`) }))}
        />
      </FormField>
      <FormField label={t("form.body")} required hint={hint("body", t("form.bodyHint"))}>
        <Textarea mono rows={14} value={value.body} onChange={set("body")} placeholder={t("form.bodyPlaceholder")} />
      </FormField>
    </div>
  );
}
```

Create `client/src/app/skills/_components/SkillFormFields/index.ts`:

```ts
export { SkillFormFields } from "./SkillFormFields";
export { validateSkillDraft, toDraft, EMPTY_DRAFT, type SkillDraftErrors } from "./helpers";
export { SKILL_TYPES, DRAFT_LIMITS } from "./constants";
```

- [ ] **Step 4: Write the create modal**

Create `client/src/app/skills/_components/CreateSkillModal/CreateSkillModal.tsx`:

```tsx
/* CreateSkillModal — write a new skill from scratch. */
"use client";

import React from "react";
import { useTranslations } from "next-intl";
import { Button, Modal } from "@devdigest/ui";
import type { Skill } from "@devdigest/shared";
import { useCreateSkill, type SkillDraft } from "../../../../lib/hooks/skills";
import { ApiError } from "../../../../lib/api";
import { EMPTY_DRAFT, SkillFormFields, validateSkillDraft } from "../SkillFormFields";

export function CreateSkillModal({ onClose, onCreated }: { onClose: () => void; onCreated: (skill: Skill) => void }) {
  const t = useTranslations("skills");
  const create = useCreateSkill();
  const [draft, setDraft] = React.useState<SkillDraft>(EMPTY_DRAFT);
  const [submitted, setSubmitted] = React.useState(false);
  const errors = validateSkillDraft(draft);

  const submit = () => {
    setSubmitted(true);
    if (Object.keys(errors).length > 0) return;
    create.mutate(draft, { onSuccess: onCreated });
  };

  return (
    <Modal
      width={720}
      title={t("create.title")}
      subtitle={t("create.subtitle")}
      onClose={onClose}
      footer={
        <div style={{ display: "flex", gap: 8, justifyContent: "flex-end", width: "100%" }}>
          <Button kind="secondary" onClick={onClose}>
            {t("create.cancel")}
          </Button>
          <Button kind="primary" loading={create.isPending} onClick={submit}>
            {t("create.submit")}
          </Button>
        </div>
      }
    >
      <SkillFormFields value={draft} onChange={setDraft} errors={submitted ? errors : {}} />
      {create.isError && (
        <div role="alert" style={{ marginTop: 12, color: "var(--danger, #f85149)", fontSize: 13 }}>
          {create.error instanceof ApiError ? create.error.message : t("create.failed")}
        </div>
      )}
    </Modal>
  );
}
```

Create `client/src/app/skills/_components/CreateSkillModal/index.ts`:

```ts
export { CreateSkillModal } from "./CreateSkillModal";
```

- [ ] **Step 5: Write the import modal**

Create `client/src/app/skills/_components/ImportSkillModal/helpers.ts`:

```ts
/** Read a file as base64 (no `data:` prefix) for the JSON import-preview request. */
export function fileToBase64(file: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(reader.error ?? new Error("Could not read the file"));
    reader.onload = () => {
      const url = String(reader.result);
      resolve(url.slice(url.indexOf(",") + 1));
    };
    reader.readAsDataURL(file);
  });
}
```

Create `client/src/app/skills/_components/ImportSkillModal/ImportSkillModal.tsx`:

```tsx
/* ImportSkillModal — upload .md / .zip → server-side parse → editable preview
   → explicit confirm. Nothing is saved before "Import skill"; the saved skill
   starts disabled (server default for imported_file). */
"use client";

import React from "react";
import { useTranslations } from "next-intl";
import { Button, Icon, Markdown, Modal, Skeleton } from "@devdigest/ui";
import type { Skill } from "@devdigest/shared";
import { useCreateSkill, usePreviewSkillImport, type SkillDraft } from "../../../../lib/hooks/skills";
import { ApiError } from "../../../../lib/api";
import { SkillFormFields, validateSkillDraft } from "../SkillFormFields";
import { fileToBase64 } from "./helpers";

interface SourceInfo {
  source_file: string;
  ignored_files: string[];
}

export function ImportSkillModal({ onClose, onImported }: { onClose: () => void; onImported: (skill: Skill) => void }) {
  const t = useTranslations("skills");
  const preview = usePreviewSkillImport();
  const create = useCreateSkill();
  const [draft, setDraft] = React.useState<SkillDraft | null>(null);
  const [source, setSource] = React.useState<SourceInfo | null>(null);
  const [submitted, setSubmitted] = React.useState(false);
  const errors = draft ? validateSkillDraft(draft) : {};

  const onFile = async (file: File) => {
    setDraft(null);
    setSource(null);
    setSubmitted(false);
    preview.reset();
    const content_base64 = await fileToBase64(file);
    preview.mutate(
      { filename: file.name, content_base64 },
      {
        onSuccess: (p) => {
          setDraft({ name: p.name, description: p.description, type: p.type, body: p.body });
          setSource({ source_file: p.source_file, ignored_files: p.ignored_files });
        },
      },
    );
  };

  const confirm = () => {
    if (!draft) return;
    setSubmitted(true);
    if (Object.keys(errors).length > 0) return;
    create.mutate({ ...draft, source: "imported_file" }, { onSuccess: onImported });
  };

  const failure = preview.error ?? create.error;
  return (
    <Modal
      width={820}
      title={t("import.title")}
      subtitle={t("import.subtitle")}
      onClose={onClose}
      footer={
        <div style={{ display: "flex", gap: 8, justifyContent: "flex-end", width: "100%" }}>
          <Button kind="secondary" onClick={onClose}>
            {t("import.cancel")}
          </Button>
          <Button kind="primary" disabled={!draft} loading={create.isPending} onClick={confirm}>
            {t("import.confirm")}
          </Button>
        </div>
      }
    >
      <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
        <div>
          <input
            type="file"
            accept=".md,.markdown,.zip"
            aria-label={t("import.fileLabel")}
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) void onFile(file);
            }}
          />
          <div style={{ fontSize: 12, color: "var(--text-muted)", marginTop: 6 }}>{t("import.fileHint")}</div>
        </div>

        {preview.isPending && <Skeleton height={120} />}
        {failure && (
          <div role="alert" style={{ color: "var(--danger, #f85149)", fontSize: 13 }}>
            {failure instanceof ApiError ? failure.message : t("import.failed")}
          </div>
        )}

        {draft && source && (
          <>
            <div
              style={{
                display: "flex",
                gap: 8,
                alignItems: "flex-start",
                padding: 10,
                borderRadius: 8,
                border: "1px solid var(--border)",
                fontSize: 12.5,
              }}
            >
              <Icon.Shield size={14} />
              <span>{t("import.trustNotice")}</span>
            </div>
            <div className="mono" style={{ fontSize: 12, color: "var(--text-secondary)" }}>
              {t("import.sourceFile", { file: source.source_file })}
            </div>
            {source.ignored_files.length > 0 && (
              <div style={{ fontSize: 12, color: "var(--text-secondary)" }}>
                {t("import.ignored", { count: source.ignored_files.length })}
                <ul style={{ margin: "4px 0 0", paddingLeft: 18 }}>
                  {source.ignored_files.map((f) => (
                    <li key={f} className="mono">
                      {f}
                    </li>
                  ))}
                </ul>
              </div>
            )}
            <SkillFormFields value={draft} onChange={setDraft} errors={submitted ? errors : {}} />
            <div style={{ fontSize: 12, color: "var(--text-muted)" }}>{t("import.rendered")}</div>
            <div style={{ padding: 12, borderRadius: 8, border: "1px solid var(--border)" }}>
              <Markdown>{draft.body}</Markdown>
            </div>
          </>
        )}
      </div>
    </Modal>
  );
}
```

Create `client/src/app/skills/_components/ImportSkillModal/index.ts`:

```ts
export { ImportSkillModal } from "./ImportSkillModal";
```

- [ ] **Step 6: Add the menu to the list view**

In `client/src/app/skills/_components/SkillsListView/SkillsListView.tsx`:
- change the `@devdigest/ui` import to `import { Button, Dropdown, EmptyState, ErrorState, Skeleton, TextInput } from "@devdigest/ui";`
- add `import { CreateSkillModal } from "../CreateSkillModal";` and `import { ImportSkillModal } from "../ImportSkillModal";`
- add `const [mode, setMode] = React.useState<"create" | "import" | null>(null);` after the `openId` state, and this function after it:

```tsx
  const onSaved = (skill: { id: string }) => {
    setMode(null);
    setOpenId(skill.id);
  };
```

- inside `<div style={s.header}>`, after the title block, add:

```tsx
        <Dropdown
          width={260}
          align="right"
          trigger={
            <Button kind="primary" icon="Plus">
              {t("page.add")}
            </Button>
          }
          items={[
            { label: t("page.addCreate"), icon: "Edit", onClick: () => setMode("create") },
            { label: t("page.addImport"), icon: "Upload", onClick: () => setMode("import") },
          ]}
        />
```

- give the empty state a create CTA: `cta={t("page.addCreate")} onCta={() => setMode("create")}`
- before `{open && <SkillPreviewPanel ... />}`, add:

```tsx
      {mode === "create" && <CreateSkillModal onClose={() => setMode(null)} onCreated={onSaved} />}
      {mode === "import" && <ImportSkillModal onClose={() => setMode(null)} onImported={onSaved} />}
```

- [ ] **Step 7: Run the tests to verify they pass**

Run: `cd client && pnpm exec vitest run src/app/skills`
Expected: PASS.

- [ ] **Step 8: Run the client suite and type-check**

Run: `cd client && pnpm typecheck && pnpm test`
Expected: PASS.

- [ ] **Step 9: Commit**

```bash
git add client/src/app/skills
git commit -m "feat(client): create a skill or import one from .md/.zip with a confirmed preview"
```

---

### Task 8: Skill page `/skills/:id` — Config, Preview, Versioning

**Files:**
- Create: `client/src/app/skills/[id]/page.tsx`
- Create: `client/src/app/skills/[id]/_components/SkillDetail/{SkillDetail.tsx,index.ts,constants.ts,SkillDetail.test.tsx}`
- Create: `client/src/app/skills/[id]/_components/SkillDetail/_components/ConfigTab/{ConfigTab.tsx,index.ts}`
- Create: `client/src/app/skills/[id]/_components/SkillDetail/_components/PreviewTab/{PreviewTab.tsx,index.ts}`
- Create: `client/src/app/skills/[id]/_components/SkillDetail/_components/VersioningTab/{VersioningTab.tsx,index.ts,helpers.ts,helpers.test.ts}`
- Modify: `client/README.md` (UI route map: add `/skills` and `/skills/:id`)

**Interfaces:**
- Consumes: `useSkill`, `useUpdateSkill`, `useSkillVersions`, `useRestoreSkillVersion` (Task 5); `SkillFormFields`, `toDraft`, `validateSkillDraft` (Task 7); `SkillTypeBadge` (Task 6).
- Produces: route `/skills/:id?tab=config|preview|versioning`; `SkillDetail({ skill, tab, onTab })`; `lineDiff(from: string, to: string): DiffLine[]` with `DiffLine = { kind: "same" | "add" | "del"; text: string }` and `MAX_DIFF_CELLS = 4_000_000`.

- [ ] **Step 1: Write the failing tests**

Create `client/src/app/skills/[id]/_components/SkillDetail/_components/VersioningTab/helpers.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { lineDiff, MAX_DIFF_CELLS } from "./helpers";

describe("lineDiff", () => {
  it("marks removed, added and unchanged lines from old to current", () => {
    expect(lineDiff("a\nb\nc", "a\nc\nd")).toEqual([
      { kind: "same", text: "a" },
      { kind: "del", text: "b" },
      { kind: "same", text: "c" },
      { kind: "add", text: "d" },
    ]);
  });

  it("returns only unchanged lines for identical bodies", () => {
    expect(lineDiff("x\ny", "x\ny").every((l) => l.kind === "same")).toBe(true);
  });

  it("falls back to whole-body del/add when the bodies are too large", () => {
    const big = Array.from({ length: Math.ceil(Math.sqrt(MAX_DIFF_CELLS)) + 1 }, (_, i) => `l${i}`).join("\n");
    const out = lineDiff(big, big + "\nextra");
    expect(out[0]!.kind).toBe("del");
    expect(out[out.length - 1]).toEqual({ kind: "add", text: "extra" });
  });
});
```

Create `client/src/app/skills/[id]/_components/SkillDetail/SkillDetail.test.tsx`:

```tsx
import { describe, it, expect, afterEach, vi } from "vitest";
import { render, screen, cleanup, fireEvent } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import type { Skill, SkillVersion } from "@devdigest/shared";
import messages from "../../../../../../messages/en/skills.json";

const { update, restore } = vi.hoisted(() => ({ update: vi.fn(), restore: vi.fn() }));
const VERSIONS: SkillVersion[] = [
  { skill_id: "s1", version: 2, body: "# Rule\nnew line", created_at: "2026-10-08T10:00:00.000Z" },
  { skill_id: "s1", version: 1, body: "# Rule\nold line", created_at: "2026-10-07T10:00:00.000Z" },
];
vi.mock("../../../../../lib/hooks/skills", () => ({
  useUpdateSkill: () => ({ mutate: update, isPending: false, isError: false, error: null }),
  useSkillVersions: () => ({ data: VERSIONS, isLoading: false, isError: false, refetch: vi.fn() }),
  useRestoreSkillVersion: () => ({ mutate: restore, isPending: false, variables: undefined }),
}));

import { SkillDetail } from "./SkillDetail";

const SKILL: Skill = {
  id: "s1",
  name: "no-then-chains",
  description: "Flag .then() chains in new code.",
  type: "convention",
  source: "manual",
  body: "# Rule\nnew line",
  enabled: true,
  version: 2,
  agent_ids: [],
  agent_count: 0,
};

afterEach(() => {
  cleanup();
  update.mockReset();
  restore.mockReset();
});

function renderTab(tab: string) {
  return render(
    <NextIntlClientProvider locale="en" messages={{ skills: messages }}>
      <SkillDetail skill={SKILL} tab={tab} onTab={() => {}} />
    </NextIntlClientProvider>,
  );
}

describe("SkillDetail", () => {
  it("has exactly the Config, Preview and Versioning tabs", () => {
    renderTab("config");
    for (const label of ["Config", "Preview", "Versioning"]) {
      expect(screen.getByRole("button", { name: label })).toBeInTheDocument();
    }
    expect(screen.queryByRole("button", { name: "Stats" })).not.toBeInTheDocument();
  });

  it("Preview renders the markdown body, not the raw text", () => {
    renderTab("preview");
    expect(screen.getByRole("heading", { name: "Rule" })).toBeInTheDocument();
    expect(screen.queryByText("# Rule")).not.toBeInTheDocument();
  });

  it("Config saves edited fields and toggles enabled", () => {
    renderTab("config");
    expect(screen.getByRole("button", { name: "Save" })).toBeDisabled();
    fireEvent.change(screen.getByDisplayValue("Flag .then() chains in new code."), {
      target: { value: "Flag promise chains." },
    });
    fireEvent.click(screen.getByRole("button", { name: "Save" }));
    expect(update).toHaveBeenCalledWith(
      {
        id: "s1",
        patch: { name: "no-then-chains", description: "Flag promise chains.", type: "convention", body: "# Rule\nnew line" },
      },
      expect.anything(),
    );

    fireEvent.click(screen.getByRole("switch"));
    expect(update).toHaveBeenCalledWith({ id: "s1", patch: { enabled: false } });
  });

  it("Versioning lists versions, diffs an old one against current, and restores it", () => {
    renderTab("versioning");
    expect(screen.getByText("v2")).toBeInTheDocument();
    expect(screen.getByText("current")).toBeInTheDocument();
    expect(screen.getAllByRole("button", { name: "Diff" })).toHaveLength(1);

    fireEvent.click(screen.getByRole("button", { name: "Diff" }));
    expect(screen.getByText("- old line")).toBeInTheDocument();
    expect(screen.getByText("+ new line")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Restore" }));
    expect(restore).toHaveBeenCalledWith({ id: "s1", version: 1 });
  });
});
```

- [ ] **Step 2: Run them to verify they fail**

Run: `cd client && pnpm exec vitest run "src/app/skills/\[id\]"`
Expected: FAIL — `./helpers` and `./SkillDetail` cannot be resolved.

- [ ] **Step 3: Write the diff helper**

Create `client/src/app/skills/[id]/_components/SkillDetail/_components/VersioningTab/helpers.ts`:

```ts
export interface DiffLine {
  kind: "same" | "add" | "del";
  text: string;
}

/** Above this many LCS cells the diff is too costly; fall back to del-all/add-all. */
export const MAX_DIFF_CELLS = 4_000_000;

/** Line diff from `from` (an old version) to `to` (the current body), LCS-based. */
export function lineDiff(from: string, to: string): DiffLine[] {
  const a = from.split("\n");
  const b = to.split("\n");
  const n = a.length;
  const m = b.length;
  if (n * m > MAX_DIFF_CELLS) {
    return [...a.map((text) => ({ kind: "del" as const, text })), ...b.map((text) => ({ kind: "add" as const, text }))];
  }
  const lcs: number[][] = Array.from({ length: n + 1 }, () => new Array<number>(m + 1).fill(0));
  for (let i = n - 1; i >= 0; i--) {
    for (let j = m - 1; j >= 0; j--) {
      lcs[i]![j] = a[i] === b[j] ? lcs[i + 1]![j + 1]! + 1 : Math.max(lcs[i + 1]![j]!, lcs[i]![j + 1]!);
    }
  }
  const out: DiffLine[] = [];
  let i = 0;
  let j = 0;
  while (i < n && j < m) {
    if (a[i] === b[j]) {
      out.push({ kind: "same", text: a[i]! });
      i++;
      j++;
    } else if (lcs[i + 1]![j]! >= lcs[i]![j + 1]!) {
      out.push({ kind: "del", text: a[i++]! });
    } else {
      out.push({ kind: "add", text: b[j++]! });
    }
  }
  while (i < n) out.push({ kind: "del", text: a[i++]! });
  while (j < m) out.push({ kind: "add", text: b[j++]! });
  return out;
}
```

- [ ] **Step 4: Write the three tabs**

Create `client/src/app/skills/[id]/_components/SkillDetail/_components/PreviewTab/PreviewTab.tsx`:

```tsx
/* PreviewTab — the skill body rendered as markdown (what the agent will read). */
"use client";

import React from "react";
import { Markdown } from "@devdigest/ui";
import type { Skill } from "@devdigest/shared";

export function PreviewTab({ skill }: { skill: Skill }) {
  return (
    <div style={{ padding: "20px 24px", maxWidth: 860, display: "flex", flexDirection: "column", gap: 12 }}>
      <blockquote style={{ margin: 0, paddingLeft: 12, borderLeft: "3px solid var(--border)", color: "var(--text-secondary)" }}>
        {skill.description}
      </blockquote>
      <Markdown>{skill.body}</Markdown>
    </div>
  );
}
```

Create `client/src/app/skills/[id]/_components/SkillDetail/_components/PreviewTab/index.ts`:

```ts
export { PreviewTab } from "./PreviewTab";
```

Create `client/src/app/skills/[id]/_components/SkillDetail/_components/ConfigTab/ConfigTab.tsx`:

```tsx
/* ConfigTab — edit name / description / type / body, and the enabled toggle. */
"use client";

import React from "react";
import { useTranslations } from "next-intl";
import { Button, FormField, Toggle } from "@devdigest/ui";
import type { Skill } from "@devdigest/shared";
import { useUpdateSkill, type SkillDraft } from "../../../../../../../lib/hooks/skills";
import { ApiError } from "../../../../../../../lib/api";
import { SkillFormFields, toDraft, validateSkillDraft } from "../../../../../_components/SkillFormFields";

const sameDraft = (a: SkillDraft, b: SkillDraft) =>
  a.name === b.name && a.description === b.description && a.type === b.type && a.body === b.body;

export function ConfigTab({ skill }: { skill: Skill }) {
  const t = useTranslations("skills");
  const update = useUpdateSkill();
  const [draft, setDraft] = React.useState<SkillDraft>(() => toDraft(skill));
  const [submitted, setSubmitted] = React.useState(false);
  const [savedVersion, setSavedVersion] = React.useState<number | null>(null);
  const errors = validateSkillDraft(draft);
  const dirty = !sameDraft(draft, toDraft(skill));

  const save = () => {
    setSubmitted(true);
    if (Object.keys(errors).length > 0) return;
    update.mutate(
      { id: skill.id, patch: draft },
      {
        onSuccess: (saved) => {
          setDraft(toDraft(saved));
          setSavedVersion(saved.version);
          setSubmitted(false);
        },
      },
    );
  };

  return (
    <div style={{ padding: "20px 24px", maxWidth: 860, display: "flex", flexDirection: "column", gap: 16 }}>
      <FormField label={t("config.enabled")} hint={t("config.enabledHint")}>
        <Toggle on={skill.enabled} onChange={(enabled) => update.mutate({ id: skill.id, patch: { enabled } })} />
      </FormField>
      <SkillFormFields value={draft} onChange={setDraft} errors={submitted ? errors : {}} />
      <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
        <Button kind="primary" disabled={!dirty} loading={update.isPending} onClick={save}>
          {t("config.save")}
        </Button>
        <span style={{ fontSize: 12, color: "var(--text-muted)" }}>
          {savedVersion != null && !dirty ? t("config.saved", { version: savedVersion }) : t("config.versionHint")}
        </span>
      </div>
      {update.isError && (
        <div role="alert" style={{ color: "var(--danger, #f85149)", fontSize: 13 }}>
          {update.error instanceof ApiError ? update.error.message : t("config.failed")}
        </div>
      )}
    </div>
  );
}
```

Create `client/src/app/skills/[id]/_components/SkillDetail/_components/ConfigTab/index.ts`:

```ts
export { ConfigTab } from "./ConfigTab";
```

Create `client/src/app/skills/[id]/_components/SkillDetail/_components/VersioningTab/VersioningTab.tsx`:

```tsx
/* VersioningTab — body history: Diff (old → current) and Restore per version. */
"use client";

import React from "react";
import { useTranslations } from "next-intl";
import { Badge, Button, ErrorState, Skeleton } from "@devdigest/ui";
import type { Skill } from "@devdigest/shared";
import { useRestoreSkillVersion, useSkillVersions } from "../../../../../../../lib/hooks/skills";
import { lineDiff, type DiffLine } from "./helpers";

const LINE_STYLE: Record<DiffLine["kind"], React.CSSProperties> = {
  same: { color: "var(--text-secondary)" },
  add: { color: "var(--success, #3fb950)", background: "rgba(63,185,80,0.10)" },
  del: { color: "var(--danger, #f85149)", background: "rgba(248,81,73,0.10)" },
};
const PREFIX: Record<DiffLine["kind"], string> = { same: "  ", add: "+ ", del: "- " };

function DiffView({ lines }: { lines: DiffLine[] }) {
  return (
    <pre className="mono" style={{ margin: "8px 0 0", padding: 10, fontSize: 12, borderRadius: 8, border: "1px solid var(--border)", overflow: "auto" }}>
      {lines.map((l, i) => (
        <div key={i} style={LINE_STYLE[l.kind]}>
          {PREFIX[l.kind] + l.text}
        </div>
      ))}
    </pre>
  );
}

export function VersioningTab({ skill }: { skill: Skill }) {
  const t = useTranslations("skills");
  const { data, isLoading, isError, refetch } = useSkillVersions(skill.id);
  const restore = useRestoreSkillVersion();
  const [diffOf, setDiffOf] = React.useState<number | null>(null);

  if (isLoading) return <Skeleton height={160} />;
  if (isError) return <ErrorState body={t("versioning.loadError")} onRetry={() => refetch()} />;

  return (
    <div style={{ padding: "20px 24px", maxWidth: 860, display: "flex", flexDirection: "column", gap: 10 }}>
      <p style={{ margin: 0, fontSize: 13, color: "var(--text-secondary)" }}>{t("versioning.hint")}</p>
      {(data ?? []).map((v) => {
        const current = v.version === skill.version;
        return (
          <div key={v.version} style={{ padding: 12, borderRadius: 8, border: "1px solid var(--border)" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <span className="mono" style={{ fontWeight: 600 }}>{`v${v.version}`}</span>
              <span style={{ fontSize: 12, color: "var(--text-muted)" }}>{new Date(v.created_at).toLocaleString()}</span>
              <span style={{ marginLeft: "auto", display: "flex", gap: 8 }}>
                {current ? (
                  <Badge color="var(--accent)">{t("versioning.current")}</Badge>
                ) : (
                  <>
                    <Button size="sm" kind="secondary" icon="Code" onClick={() => setDiffOf(diffOf === v.version ? null : v.version)}>
                      {diffOf === v.version ? t("versioning.hideDiff") : t("versioning.diff")}
                    </Button>
                    <Button
                      size="sm"
                      kind="secondary"
                      icon="History"
                      loading={restore.isPending && restore.variables?.version === v.version}
                      onClick={() => restore.mutate({ id: skill.id, version: v.version })}
                    >
                      {t("versioning.restore")}
                    </Button>
                  </>
                )}
              </span>
            </div>
            {diffOf === v.version && (
              <>
                <div style={{ fontSize: 12, color: "var(--text-muted)", marginTop: 8 }}>
                  {t("versioning.diffTitle", { version: v.version })}
                </div>
                <DiffView lines={lineDiff(v.body, skill.body)} />
              </>
            )}
          </div>
        );
      })}
    </div>
  );
}
```

Create `client/src/app/skills/[id]/_components/SkillDetail/_components/VersioningTab/index.ts`:

```ts
export { VersioningTab } from "./VersioningTab";
```

- [ ] **Step 5: Write the detail shell and the page**

Create `client/src/app/skills/[id]/_components/SkillDetail/constants.ts`:

```ts
import type { IconName } from "@devdigest/ui";

export interface DetailTab {
  key: "config" | "preview" | "versioning";
  labelKey: string;
  icon: IconName;
}

/** Skill page tabs (#25). Stats is a later lesson. */
export const TABS: readonly DetailTab[] = [
  { key: "config", labelKey: "detail.tabs.config", icon: "Settings" },
  { key: "preview", labelKey: "detail.tabs.preview", icon: "Eye" },
  { key: "versioning", labelKey: "detail.tabs.versioning", icon: "History" },
];

export const VALID_TABS: readonly string[] = TABS.map((tb) => tb.key);
```

Create `client/src/app/skills/[id]/_components/SkillDetail/SkillDetail.tsx`:

```tsx
/* SkillDetail — tabs for one skill: Config, Preview, Versioning. */
"use client";

import React from "react";
import { useTranslations } from "next-intl";
import { Tabs } from "@devdigest/ui";
import type { Skill } from "@devdigest/shared";
import { ConfigTab } from "./_components/ConfigTab";
import { PreviewTab } from "./_components/PreviewTab";
import { VersioningTab } from "./_components/VersioningTab";
import { TABS } from "./constants";

export function SkillDetail({ skill, tab, onTab }: { skill: Skill; tab: string; onTab: (t: string) => void }) {
  const t = useTranslations("skills");
  const tabs = TABS.map((tb) => ({ key: tb.key, label: t(tb.labelKey), icon: tb.icon }));
  return (
    <div style={{ display: "flex", flexDirection: "column", minHeight: 0 }}>
      <div style={{ borderBottom: "1px solid var(--border)" }}>
        <Tabs tabs={tabs} value={tab} onChange={onTab} pad="0 24px" />
      </div>
      {tab === "preview" ? (
        <PreviewTab skill={skill} />
      ) : tab === "versioning" ? (
        <VersioningTab skill={skill} />
      ) : (
        // Re-mount per skill so the form starts from that skill's fields.
        <ConfigTab key={skill.id} skill={skill} />
      )}
    </div>
  );
}
```

Create `client/src/app/skills/[id]/_components/SkillDetail/index.ts`:

```ts
export { SkillDetail } from "./SkillDetail";
export { VALID_TABS } from "./constants";
```

Create `client/src/app/skills/[id]/page.tsx`:

```tsx
/* /skills/:id — one skill. Tab state lives in ?tab=. */
"use client";

import React from "react";
import Link from "next/link";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { useTranslations } from "next-intl";
import { ErrorState, Skeleton } from "@devdigest/ui";
import { AppShell } from "../../../components/app-shell";
import { SkillTypeBadge } from "../../../components/skill-type-badge";
import { useSkill } from "../../../lib/hooks/skills";
import { ApiError } from "../../../lib/api";
import { SkillDetail, VALID_TABS } from "./_components/SkillDetail";

export default function SkillPage() {
  const t = useTranslations("skills");
  const { id } = useParams<{ id: string }>();
  const search = useSearchParams();
  const router = useRouter();
  const { data: skill, isLoading, isError, error, refetch } = useSkill(id);

  const requested = search.get("tab") ?? "";
  const tab = VALID_TABS.includes(requested) ? requested : "config";
  const setTab = (next: string) => router.replace(`/skills/${id}?tab=${next}`);
  const crumb = [
    { label: t("page.crumbLab") },
    { label: t("page.heading"), href: "/skills" },
    { label: skill?.name ?? t("detail.crumbSkill") },
  ];

  if (isError) {
    const notFound = error instanceof ApiError && error.status === 404;
    return (
      <AppShell crumb={crumb}>
        <ErrorState
          fullScreen
          title={notFound ? t("detail.notFoundTitle") : t("detail.loadError")}
          body={notFound ? t("detail.notFoundBody") : error instanceof ApiError ? error.message : undefined}
          onRetry={notFound ? undefined : () => refetch()}
        />
      </AppShell>
    );
  }

  return (
    <AppShell crumb={crumb}>
      {isLoading || !skill ? (
        <div style={{ padding: 28, display: "flex", flexDirection: "column", gap: 16 }}>
          <Skeleton height={24} width={240} />
          <Skeleton height={200} />
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column" }}>
          <div style={{ padding: "16px 24px 12px", display: "flex", alignItems: "center", gap: 12 }}>
            <Link href="/skills" style={{ fontSize: 12.5, color: "var(--text-muted)" }}>
              {t("detail.back")}
            </Link>
            <h1 className="mono" style={{ fontSize: 18, fontWeight: 700, margin: 0 }}>
              {skill.name}
            </h1>
            <SkillTypeBadge type={skill.type} />
            <span className="mono" style={{ fontSize: 12, color: "var(--text-muted)" }}>
              {t("card.version", { version: skill.version })}
            </span>
            <span style={{ fontSize: 12, color: "var(--text-muted)" }}>
              {t("card.agentCount", { count: skill.agent_count ?? 0 })}
            </span>
          </div>
          <SkillDetail skill={skill} tab={tab} onTab={setTab} />
        </div>
      )}
    </AppShell>
  );
}
```

In `client/README.md`'s route-map mermaid chart:
- replace `  AGENTS["/agents"] --> AGENT["/agents/:id<br/>editor (config)"]` with:

```
  AGENTS["/agents"] --> AGENT["/agents/:id<br/>editor (config · skills)"]
  SKILLS["/skills<br/>grid · preview panel · create / import"] --> SKILL["/skills/:id<br/>config · preview · versioning"]
```

- replace `  AGENTS -->|"/agents · /agents/:id"| API` with:

```
  AGENTS -->|"/agents · /agents/:id · /agents/:id/skills"| API
  SKILLS -->|"/skills · /skills/:id · /versions · /import/preview"| API
```

- [ ] **Step 6: Run the tests to verify they pass**

Run: `cd client && pnpm exec vitest run "src/app/skills/\[id\]"`
Expected: PASS.

- [ ] **Step 7: Run the client suite, type-check and the docs checker**

Run: `cd client && pnpm typecheck && pnpm test && cd .. && node scripts/check-claude-md.mjs`
Expected: PASS and `AGENTS.md structure OK`.

- [ ] **Step 8: Commit**

```bash
git add "client/src/app/skills/[id]" client/README.md
git commit -m "feat(client): skill page with config, rendered preview, version diff and restore"
```

---

### Task 9: Agent editor Skills tab — attach, filter, drag to reorder

**Files:**
- Create: `client/src/app/agents/[id]/_components/AgentEditor/_components/SkillsTab/{SkillsTab.tsx,index.ts,helpers.ts,styles.ts,helpers.test.ts,SkillsTab.test.tsx}`
- Modify: `client/src/app/agents/[id]/_components/AgentEditor/constants.ts`, `AgentEditor.tsx`, `AgentEditor.test.tsx`
- Modify: `client/src/app/agents/[id]/page.tsx` (`VALID_TABS`)
- Modify: `client/messages/en/agents.json` (`skills` keys)

**Interfaces:**
- Consumes: `useSkills` (Task 5), `useAgentSkills`, `useSetAgentSkills` (Task 5), `SkillTypeBadge` (Task 6).
- Produces: `SkillsTab({ agent }: { agent: Agent })`; helpers `orderRows(skills: Skill[], linkedIds: string[]): SkillRow[]` (`SkillRow = { skill: Skill; linked: boolean }`, linked first in link order, then the rest by name), `filterRows(rows, query)`, `toggleId(ids, id, on): string[]`, `moveId(ids, fromId, toId): string[]`.

- [ ] **Step 1: Write the failing tests**

Create `client/src/app/agents/[id]/_components/AgentEditor/_components/SkillsTab/helpers.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import type { Skill } from "@devdigest/shared";
import { filterRows, moveId, orderRows, toggleId } from "./helpers";

const mk = (id: string, name: string): Skill => ({
  id,
  name,
  description: "d",
  type: "custom",
  source: "manual",
  body: "b",
  enabled: true,
  version: 1,
});

describe("SkillsTab helpers", () => {
  const skills = [mk("s1", "charlie"), mk("s2", "alpha"), mk("s3", "bravo")];

  it("orders linked skills first (link order), then the rest by name", () => {
    expect(orderRows(skills, ["s3", "s1"]).map((r) => [r.skill.name, r.linked])).toEqual([
      ["bravo", true],
      ["charlie", true],
      ["alpha", false],
    ]);
  });

  it("ignores link ids whose skill no longer exists", () => {
    expect(orderRows(skills, ["gone", "s2"]).map((r) => r.skill.id)).toEqual(["s2", "s3", "s1"]);
  });

  it("filters by name, case-insensitively", () => {
    expect(filterRows(orderRows(skills, []), " ALP ").map((r) => r.skill.id)).toEqual(["s2"]);
  });

  it("toggles an id on (appended once) and off", () => {
    expect(toggleId(["a"], "b", true)).toEqual(["a", "b"]);
    expect(toggleId(["a", "b"], "b", true)).toEqual(["a", "b"]);
    expect(toggleId(["a", "b"], "a", false)).toEqual(["b"]);
  });

  it("moves an id to another id's position", () => {
    expect(moveId(["a", "b", "c"], "c", "a")).toEqual(["c", "a", "b"]);
    expect(moveId(["a", "b", "c"], "a", "c")).toEqual(["b", "c", "a"]);
    expect(moveId(["a", "b"], "x", "a")).toEqual(["a", "b"]);
  });
});
```

Create `client/src/app/agents/[id]/_components/AgentEditor/_components/SkillsTab/SkillsTab.test.tsx`:

```tsx
import { describe, it, expect, afterEach, vi } from "vitest";
import { render, screen, cleanup, fireEvent, within } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import type { Agent, AgentSkillLink, Skill, SkillType } from "@devdigest/shared";
import agentsMessages from "../../../../../../../../messages/en/agents.json";
import skillsMessages from "../../../../../../../../messages/en/skills.json";

const mk = (id: string, name: string, type: SkillType, enabled = true): Skill => ({
  id,
  name,
  description: "d",
  type,
  source: "manual",
  body: "b",
  enabled,
  version: 1,
});
const SKILLS = [
  mk("s1", "pr-quality-rubric", "rubric"),
  mk("s2", "no-then-chains", "convention"),
  mk("s3", "secret-leakage-gate", "security", false),
];
const LINKS: AgentSkillLink[] = [
  { agent_id: "a1", skill_id: "s3", order: 0 },
  { agent_id: "a1", skill_id: "s1", order: 1 },
];
const { save } = vi.hoisted(() => ({ save: vi.fn() }));
vi.mock("../../../../../../../lib/hooks/skills", () => ({
  useSkills: () => ({ data: SKILLS, isLoading: false, isError: false, refetch: vi.fn() }),
}));
vi.mock("../../../../../../../lib/hooks/agents", () => ({
  useAgentSkills: () => ({ data: LINKS, isLoading: false, isError: false, refetch: vi.fn() }),
  useSetAgentSkills: () => ({ mutate: save, isPending: false, isError: false }),
}));

import { SkillsTab } from "./SkillsTab";

const AGENT = { id: "a1", name: "Test Quality Reviewer" } as Agent;
const row = (name: string) => screen.getByText(name).closest("[draggable]") as HTMLElement;

afterEach(() => {
  cleanup();
  save.mockReset();
});

function renderTab() {
  return render(
    <NextIntlClientProvider locale="en" messages={{ agents: agentsMessages, skills: skillsMessages }}>
      <SkillsTab agent={AGENT} />
    </NextIntlClientProvider>,
  );
}

describe("Agent Skills tab", () => {
  it("lists every skill with its type, linked ones first in prompt order", () => {
    renderTab();
    expect(screen.getByText("2 of 3 enabled")).toBeInTheDocument();
    const names = screen
      .getAllByText(/^(pr-quality-rubric|no-then-chains|secret-leakage-gate)$/)
      .map((el) => el.textContent);
    expect(names).toEqual(["secret-leakage-gate", "pr-quality-rubric", "no-then-chains"]);
    expect(within(row("no-then-chains")).getByText("convention")).toBeInTheDocument();
    expect(within(row("secret-leakage-gate")).getByText("off globally")).toBeInTheDocument();
  });

  it("only enabled (linked) skills can be dragged", () => {
    renderTab();
    expect(row("pr-quality-rubric").getAttribute("draggable")).toBe("true");
    expect(row("no-then-chains").getAttribute("draggable")).toBe("false");
  });

  it("toggling links or unlinks a skill", () => {
    renderTab();
    fireEvent.click(within(row("no-then-chains")).getByRole("checkbox"));
    expect(save).toHaveBeenCalledWith({ agentId: "a1", skillIds: ["s3", "s1", "s2"] });
    fireEvent.click(within(row("pr-quality-rubric")).getByRole("checkbox"));
    expect(save).toHaveBeenLastCalledWith({ agentId: "a1", skillIds: ["s3"] });
  });

  it("dropping one enabled skill on another reorders the prompt", () => {
    renderTab();
    const setData = vi.fn();
    fireEvent.dragStart(row("pr-quality-rubric"), { dataTransfer: { setData } });
    expect(setData).toHaveBeenCalledWith("text/plain", "s1"); // Firefox needs drag data to start
    fireEvent.dragOver(row("secret-leakage-gate"));
    fireEvent.drop(row("secret-leakage-gate"));
    expect(save).toHaveBeenCalledWith({ agentId: "a1", skillIds: ["s1", "s3"] });
  });

  it("dragging a disabled skill does nothing", () => {
    renderTab();
    fireEvent.dragStart(row("no-then-chains"));
    fireEvent.drop(row("secret-leakage-gate"));
    expect(save).not.toHaveBeenCalled();
  });

  it("filters by name", () => {
    renderTab();
    fireEvent.change(screen.getByPlaceholderText("Filter skills…"), { target: { value: "secret" } });
    expect(screen.queryByText("pr-quality-rubric")).not.toBeInTheDocument();
    expect(screen.getByText("secret-leakage-gate")).toBeInTheDocument();
  });
});
```

In `client/src/app/agents/[id]/_components/AgentEditor/AgentEditor.test.tsx`, add two entries to the existing `vi.mock("../../../../../lib/hooks/agents", ...)` factory so the editor stays hermetic once it imports the Skills tab:

```tsx
  useAgentSkills: () => ({ data: [], isLoading: false, isError: false, refetch: vi.fn() }),
  useSetAgentSkills: () => ({ mutate: vi.fn(), isPending: false, isError: false }),
```

and add this test inside its `describe`:

```tsx
  it("has exactly two tabs: Config and Skills", () => {
    renderWithIntl(<AgentEditor agent={AGENT} tab="config" onTab={() => {}} />);
    expect(screen.getByRole("button", { name: "Config" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Skills" })).toBeInTheDocument();
    for (const absent of ["Evals", "Stats", "CI"]) {
      expect(screen.queryByRole("button", { name: absent })).not.toBeInTheDocument();
    }
  });
```

- [ ] **Step 2: Run them to verify they fail**

Run: `cd client && pnpm exec vitest run "src/app/agents/\[id\]"`
Expected: FAIL — `./helpers` and `./SkillsTab` missing; the AgentEditor test finds no "Skills" tab.

- [ ] **Step 3: Write the helpers and styles**

Create `client/src/app/agents/[id]/_components/AgentEditor/_components/SkillsTab/helpers.ts`:

```ts
import type { Skill } from "@devdigest/shared";

export interface SkillRow {
  skill: Skill;
  linked: boolean;
}

/** Linked skills first in prompt (link) order, then unlinked by name. */
export function orderRows(skills: Skill[], linkedIds: string[]): SkillRow[] {
  const byId = new Map(skills.map((sk) => [sk.id, sk]));
  const linked = linkedIds
    .map((id) => byId.get(id))
    .filter((sk): sk is Skill => sk !== undefined)
    .map((skill) => ({ skill, linked: true }));
  const rest = skills
    .filter((sk) => !linkedIds.includes(sk.id))
    .sort((a, b) => a.name.localeCompare(b.name))
    .map((skill) => ({ skill, linked: false }));
  return [...linked, ...rest];
}

export function filterRows(rows: SkillRow[], query: string): SkillRow[] {
  const q = query.trim().toLowerCase();
  return q ? rows.filter((r) => r.skill.name.toLowerCase().includes(q)) : rows;
}

/** Link (append once) or unlink a skill id. */
export function toggleId(ids: string[], id: string, on: boolean): string[] {
  if (!on) return ids.filter((x) => x !== id);
  return ids.includes(id) ? ids : [...ids, id];
}

/** Move `fromId` to `toId`'s position; unknown ids leave the order unchanged. */
export function moveId(ids: string[], fromId: string, toId: string): string[] {
  const from = ids.indexOf(fromId);
  const to = ids.indexOf(toId);
  if (from < 0 || to < 0 || from === to) return ids;
  const next = ids.slice();
  next.splice(from, 1);
  next.splice(to, 0, fromId);
  return next;
}
```

Create `client/src/app/agents/[id]/_components/AgentEditor/_components/SkillsTab/styles.ts`:

```ts
import type React from "react";

export const s = {
  wrap: { padding: "20px 28px", maxWidth: 1080 } as React.CSSProperties,
  header: { display: "flex", alignItems: "center", gap: 12 } as React.CSSProperties,
  title: { fontSize: 18, fontWeight: 700, margin: 0 } as React.CSSProperties,
  filter: { marginLeft: "auto", width: 300 } as React.CSSProperties,
  hint: { fontSize: 13, color: "var(--text-secondary)", margin: "12px 0" } as React.CSSProperties,
  list: { display: "flex", flexDirection: "column", gap: 8 } as React.CSSProperties,
  row: (linked: boolean, dragging: boolean): React.CSSProperties => ({
    display: "flex",
    alignItems: "center",
    gap: 12,
    padding: "12px 14px",
    borderRadius: 8,
    border: "1px solid var(--border)",
    background: linked ? "var(--bg-elevated)" : "var(--bg-surface)",
    opacity: dragging ? 0.5 : 1,
    cursor: linked ? "grab" : "default",
  }),
  handle: (linked: boolean): React.CSSProperties => ({
    width: 14,
    display: "inline-flex",
    color: linked ? "var(--text-muted)" : "transparent",
  }),
  name: { flex: 1, fontSize: 14 } as React.CSSProperties,
  error: { marginTop: 12, fontSize: 13, color: "var(--danger, #f85149)" } as React.CSSProperties,
};
```

- [ ] **Step 4: Write the tab**

Create `client/src/app/agents/[id]/_components/AgentEditor/_components/SkillsTab/SkillsTab.tsx`:

```tsx
/* SkillsTab — every workspace skill with a toggle (link to this agent), a type
   label and a name filter. Linked skills come first in prompt order and are the
   only draggable rows; dropping one on another saves the new order. */
"use client";

import React from "react";
import { useTranslations } from "next-intl";
import { Badge, Checkbox, ErrorState, Icon, Skeleton, TextInput } from "@devdigest/ui";
import type { Agent } from "@devdigest/shared";
import { useAgentSkills, useSetAgentSkills } from "../../../../../../../lib/hooks/agents";
import { useSkills } from "../../../../../../../lib/hooks/skills";
import { SkillTypeBadge } from "../../../../../../../components/skill-type-badge";
import { filterRows, moveId, orderRows, toggleId } from "./helpers";
import { s } from "./styles";

export function SkillsTab({ agent }: { agent: Agent }) {
  const t = useTranslations("agents");
  const skills = useSkills();
  const links = useAgentSkills(agent.id);
  const setSkills = useSetAgentSkills();
  const [query, setQuery] = React.useState("");
  const [dragId, setDragId] = React.useState<string | null>(null);

  if (skills.isLoading || links.isLoading) {
    return (
      <div style={s.wrap}>
        <Skeleton height={200} />
      </div>
    );
  }
  if (skills.isError || links.isError) {
    return (
      <div style={s.wrap}>
        <ErrorState
          body={t("skills.loadError")}
          onRetry={() => {
            void skills.refetch();
            void links.refetch();
          }}
        />
      </div>
    );
  }

  const all = skills.data ?? [];
  const linkedIds = [...(links.data ?? [])].sort((a, b) => a.order - b.order).map((l) => l.skill_id);
  const rows = filterRows(orderRows(all, linkedIds), query);
  const save = (ids: string[]) => setSkills.mutate({ agentId: agent.id, skillIds: ids });

  return (
    <div style={s.wrap}>
      <div style={s.header}>
        <h2 style={s.title}>{t("skills.title")}</h2>
        <Badge color="var(--accent)">{t("skills.enabledCount", { linked: linkedIds.length, total: all.length })}</Badge>
        <div style={s.filter}>
          <TextInput value={query} onChange={setQuery} placeholder={t("skills.filterPlaceholder")} />
        </div>
      </div>
      <p style={s.hint}>{t("skills.orderHint")}</p>
      {all.length === 0 && <p style={s.hint}>{t("skills.empty")}</p>}
      <div style={s.list}>
        {rows.map(({ skill, linked }) => (
          <div
            key={skill.id}
            draggable={linked}
            onDragStart={
              linked
                ? (e) => {
                    // Firefox only starts a drag when dragstart puts data on it.
                    e.dataTransfer?.setData("text/plain", skill.id);
                    setDragId(skill.id);
                  }
                : undefined
            }
            onDragOver={(e) => {
              if (linked && dragId) e.preventDefault();
            }}
            onDrop={(e) => {
              e.preventDefault();
              if (linked && dragId) save(moveId(linkedIds, dragId, skill.id));
              setDragId(null);
            }}
            onDragEnd={() => setDragId(null)}
            style={s.row(linked, dragId === skill.id)}
          >
            <span style={s.handle(linked)} aria-hidden="true">
              <Icon.Menu size={14} />
            </span>
            <Checkbox checked={linked} onChange={(on) => save(toggleId(linkedIds, skill.id, on))} />
            <span className="mono" style={s.name}>
              {skill.name}
            </span>
            {!skill.enabled && <Badge color="var(--text-muted)">{t("skills.globallyDisabled")}</Badge>}
            <SkillTypeBadge type={skill.type} />
          </div>
        ))}
      </div>
      {setSkills.isError && (
        <div role="alert" style={s.error}>
          {t("skills.saveError")}
        </div>
      )}
    </div>
  );
}
```

Create `client/src/app/agents/[id]/_components/AgentEditor/_components/SkillsTab/index.ts`:

```ts
export { SkillsTab } from "./SkillsTab";
```

- [ ] **Step 5: Wire the tab into the editor**

In `client/src/app/agents/[id]/_components/AgentEditor/constants.ts`, replace the `TABS` constant and its comment with:

```ts
/** Editor tabs: exactly Config and Skills (#35). */
export const TABS: readonly EditorTab[] = [
  { key: "config", labelKey: "editor.tabs.config", icon: "Settings" },
  { key: "skills", labelKey: "editor.tabs.skills", icon: "Sparkles" },
];
```

In `client/src/app/agents/[id]/_components/AgentEditor/AgentEditor.tsx`, add `import { SkillsTab } from "./_components/SkillsTab";` and replace `<ConfigTab agent={agent} />` with:

```tsx
        {tab === "skills" ? <SkillsTab agent={agent} /> : <ConfigTab agent={agent} />}
```

Update the file's header comment to `/* AgentEditor — agent config editor with Config and Skills tabs. Tab state lives in ?tab=. */`.

In `client/src/app/agents/[id]/page.tsx`, change `const VALID_TABS = ["config"];` to `const VALID_TABS = ["config", "skills"];`.

In `client/messages/en/agents.json`, set the `skills` object to:

```json
  "skills": {
    "title": "Skills",
    "enabledCount": "{linked} of {total} enabled",
    "filterPlaceholder": "Filter skills…",
    "orderHint": "Order matters — earlier skills appear earlier in the assembled prompt. Drag enabled skills to reorder.",
    "empty": "No skills yet. Create or import one on the Skills page.",
    "globallyDisabled": "off globally",
    "loadError": "Could not load skills.",
    "saveError": "Could not save the agent's skills."
  },
```

- [ ] **Step 6: Run the tests to verify they pass**

Run: `cd client && pnpm exec vitest run "src/app/agents"`
Expected: PASS.

- [ ] **Step 7: Run the client suite and type-check**

Run: `cd client && pnpm typecheck && pnpm test`
Expected: PASS.

- [ ] **Step 8: Commit**

```bash
git add "client/src/app/agents/[id]" client/messages/en/agents.json
git commit -m "feat(client): agent Skills tab with attach toggles, filter and drag-to-reorder"
```

---

### Task 10: Token count on each prompt-assembly block in the trace

**Files:**
- Modify: `client/src/app/repos/[repoId]/pulls/[number]/_components/RunTraceDrawer/helpers.ts`
- Modify: `client/src/app/repos/[repoId]/pulls/[number]/_components/RunTraceDrawer/_components/PromptBlock/PromptBlock.tsx`
- Modify: `client/src/app/repos/[repoId]/pulls/[number]/_components/RunTraceDrawer/_components/TraceBody/TraceBody.tsx:74-92`
- Modify: `client/messages/en/runs.json` (`trace.prompt.tokens`)
- Test: `client/src/app/repos/[repoId]/pulls/[number]/_components/RunTraceDrawer/RunTraceDrawer.test.tsx`

**Interfaces:**
- Consumes: `trace.prompt_assembly.*` strings (skills block from Task 4).
- Produces: `approxTokens(text: string): number` (= `Math.ceil(text.length / 4)`); `PromptBlock` gains an optional `tokens?: number` prop rendered as `~N tokens`.

- [ ] **Step 1: Write the failing test**

In `RunTraceDrawer.test.tsx`, add inside the `describe`:

```tsx
  it("shows the token count of each prompt block, including the skills block", () => {
    renderWithIntl(<RunTraceDrawer runId="r1" agentName="Security" prNumber={482} onClose={() => {}} />);
    fireEvent.click(screen.getByText("Prompt assembly"));
    // skills "### skill" = 9 chars → ceil(9 / 4) = 3; user "Review PR #482" = 14 → 4
    expect(screen.getByText("~3 tokens")).toBeInTheDocument();
    expect(screen.getByText("~4 tokens")).toBeInTheDocument();
  });

  it("omits the skills block when the run had no skills", () => {
    TRACE = { ...BASE_TRACE, prompt_assembly: { ...BASE_TRACE.prompt_assembly, skills: null } };
    renderWithIntl(<RunTraceDrawer runId="r1" agentName="Security" prNumber={482} onClose={() => {}} />);
    fireEvent.click(screen.getByText("Prompt assembly"));
    expect(screen.queryByText("Skills (dynamic)")).not.toBeInTheDocument();
  });
```

- [ ] **Step 2: Run it to verify it fails**

Run: `cd client && pnpm exec vitest run "src/app/repos/\[repoId\]/pulls/\[number\]/_components/RunTraceDrawer"`
Expected: FAIL — no `~3 tokens` text (the second test already passes; it guards the null branch).

- [ ] **Step 3: Implement**

Append to `RunTraceDrawer/helpers.ts`:

```ts
/** Approximate token count of a prompt block: ceil(chars / 4). */
export function approxTokens(text: string): number {
  return Math.ceil(text.length / 4);
}
```

In `PromptBlock.tsx`, change the signature to

```tsx
export function PromptBlock({
  label,
  text,
  color,
  tokens,
}: {
  label: string;
  text: string;
  color: string;
  /** Approximate tokens this block adds to the prompt. */
  tokens?: number;
}) {
```

and right after `<span style={s.promptLabel}>{label}</span>` add:

```tsx
        {tokens != null && (
          <span className="mono" style={{ fontSize: 11.5, color: "var(--text-muted)" }}>
            {t("trace.prompt.tokens", { count: tokens })}
          </span>
        )}
```

In `TraceBody.tsx`, add `approxTokens` to the `../../helpers` import, then replace the `PromptBlock` lines inside the Prompt assembly `TraceSection` with:

```tsx
        <PromptBlock label={t("trace.prompt.system")} text={trace.prompt_assembly.system} color={PROMPT_COLORS.system} tokens={approxTokens(trace.prompt_assembly.system)} />
        {trace.prompt_assembly.skills != null && (
          <PromptBlock label={t("trace.prompt.skills")} text={trace.prompt_assembly.skills} color={PROMPT_COLORS.skills} tokens={approxTokens(trace.prompt_assembly.skills)} />
        )}
        {trace.prompt_assembly.memory != null && (
          <PromptBlock label={t("trace.prompt.memory")} text={trace.prompt_assembly.memory} color={PROMPT_COLORS.memory} tokens={approxTokens(trace.prompt_assembly.memory)} />
        )}
        {trace.prompt_assembly.repo_map != null && (
          <PromptBlock label={t("trace.prompt.repoMap")} text={trace.prompt_assembly.repo_map} color={PROMPT_COLORS.repoMap} tokens={approxTokens(trace.prompt_assembly.repo_map)} />
        )}
        {trace.prompt_assembly.specs != null && (
          <PromptBlock label={t("trace.prompt.specs")} text={trace.prompt_assembly.specs} color={PROMPT_COLORS.specs} tokens={approxTokens(trace.prompt_assembly.specs)} />
        )}
        {trace.prompt_assembly.callers != null && (
          <PromptBlock label={t("trace.prompt.callers")} text={trace.prompt_assembly.callers} color={PROMPT_COLORS.callers} tokens={approxTokens(trace.prompt_assembly.callers)} />
        )}
        <PromptBlock label={t("trace.prompt.user")} text={trace.prompt_assembly.user} color={PROMPT_COLORS.user} tokens={approxTokens(trace.prompt_assembly.user)} />
```

Add `"tokens": "~{count} tokens"` to `trace.prompt` in `client/messages/en/runs.json`.

- [ ] **Step 4: Run it to verify it passes**

Run: `cd client && pnpm exec vitest run "src/app/repos/\[repoId\]/pulls/\[number\]/_components/RunTraceDrawer"`
Expected: PASS.

- [ ] **Step 5: Run the client suite and type-check**

Run: `cd client && pnpm typecheck && pnpm test`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add "client/src/app/repos/[repoId]/pulls/[number]/_components/RunTraceDrawer" client/messages/en/runs.json
git commit -m "feat(client): show the token count of each prompt block in the run trace"
```

---

### Task 11: Agent skill content, `pr-self-review` manual-only, control-experiment runbook

**Files:**
- Create: `docs/labs/lab_2/skills/test-quality/{uncovered-branches,boundary-cases,excessive-mocking,flaky-tests}.md`
- Create: `docs/labs/lab_2/skills/api-contract/{breaking-change,response-schema,semver-discipline,deprecation-policy}.md`
- Create: `docs/labs/lab_2/task2/control-experiment.md`
- Test: `server/test/skill-docs.test.ts`
- Modify: `scripts/check-skills.mjs` (`REQUIRED_TERMS['pr-self-review']`), `.claude/skills/pr-self-review/SKILL.md` (frontmatter)

**Interfaces:**
- Consumes: `previewSkillImport` (Task 2) — the same parser the UI import uses, so a file that passes this test imports cleanly.
- Produces: eight importable skill files (directive description + `## Good` / `## Bad`, acceptance #43), a runbook for the manual control experiment (#16–20), and `disable-model-invocation: true` on `pr-self-review` (#21).

- [ ] **Step 1: Write the failing checks**

Create `server/test/skill-docs.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { previewSkillImport } from '../src/modules/skills/import.js';

const ROOT = new URL('../../docs/labs/lab_2/skills/', import.meta.url);
const FILES: Record<string, string[]> = {
  'test-quality': ['uncovered-branches', 'boundary-cases', 'excessive-mocking', 'flaky-tests'],
  'api-contract': ['breaking-change', 'response-schema', 'semver-discipline', 'deprecation-policy'],
};

describe('lab skill files', () => {
  for (const [agent, names] of Object.entries(FILES)) {
    for (const name of names) {
      it(`${agent}/${name}.md imports with a directive description and good/bad examples`, () => {
        const path = fileURLToPath(new URL(`${agent}/${name}.md`, ROOT));
        const p = previewSkillImport(`${name}.md`, readFileSync(path));
        expect(p.name).toBe(name);
        expect(p.description).toMatch(/^(Flag|Require|Treat)\b/);
        expect(['rubric', 'convention']).toContain(p.type);
        expect(p.body).toMatch(/^## Good$/m);
        expect(p.body).toMatch(/^## Bad$/m);
      });
    }
  }
});
```

In `scripts/check-skills.mjs`, add `'disable-model-invocation: true',` as the first entry of `REQUIRED_TERMS['pr-self-review']`.

- [ ] **Step 2: Run them to verify they fail**

Run: `cd server && pnpm exec vitest run test/skill-docs.test.ts; cd .. && node scripts/check-skills.mjs`
Expected: 8 failing tests (`ENOENT`), and `pr-self-review: missing required term "disable-model-invocation: true"`.

- [ ] **Step 3: Disable auto-invocation of `pr-self-review`**

In `.claude/skills/pr-self-review/SKILL.md`, add the line `disable-model-invocation: true` to the frontmatter, after the `description:` line. `/pr-self-review` still works; the model can no longer start it on its own.

- [ ] **Step 4: Write the Test Quality skills**

Create `docs/labs/lab_2/skills/test-quality/uncovered-branches.md`:

````markdown
---
name: uncovered-branches
description: Flag changed conditionals (if/else, switch, early return, catch) whose new or modified branch no test reaches.
type: rubric
---
# Uncovered branches

For every conditional the diff adds or changes, find a test that drives execution into each branch. A branch no test reaches is a finding.

- WARNING when the untested branch is an error or guard path; CRITICAL when it handles money, auth or deletion.
- Cite the line of the untested branch and name the test file that should cover it.
- A test that asserts only the happy path does not cover the `else`, the `catch` or the early `return`.

## Good
```ts
export const clamp = (n: number) => (n > MAX ? MAX : n);
it('passes small values through', () => expect(clamp(3)).toBe(3));
it('caps values above MAX', () => expect(clamp(MAX + 1)).toBe(MAX));
```

## Bad
```ts
it('clamps', () => expect(clamp(3)).toBe(3)); // the n > MAX branch never runs
```
````

Create `docs/labs/lab_2/skills/test-quality/boundary-cases.md`:

````markdown
---
name: boundary-cases
description: Flag tests for a changed comparison or range that skip the boundary values (exactly at, one below, one above the limit) and empty inputs.
type: rubric
---
# Boundary cases

When the diff adds or changes a comparison (`<`, `<=`, `>`, `>=`), a length/size check, pagination or a range, the tests must exercise the edges.

- Required values: the limit itself, limit − 1, limit + 1; plus `0`, empty string/array and `null`/`undefined` when the type allows them.
- An off-by-one (`<` vs `<=`) survives every test that only uses values far from the limit — say which edge is missing.
- WARNING by default; CRITICAL when the limit guards money, quotas or security.

## Good
```ts
it.each([[99, true], [100, true], [101, false]])('allows up to 100 items (%i)', (n, ok) => {
  expect(canAdd(n)).toBe(ok);
});
it('rejects an empty cart', () => expect(() => checkout([])).toThrow());
```

## Bad
```ts
it('allows small carts', () => expect(canAdd(3)).toBe(true)); // 100 vs 101 never checked
```
````

Create `docs/labs/lab_2/skills/test-quality/excessive-mocking.md`:

````markdown
---
name: excessive-mocking
description: Flag tests that mock the unit under test or its own collaborators so heavily that the assertion only checks the mock.
type: rubric
---
# Excessive mocking

Mock the outside world (network, clock, LLM, filesystem), not the code being tested.

- Finding when a test mocks a function from the same module it tests, or when every collaborator is mocked and the test asserts only that a mock was called.
- Finding when the expected value is copied from the mock's return value (the test proves nothing).
- Suggest the real collaborator or a fake at the system boundary instead. WARNING.

## Good
```ts
const repo = new InMemoryOrders();           // fake at the boundary
await placeOrder(repo, { sku: 'A', qty: 2 });
expect(await repo.count()).toBe(1);
```

## Bad
```ts
vi.mock('./pricing', () => ({ total: () => 42 }));
expect(checkoutTotal(cart)).toBe(42);        // asserts the mock, not checkout
```
````

Create `docs/labs/lab_2/skills/test-quality/flaky-tests.md`:

````markdown
---
name: flaky-tests
description: Flag tests that depend on real time, sleeps, randomness, test order or shared mutable state, so they can pass and fail on the same code.
type: rubric
---
# Flaky tests

- Finding: `setTimeout`/`sleep` waits, `Date.now()`/`new Date()` without a fake clock, `Math.random()` without a seed, network calls, or state shared between tests without reset.
- Finding: a test that passes only when run after another test.
- Suggest fake timers, an injected clock, a seeded generator, or a `beforeEach` reset. WARNING; CRITICAL when the test gates CI merges.

## Good
```ts
vi.useFakeTimers();
const p = retry(op);
await vi.advanceTimersByTimeAsync(3000);
await expect(p).resolves.toBe('ok');
```

## Bad
```ts
await new Promise((r) => setTimeout(r, 3000)); // slow, and flaky on a busy CI runner
expect(job.done).toBe(true);
```
````

- [ ] **Step 5: Write the API Contract skills**

Create `docs/labs/lab_2/skills/api-contract/breaking-change.md`:

````markdown
---
name: breaking-change
description: Flag any change that breaks an existing public API contract — removed or renamed routes, query/body params or response fields, or a changed HTTP method or status code.
type: rubric
---
# Breaking change

A public contract is anything a client can call or read: route path and method, path/query params, request body fields, response fields, status codes, error codes.

- CRITICAL: removing or renaming a route path segment, a query param, a request body field or a response field; changing the HTTP method or a status code; making an optional request field required.
- Cite the changed line and name the old and new shape.
- Not a finding: adding a new optional field, a new route, or a new enum value that clients may ignore.
- Not a finding: renaming only a path parameter's name (e.g. `/orders/:id` → `/orders/:orderId`) — clients still call the same URL.

## Good
```ts
// old field kept, new one added alongside
return { id, total_cents, total: total_cents / 100 };
```

## Bad
```ts
- app.get('/orders/:id', ...)
+ app.get('/purchases/:id', ...)  // every client calling /orders/123 now gets 404
- return { id, total }
+ return { id, amount }              // `total` silently disappears
```
````

Create `docs/labs/lab_2/skills/api-contract/response-schema.md`:

````markdown
---
name: response-schema
description: Flag response-shape changes — a field's type, nullability or requiredness changes, or a nested object or array changes shape.
type: rubric
---
# Response schema

- CRITICAL: a field changes type (`number` → `string`, object → array), becomes nullable, or becomes optional where clients read it without a check.
- WARNING: a new required field in a request body.
- Compare against the Zod contract or response schema; if the route has none, say so.

## Good
```ts
const Order = z.object({ id: z.string(), total: z.number(), note: z.string().nullish() }); // added optional
```

## Bad
```ts
- total: z.number(),
+ total: z.string(),        // clients doing total.toFixed() now crash
- email: z.string(),
+ email: z.string().nullable(),
```
````

Create `docs/labs/lab_2/skills/api-contract/semver-discipline.md`:

````markdown
---
name: semver-discipline
description: Require a major version bump (or a new versioned route) for any breaking API change, and flag a breaking change shipped as a minor or patch.
type: convention
---
# Semver discipline

- Breaking change (see `breaking-change`) → major bump of the package or API version, or a new `/v2/...` route with `/v1` kept.
- Additive change → minor. Fix with no contract change → patch.
- Finding when the diff breaks a contract but the version in `package.json`, the OpenAPI `info.version` or the route prefix does not change. WARNING; CRITICAL for published SDKs.

## Good
```diff
- "version": "1.4.2"
+ "version": "2.0.0"   // removes GET /orders/:id/items
```

## Bad
```diff
- "version": "1.4.2"
+ "version": "1.4.3"   // same release renames `total` → `amount`
```
````

Create `docs/labs/lab_2/skills/api-contract/deprecation-policy.md`:

````markdown
---
name: deprecation-policy
description: Require that public fields and routes are deprecated (marked, documented, kept working) before removal, and flag silent removals.
type: convention
---
# Deprecation policy

- Before removing a route or field: keep it working, mark it (`@deprecated` JSDoc, a `Deprecation`/`Sunset` header, or `.describe('deprecated: …')` on the schema), and name its replacement.
- Finding when a public route or field is removed in the same change that introduces its replacement. WARNING; CRITICAL when no replacement exists.
- Removal is fine once a previous release already marked it deprecated — cite that marker.

## Good
```ts
/** @deprecated use `amount`; removed in v3. */
total: z.number(),
amount: z.number(),
```

## Bad
```ts
- total: z.number(),
+ amount: z.number(),   // removed and replaced in one step, no deprecation window
```
````

- [ ] **Step 6: Write the runbook**

Create `docs/labs/lab_2/task2/control-experiment.md`:

````markdown
# Control experiment and final check — skills for review agents

Manual steps. They need the running stack (`./scripts/dev.sh`), an LLM API key (Settings → API Keys) and a GitHub repo connected in DevDigest with two test PRs. Record what you see in the table at the end.

## 1. Agents (Skills Lab → Agents → Add Agent)

**Test Quality Reviewer** — system prompt:

> You review the tests in a pull request. Report only test-quality problems: branches the tests never reach, missing boundary cases, mocks that make a test assert nothing, and tests that can flake. Cite the exact changed line. Do not comment on style or production-code design.

**API Contract Reviewer** — system prompt:

> You review a pull request for changes to its public HTTP API: routes, parameters, request and response fields, status codes and versioning. Report only contract problems, citing the exact changed line.

## 2. Skills (Skills Lab → Skills → Add skill)

Files are in `docs/labs/lab_2/skills/`.

- Create via **Create skill** (paste name, description, type and body): `uncovered-branches`, `excessive-mocking`, `flaky-tests`, and the four `api-contract/*` skills.
- Import **one** via **Import from file**, as an archive that also carries a script, to see that only the markdown is read:

  ```bash
  cd docs/labs/lab_2/skills/test-quality
  mkdir -p /tmp/boundary-cases && cp boundary-cases.md /tmp/boundary-cases/SKILL.md
  printf '#!/bin/sh\necho "this must never run"\n' > /tmp/boundary-cases/install.sh
  (cd /tmp && zip -r boundary-cases.zip boundary-cases)
  ```

  Upload `/tmp/boundary-cases.zip`: the preview lists `boundary-cases/install.sh` as ignored. Confirm. The skill is saved **disabled**, with an **Imported** badge; read it, then enable it on its card.

## 3. Attach (Agents → agent → Skills tab)

- Test Quality Reviewer: tick the four test-quality skills; drag `boundary-cases` to the top.
- API Contract Reviewer: tick the four api-contract skills.

## 4. Test PRs (in the connected GitHub repo)

- **PR A (happy-path test):** add a function with a guard branch and a limit, e.g. `export const discount = (total: number) => (total >= 100 ? total * 0.9 : total);`, plus one test: `expect(discount(50)).toBe(50)`.
- **PR B (contract change):** rename a route path segment and a response field, e.g. `/orders/:id` → `/purchases/:id` and `total` → `amount`, without a version bump.

Sync the repo so both PRs appear in Pull Requests.

## 5. Runs

For each agent and its PR:

1. Untick all of the agent's skills → **Run Review** → note the findings (expected: the problem is missed or vague).
2. Tick the skills again → **Run Review** → expected: PR A flags the untested `total >= 100` branch and the 99/100/101 boundary; PR B flags the breaking rename (and the missing major bump).
3. Open **Agent runs → Review runs → trace**:
   - **Prompt assembly → Skills (dynamic)** shows `~N tokens` for the skills block; expand it to see one `### Skill: <name>` block per enabled skill, in Skills-tab order.
   - **Log** shows `Skill loaded: <name> (~N tokens)` per skill.
4. Disable one skill on the Skills page → run again → its block and its log line are gone.
5. Drag two skills into a different order → run again → the blocks swap places in the prompt.

## 6. `pr-self-review`

In Claude Code, with uncommitted edits in both `client/` and `server/`, run `/pr-self-review`. Expected: the routing line lists both the client and backend skill sets. The skill has `disable-model-invocation: true`, so it runs only when invoked.

## Results

| Check | Without skills | With skills | Trace / log evidence |
|---|---|---|---|
| Test Quality on PR A | | | |
| API Contract on PR B | | | |
| Disabled skill absent | — | | |
| Reorder swaps blocks | — | | |
````

- [ ] **Step 7: Run the checks to verify they pass**

Run: `cd server && pnpm exec vitest run test/skill-docs.test.ts && cd .. && node scripts/check-skills.mjs && node --test scripts/*.test.mjs && node scripts/check-claude-md.mjs`
Expected: 8 tests PASS; `Own skills OK`; checker tests pass; `AGENTS.md structure OK`.

- [ ] **Step 8: Commit**

```bash
git add docs/labs/lab_2/skills docs/labs/lab_2/task2/control-experiment.md server/test/skill-docs.test.ts scripts/check-skills.mjs .claude/skills/pr-self-review/SKILL.md
git commit -m "docs(skills): test-quality and api-contract skills, control-experiment runbook; pr-self-review manual-only"
```

- [ ] **Step 9: Final verification across modules**

Run: `cd server && pnpm typecheck && pnpm test && cd ../client && pnpm typecheck && pnpm test && cd ../reviewer-core && npm run typecheck && npm test && cd .. && node scripts/check-claude-md.mjs && node scripts/check-skills.mjs`
Expected: every command passes. The manual control experiment (runbook sections 1–6) is done by the user afterwards; it needs an API key and real PRs.

---

## Self-Review

**Spec coverage.**
- Storage + CRUD, DB as source of truth → Tasks 1, 3 (integration tests read and delete rows directly, #8).
- Skills grid, side preview, add → create / import → Tasks 6, 7 (#9–12). Directive caption under description → `form.descriptionHint` (Task 7).
- Agent Skills tab, toggle, order, order = prompt order → Tasks 4, 9 (#13, #14, #30, #31, #37).
- Import with preview, confirm-only save, executable parts not processed → Tasks 2, 3, 7 (#15).
- New agents with skills, one imported; control experiment; trace skills block with tokens; enabled/disabled in logs → Tasks 4, 10, 11 (#16–20; the runs themselves are the manual runbook).
- `pr-self-review` auto-invocation disabled → Task 11 (#21).
- Card version + agent count, delete + confirm → Tasks 5, 6 (#22–24). Skill page tabs, rendered preview, versions, diff, restore → Task 8 (#25–29).
- Agents in SKILLS LAB, agent tiles, delete confirm, exactly two tabs → Tasks 5, 9 (#6, #7, #32–36; #7 and #36 already hold and are untouched).
- Four API Contract skills with directive descriptions and good/bad examples → Task 11 (#43).

**Placeholder scan.** No TBD/TODO. Every code, JSON and skill file is written out; the only prose-only edits are one-line wiring changes that name the exact line to change.

**Type consistency.** `SkillDraft` (Task 5) is used by Tasks 7–8; `SkillImportPreview`/`SkillVersion` (Task 1) by Tasks 2, 3, 5, 7, 8; `skillCountFor` (Task 5) by `AgentsListView` and the agent page; `SkillTypeBadge` (Task 6) by Tasks 6, 8, 9; `toSkillBlocks`/`PromptSkill` (Task 4) by `run-executor.ts`; the HTTP shapes in Task 3's Interfaces match the hooks in Task 5.

**Review Focus.** Item 1 → Task 2 tests (scripts ignored, bomb, non-UTF-8, no markdown, corrupt zip, wrong type) and Task 3 (`rejects an upload that is not a skill`, preview saves nothing). Item 2 → Task 4 integration test (order, reorder, disabled absent from prompt and log). Item 3 → Task 4 `rejects unknown skill ids … de-duplicates repeats`. Item 4 → Task 3 `reports agent links and drops them when the skill is deleted`. Item 5 → Task 3 duplicate-name test and Task 7 import test (missing description blocks confirm).
