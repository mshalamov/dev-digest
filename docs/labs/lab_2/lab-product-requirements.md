# What we're building — product requirements

A knowledge-free agent reviews a diff formally, without regard for team conventions. Skills add a layer of standards, so a review becomes a check against agreed-upon rules. Every skill consumes tokens in an agent run, so its use must be justified

- **Encode knowledge as a skill** — a set of rules in markdown with a name, type and short description; stored in the product database. *UI: a skill card in the list.*
- **Attach skills to an agent** — one agent holds several skills in a given order, and that order affects prompt assembly. *UI: a Skills tab in the agent editor.*
- **Show and measure the effect** — it is visible that a skill changed the findings, and how many tokens it added. *UI: a prompt-assembly section in the run trace, the skills block separately.*
- **Import external skills safely** — import from a file/archive through a mandatory preview; someone else's skill = untrusted input, executable parts are ignored.
- **Manage skills by hand** — list, create, edit, an "enabled" toggle, preview.
- **Compose specialized agents out of skills** — no imposed ready-made personas.

Out of scope: searching the internet for skills, memory on accept/dismiss, parallel run of agents, storing a skill's file tree.
