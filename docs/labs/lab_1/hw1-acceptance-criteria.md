# Grading Criteria (Pass / Fail) — Homework #1

| # | Criterion | How it is credited |
| --- | --- | --- |
| — | **✅ Required** | — |
| 1 | CLAUDE.md — technology stack | The language/framework/key libraries of each package are stated |
| 2 | CLAUDE.md — monorepo structure | The list of packages/folders and the role of each one is stated |
| 3 | CLAUDE.md — run commands | The commands for running the project are present |
| 4 | CLAUDE.md — verification commands | The test/typecheck/lint commands are present |
| 5 | CLAUDE.md — naming conventions | A separate section with naming conventions is present |
| 6 | CLAUDE.md — do not touch (migrations) | Migrations are explicitly marked as a "do not touch" zone |
| 7 | CLAUDE.md — do not touch (lock files) | Lock files are explicitly marked as a "do not touch" zone |
| 8 | The engineering-insights skill exists | There is a separate file `.claude/skills/engineering-insights/SKILL.md` |
| 9 | The skill records findings on its own | It triggers without being explicitly asked, in every task |
| 10 | Entries in the INSIGHTS.md of the right module | The entry goes into the INSIGHTS.md of the module where the work was done (client/server/reviewer-core/e2e) |
| 11 | Evidence in the INSIGHTS.md entry | Every entry has a file:line and a date |
| 12 | Cost in the Pull Requests list | The sum of the cost of all successful runs for the PR; no runs — the value is empty |
| 13 | Cost on the Agent runs tab | Each run in the Timeline shows its own cost |
| 14 | Cost in the run tracing sidebar | A separate COST stat block in the Trace drawer → Stats |
| 15 | The 5-phase work cycle | Initiation → Planning → Implementation → Validation → Completion have been gone through |
| 16 | Findings counters by severity | The "Agent runs" tab has TWO sections: "Timeline" (tiles of runs and commits in chronological order — each tile also shows its severity icons, but without clicking) and "Review runs" (per-run cards, expandable). The counters from this criterion are specifically in "Review runs": (1) open the PR → (2) "Agent runs" tab → (3) "Review runs" section → (4) click the run card to expand it → (5) below the verdict and the PR SCORE — a row of pills "N CRITICAL · N WARNING · N SUGGESTION" (only the severities that actually exist) |
| 17 | The counters match reality | In that same expanded run card: the number on the pill = the number of finding cards of that severity rendered below it in the same card |
| 18 | Filtering findings by severity | In that same expanded run card, below the counters row — three filter buttons: **Critical**, **Warning**, **Suggestion**. Clicking one of them leaves below only the finding cards of that level, the rest are hidden; clicking the same button again clears the filter and restores the full list of that run's findings |
| 19 | Counting without an LLM | The numbers "N CRITICAL · N WARNING · N SUGGESTION" are computed by grouping the already existing findings by their severity field (a simple COUNT/filter). No new LLM call when opening the page or switching the filter |
| 20 | "N FINDINGS IN THIS RUN" popup (the PR LIST page, not the details page!) | On the Pull Requests list page (where all PRs are listed), hovering the cursor over the severity icons in the FINDINGS column of a specific PR row — a popover appears with the heading "N FINDINGS IN THIS RUN" |
| 21 | Finding preview in the popup — read-only | In that same popup from the PR list (not in the accordion on the PR page!), each finding preview shows text only: a severity icon, title, category, file:line, % confidence, a short description — without any buttons |
| 22 | Finding card with Accept/Reject — A DIFFERENT place (PR page, Review runs accordion) | This is no longer the popup from the PR list, but an expanded run card on the page of a specific PR (Agent runs tab → Review runs) — there, every finding has Accept and Reject buttons |
| 23 | Findings in the Trace and Logs sidebar | Not only cost/stats are visible, but the findings themselves as well |
| 24 | docs/ and specs/ for each package | For each package (client, server, reviewer-core, e2e) — its own `docs/*.md` and `specs/*.md`, with real content about that specific package, not an empty README stub. The difference: `docs/*.md` explains the package's architecture/data flow (e.g. `server/docs/architecture.md` — DI and adapters, `client/docs/ui-architecture.md` — Server/Client Component boundaries); `specs/*.md` records specific behavior/contracts that must stay true (e.g. `server/specs/review-flow.md` — the full review cycle, `client/specs/pages.md` — routes and page data). Each package's CLAUDE.md references its own docs/specs in the "Read When" section — the files must actually exist at those paths. The content is written deliberately, about the code already built in that package — this is NOT the same thing as the engineering-insights skill (that one only automatically appends notes to `insights/INSIGHTS.md` as sessions go — separate criteria #8–11) |
| — | **Total** | **Pass = all 24 required criteria passed** |
