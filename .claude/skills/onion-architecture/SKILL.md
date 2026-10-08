---
name: onion-architecture
description: Use when adding or reviewing server code in server/src — a route, service, repository, domain logic or an integration with git, GitHub, an LLM, the code index or secrets — to keep layers separate and dependencies pointing inward.
metadata:
  version: "1.0.0"
---

# Onion Architecture (server)

Layers for `server/` (Fastify 5, Drizzle, Zod). This skill covers layering only. For Fastify mechanics use `fastify-best-practices`; for Drizzle queries and schema use `drizzle-orm-patterns`.

## Layers (outside → inside)

| Layer | Lives in | Job | May import |
|---|---|---|---|
| route | `src/modules/<name>/routes.ts` | HTTP edge: parse params/body with Zod contracts from `@devdigest/shared`, call `getContext`, call **service methods only** (no orchestration, no branching on I/O results), shape the response | service, `_shared`, shared contracts, `platform/errors` |
| service | `src/modules/<name>/service.ts` (+ `run-executor.ts`, `findings.ts` style helpers) | Orchestrates a use case; owns transactions and the order of steps | domain, repositories, interfaces from `@devdigest/shared`, the `Container` |
| domain | pure functions: `helpers.ts`, `constants.ts`, `src/platform/grounding.ts`, `reviewer-core` (note: `src/adapters/llm/pricing.ts` is pure price math that sits under `adapters/` for historical reasons; treat it as domain, do not add I/O to it) | Business rules; no I/O, no clock/random unless passed in | other domain code and types only |
| repository | `src/modules/<name>/repository.ts`, `repository/*.repo.ts` | The only code that runs Drizzle queries | `src/db/*`, row types |
| adapter | `src/adapters/<name>/` | Implements an interface (`GitClient`, `GitHubClient`, `SecretsProvider`, `LLMProvider`, `CodeIndex`, `Embedder`) against a real system | the third-party SDK, interface types |
| container | `src/platform/container.ts` | Composition root: builds adapters and repositories lazily, accepts `ContainerOverrides` for tests | everything (it is the only place that does) |

## Dependency rule

Imports point inward only: route → service → domain, and service → repository / interface. Domain imports nothing from Fastify, `src/db`, `src/adapters` or `process.env`. Adapters and repositories depend on interfaces and row types, never on a route or service.

## Rules

1. **A route never calls an adapter or `db` directly.** `container.github()`, `container.git`, `container.secrets`, `container.llm()`, `container.codeIndex` and `import * as t from '../../db/schema.js'` do not appear in `routes.ts`. Put the call in a service method and call that. Two sanctioned exceptions: `getContext(container, req)` from `_shared/context.ts` (it reads `container.auth` to resolve tenancy; every route must call it), and the platform services on the container, which are not adapters: `container.runBus` (SSE subscribe in `reviews/routes.ts`), `container.jobs.enqueue` (background jobs in `repo-intel/routes.ts`) and the `container.repoIntel` facade. A route may call these directly.
2. **Adapters are reached through the container,** by interface type. Never `new OctokitGitHubClient(...)` or `import { SimpleGitClient }` in a service. Tests substitute `Mock*` classes from `src/adapters/mocks.ts` via `ContainerOverrides`.
3. **A new integration is an interface plus an adapter.** Reuse an interface that `@devdigest/shared` already exports (`GitClient`, `GitHubClient`, `LLMProvider`, …) when one fits; `src/vendor/shared` is vendored, so never add to it here (see `server/AGENTS.md`). Otherwise follow the `depgraph` / `tokenizer` pattern: export the interface type and its implementation from `src/adapters/<name>/index.ts` (as `DepGraph` + `DepCruiseGraph` do). Then add a lazy getter and an override slot in `container.ts`, and add a `Mock*` double.
4. **Decisions are domain functions.** Scoring, ranking, grounding, price math and formatting are pure and unit-tested without a container or database.
5. **Repositories return rows or plain data,** never Fastify types; services map rows to DTOs.
6. **Routes stay declarative.** Validation is the Zod schema in the route options. Errors are thrown as `AppError` subclasses from `platform/errors.ts` (`NotFoundError`, `ConfigError`, …), never sent with a hand-built error body. Setting a success status (`reply.status(201)`, `reply.code(202)`) is fine.
7. **Modules do not import each other's internals.** Shared entities are exposed as container repositories (`container.agentsRepo`, `container.reviewRepo`).

## Good

```ts
// reviews/routes.ts — edge only: context, parse, service calls, response shape
app.post('/pulls/:id/review', { schema: { params: IdParams } }, async (req) => {
  const { workspaceId } = await getContext(container, req);
  const body = RunRequest.parse(req.body ?? {});
  const targets = await service.resolveTargets(workspaceId, body);
  const { runs, reviews } = await service.runReview(workspaceId, req.params.id, targets, req.log);
  return { pr_id: req.params.id, runs, reviews };
});

// reviews/diff-loader.ts — the adapter is reached through the container, by interface
const diff = await container.git.diff({ owner: repoRow.owner, name: repoRow.name }, pull.base, pull.headSha);

// reviews/run-executor.ts — service-side orchestration; the repository does the SQL
diff = await loadDiff(this.container, this.repo, workspaceId, pull, repo);
const review = await this.repo.insertReview({ /* … */ });
await this.repo.markReviewed(pull.id, pull.headSha);
```

## Bad

```ts
// routes.ts
import * as t from '../../db/schema.js';                       // SQL in the edge layer
const gh = await container.github();                           // adapter called from a route
const pr = await gh.getPull(owner, repo, n);
await db.insert(t.pulls).values(map(pr));                      // orchestration + persistence in a route

// service.ts
import { OctokitGitHubClient } from '../../adapters/github/octokit.js';
const gh = new OctokitGitHubClient(token);                     // bypasses the container; untestable
```

## Legacy code

`pulls/routes.ts`, `polling/routes.ts` and `settings/routes.ts` already call `container.github()`, `container.secrets` and `db` directly. That is legacy. Do not copy the pattern into new code, do not widen it, and do not refactor it as a side effect of an unrelated change. When you add or change a handler in such a file, put the new logic in a service method and have the route call that. A review flags only lines that the diff adds or changes.
