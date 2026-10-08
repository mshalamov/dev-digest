# Run Cost Badge Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Show each completed review run's real cost and token usage in the PR list (COST column, `$0.012`) and in the PR-detail verdict banner (`$0.014 – 8.2K → 1.3K`). Revision 2 adds the findings breakdown by severity: a `N CRITICAL · N WARNING · N SUGGESTION` pill row with click-to-filter in the expanded run card, and a FINDINGS column in the PR list with a hover popover (`N FINDINGS IN THIS RUN`).

**Architecture:** `reviewer-core` already returns `costUsd` (real OpenRouter `usage.cost`, else the price-book estimate, else `null`) in `ReviewOutcome`, but `run-executor.ts` drops it. We persist it on `agent_runs.cost_usd`, expose it on two existing GET routes (`/pulls/:id/runs` per run; `/repos/:id/pulls` per PR = the run behind the PR's latest review, the same review the score ring uses), and render it with one shared client component `RunCostBadge` (variants `compact` and `banner`) in the PR list, the verdict banner and the PR timeline. No new model calls and no new client fetches. The severity breakdown is counted on the client from findings already loaded (`countBySeverity` in `client/src/lib/severity.ts`). The PR list gets a trimmed preview of the latest review's findings in the existing `GET /repos/:id/pulls` payload, so hovering needs no extra fetch.

**Tech Stack:** Fastify 5 + Drizzle (Postgres) + Zod contracts, Vitest (+ Testcontainers for `*.it.test.ts`); Next.js 15 / React 19 / next-intl / TanStack Query, Vitest + Testing Library.

**Spec:** `docs/labs/lab_1/task3/run_cost_badge.md`, plus acceptance criteria rows 12–22 in `docs/labs/lab_1/hw1-acceptance-criteria.md` (severity counters, filter, list popover). Design: `docs/labs/lab_1/devdigest-design-standalone.html`. The design's `CostBadge` is cost in secondary colour, then tokens in a muted span. `PRRow` has a 76px Cost column after Status. `VerdictBanner` puts a `$` icon and the badge under the score with a top border. Sample: `VERDICT.cost = 0.014, tokens_in = 8200, tokens_out = 1300`.

## Revision 2 (2026-10-07): review feedback

Tasks 1–4 shipped in `ba424ee`. A review against the acceptance criteria found three gaps. This revision closes them:

1. **The expanded run card has no severity breakdown.** `VerdictBanner` shows only the total (`6 findings · 2 blockers`). There is no `N CRITICAL · N WARNING · N SUGGESTION` pill row and no click-to-filter (criteria 16–19). → **Task 5.**
2. **The PR list has no FINDINGS column**, so there is nothing to hover and no `N FINDINGS IN THIS RUN` popover (criteria 20–21). `server/src/modules/pulls/routes.ts:117-118` says the breakdown was "intentionally not surfaced on the list". That comment is removed, and the list gets the data. → **Tasks 6 (server) and 7 (client).**
3. **The plan had no phase names.** It is now grouped into the five phases: Initiation → Planning → Implementation → Validation → Completion (criterion 15).

**How the shipped code differs from Tasks 1–4 below.** The code is correct; the task text is kept as the history of what was executed.
- The list COST is the **total of all `done` runs** on the PR (`totalRunCostByPr` in `server/src/modules/pulls/run-cost.ts`, per criterion 12). It is not the latest review's run, so Decision 2 is superseded.
- `RunCostBadge` variants are `compact` (review-card header), `total` (list) and `timeline` (`9,119 tok · $0.0013`). There is no `banner` variant.
- The verdict banner does not show cost. Cost sits in the accordion header, and `ReviewRunAccordion.test.tsx` asserts the banner does not repeat it.

---

## Phase 1: Initiation

Inputs, constraints and the decisions approved before code is written.

- [x] Read the spec, the design file and `server/INSIGHTS.md` / `client/INSIGHTS.md` (Revision 1).
- [x] Get the user's OK on Decisions 1–5 (Revision 1).
- [x] Revision 2: re-read `client/INSIGHTS.md` and `server/INSIGHTS.md`, and acceptance criteria rows 15–22.
- [x] Revision 2: get the user's explicit OK on Decisions 6–9. Decision 9 edits the vendored `platform.ts` again.

### Global Constraints

- Every completed run (`status = 'done'`) renders a badge. (spec §1 Requirements)
- A run with no cost data renders `--`, never `$0.00`. (spec §1)
- Zero additional model calls to obtain cost/tokens. (spec §1)
- Cost shown must equal the persisted run value, which is the same number written to the run log. Cost source order: OpenRouter `usage.cost` → price-book estimate → `null`. (spec §2 Accuracy)
- Readable format: `$0.012`, not `$0.01`. (spec §2 Formatting)
- Incomplete runs (running / failed / cancelled) show no price. (spec §2)
- List format `$0.012`; banner format `$0.014 – 8.2K → 1.3K`. (spec §1)
- Client user-visible strings go through next-intl (`client/messages/en/prReview.json`). (client/CLAUDE.md)
- Never hand-edit `server/src/db/migrations/`; edit `src/db/schema/runs.ts`, then `pnpm db:generate`. (CLAUDE.md)
- No lint/format command exists; do not add one. Finish with `node scripts/check-claude-md.mjs`. (CLAUDE.md)
- Before starting any task, read the module's `INSIGHTS.md` (`server/INSIGHTS.md`, `client/INSIGHTS.md`). (CLAUDE.md)
- Component folders: `<Name>/<Name>.tsx`, `index.ts`, colocated `<Name>.test.tsx`. Server tests are `test/*.test.ts` (hermetic) or `test/*.it.test.ts` (Docker). (module CLAUDE.md files)
- Severity counts come from grouping findings that are already loaded. Opening the page or switching the filter makes no LLM call and no new fetch. (criterion 19)
- Pills show only the severities that are present. The filter row always shows all three buttons: **Critical**, **Warning**, **Suggestion**. Clicking the active button again clears the filter. (criteria 16, 18)
- The PR-list popover is read-only. Each preview shows a severity icon, title, category, `file:line`, `% confidence` and a short description, with no buttons or links. Accept/Dismiss stay on the PR page's run card only. (criteria 21, 22)

### Decisions (approved before execution)

1. **Vendored contracts are edited — needs explicit user OK before Task 1 starts.** `server/src/vendor/shared` and `client/src/vendor/shared` hold the Zod contracts (`RunSummary`, `PrMeta`, `RunStats`). Both CLAUDE.md files say "do not edit it here", but route schemas may not be redefined locally. Tasks 1-2 edit **both copies identically, adding fields only**. (`platform.ts` copies are identical; the `trace.ts` copies differ only in comments in `PromptAssembly`.)
2. **PR-list cost = cost of the run that produced the PR's latest review.** This is the same review the score ring uses, so list cost, list score and the top banner always describe the same run (the design's PR #482 shows `$0.014` in both places). It is not a sum over agents. If that run is not `done`, is gone, or has no cost, the list shows `--`.
3. **Empty marker is `--`** (spec text). The design mock uses `—`; the spec wins.
4. **Format rule.** The spec says "≥ 3 significant digits" but its own example `$0.012` has two.
   - `>= $1`: 2 decimals (`$1.50`).
   - `$0.01–$1`: 3 decimals (`$0.012`).
   - `$0.0001–$0.01`: 2 significant digits (`$0.0013`, never `$0.001`).
   - Below that: `<$0.0001`.
   - A real zero (free model): `$0.000`, which is distinct from `--`.
5. **Old runs are not backfilled.** Runs before migration 0010 have `cost_usd = NULL` and show `--`. Recomputing from tokens × today's prices wouldn't match what OpenRouter billed.

Revision 2 (needs user OK):

6. **A pill counts every finding in that run.** That includes accepted and dismissed findings, which still render as (muted) cards below, so the number on a pill equals the number of cards of that severity in the same card (criterion 17). "Hide low confidence" is an extra, separate view filter, and it is off by default. When it is on, the pill still counts the whole run.
7. **There is one severity filter per run card, held in `ReviewRunAccordion`.** Both the pills (in `VerdictBanner`) and the three filter buttons (in the `FindingsPanel` toolbar, below the pills) drive it. Clicking a severity selects it, clicking a different one switches, and clicking the active one clears it (`toggleSeverity`). Each card has its own filter, so filtering one run never hides findings in another.
8. **The list's FINDINGS column describes the latest review**, the same review the score ring uses. That is why the popover title says "IN THIS RUN". `findings: null` means the PR was never reviewed (shows `—`, no popover). `[]` means it was reviewed and nothing was kept (shows `0`, no popover).
9. **The list ships a trimmed preview, `PrFindingPreview`.** It has no `suggestion`, and `rationale` is cut to 140 plain-text characters as `summary`. It goes on `PrMeta.findings`, so hovering needs no fetch. This is an additive edit to **both** vendored `platform.ts` copies, under the same rule as Decision 1.

### Review Focus

These are failure modes the spec implies but no happy path covers, most likely first. Each has a test in the task that owns the code.

1. **A failed, cancelled or running run** shows no price: NULL in the DB, no badge in the timeline, `--` in the list. Tests: Task 1 (failed-run integration test), Task 2 (helper: non-`done` run gives null), Task 4 (timeline).
2. **Unknown model with no `usage.cost` and no price entry** gives `costUsd = null`, shown as `--`, not `$0.000`. Tests: Task 3 (`formatCostUsd(null)`), Task 1 (NULL is persisted, not 0).
3. **A tiny real cost** (`0.0013` in the design data) never rounds to `$0.00` or `$0.001`, in the UI or the run log. Tests: Task 3; the Task 1 log line uses 6 decimals.
4. **The PR list never disagrees with the score next to it.** It shows `--` for a PR with no review, or whose latest review's run is missing or unfinished. A deleted review must not leave its cost on the row. Test: Task 2.
5. **Pre-migration runs and legacy traces** (no `cost_usd` in `run_traces.trace.stats`) still parse and show `--`. Tests: Task 1 (contract parses a legacy `stats`), Task 4.

Revision 2 (severity breakdown):

6. **Keyboard actions on a filtered list.** After filtering, `a`/`d` (accept/dismiss) must hit the first *visible* card, never a card the filter has hidden. So the j/k focus index resets when the filter changes. Test: Task 5 (FindingsPanel, filter then press `a`).
7. **Clicking inside the popover must not open the PR.** The popover is portalled, but React events still bubble to `PRRow`'s `onClick`. Test: Task 7.
8. **The popover gets clipped, or covers rows near the bottom of the screen.** It is portalled with fixed positioning, kept inside the viewport horizontally, and flipped above the icons when there's no room below. Test: Task 7 (`popoverPosition`).
9. **Moving the pointer from the icons into the popover** closes it before you can read it. A close delay (`CLOSE_DELAY_MS`) is cancelled when the pointer enters the popover. Keyboard focus also opens it, and Escape closes it. Test: Task 7.
10. **A severity string the client doesn't know** (the DB column is free `text`) must not add a bucket or a pill. A key like `toString` must not hit `Object.prototype` either. Test: Task 5 (`countBySeverity`).

---

## Phase 2: Planning

This document is the Planning output: Decisions and Review Focus above, file map below, then tasks. Revision 2 is planned against the code as shipped in `ba424ee`.

### File Structure

| File | Responsibility |
|---|---|
| `server/src/db/schema/runs.ts` (modify) | `agentRuns.costUsd` column |
| `server/src/db/migrations/0010_*` (generated) | `ALTER TABLE agent_runs ADD COLUMN cost_usd double precision` |
| `server/src/modules/reviews/repository/run.repo.ts`, `.../repository.ts` (modify) | write `costUsd` on completion; return `cost_usd` in run history |
| `server/src/modules/reviews/run-executor.ts` (modify) | pass `outcome.costUsd` through; trace stats + persisted log line |
| `server/src/vendor/shared/contracts/{trace,platform}.ts` + `client/src/vendor/shared/contracts/{trace,platform}.ts` (modify) | `RunStats.cost_usd`, `RunSummary.cost_usd`, `PrMeta.cost_usd` |
| `server/src/modules/pulls/run-cost.ts` (create) | pure `costOfLatestReviewRun` |
| `server/src/modules/pulls/routes.ts` (modify) | add `cost_usd` to the PR list |
| `client/src/components/run-cost-badge/{format.ts,RunCostBadge.tsx,index.ts,RunCostBadge.test.tsx}` (create) | formatting and the 2-variant component |
| `client/messages/en/prReview.json` (modify) | `list.columns.cost`, `cost.*` |
| `client/src/app/repos/[repoId]/pulls/{constants.ts}`, `_components/PRRow/*` | COST column |
| `…/[number]/_components/{FindingsTab,ReviewRunAccordion,VerdictBanner,RunHistory}/*` | banner + timeline badge |
| `server/INSIGHTS.md`, `client/INSIGHTS.md` | session findings |
| **Revision 2** | |
| `client/src/lib/severity.ts` (create) | `SEVERITIES`, `countBySeverity`, `filterBySeverity`, `toggleSeverity`; used by the PR page and the PR list |
| `…/[number]/_components/SeverityPills/*` (create) | `N CRITICAL · N WARNING · N SUGGESTION` clickable pill row |
| `…/[number]/_components/SeverityFilter/*` (create) | the Critical / Warning / Suggestion filter buttons |
| `…/[number]/_components/{VerdictBanner,FindingsPanel,ReviewRunAccordion}/*` (modify) | pill row under verdict + score; filter in the toolbar; one shared filter state per run card |
| `server/src/vendor/shared/contracts/platform.ts` + `client/…/platform.ts` (modify) | `PrFindingPreview`, `PrMeta.findings` |
| `server/src/modules/pulls/findings-preview.ts` (create) | pure `latestFindingsByPr`, `shortSummary` |
| `server/src/modules/pulls/routes.ts` (modify) | add `findings` to the PR list; drop the "intentionally not surfaced" comment |
| `client/src/app/repos/[repoId]/pulls/_components/FindingsCell/*` (create) | severity-icon counts + hover/focus popover (`FindingsPopover`, `popoverPosition`) |
| `client/src/app/repos/[repoId]/pulls/{constants.ts,_components/PRRow/*}` (modify) | FINDINGS column |

---

## Phase 3: Implementation

Tasks 1–4 shipped in `ba424ee` (see the deviations in Revision 2). Tasks 5–7 are new.

### Task 1: Persist run cost (server)

**Files:**
- Modify: `server/src/db/schema/runs.ts:1,19-20`
- Generate: `server/src/db/migrations/0010_*.sql` + `meta/` (drizzle-kit only)
- Modify: `server/src/modules/reviews/repository/run.repo.ts` (`listRunsForPull` ~l.47-66, `completeAgentRun` ~l.141-175)
- Modify: `server/src/modules/reviews/repository.ts:150-165`
- Modify: `server/src/modules/reviews/run-executor.ts:213` (destructure), `:243-253` (completeAgentRun), `:262-269` (trace stats), `:283-285` (log)
- Modify (identical edit in both): `server/src/vendor/shared/contracts/trace.ts`, `client/src/vendor/shared/contracts/trace.ts`
- Modify: `client/src/app/repos/[repoId]/pulls/[number]/_components/RunHistory/RunHistory.test.tsx:16-34` (fixture gains `cost_usd`)
- Test: `server/test/reviews.it.test.ts`, `server/test/contracts.test.ts`

**Interfaces:**
- Consumes: `ReviewOutcome.costUsd: number | null` (`reviewer-core/src/review/run.ts:110`).
- Produces:
  - Column `agent_runs.cost_usd double precision NULL` → Drizzle `agentRuns.costUsd: number | null`.
  - `completeAgentRun(runId, values)` takes optional `costUsd?: number | null` (omitted ⇒ NULL).
  - `RunStats.cost_usd?: number | null` (nullish), `RunSummary.cost_usd: number | null`.

- [x] **Step 1: Write the failing tests**

In `server/test/reviews.it.test.ts`, add near the top (after `config`):

```ts
/** `completeAgentRun` (status done, which ends waitForPrRuns) runs before
 *  `saveRunTrace`, so poll until the trace document exists. */
async function fetchTrace(app: { inject: (o: { method: 'GET'; url: string }) => Promise<{ statusCode: number; json: () => any }> }, runId: string) {
  for (let i = 0; i < 200; i++) {
    const res = await app.inject({ method: 'GET', url: `/runs/${runId}/trace` });
    if (res.statusCode === 200 && res.json()?.stats) return res.json();
    await new Promise((r) => setTimeout(r, 25));
  }
  throw new Error(`trace for ${runId} never persisted`);
}
```

In the first test (`runs a review: map-reduce + grounding…`), replace
`const trace = (await app.inject({ method: 'GET', url: \`/runs/${runId}/trace\` })).json();`
with `const trace = await fetchTrace(app, runId);`, and after `expect(run!.grounding).toBe('1/2 passed');` add:

```ts
    // cost: MockLLMProvider reports costUsd 0.001 / 100 in / 50 out per call; the
    // single-file DIFF is one single-pass call, so the run's cost is exactly that.
    expect(run!.costUsd).toBeCloseTo(0.001, 10);
    expect(run!.tokensIn).toBe(100);
    expect(run!.tokensOut).toBe(50);
    expect(trace.stats.cost_usd).toBeCloseTo(0.001, 10);
    // the persisted run log carries the same number
    expect(trace.log.map((l: { msg: string }) => l.msg).join('\n')).toContain('$0.001000');

    const history = (await app.inject({ method: 'GET', url: `/pulls/${pr.id}/runs` })).json();
    expect(history[0].cost_usd).toBeCloseTo(0.001, 10);
```

Add a new test right after it in the same `d(...)` block:

```ts
  it('a failed run stores NULL cost (never 0)', async () => {
    // fixture violates the Review schema → MockLLMProvider throws → run fails
    const app = await appWith({ not: 'a review' });
    const { pr } = await setupRepoAndPr(pg.handle.db, workspaceId);
    const agent = (
      await app.inject({
        method: 'POST',
        url: '/agents',
        payload: { name: 'Failing', provider: 'openai', model: 'gpt-4.1', system_prompt: 'x' },
      })
    ).json();
    await app.inject({ method: 'POST', url: `/pulls/${pr.id}/review`, payload: { agentId: agent.id } });
    const runs = await waitForPrRuns(pg.handle.db, pr.id, { expected: 1 });
    expect(runs[0]!.status).toBe('failed');
    expect(runs[0]!.costUsd).toBeNull();

    const history = (await app.inject({ method: 'GET', url: `/pulls/${pr.id}/runs` })).json();
    expect(history[0].cost_usd).toBeNull();
    await app.close();
  });
```

In `server/test/contracts.test.ts`, add `RunStats` to the existing `@devdigest/shared` import, and append:

```ts
describe('RunStats cost_usd', () => {
  it('parses a legacy stats object without cost_usd, and one with null', () => {
    const base = { duration_ms: 1, tokens_in: 2, tokens_out: 3, findings: 0, grounding: '0/0 passed' };
    expect(RunStats.parse(base).cost_usd).toBeUndefined();
    expect(RunStats.parse({ ...base, cost_usd: null }).cost_usd).toBeNull();
    expect(RunStats.parse({ ...base, cost_usd: 0.014 }).cost_usd).toBe(0.014);
  });
});
```

- [x] **Step 2: Run tests to verify they fail**

- `cd server && pnpm exec vitest run test/contracts.test.ts`. The new case FAILS: zod strips the unknown key, so `toBeNull` and `toBe(0.014)` fail.
- `cd server && pnpm exec vitest run test/reviews.it.test.ts`. The new assertions FAIL (`costUsd` undefined). This needs Docker running; without it the suite skips.

- [x] **Step 3: Implement**

`server/src/db/schema/runs.ts`: add `doublePrecision` to the `drizzle-orm/pg-core` import. After `tokensOut`, add:

```ts
  /** Real USD cost of the run (OpenRouter usage.cost, else price-book estimate).
   *  NULL = unknown / run not completed — never 0 as a stand-in. */
  costUsd: doublePrecision('cost_usd'),
```

Generate the migration (never hand-edit):

```bash
cd server && pnpm db:generate
git status --short src/db/migrations     # one new 0010_*.sql + meta/_journal.json + meta/0010_snapshot.json
cat src/db/migrations/0010_*.sql          # must be exactly: ALTER TABLE "agent_runs" ADD COLUMN "cost_usd" double precision;
```

If the dev DB is up (`docker compose up -d`, `DATABASE_URL` set), also run `pnpm db:migrate`. The integration tests migrate their own container and do not need it.

`run.repo.ts` changes:
- In the `completeAgentRun` values type, add `/** USD cost; null/omitted ⇒ unknown. */ costUsd?: number | null;`.
- In `.set({...})`, add `costUsd: values.costUsd ?? null,`.
- In `listRunsForPull`, add `cost_usd: run.costUsd,` after `tokens_out`.

`repository.ts`: add the same `costUsd?: number | null;` to the `completeAgentRun` facade values type.

`run-executor.ts` changes:
- Change `const { tokensIn, tokensOut, grounding } = outcome;` to `const { tokensIn, tokensOut, costUsd, grounding } = outcome;`.
- Add `costUsd,` after `tokensOut,` in the `completeAgentRun` call.
- Add `cost_usd: costUsd,` to the trace `stats` object.
- Insert the new log line **before** the `const trace: RunTrace = {` literal. `log: runLog.logFor(runId)` copies the buffer at that moment, so any line logged later is never persisted:

```ts
      // Logged BEFORE the trace is built: logFor() snapshots the buffer, so this
      // line is persisted and matches agent_runs.cost_usd exactly.
      runLog.result(
        `Run complete · ${tokensIn} in / ${tokensOut} out tokens · ` +
          (costUsd == null ? 'cost unknown' : `$${costUsd.toFixed(6)}`),
      );
```

  Keep the existing `runLog.info('Run complete; trace persisted');` as it is. The failure path already omits `costUsd`, which stores NULL; leave it alone.

Contracts, **identical edit in both** `trace.ts` copies. In `RunStats`, after `grounding`:

```ts
  /** USD cost of the run; absent on legacy traces, null when unknown. */
  cost_usd: z.number().nullish(),
```

In `RunSummary`, after `tokens_out`:

```ts
  /** USD cost; null for unfinished runs and runs with no cost data. */
  cost_usd: z.number().nullable(),
```

`RunHistory.test.tsx` fixture `run()`: add `cost_usd: null,` after `blockers: null,`. The field is now required, and the client typecheck covers `*.test.tsx`.

- [x] **Step 4: Run tests to verify they pass**

```bash
cd server && pnpm typecheck && pnpm exec vitest run test/contracts.test.ts test/reviews.it.test.ts
cd ../client && pnpm typecheck && pnpm exec vitest run src/app/repos
```

Expected: PASS.

- [x] **Step 5: Commit**

```bash
git add server/src/db/schema/runs.ts server/src/db/migrations server/src/modules/reviews \
  server/src/vendor/shared/contracts/trace.ts client/src/vendor/shared/contracts/trace.ts \
  "client/src/app/repos/[repoId]/pulls/[number]/_components/RunHistory/RunHistory.test.tsx" server/test
git commit -m "feat(server): persist per-run cost on agent_runs and expose it in run history"
```

---

### Task 2: PR-list cost (server)

**Files:**
- Create: `server/src/modules/pulls/run-cost.ts`
- Modify: `server/src/modules/pulls/routes.ts:114-155` (latest-review block + returned object)
- Modify (identical edit in both): `server/src/vendor/shared/contracts/platform.ts`, `client/src/vendor/shared/contracts/platform.ts` (`PrMeta`)
- Test: `server/test/pulls-run-cost.test.ts` (hermetic), `server/test/reviews.it.test.ts`

**Interfaces:**
- Consumes: `agentRuns.costUsd` (Task 1); `reviews.runId` (`server/src/db/schema/reviews.ts:19`, no FK).
- Produces:
  - `export interface RunCostRow { id: string; status: string | null; costUsd: number | null }`
  - `export function costOfLatestReviewRun(latestRunIdByPr: Map<string, string | null>, runs: RunCostRow[]): Map<string, number | null>`. It returns one entry per PR in the input map: the run's `costUsd` if that run exists and is `done`, else `null`.
  - `PrMeta.cost_usd?: number | null` (nullish; list endpoint only).

- [x] **Step 1: Write the failing tests**

`server/test/pulls-run-cost.test.ts`:

```ts
/**
 * PR-list cost (`modules/pulls/run-cost.ts`): the COST cell shows the cost of
 * the run behind the PR's latest review — the same review the score ring uses —
 * so cost and score never describe different runs.
 */
import { describe, it, expect } from 'vitest';
import { costOfLatestReviewRun, type RunCostRow } from '../src/modules/pulls/run-cost.js';

const run = (o: Partial<RunCostRow> & { id: string }): RunCostRow => ({ status: 'done', costUsd: 0.01, ...o });

describe('costOfLatestReviewRun', () => {
  it("returns the latest review's run cost", () => {
    const m = costOfLatestReviewRun(new Map([['pr1', 'r2']]), [
      run({ id: 'r1', costUsd: 0.5 }),
      run({ id: 'r2', costUsd: 0.014 }),
    ]);
    expect(m.get('pr1')).toBe(0.014);
  });

  it('a run that is not done never shows a price', () => {
    for (const status of ['failed', 'cancelled', 'running', null]) {
      const m = costOfLatestReviewRun(new Map([['pr1', 'r1']]), [run({ id: 'r1', status, costUsd: 0.3 })]);
      expect(m.get('pr1')).toBeNull();
    }
  });

  it('unknown cost stays null; a missing run (deleted) or a review without run_id is null', () => {
    const m = costOfLatestReviewRun(
      new Map<string, string | null>([['a', 'r1'], ['b', 'gone'], ['c', null]]),
      [run({ id: 'r1', costUsd: null })],
    );
    expect(m.get('a')).toBeNull();
    expect(m.get('b')).toBeNull();
    expect(m.get('c')).toBeNull();
  });

  it('keeps a real zero (free model) as 0, distinct from null', () => {
    expect(costOfLatestReviewRun(new Map([['pr1', 'r1']]), [run({ id: 'r1', costUsd: 0 })]).get('pr1')).toBe(0);
  });

  it('PRs without a review are absent', () => {
    expect(costOfLatestReviewRun(new Map(), [run({ id: 'r1' })]).size).toBe(0);
  });
});
```

`server/test/reviews.it.test.ts` changes:
- Import `MockGitHubClient` from `../src/adapters/mocks.js`.
- In `appWith` overrides, add `github: new MockGitHubClient(),`. This keeps `GET /repos/:id/pulls` hermetic even when `~/.devdigest/secrets.json` or `GITHUB_TOKEN` exists (same idiom as `test/integration.it.test.ts:120`).
- In the first test, change `const { pr } = await setupRepoAndPr(...)` to `const { repo, pr } = …`, and before `await app.close()` add:

```ts
    const list = (await app.inject({ method: 'GET', url: `/repos/${repo.id}/pulls` })).json();
    const row = list.find((p: { id: string }) => p.id === pr.id);
    expect(row.cost_usd).toBeCloseTo(0.001, 10);
    expect(row.score).toBe(65); // same review → same run as the cost
```

In the failed-run test, also destructure `repo` and before `await app.close()` add:

```ts
    const list = (await app.inject({ method: 'GET', url: `/repos/${repo.id}/pulls` })).json();
    expect(list.find((p: { id: string }) => p.id === pr.id).cost_usd).toBeNull();
```

- [x] **Step 2: Run to verify failure**

Run: `cd server && pnpm exec vitest run test/pulls-run-cost.test.ts`. Expected: FAIL (module not found).

- [x] **Step 3: Implement**

`server/src/modules/pulls/run-cost.ts`:

```ts
/**
 * Cost for the PR list: the cost of the run that produced the PR's latest
 * review — the same review the score ring is taken from — so the list's cost and
 * score always describe one run. A run that isn't `done`, no longer exists, or
 * has unknown cost yields null (rendered "--"), never another run's number.
 */
export interface RunCostRow {
  id: string;
  status: string | null;
  costUsd: number | null;
}

export function costOfLatestReviewRun(
  latestRunIdByPr: Map<string, string | null>,
  runs: RunCostRow[],
): Map<string, number | null> {
  const byId = new Map(runs.map((r) => [r.id, r]));
  const out = new Map<string, number | null>();
  for (const [prId, runId] of latestRunIdByPr) {
    const r = runId ? byId.get(runId) : undefined;
    out.set(prId, r && r.status === 'done' ? r.costUsd : null);
  }
  return out;
}
```

`routes.ts` changes:
- Add `import { costOfLatestReviewRun } from './run-cost.js';`.
- Widen the latest-review map to also carry `runId`:

```ts
    const latestReviewByPr = new Map<string, { score: number | null; runId: string | null }>();
    if (prIds.length > 0) {
      const reviewRows = await container.db
        .select({ prId: t.reviews.prId, score: t.reviews.score, runId: t.reviews.runId })
        .from(t.reviews)
        .where(and(inArray(t.reviews.prId, prIds), eq(t.reviews.kind, 'review')))
        .orderBy(desc(t.reviews.createdAt));
      // Rows are newest-first → first seen per PR is the latest review.
      for (const rv of reviewRows) {
        if (!latestReviewByPr.has(rv.prId)) latestReviewByPr.set(rv.prId, { score: rv.score, runId: rv.runId });
      }
    }

    // COST = the run behind that same latest review (see run-cost.ts).
    const latestRunIdByPr = new Map([...latestReviewByPr].map(([prId, v]) => [prId, v.runId]));
    const runIds = [...new Set([...latestRunIdByPr.values()].filter((id): id is string => id != null))];
    const runRows =
      runIds.length > 0
        ? await container.db
            .select({ id: t.agentRuns.id, status: t.agentRuns.status, costUsd: t.agentRuns.costUsd })
            .from(t.agentRuns)
            .where(inArray(t.agentRuns.id, runIds))
        : [];
    const costByPr = costOfLatestReviewRun(latestRunIdByPr, runRows);
```

- In the returned object, after `score: …`, add `cost_usd: costByPr.get(r.id) ?? null,`.

`PrMeta` in **both** `platform.ts` copies, after `score`:

```ts
  // Cost (USD) of the run behind the latest review (list endpoint only; null/absent = no data).
  cost_usd: z.number().nullish(),
```

- [x] **Step 4: Run to verify pass**

```bash
cd server && pnpm typecheck && pnpm exec vitest run --exclude '**/*.it.test.ts' && pnpm exec vitest run test/reviews.it.test.ts
cd ../client && pnpm typecheck
```

Expected: PASS.

- [x] **Step 5: Commit**

```bash
git add server/src/modules/pulls server/src/vendor/shared/contracts/platform.ts client/src/vendor/shared/contracts/platform.ts server/test
git commit -m "feat(server): serve the latest review's run cost on the PR list"
```

---

### Task 3: `RunCostBadge` component + formatters (client)

**Files:**
- Create: `client/src/components/run-cost-badge/format.ts`, `RunCostBadge.tsx`, `index.ts`, `RunCostBadge.test.tsx`
- Modify: `client/messages/en/prReview.json`

**Interfaces:**
- Consumes: nothing from earlier tasks (pure props).
- Produces:
  - `formatCostUsd(usd: number | null | undefined): string`. Returns `"--"` for null, undefined, NaN or negative.
  - `formatTokens(n: number | null | undefined): string`. Returns `"--"` for null.
  - `<RunCostBadge variant="compact" | "banner" costUsd={number|null|undefined} tokensIn?={number|null} tokensOut?={number|null} />`. The root `<span>` has `title` `"Cost of this run"` when cost is known and `"No cost data"` otherwise. Tests locate it with `getByTitle`.
  - i18n keys under `prReview`: `list.columns.cost`, `cost.none`, `cost.title`, `cost.noneTitle`, `cost.tokens`.

- [x] **Step 1: Write the failing tests**

`client/src/components/run-cost-badge/RunCostBadge.test.tsx`:

```tsx
import { describe, it, expect, afterEach } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import messages from "../../../messages/en/prReview.json";
import { RunCostBadge } from "./RunCostBadge";
import { formatCostUsd, formatTokens } from "./format";

afterEach(cleanup);

function renderWithIntl(ui: React.ReactElement) {
  return render(
    <NextIntlClientProvider locale="en" messages={{ prReview: messages }}>
      {ui}
    </NextIntlClientProvider>,
  );
}

describe("formatCostUsd", () => {
  it("keeps enough digits to read: $0.012 not $0.01", () => {
    expect(formatCostUsd(0.012)).toBe("$0.012");
    expect(formatCostUsd(0.014)).toBe("$0.014");
    expect(formatCostUsd(0.041)).toBe("$0.041");
    expect(formatCostUsd(0.5)).toBe("$0.500");
  });
  it("never collapses a tiny real cost to $0.00 / $0.001", () => {
    expect(formatCostUsd(0.0013)).toBe("$0.0013");
    expect(formatCostUsd(0.00999)).toBe("$0.010");
    expect(formatCostUsd(0.00002)).toBe("<$0.0001");
  });
  it("uses cents above $1, including values that round up to $1", () => {
    expect(formatCostUsd(1.5)).toBe("$1.50");
    expect(formatCostUsd(0.9996)).toBe("$1.00");
  });
  it("a real zero is $0.000, but no data is --", () => {
    expect(formatCostUsd(0)).toBe("$0.000");
    expect(formatCostUsd(null)).toBe("--");
    expect(formatCostUsd(undefined)).toBe("--");
    expect(formatCostUsd(Number.NaN)).toBe("--");
    expect(formatCostUsd(-1)).toBe("--");
  });
});

describe("formatTokens", () => {
  it("compacts to K / M with one decimal", () => {
    expect(formatTokens(8200)).toBe("8.2K");
    expect(formatTokens(1300)).toBe("1.3K");
    expect(formatTokens(950)).toBe("950");
    expect(formatTokens(0)).toBe("0");
    expect(formatTokens(1_250_000)).toBe("1.3M");
    expect(formatTokens(999_990)).toBe("1.0M");
    expect(formatTokens(null)).toBe("--");
  });
});

describe("RunCostBadge", () => {
  it("compact: cost only", () => {
    renderWithIntl(<RunCostBadge variant="compact" costUsd={0.012} tokensIn={8200} tokensOut={1300} />);
    expect(screen.getByTitle("Cost of this run").textContent).toBe("$0.012");
  });
  it("banner: cost – tokens in → tokens out, tokens in their own muted span", () => {
    renderWithIntl(<RunCostBadge variant="banner" costUsd={0.014} tokensIn={8200} tokensOut={1300} />);
    expect(screen.getByTitle("Cost of this run").textContent).toBe("$0.014 – 8.2K → 1.3K");
    expect(screen.getByText("– 8.2K → 1.3K").tagName).toBe("SPAN");
  });
  it("banner without token counts shows the cost alone", () => {
    renderWithIntl(<RunCostBadge variant="banner" costUsd={0.014} />);
    expect(screen.getByTitle("Cost of this run").textContent).toBe("$0.014");
  });
  it.each(["compact", "banner"] as const)("%s: no cost data renders -- and never $0.00", (variant) => {
    renderWithIntl(<RunCostBadge variant={variant} costUsd={null} tokensIn={8200} tokensOut={1300} />);
    expect(screen.getByTitle("No cost data").textContent).toBe("--");
    expect(screen.queryByText(/\$/)).not.toBeInTheDocument();
  });
});
```

- [x] **Step 2: Run to verify failure**

Run: `cd client && pnpm exec vitest run src/components/run-cost-badge`. Expected: FAIL (modules not found).

- [x] **Step 3: Implement**

`client/messages/en/prReview.json` changes:
- Add `"cost": "Cost"` to `list.columns`, between `status` and `updated`.
- Add a new top-level block next to `verdict`:

```json
  "cost": {
    "none": "--",
    "title": "Cost of this run",
    "noneTitle": "No cost data",
    "tokens": "– {tokensIn} → {tokensOut}"
  },
```

`format.ts`:

```ts
/** Formatting for run cost / token usage. `--` means "no data" and is never `$0.00`. */
export const NO_DATA = "--";

/** USD for a run. >= $1: cents; $0.01-$1: 3 decimals ($0.012); below that 2
 *  significant digits ($0.0013) so a real small cost never rounds to $0.00;
 *  below $0.0001: "<$0.0001". A real 0 (free model) is "$0.000". */
export function formatCostUsd(usd: number | null | undefined): string {
  if (usd == null || !Number.isFinite(usd) || usd < 0) return NO_DATA;
  if (usd === 0) return "$0.000";
  if (Number(usd.toFixed(3)) >= 1) return `$${usd.toFixed(2)}`;
  if (usd >= 0.01) return `$${usd.toFixed(3)}`;
  if (usd >= 0.0001) return `$${usd.toPrecision(2)}`;
  return "<$0.0001";
}

/** Compact token count: 950 → "950", 8200 → "8.2K", 1_250_000 → "1.3M". */
export function formatTokens(n: number | null | undefined): string {
  if (n == null || !Number.isFinite(n) || n < 0) return NO_DATA;
  if (n >= 999_950) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1000) return `${(n / 1000).toFixed(1)}K`;
  return String(Math.round(n));
}
```

`RunCostBadge.tsx`:

```tsx
/* RunCostBadge — a run's cost (and, in the banner, token usage). Ported from
   the design's CostBadge.
   compact → "$0.012" (PR list COST column, timeline rows)
   banner  → "$0.014 – 8.2K → 1.3K" (verdict banner; tokens in a muted span)
   No cost data renders "--" (never $0.00); tokens are only shown next to a real cost. */
"use client";

import React from "react";
import type { CSSProperties } from "react";
import { useTranslations } from "next-intl";
import { NO_DATA, formatCostUsd, formatTokens } from "./format";

export type RunCostBadgeVariant = "compact" | "banner";

const s = {
  cost: (variant: RunCostBadgeVariant): CSSProperties => ({
    fontSize: variant === "banner" ? 13 : 11.5,
    fontWeight: 500,
    color: "var(--text-secondary)",
  }),
  tokens: { fontWeight: 400, color: "var(--text-muted)" } satisfies CSSProperties,
  none: { fontSize: 12, color: "var(--text-muted)" } satisfies CSSProperties,
};

export function RunCostBadge({
  variant,
  costUsd,
  tokensIn,
  tokensOut,
}: {
  variant: RunCostBadgeVariant;
  costUsd: number | null | undefined;
  tokensIn?: number | null;
  tokensOut?: number | null;
}) {
  const t = useTranslations("prReview");
  const cost = formatCostUsd(costUsd);
  if (cost === NO_DATA) {
    return (
      <span className="mono" style={s.none} title={t("cost.noneTitle")}>
        {t("cost.none")}
      </span>
    );
  }
  const showTokens = variant === "banner" && tokensIn != null && tokensOut != null;
  return (
    <span className="mono tnum" style={s.cost(variant)} title={t("cost.title")}>
      {cost}
      {showTokens && (
        <>
          {" "}
          <span style={s.tokens}>
            {t("cost.tokens", { tokensIn: formatTokens(tokensIn), tokensOut: formatTokens(tokensOut) })}
          </span>
        </>
      )}
    </span>
  );
}

export default RunCostBadge;
```

`index.ts`:

```ts
export { RunCostBadge, default } from "./RunCostBadge";
export { formatCostUsd, formatTokens } from "./format";
```

- [x] **Step 4: Run to verify pass**

Run: `cd client && pnpm exec vitest run src/components/run-cost-badge && pnpm typecheck`. Expected: PASS.

- [x] **Step 5: Commit**

```bash
git add client/src/components/run-cost-badge client/messages/en/prReview.json
git commit -m "feat(client): add RunCostBadge (compact + banner) and cost formatters"
```

---

### Task 4: Show the badge in the PR list, verdict banner and timeline (client)

**Files:**
- Modify: `client/src/app/repos/[repoId]/pulls/constants.ts` (`GRID`, `COLUMN_KEYS`)
- Modify: `client/src/app/repos/[repoId]/pulls/_components/PRRow/PRRow.tsx`
- Create: `client/src/app/repos/[repoId]/pulls/_components/PRRow/PRRow.test.tsx`
- Modify: `…/[number]/_components/VerdictBanner/{VerdictBanner.tsx,styles.ts,VerdictBanner.test.tsx}`
- Modify: `…/[number]/_components/ReviewRunAccordion/ReviewRunAccordion.tsx`, `…/FindingsTab/FindingsTab.tsx`
- Modify: `…/[number]/_components/RunHistory/{RunHistory.tsx,RunHistory.test.tsx}`

**Interfaces:**
- Consumes: `RunCostBadge` (Task 3), `PrMeta.cost_usd` (Task 2), and `RunSummary.cost_usd/tokens_in/tokens_out` (Task 1). Both contracts are already in the client's `@devdigest/shared`.
- Produces:
  - `VerdictBanner` gains optional props `costUsd?: number | null; tokensIn?: number | null; tokensOut?: number | null`.
  - `ReviewRunAccordion` gains an optional prop `run?: RunSummary | null`.

Every completed run gets a badge. The timeline (`RunHistory`) lists every run without expanding anything, so each `done` row there gets a compact badge. The expanded review shows the banner variant.

- [x] **Step 1: Write the failing tests**

`PRRow.test.tsx` (the `next/navigation` mock matches `RunReviewDropdown.test.tsx:6`):

```tsx
import { describe, it, expect, afterEach, vi } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import messages from "../../../../../../../messages/en/prReview.json";
import type { PrMeta } from "@/lib/types";
import { PRRow } from "./PRRow";

vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn() }) }));
afterEach(cleanup);

const pr = (over: Partial<PrMeta>): PrMeta => ({
  number: 482, title: "Add rate limiting", author: "marisa.koch", branch: "f", base: "main",
  head_sha: "abc", additions: 10, deletions: 2, files_count: 1, status: "reviewed",
  updated_at: new Date().toISOString(), score: 61, ...over,
});

function renderRow(p: PrMeta) {
  return render(
    <NextIntlClientProvider locale="en" messages={{ prReview: messages }}>
      <PRRow pr={p} repoId="r1" />
    </NextIntlClientProvider>,
  );
}

describe("PRRow cost column", () => {
  it("shows the compact cost of the latest review's run", () => {
    renderRow(pr({ cost_usd: 0.012 }));
    expect(screen.getByText("$0.012")).toBeInTheDocument();
  });
  it("shows -- when the PR has no cost data (unreviewed, or cost unknown)", () => {
    renderRow(pr({ cost_usd: null, score: null }));
    expect(screen.getByText("--")).toBeInTheDocument();
    expect(screen.queryByText(/\$/)).not.toBeInTheDocument();
  });
  it("shows -- when cost_usd is absent from the payload", () => {
    renderRow(pr({}));
    expect(screen.getByText("--")).toBeInTheDocument();
  });
});
```

(The unreviewed score cell renders `—`, an em dash, which differs from `--`, so `getByText("--")` stays unique. `relativeTime(now)` renders `now`.)

Append to the `describe` in `VerdictBanner.test.tsx`:

```tsx
  it("shows cost and token usage in the banner row", () => {
    renderWithIntl(
      <VerdictBanner verdict="request_changes" summary="s" score={61} findingsCount={6} blockers={2}
        costUsd={0.014} tokensIn={8200} tokensOut={1300} />,
    );
    expect(screen.getByTitle("Cost of this run").textContent).toBe("$0.014 – 8.2K → 1.3K");
  });

  it("shows -- (not $0.00) when the run has no cost data", () => {
    renderWithIntl(
      <VerdictBanner verdict="comment" summary="s" score={90} findingsCount={0} blockers={0}
        costUsd={null} tokensIn={8200} tokensOut={1300} />,
    );
    expect(screen.getByTitle("No cost data").textContent).toBe("--");
    expect(screen.queryByText(/\$/)).not.toBeInTheDocument();
  });
```

Append to `RunHistory.test.tsx`:

```tsx
describe("RunHistory — cost badge", () => {
  it("a done run shows its compact cost", () => {
    renderRuns([run({ status: "done", findings_count: 0, blockers: 0, score: 95, cost_usd: 0.012 })]);
    expect(screen.getByText("$0.012")).toBeInTheDocument();
  });

  it("a done run without cost data shows --", () => {
    renderRuns([run({ status: "done", findings_count: 0, blockers: 0, score: 95, cost_usd: null })]);
    expect(screen.getByText("--")).toBeInTheDocument();
  });

  it.each(["failed", "running", "cancelled"])("a %s run shows no price at all", (status) => {
    renderRuns([run({ status, error: status === "failed" ? "boom" : null, score: null, cost_usd: 0.5 })]);
    expect(screen.queryByText(/\$/)).not.toBeInTheDocument();
    expect(screen.queryByText("--")).not.toBeInTheDocument();
  });
});
```

- [x] **Step 2: Run to verify failure**

Run: `cd client && pnpm exec vitest run src/app/repos`. Expected: the new tests FAIL.

- [x] **Step 3: Implement**

`constants.ts`:
- Set `export const GRID = "1fr 132px 92px 60px 118px 76px 78px";`.
- Set `COLUMN_KEYS` to `["pullRequest","author","size","score","status","cost","updated"]`. `page.tsx` maps these into the header, so it needs no change.

`PRRow.tsx`: add `import { RunCostBadge } from "@/components/run-cost-badge";`. Between the status `<div>` and the updated `<div>`, add:

```tsx
      <div>
        <RunCostBadge variant="compact" costUsd={pr.cost_usd} />
      </div>
```

`VerdictBanner.tsx`:
- Import `RunCostBadge` from `@/components/run-cost-badge`.
- Add the three optional props to the destructuring and its type (`costUsd?: number | null; tokensIn?: number | null; tokensOut?: number | null;`).
- Replace the `{score != null && (<div style={s.scoreCol}>…</div>)}` block with:

```tsx
      <div style={s.scoreCol}>
        {score != null && (
          <>
            <CircularScore score={score} size={52} stroke={5} />
            <span style={s.scoreLabel}>{t("verdict.prScore")}</span>
          </>
        )}
        <div style={s.costRow}>
          <Icon.DollarSign size={11} style={s.costIcon} />
          <RunCostBadge variant="banner" costUsd={costUsd} tokensIn={tokensIn} tokensOut={tokensOut} />
        </div>
      </div>
```

`VerdictBanner/styles.ts` (matches the design: top border, 5px gap). Add:

```ts
  costRow: {
    display: "flex",
    alignItems: "center",
    gap: 5,
    marginTop: 5,
    paddingTop: 6,
    borderTop: "1px solid var(--border)",
  } satisfies CSSProperties,
  costIcon: { color: "var(--text-muted)" } satisfies CSSProperties,
```

`ReviewRunAccordion.tsx`:
- Add `RunSummary` to the `@devdigest/shared` type import.
- Add the prop `/** This review's agent_runs row (supplies cost/tokens). */ run?: RunSummary | null;` to the destructuring and type.
- Pass these to `<VerdictBanner …>`:

```tsx
                costUsd={run?.cost_usd ?? null}
                tokensIn={run?.tokens_in ?? null}
                tokensOut={run?.tokens_out ?? null}
```

`FindingsTab.tsx`: in the `runs.map`, add `run={prRuns?.find((r) => r.run_id === review.run_id) ?? null}` to `<ReviewRunAccordion …>`. `prRuns` is the existing `/pulls/:id/runs` query, so this adds no new fetch.

`RunHistory.tsx`:
- Import `RunCostBadge` from `@/components/run-cost-badge`.
- In the right-hand column `<div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", … }}>`, add before the time:

```tsx
              {settled && <RunCostBadge variant="compact" costUsd={r.cost_usd} />}
```

- [x] **Step 4: Run to verify pass**

Run: `cd client && pnpm typecheck && pnpm test`. Expected: PASS. The existing `VerdictBanner` smoke test and the `RunHistory` outcome tests keep passing: the new props are optional, and the new `--` doesn't collide with their assertions.

- [x] **Step 5: Commit**

```bash
git add client/src
git commit -m "feat(client): show run cost in the PR list, verdict banner and run timeline"
```

---

### Task 5: Severity pills + click-to-filter in the expanded run card (client)

Paths below use `…/[number]` for `client/src/app/repos/[repoId]/pulls/[number]`.

**Files:**
- Create: `client/src/lib/severity.ts`, `client/src/lib/severity.test.ts`
- Create: `…/[number]/_components/SeverityPills/{SeverityPills.tsx,styles.ts,index.ts,SeverityPills.test.tsx}`
- Create: `…/[number]/_components/SeverityFilter/{SeverityFilter.tsx,styles.ts,index.ts,SeverityFilter.test.tsx}`
- Modify: `…/[number]/_components/VerdictBanner/{VerdictBanner.tsx,styles.ts,VerdictBanner.test.tsx}`
- Modify: `…/[number]/_components/FindingsPanel/{FindingsPanel.tsx,helpers.ts,FindingsPanel.test.tsx}`
- Modify: `…/[number]/_components/ReviewRunAccordion/{ReviewRunAccordion.tsx,ReviewRunAccordion.test.tsx}`
- Modify: `client/messages/en/prReview.json`

**Interfaces:**
- Consumes: `Severity` (`'CRITICAL' | 'WARNING' | 'SUGGESTION'`) and `FindingRecord` from `@devdigest/shared`; `SEV` (colour, bg, icon per severity) and `Icon` from `@devdigest/ui`.
- Produces (Task 7 relies on the first two):
  - `client/src/lib/severity.ts`:
    - `SEVERITIES: readonly Severity[]`, ordered `["CRITICAL","WARNING","SUGGESTION"]`.
    - `type SeverityCounts = Record<Severity, number>`.
    - `countBySeverity(items: readonly { severity: string }[]): SeverityCounts`. Unknown severities are ignored.
    - `filterBySeverity<T extends { severity: string }>(items: readonly T[], severity: Severity | null): T[]`.
    - `toggleSeverity(current: Severity | null, clicked: Severity): Severity | null`.
  - `<SeverityPills counts={SeverityCounts} active?={Severity|null} onToggle?={(s: Severity) => void} />`. Renders `null` when every count is 0.
  - `<SeverityFilter active={Severity|null} onToggle={(s: Severity) => void} />`
  - `VerdictBanner` gets optional props `severityCounts?: SeverityCounts; activeSeverity?: Severity | null; onSeverityToggle?: (s: Severity) => void`.
  - `FindingsPanel` gets optional props `severity?: Severity | null; onSeverityChange?: (s: Severity | null) => void`. Without them it manages its own filter state.
  - `visibleFindings(findings, hideLow, severity: Severity | null = null)`.
  - i18n under `prReview.severity`: `pillsLabel`, `pill.{CRITICAL,WARNING,SUGGESTION}`, `filterLabel`, `filter.{CRITICAL,WARNING,SUGGESTION}`.

- [x] **Step 1: Write the failing tests**

`client/src/lib/severity.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { SEVERITIES, countBySeverity, filterBySeverity, toggleSeverity } from "./severity";

const f = (severity: string, id: string = severity) => ({ id, severity });

describe("countBySeverity", () => {
  it("groups by severity and reports 0 for absent levels", () => {
    expect(countBySeverity([f("CRITICAL", "a"), f("CRITICAL", "b"), f("SUGGESTION")])).toEqual({
      CRITICAL: 2,
      WARNING: 0,
      SUGGESTION: 1,
    });
  });
  it("ignores unknown severities (free-text DB column) instead of adding a bucket", () => {
    expect(countBySeverity([f("INFO"), f("toString"), f("critical")])).toEqual({
      CRITICAL: 0,
      WARNING: 0,
      SUGGESTION: 0,
    });
  });
});

describe("filterBySeverity", () => {
  const items = [f("CRITICAL", "c"), f("WARNING", "w1"), f("WARNING", "w2")];
  it("null keeps everything, as a new array", () => {
    const out = filterBySeverity(items, null);
    expect(out).toEqual(items);
    expect(out).not.toBe(items);
  });
  it("a severity keeps only that level", () => {
    expect(filterBySeverity(items, "WARNING").map((x) => x.id)).toEqual(["w1", "w2"]);
    expect(filterBySeverity(items, "SUGGESTION")).toEqual([]);
  });
});

describe("toggleSeverity", () => {
  it("selects, switches, and clears on a second click on the same level", () => {
    expect(toggleSeverity(null, "WARNING")).toBe("WARNING");
    expect(toggleSeverity("WARNING", "CRITICAL")).toBe("CRITICAL");
    expect(toggleSeverity("WARNING", "WARNING")).toBeNull();
  });
});

it("SEVERITIES is ordered most severe first", () => {
  expect(SEVERITIES).toEqual(["CRITICAL", "WARNING", "SUGGESTION"]);
});
```

`…/[number]/_components/SeverityPills/SeverityPills.test.tsx`:

```tsx
import { describe, it, expect, afterEach, vi } from "vitest";
import { render, screen, cleanup, fireEvent } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import messages from "../../../../../../../../messages/en/prReview.json";
import { SeverityPills } from "./SeverityPills";

afterEach(cleanup);

function renderWithIntl(ui: React.ReactElement) {
  return render(
    <NextIntlClientProvider locale="en" messages={{ prReview: messages }}>
      {ui}
    </NextIntlClientProvider>,
  );
}

describe("SeverityPills", () => {
  it("shows only the severities that are present, most severe first", () => {
    renderWithIntl(<SeverityPills counts={{ CRITICAL: 2, WARNING: 0, SUGGESTION: 3 }} />);
    const group = screen.getByRole("group", { name: "Findings by severity" });
    expect(group).toBeInTheDocument();
    expect(screen.getAllByRole("button").map((b) => b.textContent)).toEqual(["2 CRITICAL", "3 SUGGESTION"]);
    expect(screen.queryByText(/WARNING/)).not.toBeInTheDocument();
    expect(screen.getAllByText("·")).toHaveLength(1);
  });

  it("renders nothing when the run has no findings", () => {
    renderWithIntl(<SeverityPills counts={{ CRITICAL: 0, WARNING: 0, SUGGESTION: 0 }} />);
    expect(screen.queryByRole("group")).not.toBeInTheDocument();
  });

  it("reports the clicked severity and marks the active pill as pressed", () => {
    const onToggle = vi.fn();
    renderWithIntl(
      <SeverityPills counts={{ CRITICAL: 1, WARNING: 2, SUGGESTION: 0 }} active="WARNING" onToggle={onToggle} />,
    );
    expect(screen.getByRole("button", { name: "2 WARNING" })).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByRole("button", { name: "1 CRITICAL" })).toHaveAttribute("aria-pressed", "false");
    fireEvent.click(screen.getByRole("button", { name: "1 CRITICAL" }));
    expect(onToggle).toHaveBeenCalledWith("CRITICAL");
  });
});
```

`…/[number]/_components/SeverityFilter/SeverityFilter.test.tsx`:

```tsx
import { describe, it, expect, afterEach, vi } from "vitest";
import { render, screen, cleanup, fireEvent } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import messages from "../../../../../../../../messages/en/prReview.json";
import { SeverityFilter } from "./SeverityFilter";

afterEach(cleanup);

function renderWithIntl(ui: React.ReactElement) {
  return render(
    <NextIntlClientProvider locale="en" messages={{ prReview: messages }}>
      {ui}
    </NextIntlClientProvider>,
  );
}

describe("SeverityFilter", () => {
  it("always offers Critical, Warning and Suggestion, in that order", () => {
    renderWithIntl(<SeverityFilter active={null} onToggle={() => {}} />);
    const group = screen.getByRole("group", { name: "Filter findings by severity" });
    expect(group).toBeInTheDocument();
    expect(screen.getAllByRole("button").map((b) => b.textContent)).toEqual(["Critical", "Warning", "Suggestion"]);
    for (const b of screen.getAllByRole("button")) expect(b).toHaveAttribute("aria-pressed", "false");
  });

  it("reports clicks and marks the active level", () => {
    const onToggle = vi.fn();
    renderWithIntl(<SeverityFilter active="SUGGESTION" onToggle={onToggle} />);
    expect(screen.getByRole("button", { name: "Suggestion" })).toHaveAttribute("aria-pressed", "true");
    fireEvent.click(screen.getByRole("button", { name: "Critical" }));
    expect(onToggle).toHaveBeenCalledWith("CRITICAL");
  });
});
```

Append to the `describe` in `VerdictBanner.test.tsx` (add `fireEvent` and `vi` to the imports):

```tsx
  it("shows the N CRITICAL · N WARNING · N SUGGESTION pill row under the verdict and score", () => {
    renderWithIntl(
      <VerdictBanner verdict="request_changes" summary="s" score={61} findingsCount={6} blockers={2}
        severityCounts={{ CRITICAL: 2, WARNING: 3, SUGGESTION: 1 }} />,
    );
    expect(screen.getByRole("group", { name: "Findings by severity" })).toBeInTheDocument();
    for (const name of ["2 CRITICAL", "3 WARNING", "1 SUGGESTION"]) {
      expect(screen.getByRole("button", { name })).toBeInTheDocument();
    }
  });

  it("has no pill row without counts, or when every count is 0", () => {
    renderWithIntl(
      <VerdictBanner verdict="approve" summary="s" score={95} findingsCount={0} blockers={0}
        severityCounts={{ CRITICAL: 0, WARNING: 0, SUGGESTION: 0 }} />,
    );
    expect(screen.queryByRole("group", { name: "Findings by severity" })).not.toBeInTheDocument();
  });

  it("clicking a pill calls onSeverityToggle with that level", () => {
    const onSeverityToggle = vi.fn();
    renderWithIntl(
      <VerdictBanner verdict="comment" summary="s" score={70} findingsCount={1} blockers={0}
        severityCounts={{ CRITICAL: 0, WARNING: 1, SUGGESTION: 0 }} onSeverityToggle={onSeverityToggle} />,
    );
    fireEvent.click(screen.getByRole("button", { name: "1 WARNING" }));
    expect(onSeverityToggle).toHaveBeenCalledWith("WARNING");
  });
```

`FindingsPanel.test.tsx` changes:
- Make the action mock observable. Replace the `vi.mock(...)` block with:

```tsx
const { mutate } = vi.hoisted(() => ({ mutate: vi.fn() }));
vi.mock("../../../../../../../lib/hooks/reviews", () => ({
  useFindingAction: () => ({ mutate, isPending: false }),
}));
```

- Add `fireEvent` to the `@testing-library/react` import and `Severity` to the `@devdigest/shared` type import.
- Append:

```tsx
const mk = (id: string, severity: Severity, title: string): FindingRecord => ({ ...FINDINGS[0]!, id, severity, title });
const MIXED = [
  mk("c1", "CRITICAL", "Crit A"),
  mk("w1", "WARNING", "Warn A"),
  mk("w2", "WARNING", "Warn B"),
  mk("s1", "SUGGESTION", "Sugg A"),
];

describe("FindingsPanel — severity filter", () => {
  it("a filter button keeps only that level; a second click restores the full list", () => {
    renderWithIntl(<FindingsPanel findings={MIXED} prId="pr1" />);
    fireEvent.click(screen.getByRole("button", { name: "Warning" }));
    expect(screen.queryByText("Crit A")).not.toBeInTheDocument();
    expect(screen.getByText("Warn A")).toBeInTheDocument();
    expect(screen.getByText("Warn B")).toBeInTheDocument();
    expect(screen.queryByText("Sugg A")).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Warning" }));
    for (const title of ["Crit A", "Warn A", "Warn B", "Sugg A"]) {
      expect(screen.getByText(title)).toBeInTheDocument();
    }
  });

  it("controlled: renders the given level and reports the toggled value", () => {
    const onSeverityChange = vi.fn();
    renderWithIntl(
      <FindingsPanel findings={MIXED} prId="pr1" severity="CRITICAL" onSeverityChange={onSeverityChange} />,
    );
    expect(screen.getByText("Crit A")).toBeInTheDocument();
    expect(screen.queryByText("Warn A")).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Critical" }));
    expect(onSeverityChange).toHaveBeenCalledWith(null);
  });

  it("keyboard accept after filtering acts on the first VISIBLE card, never a hidden one", () => {
    mutate.mockClear();
    renderWithIntl(<FindingsPanel findings={MIXED} prId="pr1" />);
    fireEvent.keyDown(window, { key: "j" }); // focus moves to the 2nd card (Warn A) in the full list
    fireEvent.click(screen.getByRole("button", { name: "Suggestion" }));
    fireEvent.keyDown(window, { key: "a" });
    expect(mutate).toHaveBeenCalledWith({ findingId: "s1", action: "accept", prId: "pr1" });
  });
});
```

`ReviewRunAccordion.test.tsx` changes:
- Add `FindingRecord` to the `@devdigest/shared` type import.
- Append:

```tsx
const F = (id: string, severity: FindingRecord["severity"], title: string): FindingRecord => ({
  id, severity, title, category: "bug", file: "src/a.ts", start_line: 1, end_line: 1,
  rationale: "r", suggestion: null, confidence: 0.9, kind: "finding",
  trifecta_components: null, evidence: null, review_id: "rv1", accepted_at: null, dismissed_at: null,
});

function renderReview(review: ReviewRecord) {
  return render(
    <NextIntlClientProvider locale="en" messages={{ prReview: messages }}>
      <ReviewRunAccordion review={review} prId="pr1" run={RUN(0.0013)} defaultOpen />
    </NextIntlClientProvider>,
  );
}

describe("ReviewRunAccordion — severity breakdown", () => {
  const review: ReviewRecord = {
    ...REVIEW,
    findings: [F("c1", "CRITICAL", "Crit A"), F("c2", "CRITICAL", "Crit B"), F("w1", "WARNING", "Warn A")],
  };

  it("each pill's number equals the finding cards of that severity rendered below", () => {
    const { container } = renderReview(review);
    expect(screen.getByRole("button", { name: "2 CRITICAL" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "1 WARNING" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /SUGGESTION$/ })).not.toBeInTheDocument();
    expect(container.querySelectorAll("[data-finding-id]")).toHaveLength(3);
  });

  it("clicking a pill filters the cards and presses the matching filter button; a second click clears", () => {
    const { container } = renderReview(review);
    fireEvent.click(screen.getByRole("button", { name: "1 WARNING" }));
    expect(container.querySelectorAll("[data-finding-id]")).toHaveLength(1);
    expect(screen.getByText("Warn A")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Warning" })).toHaveAttribute("aria-pressed", "true");

    fireEvent.click(screen.getByRole("button", { name: "1 WARNING" }));
    expect(container.querySelectorAll("[data-finding-id]")).toHaveLength(3);
  });

  it("the Critical filter button drives the same state as the pills", () => {
    const { container } = renderReview(review);
    fireEvent.click(screen.getByRole("button", { name: "Critical" }));
    expect(container.querySelectorAll("[data-finding-id]")).toHaveLength(2);
    expect(screen.getByRole("button", { name: "2 CRITICAL" })).toHaveAttribute("aria-pressed", "true");
  });
});
```

- [x] **Step 2: Run to verify failure**

Run: `cd client && pnpm exec vitest run src/lib/severity.test.ts "src/app/repos/[repoId]/pulls/[number]"`
Expected: FAIL. `./severity`, `./SeverityPills` and `./SeverityFilter` are not found, and the new VerdictBanner, FindingsPanel and ReviewRunAccordion cases fail. If vitest reports "No test files found" for `src/lib/severity.test.ts`, check `include` in `client/vitest.config.*`. Don't move the file.

- [x] **Step 3: Implement**

`client/messages/en/prReview.json`: add a top-level block next to `verdict`:

```json
  "severity": {
    "pillsLabel": "Findings by severity",
    "pill": {
      "CRITICAL": "{count} CRITICAL",
      "WARNING": "{count} WARNING",
      "SUGGESTION": "{count} SUGGESTION"
    },
    "filterLabel": "Filter findings by severity",
    "filter": {
      "CRITICAL": "Critical",
      "WARNING": "Warning",
      "SUGGESTION": "Suggestion"
    }
  },
```

`client/src/lib/severity.ts`:

```ts
import type { Severity } from "@devdigest/shared";

/** Finding severity helpers shared by the PR page (pills + filter) and the PR
 *  list (FINDINGS column). Pure grouping of findings already loaded: no fetch,
 *  no LLM call. */

/** Most severe first: the display order for pills, filters and icon counts. */
export const SEVERITIES: readonly Severity[] = ["CRITICAL", "WARNING", "SUGGESTION"];

export type SeverityCounts = Record<Severity, number>;

function isSeverity(s: string): s is Severity {
  return (SEVERITIES as readonly string[]).includes(s);
}

/** Count per severity. Unknown strings (the DB column is free text) are ignored. */
export function countBySeverity(items: readonly { severity: string }[]): SeverityCounts {
  const counts: SeverityCounts = { CRITICAL: 0, WARNING: 0, SUGGESTION: 0 };
  for (const item of items) if (isSeverity(item.severity)) counts[item.severity] += 1;
  return counts;
}

/** Keep only one severity; `null` keeps everything (always a new array). */
export function filterBySeverity<T extends { severity: string }>(
  items: readonly T[],
  severity: Severity | null,
): T[] {
  return severity == null ? [...items] : items.filter((i) => i.severity === severity);
}

/** Click on a severity: select it, switch to it, or clear when it is already active. */
export function toggleSeverity(current: Severity | null, clicked: Severity): Severity | null {
  return current === clicked ? null : clicked;
}
```

`SeverityPills/styles.ts`:

```ts
import type { CSSProperties } from "react";
import { SEV } from "@devdigest/ui";
import type { Severity } from "@devdigest/shared";

/** Co-located styles for SeverityPills. */
export const s = {
  row: { display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" } satisfies CSSProperties,
  sep: { color: "var(--text-muted)", fontSize: 12 } satisfies CSSProperties,
  pill: (sev: Severity, pressed: boolean, dimmed: boolean): CSSProperties => ({
    display: "inline-flex",
    alignItems: "center",
    gap: 6,
    padding: "3px 9px",
    borderRadius: 5,
    fontSize: 12,
    fontWeight: 600,
    letterSpacing: "0.04em",
    color: SEV[sev].c,
    background: SEV[sev].bg,
    border: `1px solid ${pressed ? SEV[sev].c : "transparent"}`,
    opacity: dimmed ? 0.5 : 1,
    cursor: "pointer",
  }),
} as const;
```

`SeverityPills/SeverityPills.tsx`:

```tsx
/* SeverityPills — "N CRITICAL · N WARNING · N SUGGESTION" for one run, shown
   under the verdict and PR score. Only the levels present are shown. Each pill
   toggles the run card's severity filter. */
"use client";

import React from "react";
import { useTranslations } from "next-intl";
import { Icon, SEV } from "@devdigest/ui";
import type { Severity } from "@devdigest/shared";
import { SEVERITIES, type SeverityCounts } from "@/lib/severity";
import { s } from "./styles";

export function SeverityPills({
  counts,
  active = null,
  onToggle,
}: {
  counts: SeverityCounts;
  active?: Severity | null;
  onToggle?: (severity: Severity) => void;
}) {
  const t = useTranslations("prReview");
  const present = SEVERITIES.filter((sev) => counts[sev] > 0);
  if (present.length === 0) return null;
  return (
    <div role="group" aria-label={t("severity.pillsLabel")} style={s.row}>
      {present.map((sev, i) => {
        const I = Icon[SEV[sev].icon];
        const pressed = active === sev;
        return (
          <React.Fragment key={sev}>
            {i > 0 && (
              <span aria-hidden="true" style={s.sep}>
                ·
              </span>
            )}
            <button
              type="button"
              aria-pressed={pressed}
              onClick={() => onToggle?.(sev)}
              style={s.pill(sev, pressed, active != null && !pressed)}
            >
              <I size={12} />
              {t(`severity.pill.${sev}`, { count: counts[sev] })}
            </button>
          </React.Fragment>
        );
      })}
    </div>
  );
}

export default SeverityPills;
```

`SeverityPills/index.ts`:

```ts
export { SeverityPills, default } from "./SeverityPills";
```

`SeverityFilter/styles.ts`:

```ts
import type { CSSProperties } from "react";
import { SEV } from "@devdigest/ui";
import type { Severity } from "@devdigest/shared";

/** Co-located styles for SeverityFilter. */
export const s = {
  group: { display: "flex", alignItems: "center", gap: 6 } satisfies CSSProperties,
  btn: (sev: Severity, pressed: boolean): CSSProperties => ({
    display: "inline-flex",
    alignItems: "center",
    gap: 5,
    padding: "4px 10px",
    borderRadius: 6,
    fontSize: 12.5,
    fontWeight: 500,
    cursor: "pointer",
    color: pressed ? SEV[sev].c : "var(--text-secondary)",
    background: pressed ? SEV[sev].bg : "transparent",
    border: `1px solid ${pressed ? SEV[sev].c : "var(--border)"}`,
  }),
} as const;
```

`SeverityFilter/SeverityFilter.tsx`:

```tsx
/* SeverityFilter — the Critical / Warning / Suggestion buttons above a run's
   finding cards. All three are always shown; clicking the active one clears. */
"use client";

import React from "react";
import { useTranslations } from "next-intl";
import { Icon, SEV } from "@devdigest/ui";
import type { Severity } from "@devdigest/shared";
import { SEVERITIES } from "@/lib/severity";
import { s } from "./styles";

export function SeverityFilter({
  active,
  onToggle,
}: {
  active: Severity | null;
  onToggle: (severity: Severity) => void;
}) {
  const t = useTranslations("prReview");
  return (
    <div role="group" aria-label={t("severity.filterLabel")} style={s.group}>
      {SEVERITIES.map((sev) => {
        const I = Icon[SEV[sev].icon];
        const pressed = active === sev;
        return (
          <button key={sev} type="button" aria-pressed={pressed} onClick={() => onToggle(sev)} style={s.btn(sev, pressed)}>
            <I size={12} />
            {t(`severity.filter.${sev}`)}
          </button>
        );
      })}
    </div>
  );
}

export default SeverityFilter;
```

`SeverityFilter/index.ts`:

```ts
export { SeverityFilter, default } from "./SeverityFilter";
```

`VerdictBanner/styles.ts`: change `wrap` to a column and move the old row layout into `top`. Then add `pillsRow`:

```ts
  wrap: {
    display: "flex",
    flexDirection: "column",
    gap: 14,
    padding: 18,
    borderRadius: 10,
    border: "1px solid var(--border)",
    background: "var(--bg-elevated)",
  } satisfies CSSProperties,
  top: { display: "flex", gap: 18, alignItems: "flex-start" } satisfies CSSProperties,
  pillsRow: { paddingTop: 12, borderTop: "1px solid var(--border)" } satisfies CSSProperties,
```

`VerdictBanner.tsx` changes:
- Imports: add `type Severity` to the `@devdigest/shared` import, plus `import { SEVERITIES, type SeverityCounts } from "@/lib/severity";` and `import { SeverityPills } from "../SeverityPills";`.
- Update the header comment to `+ summary + finding/blocker counts + score + severity pills.`
- Add the props `severityCounts?: SeverityCounts; activeSeverity?: Severity | null; onSeverityToggle?: (severity: Severity) => void;` to the destructuring and its type.
- Wrap the existing three children (`iconBox`, `main`, the score column) in `<div style={s.top}>…</div>`, then add the pill row as the last child of `s.wrap`:

```tsx
      {severityCounts && SEVERITIES.some((sev) => severityCounts[sev] > 0) && (
        <div style={s.pillsRow}>
          <SeverityPills counts={severityCounts} active={activeSeverity ?? null} onToggle={onSeverityToggle} />
        </div>
      )}
```

`FindingsPanel/helpers.ts`:

```ts
import type { FindingRecord, Severity } from "@devdigest/shared";
import { filterBySeverity } from "@/lib/severity";
import { LOW_CONFIDENCE_THRESHOLD, SEVERITY_ORDER } from "./constants";

/** Optionally keep one severity, drop low-confidence findings, and sort by severity. */
export function visibleFindings(
  findings: FindingRecord[],
  hideLow: boolean,
  severity: Severity | null = null,
): FindingRecord[] {
  let shown = filterBySeverity(findings, severity);
  if (hideLow) shown = shown.filter((f) => f.confidence >= LOW_CONFIDENCE_THRESHOLD);
  return shown.sort(
    (a, b) => (SEVERITY_ORDER[a.severity] ?? 9) - (SEVERITY_ORDER[b.severity] ?? 9),
  );
}
```

(`filterBySeverity` always returns a new array, so sorting it in place never mutates the prop.)

`FindingsPanel.tsx` changes:
- Update the header comment to `severity filter + hide-low-confidence + j/k navigation + FindingCard list`.
- Imports: add `Severity` to the `@devdigest/shared` type import, plus `import { toggleSeverity } from "@/lib/severity";` and `import { SeverityFilter } from "../SeverityFilter";`.
- Add the props `severity?: Severity | null; onSeverityChange?: (severity: Severity | null) => void;` to the destructuring and its type.
- After the `hideLow` state:

```tsx
  // Controlled by the run card (shared with the verdict pills) when it passes
  // `onSeverityChange`; otherwise the panel keeps its own filter.
  const [ownSeverity, setOwnSeverity] = React.useState<Severity | null>(null);
  const activeSeverity = onSeverityChange ? (severity ?? null) : ownSeverity;
  const setSeverity = onSeverityChange ?? setOwnSeverity;
```

- Change the `shown` memo to `visibleFindings(findings, hideLow, activeSeverity)` with deps `[findings, hideLow, activeSeverity]`.
- Below the memo, reset keyboard focus whenever the visible set changes because of a filter. Otherwise `a`/`d` could act on a card that is no longer visible:

```tsx
  React.useEffect(() => setFocusIdx(0), [activeSeverity, hideLow]);
```

- As the first child of `<div style={s.toolbar}>` (the toggle group keeps `marginLeft: "auto"`, so the filter sits on the left):

```tsx
        <SeverityFilter
          active={activeSeverity}
          onToggle={(sev) => setSeverity(toggleSeverity(activeSeverity, sev))}
        />
```

`ReviewRunAccordion.tsx` changes:
- Imports: add `Severity` to the `@devdigest/shared` type import, and add `import { countBySeverity, toggleSeverity } from "@/lib/severity";`.
- After `const findings = review.findings;`:

```tsx
  // One severity filter per run card, shared by the verdict pills and the
  // FindingsPanel filter buttons. Counts group the findings already loaded (no fetch).
  const [severity, setSeverity] = React.useState<Severity | null>(null);
  const severityCounts = React.useMemo(() => countBySeverity(findings), [findings]);
```

- Pass to `<VerdictBanner …>`:

```tsx
                severityCounts={severityCounts}
                activeSeverity={severity}
                onSeverityToggle={(sev) => setSeverity((cur) => toggleSeverity(cur, sev))}
```

- Pass to `<FindingsPanel …>`: `severity={severity}` and `onSeverityChange={setSeverity}`.

- [x] **Step 4: Run to verify pass**

Run: `cd client && pnpm typecheck && pnpm test`
Expected: PASS. The existing VerdictBanner smoke test (`1 findings · 1 blockers`) and the ReviewRunAccordion cost tests still pass. The filter buttons' names (`Critical`/`Warning`/`Suggestion`) don't clash with the pill names (`N CRITICAL` …).

- [x] **Step 5: Commit**

```bash
git add client/src/lib/severity.ts client/src/lib/severity.test.ts client/messages/en/prReview.json \
  "client/src/app/repos/[repoId]/pulls/[number]/_components"
git commit -m "feat(client): severity pills with click-to-filter in the expanded review run card"
```

---

### Task 6: Latest-review findings preview on the PR list (server)

**Files:**
- Create: `server/src/modules/pulls/findings-preview.ts`
- Modify: `server/src/modules/pulls/routes.ts:115-131` (latest-review block, and the comment at l.117-118), `:144-168` (returned object)
- Modify (identical edit in both): `server/src/vendor/shared/contracts/platform.ts`, `client/src/vendor/shared/contracts/platform.ts`
- Test: `server/test/pulls-findings-preview.test.ts` (hermetic), `server/test/contracts.test.ts`, `server/test/reviews.it.test.ts`

**Interfaces:**
- Consumes: `t.reviews` (`id`, `prId`, `score`, `kind`, `createdAt`) and `t.findings` (`reviewId`, `severity`, `category`, `title`, `file`, `startLine`, `endLine`, `confidence`, `rationale`) from `server/src/db/schema/reviews.ts`.
- Produces:
  - Contract: `PrFindingPreview = Finding.pick({ id, severity, category, title, file, start_line, end_line, confidence }).extend({ summary: z.string() })`.
  - `PrMeta.findings?: PrFindingPreview[] | null`. It is nullish: null means never reviewed, `[]` means reviewed with nothing kept.
  - `export interface FindingPreviewRow { id: string; reviewId: string; severity: string; category: string; title: string; file: string; startLine: number; endLine: number; confidence: number; rationale: string }`
  - `export const SUMMARY_MAX = 140;`, `export function shortSummary(markdown: string): string`
  - `export function latestFindingsByPr(latestReviewIdByPr: Map<string, string>, rows: FindingPreviewRow[]): Map<string, PrFindingPreview[]>`. It returns one entry per PR in the input map, sorted most severe first, then by confidence (highest first).

- [x] **Step 1: Write the failing tests**

`server/test/pulls-findings-preview.test.ts`:

```ts
/**
 * PR-list FINDINGS column (`modules/pulls/findings-preview.ts`): the preview of
 * the latest review's findings, which is the same review the score ring uses.
 * The client counts per severity and renders the hover popover from this.
 */
import { describe, it, expect } from 'vitest';
import {
  latestFindingsByPr,
  shortSummary,
  SUMMARY_MAX,
  type FindingPreviewRow,
} from '../src/modules/pulls/findings-preview.js';

const row = (o: Partial<FindingPreviewRow> & { id: string; reviewId: string }): FindingPreviewRow => ({
  severity: 'WARNING',
  category: 'bug',
  title: 't',
  file: 'src/a.ts',
  startLine: 1,
  endLine: 1,
  confidence: 0.8,
  rationale: 'r',
  ...o,
});

describe('latestFindingsByPr', () => {
  it("keeps only the latest review's findings, most severe first, then by confidence", () => {
    const m = latestFindingsByPr(new Map([['pr1', 'rvNew']]), [
      row({ id: 'old', reviewId: 'rvOld', severity: 'CRITICAL' }),
      row({ id: 's', reviewId: 'rvNew', severity: 'SUGGESTION', confidence: 0.99 }),
      row({ id: 'w-lo', reviewId: 'rvNew', severity: 'WARNING', confidence: 0.6 }),
      row({ id: 'c', reviewId: 'rvNew', severity: 'CRITICAL' }),
      row({ id: 'w-hi', reviewId: 'rvNew', severity: 'WARNING', confidence: 0.9 }),
    ]);
    expect(m.get('pr1')!.map((f) => f.id)).toEqual(['c', 'w-hi', 'w-lo', 's']);
  });

  it('maps DB columns to the wire shape, rationale → plain summary', () => {
    const m = latestFindingsByPr(new Map([['pr1', 'rv']]), [
      row({ id: 'f1', reviewId: 'rv', severity: 'CRITICAL', category: 'security', title: 'Secret',
        file: 'src/cfg.ts', startLine: 10, endLine: 12, confidence: 0.91, rationale: '**Key** is committed.' }),
    ]);
    expect(m.get('pr1')).toEqual([
      { id: 'f1', severity: 'CRITICAL', category: 'security', title: 'Secret', file: 'src/cfg.ts',
        start_line: 10, end_line: 12, confidence: 0.91, summary: 'Key is committed.' },
    ]);
  });

  it('a reviewed PR whose latest review kept nothing gets [] (not null)', () => {
    expect(latestFindingsByPr(new Map([['pr1', 'rv']]), []).get('pr1')).toEqual([]);
  });

  it('PRs without a review are absent (the route renders null)', () => {
    expect(latestFindingsByPr(new Map(), [row({ id: 'f', reviewId: 'rv' })]).size).toBe(0);
  });
});

describe('shortSummary', () => {
  it('strips markdown markers and collapses whitespace', () => {
    expect(shortSummary('**Bold** `code`\n\n# h')).toBe('Bold code h');
  });
  it('drops fenced code blocks', () => {
    expect(shortSummary('Use this:\n```ts\nconst x = 1;\n```\ninstead')).toBe('Use this: instead');
  });
  it(`cuts to ${SUMMARY_MAX} chars ending in an ellipsis`, () => {
    const s = shortSummary('a'.repeat(500));
    expect(s).toHaveLength(SUMMARY_MAX);
    expect(s.endsWith('…')).toBe(true);
  });
});
```

`server/test/contracts.test.ts`: add `PrMeta` to the `@devdigest/shared` import and append:

```ts
describe('PrMeta findings', () => {
  const base = {
    number: 1, title: 't', author: 'a', branch: 'b', base: 'main', head_sha: 'x',
    additions: 0, deletions: 0, files_count: 0, status: 'reviewed',
  };
  it('accepts absent, null and a preview array', () => {
    expect(PrMeta.parse(base).findings).toBeUndefined();
    expect(PrMeta.parse({ ...base, findings: null }).findings).toBeNull();
    const f = { id: 'f1', severity: 'CRITICAL', category: 'security', title: 'x', file: 'a.ts',
      start_line: 1, end_line: 2, confidence: 0.9, summary: 's' };
    expect(PrMeta.parse({ ...base, findings: [f] }).findings).toEqual([f]);
  });
});
```

`server/test/reviews.it.test.ts`: in the first test, after the existing `expect(row.score).toBe(65);` add:

```ts
    // FINDINGS column: the latest review's kept findings ('1/2 passed' ⇒ one kept)
    expect(row.findings).toHaveLength(1);
    expect(row.findings[0]).toMatchObject({
      severity: expect.stringMatching(/^(CRITICAL|WARNING|SUGGESTION)$/),
      summary: expect.any(String),
    });
    expect(row.findings[0]).not.toHaveProperty('suggestion');
```

In the failed-run test, after the existing `cost_usd` list assertion add:

```ts
    expect(list.find((p: { id: string }) => p.id === pr.id).findings).toBeNull(); // never reviewed
```

- [x] **Step 2: Run to verify failure**

Run: `cd server && pnpm exec vitest run test/pulls-findings-preview.test.ts test/contracts.test.ts`
Expected: FAIL. The module is not found, and zod strips `findings`, so `toBeNull`/`toEqual` fail.

- [x] **Step 3: Implement**

`PrFindingPreview` + `PrMeta.findings`, an **identical edit in both** `platform.ts` copies:
- Add `import { Finding } from './findings.js';` after the existing `Provider` import.
- Above `export const PrMeta`:

```ts
/** One finding as previewed in the PR list's hover popover: read-only, trimmed
 *  (no suggestion; rationale cut to a short plain-text `summary`). */
export const PrFindingPreview = Finding.pick({
  id: true,
  severity: true,
  category: true,
  title: true,
  file: true,
  start_line: true,
  end_line: true,
  confidence: true,
}).extend({ summary: z.string() });
export type PrFindingPreview = z.infer<typeof PrFindingPreview>;
```

- In `PrMeta`, replace the stale `cost_usd` comment and add `findings` after it:

```ts
  // Total cost (USD) of the PR's completed runs (list endpoint only; null/absent = no data).
  cost_usd: z.number().nullish(),
  // Latest review's findings (list endpoint only): null/absent = never reviewed, [] = nothing kept.
  findings: z.array(PrFindingPreview).nullish(),
```

`server/src/modules/pulls/findings-preview.ts`:

```ts
import type { PrFindingPreview } from '@devdigest/shared';

/**
 * FINDINGS column on the PR list: a read-only preview of the findings of the
 * PR's latest review, the same review the score ring is taken from. Pure so it
 * is unit-testable without a DB. The client counts per severity from this, so
 * there is no extra fetch on hover and no LLM call.
 */
export interface FindingPreviewRow {
  id: string;
  reviewId: string;
  severity: string;
  category: string;
  title: string;
  file: string;
  startLine: number;
  endLine: number;
  confidence: number;
  rationale: string;
}

/** Max length of a preview's plain-text summary, ellipsis included. */
export const SUMMARY_MAX = 140;

const SEVERITY_ORDER: Record<string, number> = { CRITICAL: 0, WARNING: 1, SUGGESTION: 2 };

/** Markdown rationale → one short plain-text line (code fences and markers dropped). */
export function shortSummary(markdown: string): string {
  const plain = markdown
    .replace(/```[\s\S]*?```/g, ' ')
    .replace(/[`*_#>]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
  return plain.length > SUMMARY_MAX ? `${plain.slice(0, SUMMARY_MAX - 1).trimEnd()}…` : plain;
}

