# Prompts for the Laboratory Work

## Request to Describe the Project (Codebase Familiarization)

Tell me what's here and what everything is for, explain how this project is structured and how it works.

## Request for the Structure of the CLAUDE.md Files

Propose a structure for our CLAUDE.md files. I want this CLAUDE.md file to be present in every folder, in every module of our project (there are four of them), so that we definitely link to the documentation we already have. As for documentation, we have README files. Then in each of these [modules] there will be a Docs folder, a Specs folder, and an Insights file. All of these directories need to be included. Follow the recommendations I sent you.

## Request to Explain the "Don't Touch Migrations" Rule

Can you explain in more detail what this is needed for?

## Creating an Engineering Insights Skill

I want to create a skill called Engineering Insights. It should trigger during any session when the agent finds something interesting, according to the categories I will give you, and then it must record these insights into the file corresponding to the module it is working in. Use the recommendations I will show you on the slide to implement this better. Also read the research I will send you, visit those sites, and propose the best option for what to include in that specific skill.

## Clarification on Reading and Writing Insights

Before starting the chat — once the user has already entered their input, their prompt, and asked something — the agent must read the insights file belonging to the specific module where development will take place or which is being discussed. Also, at the end of the session, insights must be recorded, but there has to be something substantial in them. If nothing substantial happened during the agent's work beyond what is already written, then nothing should be written. Before writing, you must first read these insights — perhaps a particular insight is already there, in which case it should not be written again.

## Checking Whether the Sources Were Actually Used

Tell us how you used the articles I provided. What content did you take from them? Did you look at them at all? Did you actually visit those articles? Did you look at the skill examples that were there?

## Requirement to Actually Process the Sources

No — "I didn't visit those sites, I didn't open any URL. What I actually used was my own data." I want you to go through all of those sites, collect the data, collect the skill examples again, and use them for our skill.

## Answer to the Question About Writing to Insights (Automatic Mode)

In automatic mode, the skill should read the file, see what is recorded there, and then add its own notes.

## Requirement Not to Overwrite Existing Content

Make sure the skill does not overwrite what is already in the document and doesn't erase anything.

## Spec and Plan for the Cost Feature (Run Costs)

I want you to produce a specification and a plan for how we will implement the next feature. It should be cost in the pull requests list. We need to cover three screens in the design. First — the pull requests page, which must have a separate column with cost. Second — it should be on the agent reviewers' run itself; you can see it in the screenshots I sent you, somewhere near the time when this agent reviewer was run, and also its price. And third — in Agent Run General Reviewer, the run of the agent itself in the sidebar, where Duration, tokens, and findings are, there should be a cost column. Ask me questions if anything is unclear.

## Answers to Clarifying Questions About the Cost Feature

What exactly to show in Cost Pull Request? The latest review, I think. Where to take the run cost from? Store cost in USD for the run — a new column, not a token price.

## Request to Show the Planned UI Components

Show me exactly which UI components you are going to add and where. It's important for us to know at this stage that everything will be done as planned, so we don't have to redo it later.

## Question About the Skills Used and Tests Written

Tell me which UI tests and backend tests you wrote for this functionality. Tell me which skills were used during the session and whether you recorded any insights.

## Requirement to Record Insights

Write engineering insights. Run engineering insights. Record these items.
