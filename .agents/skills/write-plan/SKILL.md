---
name: write-plan
description: Write an implementation plan file under design/plans/ before the code is written, as one plan or as an overview with a plan for each phase, and open it as its own PR. Use when asked to write an implementation plan for a piece of work, or the plan for one phase of an existing overview.
---

# Write a plan

A plan is written before the code, for two readers:

- **The implementer**: the agent that builds from the plan. It has not seen your research or the
  discussion behind the plan. The plan is mainly for this reader.
- **The reviewer**: the person or agent that compares the finished work against the plan.

A plan hands over what you learned and what was settled, so the implementer builds the right thing
without working it out again. It gives the shape of the design: the main types, the interfaces, and
how the new code joins the code already there.

Write a plan just before the work it covers is built. Detail stays true when the code it describes
is the code the implementer will find.

## Learn the code first

Read the code the plan rests on before writing. For a broad survey, sub-agents can each take an
area and report what exists, with `file:line`. For a narrow one, read it yourself. Either way, read
for yourself anything the design depends on: a plan that is wrong about existing code misleads the
implementer more than one that says nothing.

Follow the goal from start to finish. Take what must be true when the work is done and walk every
step it passes through, including code the plan will not change. A limit there defeats the goal as
surely as one in the code you edit.

Run code when that is the cheapest way to learn how it behaves. When the design depends on
something you could not confirm by reading, test it now if a small test will do.

## One file or a folder

- **One plan**, when the whole design can be laid out now: `design/plans/<date>-<topic>.md`.
- **A folder**, when the work has phases and the later ones depend on what the earlier ones build,
  so their plans are better written later: `design/plans/<date>-<topic>/` with `overview.md` and a
  plan for each phase, named `<n>-<what-it-delivers>.md`. The number only sorts. A phase simple
  enough to build from its row in the overview doesn't need a file.

## One plan

Typically under 1,500 words, code sketches aside. That is a guide, not a limit: shorter is fine,
and a reason or a change in behaviour is never cut to fit. The sections run from the idea to the
detail.

- **Goal.** What works when this is done, in plain words. The pass condition as a short table when
  a brief gives one.
- **Approach.** How it works, in plain words: what happens today and what happens after. Then, set
  apart and before the other choices, anything that will behave differently beyond the goal itself:
  for each, what happens today, what happens after, and what the alternative would have kept. A
  reader who skims must not miss these. Then what is settled and why, so the implementer follows it
  and the reviewer knows what was intended. If an alternative was seriously considered and
  rejected, name it in one line with the reason, so it is not tried again. There may be several, or
  none.
- **Design.** The shape of the new code, sketched as code wherever that is clearer than prose: the
  main types, the interfaces between the pieces, and where it lives. At each point where it joins
  existing code, give the pointer and any trap you found there. In a fork, name the upstream files
  it edits. Sketch signatures and fields; leave bodies to the implementer. Before sketching code,
  invoke the skills the repo has for that language, and its `code-naming` skill if it has one, so
  the names, types and interfaces follow their rules.
- **Suggested breakdown.** The work by pull request, in merge order: a table, then a numbered list
  of notes. Every plan has one, a phase plan included, even when the work is one pull request.
- **Success criteria.** 2 to 5 lines per pull request. Each names a behaviour and the test that
  shows it. The reviewer reads the result against these.

On the breakdown:

- The table has the columns `#`, `Name`, `Complexity`, `Risk` and `Dependencies`:

  ```markdown
  | # | Name | Complexity | Risk | Dependencies |
  |---|---|---|---|---|
  | 1 | The limiter config is renamed | 1 | 1 | None |
  | 2 | The per-route limit table | 3 | 2 | None |
  | 3 | Requests are limited per route | 4 | 4 | [1-2]: reads the limit table (2) |
  ```

- Complexity and risk are each 1 to 5. Complexity is how complex the pull request is to implement:
  clear prior art to port from lowers it. Risk is what breaks if it is wrong: stored data or
  security is high, a metric is low.