export function latestFindingsByPr(
  latestReviewIdByPr: Map<string, string>,
  rows: FindingPreviewRow[],
): Map<string, PrFindingPreview[]> {
  const byReview = new Map<string, FindingPreviewRow[]>();
  for (const r of rows) {
    const list = byReview.get(r.reviewId);
    if (list) list.push(r);
    else byReview.set(r.reviewId, [r]);
  }
  const out = new Map<string, PrFindingPreview[]>();
  for (const [prId, reviewId] of latestReviewIdByPr) {
    const sorted = [...(byReview.get(reviewId) ?? [])].sort(
      (a, b) =>
        (SEVERITY_ORDER[a.severity] ?? 9) - (SEVERITY_ORDER[b.severity] ?? 9) ||
        b.confidence - a.confidence,
    );
    out.set(
      prId,
      sorted.map((r) => ({
        id: r.id,
        severity: r.severity as PrFindingPreview['severity'],
        category: r.category as PrFindingPreview['category'],
        title: r.title,
        file: r.file,
        start_line: r.startLine,
        end_line: r.endLine,
        confidence: r.confidence,
        summary: shortSummary(r.rationale),
      })),
    );
  }
  return out;
}
```

`routes.ts` changes:
- Add `import { latestFindingsByPr } from './findings-preview.js';`.
- Replace the latest-review block (from the `// Latest-review SCORE per PR…` comment through the end of its `if (prIds.length > 0) { … }`) with:

