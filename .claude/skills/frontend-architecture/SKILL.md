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
