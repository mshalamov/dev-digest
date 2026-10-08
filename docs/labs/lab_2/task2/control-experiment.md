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