```ts
    // Latest review per PR → the list's SCORE ring and FINDINGS column. Computed
    // on read from reviews (no FK denorm); the list is small, so IN-queries + JS
    // grouping are cheap.
    const prIds = rows.map((r) => r.id);
    const latestReviewByPr = new Map<string, { id: string; score: number | null }>();
    if (prIds.length > 0) {
      const reviewRows = await container.db
        .select({ id: t.reviews.id, prId: t.reviews.prId, score: t.reviews.score })
        .from(t.reviews)
        .where(and(inArray(t.reviews.prId, prIds), eq(t.reviews.kind, 'review')))
        .orderBy(desc(t.reviews.createdAt));
      // Rows are newest-first → first seen per PR is the latest review.
      for (const rv of reviewRows) {
        if (!latestReviewByPr.has(rv.prId)) latestReviewByPr.set(rv.prId, { id: rv.id, score: rv.score });
      }
    }

    // FINDINGS = that same latest review's findings (see findings-preview.ts).
    const latestReviewIdByPr = new Map([...latestReviewByPr].map(([prId, v]) => [prId, v.id] as const));
    const reviewIds = [...latestReviewIdByPr.values()];
    const findingRows =
      reviewIds.length > 0
        ? await container.db
            .select({
              id: t.findings.id,
              reviewId: t.findings.reviewId,
              severity: t.findings.severity,
              category: t.findings.category,
              title: t.findings.title,
              file: t.findings.file,
              startLine: t.findings.startLine,
              endLine: t.findings.endLine,
              confidence: t.findings.confidence,
              rationale: t.findings.rationale,
            })
            .from(t.findings)
            .where(inArray(t.findings.reviewId, reviewIds))
        : [];
    const findingsByPr = latestFindingsByPr(latestReviewIdByPr, findingRows);
```