- Dependencies is `None`, or in brackets every earlier pull request it waits for, not only the
  direct ones, then a colon and which of them it uses directly. A row that waits on 3, which waits
  on 1 and 2, lists `[1-3]`, not `[3]`; consecutive numbers are a range, `[1-3]`, not `[1,2,3]`.
  Outside dependencies, such as another plan's pull requests, are named in words after the colon.
  Write each row in full, so it reads on its own.
- The numbered list follows the table, one note per pull request for what a row cannot hold: the
  changes it makes, what makes it complex or risky, and a rough size.
- It is a suggestion. The implementer may change it as the code requires.
- The rough size is information, so an oversized piece shows before it is built. It is not a
  limit. Size and stacking follow the `pr` skill.
- Each pull request leaves main correct when merged alone.
- Renames and refactors the design needs come first.
- When the design depends on something not yet confirmed, the pull request that proves it comes
  before the work that depends on it.

What the plan does not state is the implementer's call.

## A folder of plans

An overview holds what spans the phases, and each phase gets a plan of its own.

A new overview comes with the plan for its first phase, in the same pull request. Write another
phase's plan when asked to, or when that phase is next to be built.

### The overview

Written up front, typically under 1,500 words. It leaves each phase's detail to that phase's plan.

- **Goal.** As in one plan, for the whole work.
- **Approach.** How the whole design works: the main pieces, what flows between them, and where
  they sit in the existing code, with one diagram or a today-and-after table. Then the choices that
  hold across phases, each with its reason. Sketch a type or an interface here when several phases
  share it.
- **Phases.** A table with the columns `#`, `Name`, `Delivers`, `Dependencies` and `Hands on`,
  numbered from 1: what each phase delivers, what it waits for, and what it hands to the next.
  Later phases can be one line each. Dependencies has the form of the breakdown's, for phases.

The Phases table is the record of what blocks what. Derive dependencies from interfaces: if phase B
calls or changes anything phase A adds, B uses A. The brackets list every earlier phase the row
waits for, so a chain reads at a glance; the text after the colon says which of them it uses
directly. Phases that depend on nothing from each other and edit no file in common can be built at
the same time.

### A phase plan

A phase plan is one plan, as above, for a single phase, with these differences:

- It is written against main as it is when the phase is about to be built. Because it is written
  then, it can be specific.
- It opens with **Delivers** in place of Goal: two or three sentences, and a link to the overview.
- It repeats nothing from the overview. Its Approach holds only what is settled for this phase.
- It typically runs under 1,000 words, code sketches aside.

## Write for a reader who was not there

- Define each term where it first appears. No single-letter shorthand and no bare phase numbers:
  name the thing.
- Give the reason for every number and every limit.
- Show the concrete thing: the type as code, a sample of the output, a today-and-after table.
- State what is settled as plain statements. Questions are answered in the plan's pull request
  before it merges, so the merged plan holds none, and no names of people.
- A choice made to avoid editing upstream or vendored code says so, with what the edit would have
  been.

## Leave out

- Status tables, checkboxes and links to merged pull requests. The issue tracker holds status.
- Verification commands that the repo's CLAUDE.md or AGENTS.md already gives.
- How the plan was arrived at.
- A list of what is out of scope or left for later. Later work belongs in the issue tracker. Where
  the implementer could reasonably build something the plan means to leave alone, say so in one
  line at that point in the Approach or Design.

## Check it against the code

Before opening, have an agent that did not write the plan check it once against the code: every
claim about existing code, each sketch against the code it joins, and the overview's Dependencies
column against real interfaces. Where the tool can't start a sub-agent, do the check in a fresh
session. Fix what it finds, then open.

## Open it

Open the plan as its own pull request, with no code in it, following the repo's PR rules and the
`pr` skill. The body gives the goal in two sentences and lists anything that needs an answer before
the plan merges. A different agent builds from the plan once it merges; the repo's CLAUDE.md or
AGENTS.md says what that agent may change.
