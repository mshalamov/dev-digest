# Step 2 — three of our own development skills

The skills that write code in our stack are already imported (fastify, drizzle, next, typescript, RTL) — we don't duplicate them. We write only what they don't cover:

- **UI-architecture skill** (Instruction) — the structure of the frontend stack: where pages live (app-router), where a page's components are colocated, where shared components live, how files are named, where tests live. The goal is to encode "what goes where on the client".
- **Onion-architecture skill for the backend** (Instruction) — fixes the layers: route → service → domain via the container; external integrations (git, index, secrets) in adapters at the edge; dependencies point inward. It does not allow an adapter call to be pulled straight into a route.
- `pr-self-review` (Workflow, a dispatcher of skills) — before the "ready" status, runs the uncommitted diff in a second pass and routes by the changed surfaces: client → UI-architecture skill + react + RTL; backend → Onion skill + fastify + drizzle.