- In the returned object, after `cost_usd: …`, add `findings: findingsByPr.get(r.id) ?? null,`.

- [x] **Step 4: Run to verify pass**

```bash
cd server && pnpm typecheck && pnpm exec vitest run --exclude '**/*.it.test.ts' && pnpm exec vitest run test/reviews.it.test.ts
cd ../client && pnpm typecheck
```

Expected: PASS. The integration suite needs Docker; without it the suite skips. If so, say that it skipped, not that it passed.

- [x] **Step 5: Commit**

```bash
git add server/src/modules/pulls server/src/vendor/shared/contracts/platform.ts client/src/vendor/shared/contracts/platform.ts server/test
git commit -m "feat(server): serve the latest review's findings preview on the PR list"
```

---

### Task 7: FINDINGS column with the "N FINDINGS IN THIS RUN" hover popover (client)

Paths below use `…/pulls` for `client/src/app/repos/[repoId]/pulls`.

**Files:**
- Create: `…/pulls/_components/FindingsCell/{FindingsCell.tsx,FindingsPopover.tsx,helpers.ts,styles.ts,index.ts,FindingsCell.test.tsx}`
- Modify: `…/pulls/constants.ts` (`GRID`, `COLUMN_KEYS`), `…/pulls/_components/PRRow/{PRRow.tsx,PRRow.test.tsx}`
- Modify: `client/messages/en/prReview.json`

