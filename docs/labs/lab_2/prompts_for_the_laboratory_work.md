# Prompts for the Laboratory Work

## Renaming CLAUDE.md → AGENTS.md (Plan Mode)

We will need to rename all CLAUDE.md files to AGENTS.md, and for Claude Code add symlinks so that we don't copy the file but simply create a link pointing to it. Do this for all relevant directories in the project (server, client, etc.), and propose implementation options yourself.

## Clarifications During Plan Mode (Answers to Questions)

Which backward-compatibility mechanism to use — an empty file referencing AGENTS.md, or a symlink? A symlink. Which files should the replacement apply to — all five files.

## Request for a Verification Approach

How do we test that the new AGENTS.md files work?

## Creating a React/Frontend Best Practices Skill

I want to create a new skill with React and frontend best practices. We need to answer questions such as: where should all components live, how should they be split up, where should constants live, what should be extracted into utilities or helpers, where should business logic go, and similar questions. Do research or deep research, find all these best practices, give me a list of sources from which we will later build the skill, and don't forget to keep all these sources so we can compile them into a README file later.

## Addition to the Previous Prompt

We also use Next.js — maybe add it to the practices as well. I'm interested specifically in architecture, not performance.

## Focusing the Skill and Creating It

I agree that the skill should focus specifically on architecture and code organization to avoid duplication. The name can be something along the lines of "Frontend UI Architecture." Try to create this skill, drawing on the best practices for creating skills. Add all the links we used to the README. Capture the necessary information in the skill itself. Don't forget to add a version to the skill. If you have any questions, ask.

## Creating an Onion Architecture Skill for the Backend

I want to create a skill called Onion Architecture for our backend modules. It should enforce the use of this architecture for the tools we use. Look at which backend tools we use, find good architectural practices for them that support the Onion Architecture concept. Also search for articles with good practices on Onion Architecture and produce a plan for the skill. Don't forget to include these links.

## Analyzing the Project with the New Skills and Building an Improvement Plan

Analyze the entire project using the new skill, and produce a plan of what could be improved. We care about more than just the frontend. Also use the other skills we already have — React best practices, Next best practices, and similar ones — and apply them to this analysis as well.

## Starting the Refactoring Plan

You can start this plan. Just make sure all tests pass, that you haven't broken any functionality, and that everything works.

## Creating a PR Self Review Skill (Plan Only)

We need to create a skill called PR Self Review. It will run before every PR is opened on GitHub, or manually. It needs to check all open changes: analyze the skills we have and match them against the diff, so that all UI-related skills run over the UI files, and backend architecture skills run over the backend files present in the diff. If at least one critical finding is found, the user should be blocked from merging these changes. The idea is to check local changes before opening a pull request. Don't write the skill itself — just create a plan for us.

## Clarification to the Skill Plan

What else would you want to add to this item to make our skill even better or more practical?

## Large Feature Spec: "Skills for Review Agents" (with Added Requirements and Screenshots)

We need to implement the skills feature. It is similar to the agents design, but skills must be reusable across agents. The user should be able to edit and update them. We can reuse the functionality we have in agents. Skills cannot use anything — only the text configuration we created. In addition, you should look at the requirements and the designs and ask questions if you have any.

## Clarification — Don't Build Right Away, Produce a Plan/Spec

Don't create anything; just produce a plan or specification for us — a plan and specification for implementing this feature.

## Answers to Clarifying Questions About the Spec

This should be a single agent, Test Quality Reviewer, with four skills for it — or three, or four.

## Updating the Spec for the New Designs

I've updated the designs. Now change the specification that we will be implementing.

## Starting the Spec Implementation

Execute this spec. Use multi-agent mode to do some of the modules in parallel, if possible.
