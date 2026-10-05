# server insights

Append-only. One line per finding, at the end of its section:
`- YYYY-MM-DD Fact, the action to take, and why. Applies to path/file.ext:LINE.`

## What Works

## What Doesn't Work
- 2026-10-05 An integration test that reaches `container.github()` (e.g. `GET /repos/:id/pulls`) calls real GitHub whenever `GITHUB_TOKEN` is in the env or `~/.devdigest/secrets.json`; override `github: new MockGitHubClient()` in `buildApp`. Applies to `test/reviews.it.test.ts:131`.

## Codebase Patterns
- 2026-09-19 Server boot (`src/server.ts`) never runs migrations; run `pnpm db:migrate` explicitly after pulling schema changes. Applies to `package.json:13`.
- 2026-09-19 An unindexed repo silently degrades to a diff-only review (no repo map is attached); index the repo first when review context looks thin. Applies to `src/modules/reviews/run-executor.ts:370`.
- 2026-10-05 `agent_runs.cost_usd` is NULL for runs before migration 0010 and for non-`done` runs, and the PR list takes cost from the latest review's run; do not backfill from tokens x price, or old figures stop matching the OpenRouter bill. Applies to `src/modules/pulls/run-cost.ts:13`.
- 2026-10-05 `runLog.logFor()` snapshots the buffer, so a line logged after the trace literal is never persisted; log (e.g. the `Run complete` cost line) before building the trace. Applies to `src/modules/reviews/run-executor.ts:292`.
- 2026-10-05 Supersedes the 2026-10-05 client contract note: the `server` and `client` copies of `trace.ts` already differ in the `PromptAssembly` doc comments (lines 44-47), so add schema fields by hand in both and never copy one file over the other. Applies to `src/vendor/shared/contracts/trace.ts:44`.
- 2026-10-05 Supersedes the `run-cost.ts` entry above: the PR list COST is now the SUM of all the PR's `done` runs with a known cost (null when none is known), not the latest review's run; when older runs have NULL cost the total under-reports, which is accepted over showing `--`. Applies to `src/modules/pulls/run-cost.ts:13`.

## Tool & Library Notes

## Recurring Errors & Fixes
- 2026-10-05 `completeAgentRun` sets status `done` before `saveRunTrace`, so a test reading `/runs/:id/trace` right after `waitForPrRuns` can see no trace; poll in the helper. Applies to `test/reviews.it.test.ts:19`.

## Session Notes
- 2026-10-05 Added 3 entries to server/INSIGHTS.md (run-cost-badge).
- 2026-10-05 Added 2 entries to server/INSIGHTS.md (GitHub mock in integration tests, vendored contract note).
- 2026-10-05 Added 1 entry to server/INSIGHTS.md (PR-list cost is now a total).

## Open Questions