**Interfaces:**
- Consumes: `PrMeta.findings` / `PrFindingPreview` (Task 6, via `@devdigest/shared` and `@/lib/types`); `SEVERITIES` and `countBySeverity` (Task 5); `Icon`, `SEV`, `SeverityBadge` and `CategoryTag` from `@devdigest/ui`.
- Produces:
  - `<FindingsCell findings={PrFindingPreview[] | null | undefined} />`
  - `<FindingsPopover findings={PrFindingPreview[]} anchor={DOMRect} onMouseEnter onMouseLeave />`
  - `CLOSE_DELAY_MS = 120`, `POPOVER_WIDTH = 380`, `POPOVER_MAX_HEIGHT = 360`
  - `popoverPosition(anchor: { top: number; bottom: number; left: number }, viewport: { width: number; height: number }): { left: number; top?: number; bottom?: number }`
  - `lineLabel(f: { start_line: number; end_line: number }): string`
  - i18n: `list.columns.findings`, and `list.findings.{notReviewed,noneTitle,trigger,popoverTitle,confidence}`.

- [x] **Step 1: Write the failing tests**

`…/pulls/_components/FindingsCell/FindingsCell.test.tsx`:

```tsx
import { describe, it, expect, afterEach, vi } from "vitest";
import { render, screen, cleanup, fireEvent, within, act } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import type { PrFindingPreview } from "@devdigest/shared";
import messages from "../../../../../../../messages/en/prReview.json";
import { FindingsCell } from "./FindingsCell";
import { CLOSE_DELAY_MS, POPOVER_MAX_HEIGHT, POPOVER_WIDTH, lineLabel, popoverPosition } from "./helpers";

afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

const F = (id: string, severity: PrFindingPreview["severity"], over: Partial<PrFindingPreview> = {}): PrFindingPreview => ({
  id, severity, category: "security", title: `T-${id}`, file: "src/api/limit.ts",
  start_line: 42, end_line: 42, confidence: 0.91, summary: `S-${id}`, ...over,
});

function renderCell(findings: PrFindingPreview[] | null | undefined) {
  return render(
    <NextIntlClientProvider locale="en" messages={{ prReview: messages }}>
      <FindingsCell findings={findings} />
    </NextIntlClientProvider>,
  );
}

const THREE = [F("a", "CRITICAL"), F("b", "CRITICAL", { start_line: 10, end_line: 14 }), F("c", "WARNING")];

describe("FindingsCell", () => {
  it("shows a count per present severity, most severe first", () => {
    renderCell(THREE);
    const trigger = screen.getByLabelText("3 findings in the latest run");
    expect(within(trigger).getByText("2")).toBeInTheDocument();
    expect(within(trigger).getByText("1")).toBeInTheDocument();
  });

  it("never reviewed → — and no popover trigger; reviewed with nothing kept → 0", () => {
    renderCell(null);
    expect(screen.getByTitle("Not reviewed yet").textContent).toBe("—");
    cleanup();
    renderCell([]);
    expect(screen.getByTitle("The latest run kept no findings").textContent).toBe("0");
    expect(screen.queryByLabelText(/findings in the latest run/)).not.toBeInTheDocument();
  });

  it("hover opens a read-only 'N FINDINGS IN THIS RUN' popover previewing every finding", () => {
    renderCell(THREE);
    fireEvent.mouseEnter(screen.getByLabelText("3 findings in the latest run"));
    const pop = screen.getByRole("dialog", { name: "3 FINDINGS IN THIS RUN" });
    expect(within(pop).getByText("3 FINDINGS IN THIS RUN")).toBeInTheDocument();
    for (const id of ["a", "b", "c"]) {
      expect(within(pop).getByText(`T-${id}`)).toBeInTheDocument();
      expect(within(pop).getByText(`S-${id}`)).toBeInTheDocument();
    }
    expect(within(pop).getByText("src/api/limit.ts:10-14")).toBeInTheDocument();
    expect(within(pop).getAllByText("src/api/limit.ts:42")).toHaveLength(2);
    expect(within(pop).getAllByText("91% confidence")).toHaveLength(3);
    expect(within(pop).getAllByText("security")).toHaveLength(3);
    // read-only: no Accept/Reject, no links
    expect(within(pop).queryAllByRole("button")).toHaveLength(0);
    expect(within(pop).queryAllByRole("link")).toHaveLength(0);
  });

  it("stays open while the pointer travels into the popover; closes after leaving both", () => {
    vi.useFakeTimers();
    renderCell(THREE);
    const trigger = screen.getByLabelText("3 findings in the latest run");
    fireEvent.mouseEnter(trigger);
    fireEvent.mouseLeave(trigger);
    fireEvent.mouseEnter(screen.getByRole("dialog"));
    act(() => vi.advanceTimersByTime(CLOSE_DELAY_MS * 2));
    expect(screen.getByRole("dialog")).toBeInTheDocument();
    fireEvent.mouseLeave(screen.getByRole("dialog"));
    act(() => vi.advanceTimersByTime(CLOSE_DELAY_MS));
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("keyboard: focus opens it, Escape closes it", () => {
    renderCell(THREE);
    const trigger = screen.getByLabelText("3 findings in the latest run");
    fireEvent.focus(trigger);
    expect(screen.getByRole("dialog")).toBeInTheDocument();
    fireEvent.keyDown(trigger, { key: "Escape" });
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });
});

describe("popoverPosition", () => {
  const vp = { width: 1200, height: 800 };
  it("opens below the icons, aligned to their left edge", () => {
    expect(popoverPosition({ top: 100, bottom: 120, left: 500 }, vp)).toEqual({ left: 500, top: 126 });
  });
  it("flips above when there is no room below", () => {
    const top = 800 - POPOVER_MAX_HEIGHT;
    expect(popoverPosition({ top, bottom: top + 20, left: 500 }, vp)).toEqual({ left: 500, bottom: 800 - top + 6 });
  });
  it("stays inside the viewport horizontally", () => {
    expect(popoverPosition({ top: 100, bottom: 120, left: 1150 }, vp).left).toBe(1200 - POPOVER_WIDTH - 8);
    expect(popoverPosition({ top: 100, bottom: 120, left: 2 }, vp).left).toBe(8);
  });
});

describe("lineLabel", () => {
  it("single line vs range", () => {
    expect(lineLabel({ start_line: 42, end_line: 42 })).toBe("42");
    expect(lineLabel({ start_line: 10, end_line: 14 })).toBe("10-14");
  });
});
```

