# Grading Criteria (Pass / Fail) — Homework #2

> In the "How it is credited" column, the LOCATION (file, or a specific page/tab/section of the site) is stated first, and then — what exactly must be there.

| # | Criterion | How it is credited |
| --- | --- | --- |
| — | **✅ Required** | — |
| 1 | Migration to AGENTS.md (repository root) | Filesystem, repo root: there IS an `AGENTS.md` → next to it there must be a symlink `CLAUDE.md`→`AGENTS.md` OR a `CLAUDE.md` containing a single-line import `@AGENTS.md`. If there is no `AGENTS.md`, the criterion simply does not apply |
| 2 | Migration to AGENTS.md (server/client/reviewer-core) | Filesystem, `server/`, `client/`, `reviewer-core/` folders: the same pattern (rename + symlink/import), not only in the root |
| 3 | UI-architecture skill | Filesystem: `.claude/skills/frontend-architecture/SKILL.md` (folder name is approximate). Content: where pages live (app-router), where page components live, where shared components live, naming conventions, where tests live |
| 4 | Onion-architecture skill | Filesystem: `.claude/skills/onion-architecture/SKILL.md`. Content: layers route→service→domain via a container, external integrations in adapters at the edge, dependencies point inward, calling an adapter directly from a route is forbidden |
| 5 | pr-self-review skill exists | Filesystem: `.claude/skills/pr-self-review/SKILL.md`, type Workflow (a skill dispatcher) |
| 6 | Agents in the SKILLS LAB sidebar | Left sidebar: the **Agents** item is located in the SKILLS LAB section, not WORKSPACE |
| 7 | Agents page — grid/list of cards | Sidebar SKILLS LAB → **Agents** page: shows a list/grid of tiles (cards) for all agents |
| 8 | CRUD over the skills table | Backend: `GET/POST/PUT/DELETE /skills[:id]` actually read from/write to Postgres (verification: create a skill via the API → find the record in the DB with a direct query; delete it directly in the DB → `GET /skills` no longer returns it) |
| 9 | Skills page — grid of cards | Sidebar SKILLS LAB → **Skills** page: a list of skill cards, each showing name, type, description, and an "enabled" toggle |
| 10 | Clicking a card → preview on the side | **Skills** page: clicking a skill card in the list opens a preview in a SIDE panel, not in a modal and not on a separate page |
| 11 | "Add" skill button | **Skills** page, "Add"/"+" button: opens a choice of "create" or "import"; the actual creation happens in a modal |
| 12 | Skill form | Skill creation modal (Add button → "create"): fields for name, description, type, and body in markdown |
| 13 | Skills tab in the agent editor | Sidebar SKILLS LAB → **Agents** page → open a specific agent → **Skills** tab: attaching skills, enabling/disabling them, reordering (drag&drop) |
| 14 | Drag&drop on the agent's Skills tab really affects the prompt | This is not just UI cosmetics: the order in which skills are arranged via drag&drop on the agent's Skills tab (criterion 13) is exactly the order in which their bodies are inserted into the system prompt when the agent runs. Verification: swap skills in the UI → run the agent → in the assembled prompt (run log/trace) the skill blocks have also swapped places |
| 15 | Importing a skill from a file/zip archive | **Skills** page → "add" → "import": accepts a .md file OR a .zip archive itself (other archive formats — .tar/.rar/.7z — do not have to be supported); shows a preview of the skill core before saving |
| 16 | At least one skill created via import | **Skills** page: at least one of the skills attached to the new agents has origin "imported" (not just "created") |
| 17 | Control experiment — Test Quality | PR page, Run Review button: run the Test Quality Reviewer on a PR whose test covers only the happy path WITHOUT an attached skill → does not flag; the same PR with the skill attached → flags an uncovered branch and an edge case |
| 18 | Control experiment — API Contract | Same way: PR with a route signature change, without the skill → skipped; with the skill → detects the breaking change |
| 19 | Skills in the prompt trace | PR page → Agent runs tab → Review runs → open the run trace (log/trace icon): the prompt-assembly section shows a separate skills block + a number next to it — "how many tokens this specific block weighs" ("tokens are not counted by hand — take the full text of the skills that went into this block and count its tokens with a tokenizer (e.g. tiktoken) OR most simply — approximately, using the formula `text_length / 4`; the key thing is that this number relates to the SKILLS block specifically, not to the whole prompt") |
| 20 | Enabled/disabled is visible in the logs | The same run trace: an enabled skill — a separate block in the logs; a disabled skill — no block at all |
| 21 | pr-self-review — manual invocation on a mixed diff | Locally (Claude Code): the auto-invocation (hook on git push) is disabled; manually running the skill on a diff that touches both client/ and server/ pulls in both skill sets at once |
| 22 | Skill card — version and agent count | **Skills** page, skill card: besides name/type/description/toggle — also the current version and a counter of how many agents it is attached to (agent_count) |
| 23 | "Delete" button on the skill card | **Skills** page, skill card: there is a "Delete" button |
| 24 | Skill deletion confirmation | Clicking "Delete" on a skill card: a modal opens (confirm / cancel / X) |
| 25 | Tabs of the skill page | **Skills** page → click a skill → `/skills/:id` page: tabs Config, Preview, Versioning (the Stats tab is optional, it will be in HW #8) |
| 26 | Preview — rendered view | `/skills/:id` → **Preview** tab: shows the formatted (rendered) view of the skill body, not raw markdown text |
| 27 | Versioning — list of versions | `/skills/:id` → **Versioning** tab: a list of all versions of the skill |
| 28 | Diff button in versions | The same **Versioning** tab, each previous version: a "Diff" button shows the difference against the current version |
| 29 | Restore button in versions | The same **Versioning** tab: a "Restore" button returns the skill body to the selected version |
| 30 | Search in the agent's Skills tab | The same **Skills** tab of the `/agents/:id` page: a search/filter field for skills by name |
| 31 | Drag&drop only for enabled skills | The same **Skills** tab of the `/agents/:id` page: only enabled skills can be dragged (drag&drop) to change their order |
| 32 | Agent tile — basic fields | **Agents** page, agent tile (card): name, description, LLM/model, enabled/disabled toggle, counter of attached skills |
| 33 | "Delete" button on the agent tile | **Agents** page, agent tile: a "Delete" button (removes the agent from the database) |
| 34 | Agent deletion confirmation | Clicking "Delete" on an agent tile: a modal (confirm / cancel / X) |
| 35 | Tabs of the agent page | **Agents** page → click an agent → `/agents/:id` page: exactly 2 tabs — Config and Skills |
| 36 | Agent Config — fields | `/agents/:id` → **Config** tab: name, description, provider, model (from a list), review strategy, system prompt |
| 37 | Agent Skills tab — full list | `/agents/:id` → **Skills** tab: shows ALL skills in the system (not only those attached to this agent), each with an enabled/disabled toggle and a category label of its type (security/convention/custom, etc.) |
| 38 | Conventions extract route | Backend: `POST /repos/:id/conventions/extract` actually runs the analysis, and the result is stored persistently (survives a reload) |
| 39 | Sample selection — without a model | Backend, the sample-selection step for the analysis: configs (eslint/tsconfig/prettier) + top-12 files via `repoIntel.getConventionSamples()` — plain code, no LLM call |
| 40 | Candidate format from the model | Backend, the LLM's response for the conventions analysis: `{category, rule, evidence: file+line, confidence}` |
| 41 | Create modal — editing the body | Sidebar SKILLS LAB → **Conventions** page → select candidates → "Create skill" button → modal: you can edit the future skill text (body) and its metadata, not just name/description |
| 42 | Approved → repo-conventions skill | Backend: approved candidates are assembled into a single skill named `repo-conventions`, linked to the agent |
| 43 | 4 skills of the API Contract Reviewer | **Skills** page (or the skill files): breaking-change, response-schema, semver-discipline, deprecation-policy — each with a directive description and a "good/bad" example |
| 44 | Conventions in the SKILLS LAB sidebar | Left sidebar: the **Conventions** item is located in the SKILLS LAB section, not WORKSPACE |
| 45 | Run Scan / ReScan buttons | **Conventions** page: two separate buttons — "Run Scan" (first run of the analysis) and "ReScan" (re-run/regeneration) |
| 46 | Candidate cards after scanning | **Conventions** page, after the scan completes: candidate cards show the rule, the source file, and the confidence percentage |
| 47 | Three buttons on the candidate card | **Conventions** page, each candidate card: Accept, Reject, Edit buttons |
| 48 | Reject is persisted | **Conventions** page: a rejected candidate does not come back after a page reload and does not end up in the final skill |
| 49 | Edit inline | **Conventions** page, candidate card: the Edit button edits the card right in place (inline), without navigating to another page |
| 50 | Create skill button | **Conventions** page: the "Create skill" button appears after selecting (Accept) at least one candidate |
| 51 | Create skill modal | **Conventions** page → "Create skill" button: the modal explains that this is creation from conventions; Name/Description fields; Cancel and Create buttons |
| 52 | New skill on the Skills page | After Create on the **Conventions** page → go to the **Skills** page: the new skill is visible in the general list |
| 53 | Settings → Models → Conventions | Sidebar → **Settings** → **Models** section: a separate row for the conventions-classification feature, with a dropdown model search; the model is chosen dynamically, not hardcoded in the code |
| — | **Total** | **Pass = all 53 required criteria passed** |
