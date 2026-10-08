---
name: pr-self-review
description: Use when your changes are about to be marked ready for review, or when asked to self-review local changes — runs the uncommitted diff through a second pass and routes it to the architecture and best-practice skills for each surface it touches.
disable-model-invocation: true
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

When the diff also touches routed paths, the "none" paths are still not silently dropped: keep their list and print `Unrouted (not reviewed): <paths>` in the report, just before the verdict, so a PASS never reads as covering lines nobody reviewed.

## 3. Second pass

Run this as a separate pass from the work that produced the diff. Use a fresh subagent when one is available. A subagent does not inherit skills you loaded, so give it the diff and, for each skill in the routing line, its name and path `.claude/skills/<name>/SKILL.md`, and tell it to load every one (Skill tool, or read the file) before judging; otherwise re-read the diff top to bottom as a reviewer, not as the author. Read each loaded skill fully before judging.

Review the **changed lines only**. Code a touched file already had (see "Legacy code" in `onion-architecture`) is not a finding unless the diff adds to the pattern. Every finding must cite `path:line` of a line in the diff and name the skill rule it breaks.

## 4. Report

One line per finding, grouped by severity:

- **CRITICAL** — breaks a layering or placement rule of an architecture skill (adapter or `db` call in a route, import from an unrelated route tree's `_components`, vendored code edited, an existing migration in `server/src/db/migrations/` modified or deleted), or introduces a defect. Blocks "ready". A **new** migration file is expected when the same diff changes `server/src/db/schema*` (it comes from `pnpm db:generate`); a new migration without a schema change is MAJOR (likely hand-written).
- **MAJOR** — violates a best-practice rule with real cost (missing test for new logic, untranslated user-visible string, effect used for data fetching).
- **MINOR** — naming, folder shape, small cleanups.

If any changed path matched no surface, print `Unrouted (not reviewed): <paths>` here.

End with a verdict line:

- Any CRITICAL → `VERDICT: BLOCK — fix the CRITICAL findings, then run this skill again.`
- Otherwise → `VERDICT: PASS` followed by the MAJOR count.

Do not fix anything unless the user asks. Do not push, commit or open a PR.