`PRRow.test.tsx` changes:
- Replace the `vi.mock("next/navigation", …)` line with:

```tsx
const { push } = vi.hoisted(() => ({ push: vi.fn() }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ push }) }));
```

- Add `fireEvent` and `within` to the `@testing-library/react` import, and `import type { PrFindingPreview } from "@devdigest/shared";`.
- Append:

```tsx
const finding = (id: string, severity: PrFindingPreview["severity"]): PrFindingPreview => ({
  id, severity, category: "bug", title: `T-${id}`, file: "a.ts", start_line: 1, end_line: 1, confidence: 0.8, summary: "s",
});

describe("PRRow findings column", () => {
  it("renders the FINDINGS cell from pr.findings", () => {
    renderRow(pr({ findings: [finding("a", "CRITICAL"), finding("b", "SUGGESTION")] }));
    expect(screen.getByLabelText("2 findings in the latest run")).toBeInTheDocument();
  });

  it("clicking inside the popover does not open the PR", () => {
    push.mockClear();
    renderRow(pr({ findings: [finding("a", "CRITICAL")] }));
    fireEvent.mouseEnter(screen.getByLabelText("1 findings in the latest run"));
    fireEvent.click(within(screen.getByRole("dialog")).getByText("T-a"));
    expect(push).not.toHaveBeenCalled();
  });

  it("clicking the row elsewhere still opens the PR", () => {
    push.mockClear();
    renderRow(pr({ findings: [] }));
    fireEvent.click(screen.getByText("Add rate limiting"));
    expect(push).toHaveBeenCalledWith("/repos/r1/pulls/482");
  });
});
```

