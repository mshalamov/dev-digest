# Step 1 — migrating to AGENTS.md

- Part of the team uses other editors rather than Claude Code — ones that read `AGENTS.md`, not `CLAUDE.md`.
- We rename `CLAUDE.md` to `AGENTS.md` and put a symlink `CLAUDE.md` → `AGENTS.md` next to it for compatibility with Claude Code.
- This works for nested files as well (`server`, `client`, `reviewer-core`).
- Alternative without a symlink: keep `CLAUDE.md` with a single import line `@AGENTS.md` (in particular for Windows without administrator rights).
