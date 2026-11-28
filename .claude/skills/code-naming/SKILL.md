---
name: code-naming
description: Rules for naming things in code, in any language. Invoke when planning code changes or reviewing code, including before opening a PR. Planners read the rule index and open a rule file when unsure. Reviewers read every rule file and run the naming pass.
---

# Code Naming

Rules for picking names that tell the reader what a thing is. Each rule is a separate file in `rules/` with the directive, why it holds, what to check, and its limits.

## Principles

- **A name reveals what the thing is, what it does, or what it is for.** The reader meets the name before the code behind it. A name that says something else, or nothing, makes them work out what the thing is before they can think about what it does. Every gap between name and thing is a cost paid at every place the name is read.
- **Lean slightly more explicit, but not pedantic.** Between two accurate names, pick the one a reader understands with less context, even if it's a few characters longer. Stop adding words once the reader needs no extra step where they read the name. Words the surrounding type, module, path or field already say are noise.
- **A name earns its place on its own merits.** A word isn't right because an earlier commit, a spec draft or an agent used it first. If it fails these rules, rename it while renaming is cheap.

Every rule below is one way to apply these principles.

## Rules

- [`say-what-it-is-now`](rules/say-what-it-is-now.md): Name the thing's role or contents as they are today, not its mechanism, its origin, how it was built, or a role it may take later.
- [`no-false-readings`](rules/no-false-readings.md): A name must not suggest something the thing isn't or doesn't do: a wrong type, a wrong part of speech, a wrong effect, or a connotation from the field that doesn't hold.
- [`one-concept-one-word`](rules/one-concept-one-word.md): Use one word for one concept everywhere (code, schema, wire format, docs, spec, UI), and avoid giving one word two meanings, in the codebase or in the field.
- [`domain-noun-unless-in-context`](rules/domain-noun-unless-in-context.md): Give generic verbs and nouns their object or domain; drop words the enclosing type, module, field, path or URL already supplies.
- [`field-or-plain-words`](rules/field-or-plain-words.md): Use the field's standard term or an everyday word, never a word coined in the session, internal jargon or an abbreviation the field doesn't use.

## How to Apply

### When Planning

- Read the rule index above before naming anything in a plan or design. Open a rule's file whenever you're unsure whether or how it applies.
- Before you name a thing, say in one plain sentence what it is or does. Build the name from that sentence, not from how the code works.
- In a plan or design doc, apply the rules to every name the plan sketches, so code written from it already complies.
- When a rename is right, rename the thing everywhere it appears in the same change.
- Cite rules by id (e.g. "per `no-false-readings`, ...") so the reasoning can be traced.

### When Reviewing: the Naming Pass

Read every file in `rules/` in full first. Then, for each name the change adds or renames, and each existing name whose meaning the change alters:

1. Read the code behind the name and say in one sentence what the thing is or does, without leaning on the name.
2. Compare the name with that sentence. Note any gap: a role the name leaves out, a meaning it adds, a word it repeats from the context.
3. Check the name against each rule.
4. For each problem, propose a replacement and say which rule it serves.

Report:

- **Renames:** each name with its location, the rule id, the proposed name, and the one-sentence description it was built from.
- **Checked, clean:** the count of names checked with no problem.

A name that is accurate but could be marginally better is not a finding. Raise it only when the gap would cost a reader a step.

## Related Skills

- `rust-dev`: its type rules carry meaning that names alone can't, such as newtypes and enums in place of bools. Apply both when naming Rust types.