(`"1 findings in the latest run"`: the trigger label is a plain ICU string, kept simple. The popover title uses ICU plural.)

- [x] **Step 2: Run to verify failure**

Run: `cd client && pnpm exec vitest run "src/app/repos/[repoId]/pulls/_components"`
Expected: FAIL. `./FindingsCell` and `./helpers` are not found, and the new PRRow cases fail.

- [x] **Step 3: Implement**

`client/messages/en/prReview.json` changes:
- Add `"findings": "Findings"` to `list.columns`, between `score` and `status`.
- Add a `findings` object inside `list`, next to `columns`:

```json
    "findings": {
      "notReviewed": "Not reviewed yet",
      "noneTitle": "The latest run kept no findings",
      "trigger": "{count} findings in the latest run",
      "popoverTitle": "{count, plural, one {# FINDING} other {# FINDINGS}} IN THIS RUN",
      "confidence": "{pct}% confidence"
    },
```

`constants.ts`:
- Set `export const GRID = "1fr 132px 92px 60px 112px 118px 76px 78px";`.
- Set `COLUMN_KEYS` to `["pullRequest","author","size","score","findings","status","cost","updated"]`. `page.tsx` maps these into the header, so it needs no change.

`FindingsCell/helpers.ts`:

```ts
/** Pure helpers for the PR-list FINDINGS cell and its popover. */

/** Delay before closing, so the pointer can travel from the icons into the popover. */
export const CLOSE_DELAY_MS = 120;
export const POPOVER_WIDTH = 380;
export const POPOVER_MAX_HEIGHT = 360;
const GAP = 6;
const EDGE = 8;

/** `42` for a single line, `10-14` for a range. */
export function lineLabel(f: { start_line: number; end_line: number }): string {
  return f.end_line > f.start_line ? `${f.start_line}-${f.end_line}` : String(f.start_line);
}

/** Fixed-position coordinates: below the anchor, or above it when there's no
 *  room below, clamped horizontally inside the viewport. */
export function popoverPosition(
  anchor: { top: number; bottom: number; left: number },
  viewport: { width: number; height: number },
): { left: number; top?: number; bottom?: number } {
  const left = Math.max(EDGE, Math.min(anchor.left, viewport.width - POPOVER_WIDTH - EDGE));
  const fitsBelow = anchor.bottom + GAP + POPOVER_MAX_HEIGHT <= viewport.height;
  return fitsBelow
    ? { left, top: anchor.bottom + GAP }
    : { left, bottom: viewport.height - anchor.top + GAP };
}
```

(Check the flip test against this: `top = 800 - 360 = 440`, `bottom = 460`, and `460 + 6 + 360 = 826 > 800`, so it flips to `bottom: 800 - 440 + 6 = 366`. That matches `800 - top + 6`.)

`FindingsCell/styles.ts`:

```ts
import type { CSSProperties } from "react";
import { POPOVER_MAX_HEIGHT, POPOVER_WIDTH } from "./helpers";

/** Co-located styles for FindingsCell + FindingsPopover. */
export const s = {
  muted: { fontSize: 12, color: "var(--text-muted)" } satisfies CSSProperties,
  trigger: {
    display: "inline-flex",
    alignItems: "center",
    gap: 10,
    padding: "2px 4px",
    borderRadius: 5,
    cursor: "default",
  } satisfies CSSProperties,
  sevCount: (color: string): CSSProperties => ({
    display: "inline-flex",
    alignItems: "center",
    gap: 4,
    fontSize: 12,
    fontWeight: 600,
    color,
  }),
  popover: (pos: CSSProperties): CSSProperties => ({
    position: "fixed",
    zIndex: 1000,
    width: POPOVER_WIDTH,
    maxHeight: POPOVER_MAX_HEIGHT,
    overflowY: "auto",
    padding: 12,
    borderRadius: 10,
    border: "1px solid var(--border)",
    background: "var(--bg-elevated)",
    boxShadow: "0 8px 24px rgba(0,0,0,.35)",
    cursor: "default",
    ...pos,
  }),
  popoverTitle: {
    fontSize: 11,
    fontWeight: 600,
    letterSpacing: "0.06em",
    color: "var(--text-muted)",
    marginBottom: 8,
  } satisfies CSSProperties,
  list: { listStyle: "none", margin: 0, padding: 0, display: "flex", flexDirection: "column", gap: 10 } satisfies CSSProperties,
  item: { display: "flex", flexDirection: "column", gap: 4 } satisfies CSSProperties,
  itemHead: { display: "flex", alignItems: "center", gap: 8, minWidth: 0 } satisfies CSSProperties,
  itemTitle: {
    fontSize: 13,
    fontWeight: 600,
    color: "var(--text-primary)",
    overflow: "hidden",
    textOverflow: "ellipsis",
    whiteSpace: "nowrap",
  } satisfies CSSProperties,
  itemMeta: { display: "flex", alignItems: "center", gap: 10, fontSize: 11.5, color: "var(--text-muted)" } satisfies CSSProperties,
  itemSummary: { margin: 0, fontSize: 12, lineHeight: 1.45, color: "var(--text-secondary)" } satisfies CSSProperties,
} as const;
```

`FindingsCell/FindingsPopover.tsx`:

