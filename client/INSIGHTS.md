# client insights

Append-only. One line per finding, at the end of its section:
`- YYYY-MM-DD Fact, the action to take, and why. Applies to path/file.ext:LINE.`

## What Works

## What Doesn't Work
- 2026-10-07 A `createPortal` popover still bubbles React events through the React tree, so a click inside the FINDINGS popover fired `PRRow`'s row `onClick` and navigated; stop propagation at the popover root. Applies to `src/app/repos/[repoId]/pulls/_components/FindingsCell/FindingsPopover.tsx:35`.
- 2026-10-07 Closing a fixed-position popover on `window.addEventListener('scroll', …, true)` also fires when the popover's own scrollable list scrolls (capture sees every element's scroll), so it closed itself; skip events whose target is inside the popover. Applies to `src/app/repos/[repoId]/pulls/_components/FindingsCell/FindingsCell.tsx:45`.

## Codebase Patterns
- 2026-10-05 `RunSummary` (`cost_usd`) and `PrMeta` cost fields were edited in both vendored `shared` copies (client and server); keep them identical or wire parsing drifts. Applies to `src/vendor/shared/contracts/trace.ts:107`.
- 2026-10-05 Supersedes the entry above: `RunStats.cost_usd`, `RunSummary.cost_usd` and `PrMeta.cost_usd` live in both vendored copies, but the `trace.ts` copies already differ in the `PromptAssembly` doc comments (lines 44-46), so edit each by hand and never copy one over the other. Applies to `src/vendor/shared/contracts/trace.ts:44`.
- 2026-10-07 The per-run severity filter is one state in `ReviewRunAccordion`, shared by the verdict pills and the `FindingsPanel` filter buttons (the panel is controlled when `onSeverityChange` is passed); never add a second filter state in either child or pills and buttons drift apart. Applies to `src/app/repos/[repoId]/pulls/[number]/_components/ReviewRunAccordion/ReviewRunAccordion.tsx:63`.

## Tool & Library Notes
- 2026-10-08 Vitest's file filter treats `[...]` as a glob class, so `vitest run "src/app/skills/\[id\]"` matches no tests; pass the quoted file path or an unbracketed parent dir (`src/app/agents`). Applies to `vitest.config.ts:18`.

## Recurring Errors & Fixes

## Session Notes
- 2026-10-05 Added 1 entry to client/INSIGHTS.md (run-cost-badge).
- 2026-10-05 Added 1 entry to client/INSIGHTS.md (vendored contract note).
- 2026-10-07 Added 2 entries to client/INSIGHTS.md (severity pills/filter, FINDINGS popover).
- 2026-10-07 Added 1 entry to client/INSIGHTS.md (capture-phase scroll closes popover).
- 2026-10-08 Added 1 entry to client/INSIGHTS.md (vitest bracket filters).

## Open Questions