```tsx
/* FindingsPopover — read-only preview of a PR's latest-run findings, opened by
   hovering the FINDINGS cell in the PR list. Text only: no Accept/Reject (those
   live on the PR page's run card) and no links. */
"use client";

import React from "react";
import { useTranslations } from "next-intl";
import { SeverityBadge, CategoryTag } from "@devdigest/ui";
import type { PrFindingPreview } from "@devdigest/shared";
import { lineLabel, popoverPosition } from "./helpers";
import { s } from "./styles";

export function FindingsPopover({
  findings,
  anchor,
  onMouseEnter,
  onMouseLeave,
}: {
  findings: PrFindingPreview[];
  anchor: DOMRect;
  onMouseEnter: () => void;
  onMouseLeave: () => void;
}) {
  const t = useTranslations("prReview");
  const title = t("list.findings.popoverTitle", { count: findings.length });
  const pos = popoverPosition(anchor, { width: window.innerWidth, height: window.innerHeight });
  return (
    <div
      role="dialog"
      aria-label={title}
      style={s.popover(pos)}
      onMouseEnter={onMouseEnter}
      onMouseLeave={onMouseLeave}
      // Portalled, but React events still bubble to PRRow's onClick (navigation).
      onClick={(e) => e.stopPropagation()}
    >
      <div style={s.popoverTitle}>{title}</div>
      <ul style={s.list}>
        {findings.map((f) => (
          <li key={f.id} style={s.item}>
            <div style={s.itemHead}>
              <SeverityBadge severity={f.severity} compact />
              <span style={s.itemTitle}>{f.title}</span>
            </div>
            <div style={s.itemMeta}>
              <CategoryTag category={f.category} />
              <span className="mono">
                {f.file}:{lineLabel(f)}
              </span>
              <span className="mono tnum">
                {t("list.findings.confidence", { pct: Math.round(f.confidence * 100) })}
              </span>
            </div>
            {f.summary && <p style={s.itemSummary}>{f.summary}</p>}
          </li>
        ))}
      </ul>
    </div>
  );
}

export default FindingsPopover;
```

`FindingsCell/FindingsCell.tsx`:

```tsx
/* FindingsCell — PR-list FINDINGS column: one icon + count per severity present
   in the PR's latest run. Hover or focus opens FindingsPopover ("N FINDINGS IN
   THIS RUN"). Counts group the preview already in the list payload: no fetch. */
"use client";

import React from "react";
import { createPortal } from "react-dom";
import { useTranslations } from "next-intl";
import { Icon, SEV } from "@devdigest/ui";
import type { PrFindingPreview } from "@devdigest/shared";
import { SEVERITIES, countBySeverity } from "@/lib/severity";
import { FindingsPopover } from "./FindingsPopover";
import { CLOSE_DELAY_MS } from "./helpers";
import { s } from "./styles";

export function FindingsCell({ findings }: { findings: PrFindingPreview[] | null | undefined }) {
  const t = useTranslations("prReview");
  const triggerRef = React.useRef<HTMLSpanElement | null>(null);
  const closeTimer = React.useRef<ReturnType<typeof setTimeout> | null>(null);
  const [anchor, setAnchor] = React.useState<DOMRect | null>(null);

  React.useEffect(
    () => () => {
      if (closeTimer.current) clearTimeout(closeTimer.current);
    },
    [],
  );

  if (findings == null) {
    return (
      <span style={s.muted} title={t("list.findings.notReviewed")}>
        —
      </span>
    );
  }
  if (findings.length === 0) {
    return (
      <span className="mono" style={s.muted} title={t("list.findings.noneTitle")}>
        0
      </span>
    );
  }

  const counts = countBySeverity(findings);
  const cancelClose = () => {
    if (closeTimer.current) clearTimeout(closeTimer.current);
    closeTimer.current = null;
  };
  const open = () => {
    cancelClose();
    if (triggerRef.current) setAnchor(triggerRef.current.getBoundingClientRect());
  };
  const scheduleClose = () => {
    cancelClose();
    closeTimer.current = setTimeout(() => setAnchor(null), CLOSE_DELAY_MS);
  };

  return (
    <>
      <span
        ref={triggerRef}
        tabIndex={0}
        aria-label={t("list.findings.trigger", { count: findings.length })}
        aria-haspopup="dialog"
        aria-expanded={anchor != null}
        onMouseEnter={open}
        onMouseLeave={scheduleClose}
        onFocus={open}
        onBlur={scheduleClose}
        onKeyDown={(e) => {
          if (e.key === "Escape") {
            cancelClose();
            setAnchor(null);
          }
        }}
        style={s.trigger}
      >
        {SEVERITIES.filter((sev) => counts[sev] > 0).map((sev) => {
          const I = Icon[SEV[sev].icon];
          return (
            <span key={sev} style={s.sevCount(SEV[sev].c)}>
              <I size={13} />
              <span className="mono tnum">{counts[sev]}</span>
            </span>
          );
        })}
      </span>
      {anchor &&
        createPortal(
          <FindingsPopover findings={findings} anchor={anchor} onMouseEnter={cancelClose} onMouseLeave={scheduleClose} />,
          document.body,
        )}
    </>
  );
}

export default FindingsCell;
```

`FindingsCell/index.ts`:

```ts
export { FindingsCell, default } from "./FindingsCell";
```

`PRRow.tsx`: add `import { FindingsCell } from "../FindingsCell";`. Between the score `<div style={s.scoreCell}>…</div>` and the status `<div>`, add:

```tsx
      <div>
        <FindingsCell findings={pr.findings} />
      </div>
```

- [x] **Step 4: Run to verify pass**

Run: `cd client && pnpm typecheck && pnpm test`
Expected: PASS. The existing PRRow cost tests are unaffected: the unreviewed FINDINGS cell renders `—`, which is not `--`.

- [x] **Step 5: Commit**

```bash
git add client/messages/en/prReview.json "client/src/app/repos/[repoId]/pulls/constants.ts" \
  "client/src/app/repos/[repoId]/pulls/_components/FindingsCell" "client/src/app/repos/[repoId]/pulls/_components/PRRow"
git commit -m "feat(client): FINDINGS column with a read-only 'N findings in this run' hover popover"
```

---

## Phase 4: Validation

### Task 8: Verify end to end

- [x] **Step 1: Full verification**

```bash
cd server && pnpm typecheck && pnpm test
cd ../client && pnpm typecheck && pnpm test
cd .. && node scripts/check-claude-md.mjs
```

Expected: all green. The server `pnpm test` includes the `*.it.test.ts` suites, which need Docker. If they skip, report that they skipped.

- [x] **Step 2: Accuracy check against a real run (manual; needs an OpenRouter key and the dev DB migrated)** (done for Revision 1)

Run `./scripts/dev.sh` (and `cd server && pnpm db:migrate` if it was not done in Task 1). Review one PR with an OpenRouter model, then confirm the same number appears in each of these:
- the PR-list COST cell (for a PR with one run; with several runs it is their total);
- the review-card header;
- the timeline row;
- `agent_runs.cost_usd`: `select cost_usd, tokens_in, tokens_out from agent_runs order by ran_at desc limit 1;`;
- the run log's `Run complete · … · $x.xxxxxx` line in the trace drawer.

Compare with that generation on the OpenRouter activity page; they should agree to the displayed precision. Confirm that a pre-migration run shows `--`, and that a failed run shows no price.

- [ ] **Step 3: Severity breakdown walkthrough (manual, `./scripts/dev.sh`; follow the acceptance criteria's click path)** (partial: the dev DB had no review with findings; only the empty-state list column was checked live)

Pick a PR whose latest review has findings of at least two severities.
1. **PR list (criteria 20–21).** The FINDINGS column shows one icon + count per severity present.
   - Hovering the icons opens `N FINDINGS IN THIS RUN`, with one preview per finding: severity icon, title, category, `file:line`, `% confidence` and a short description. It has no buttons and no links.
   - The pointer can move into the popover without it closing.
   - On a row near the bottom of the window, the popover opens above the icons.
   - Clicking inside the popover does not open the PR; clicking elsewhere on the row does.
   - An unreviewed PR shows `—` and no popover.
2. **PR page → Agent runs → Review runs → expand a run card (criteria 16–17).** Under the verdict and PR SCORE there is a row `N CRITICAL · N WARNING · N SUGGESTION` showing only the levels present. Count the finding cards of each severity below: each pill's number matches.
3. **Filter (criterion 18).** Under the pills, the toolbar has **Critical**, **Warning** and **Suggestion**.
   - Clicking one leaves only that level's cards.
   - Clicking it again restores the full list.
   - Clicking a pill does the same and lights up the matching button.
   - A second run card's list is unaffected.
   - Each card keeps its Accept/Dismiss buttons (criterion 22).
4. **No LLM (criterion 19).** With the server log open, open the PR page and toggle the filter several times. No new `agent_runs` row appears, and the Network tab shows no new request when toggling or hovering.

---

## Phase 5: Completion

### Task 9: Record insights and close out

**Files:**
- Modify: `server/INSIGHTS.md`, `client/INSIGHTS.md` (via the `engineering-insights` skill)
- Modify: this plan (tick the boxes that were executed)

- [x] **Step 1: Record Revision 1 findings** (done)

Invoke the `engineering-insights` skill and add entries in its exact format (`- YYYY-MM-DD Fact, the action to take, and why. Applies to path/file.ext:LINE.`), using the real line numbers after implementation. For example:
- **server:** `agent_runs.cost_usd` is NULL for runs before migration 0010 and for non-`done` runs. Don't backfill from tokens × price, or old figures won't match the bill. Applies to `src/modules/pulls/run-cost.ts:LINE`.
- **server:** `runLog.logFor()` snapshots the buffer, so anything logged after the trace literal is never persisted. Applies to `src/modules/reviews/run-executor.ts:LINE`.
- **client:** `RunSummary`/`PrMeta` in `@devdigest/shared` were edited in both vendor copies; keep them identical. Applies to `src/vendor/shared/contracts/trace.ts:LINE`.

- [x] **Step 2: Record Revision 2 findings**

Same skill and format, with real line numbers. Candidates (keep only what proved non-obvious):
- **client:** a portalled popover still bubbles React events to its React ancestors, so `PRRow`'s row `onClick` fires on clicks inside it. Stop propagation at the popover root. Applies to `src/app/repos/[repoId]/pulls/_components/FindingsCell/FindingsPopover.tsx:LINE`.
- **client:** the severity filter state lives in `ReviewRunAccordion` and is shared by the verdict pills and the `FindingsPanel` buttons. Don't add a second state in either child, or they drift apart. Applies to `src/app/repos/[repoId]/pulls/[number]/_components/ReviewRunAccordion/ReviewRunAccordion.tsx:LINE`.
- **server:** the PR list's SCORE and FINDINGS both come from the latest `kind='review'` row, but COST totals every `done` run. Don't "fix" them to match. Applies to `src/modules/pulls/routes.ts:LINE`.

- [x] **Step 3: Final check and commit**

```bash
node scripts/check-claude-md.mjs
git add server/INSIGHTS.md client/INSIGHTS.md docs/superpowers/plans/2026-10-05-run-cost-badge.md
git commit -m "docs: record severity-breakdown insights and close out the run-cost-badge plan"
```

---

### Self-Review

- **Spec coverage:**
  - COST column: Tasks 2 and 4.
  - Banner row: Tasks 1 and 4.
  - Data source and real OpenRouter cost: Task 1 uses `outcome.costUsd`, which takes `usage.cost` and falls back to the price book (`reviewer-core/src/llm/openrouter.ts:94-97`, `run.ts:184`, `container.ts:185-188`).
  - Server per-run data and GET routes: Tasks 1 and 2.
  - `RunCostBadge` with 2 variants: Task 3.
  - Every completed run has a badge: Task 4 (timeline row for every `done` run, plus the banner).
  - `--` for no data: Tasks 3 and 4.
  - No extra model calls or fetches: Task 4 reuses the existing queries.
  - Accuracy vs the run log: Task 1 logs the same value before the trace snapshot, and its test asserts it. Task 8 checks against OpenRouter manually.
  - Formatting: Task 3.
  - Stale and incomplete runs: Tasks 1, 2 and 4.
- **Placeholder scan:** none. The generated migration filename suffix is chosen by drizzle-kit, so the plan doesn't name it. INSIGHTS `:LINE` is filled in after implementation.
- **Type consistency:**
  - `costUsd` (server) ↔ `cost_usd` (wire) ↔ the client prop `costUsd`.
  - `costOfLatestReviewRun` and `RunCostRow` are identical in Task 2's test and implementation.
  - `RunCostBadge` props and title strings are identical across Tasks 3 and 4.
  - The `RunSummary.cost_usd` fixture is updated in Task 1, where the field becomes required.
- **Review Focus:** all five are mapped to tests.

Revision 2:

- **Criteria coverage:**
  - Pill row under the verdict and score, showing only the levels present (16): Task 5 (`SeverityPills`, `VerdictBanner`).
  - Pill = number of cards below (17): Task 5, accordion test plus Decision 6.
  - Critical/Warning/Suggestion filter, second click clears (18): Task 5 (`SeverityFilter`, `toggleSeverity`, accordion + panel tests).
  - No LLM (19): Tasks 5 and 7 group loaded data; Task 6 adds no model call; Task 8 Step 3.4.
  - List hover popover `N FINDINGS IN THIS RUN` (20): Tasks 6 and 7.
  - Read-only preview fields (21): Task 7 popover test (no buttons or links; title, category, `file:line`, `%`, summary, severity icon).
  - Accept/Reject only on the run card (22): unchanged `FindingCard`; checked in Task 8.
  - Five phases (15): Phases 1–5 headings.
- **Placeholder scan:** none. INSIGHTS `:LINE` is filled in after implementation, as in Revision 1.
- **Type consistency:**
  - `SeverityCounts` / `countBySeverity` / `toggleSeverity` / `SEVERITIES` are defined in Task 5 and used by name in Task 7.
  - `PrFindingPreview` fields (`start_line`, `end_line`, `summary`) match across Task 6's contract, helper and test, and Task 7's fixtures.
  - `latestReviewIdByPr` is `Map<string, string>` (`as const` tuple) in both the helper signature and the route.
  - The i18n keys used in tests (`Findings by severity`, `Filter findings by severity`, `N findings in the latest run`, `N FINDINGS IN THIS RUN`, `Not reviewed yet`, `The latest run kept no findings`, `91% confidence`) all match the JSON added in Tasks 5 and 7.
- **Review Focus 6–10:** each is mapped to a test in Task 5 or 7.
- **Not in scope (noted, not planned):**
  - Criterion 16 also mentions severity icons on Timeline tiles (no click). `RunHistory` shows only `N finding(s)` today. It's not part of this feedback, so it is left for a follow-up.
  - The banner still shows no cost (see the Revision 2 deviations).
