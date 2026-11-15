---
name: pr
description: Write a pull request's description and its squash commit message so a reviewer can understand the change quickly. Use when opening a PR, splitting work into PRs, stacking one PR on another, updating a PR's description, or pushing to an open PR, including from a repo's own PR skill. A repo's process rules and any template for a special kind of PR take precedence.
---

# Write a PR description

The reader reviews many PRs a day across several repos and arrives cold. They don't remember plan phases, earlier PR numbers or project terms. The description's job is to protect their attention: it should give them what they need to judge the change, and nothing they would have to read and then discard.

It does two things:

1. **Condense the change's complexity.** It turns the diff into something quick to take in, in proportion to how complex the change is. A small script change needs a sentence or two. A change across several modules needs more: a map of where it lives, or the new interface.
2. **Flag real risk, when there is any.** That means what could break, what would be hard to undo, or what could harm users, funds, consensus or stored data. When there is no real risk, say nothing about it.

The more complex or risky a change is, the more context it gets. A change that is low on both gets the least.

## Defer to anything more specific

Read the repo's CLAUDE.md, AGENTS.md and PR skills first.

- **Process rules win:** draft PRs, labels, `Closes #N`, checks to run.
- **PRs whose body a bot or workflow writes are out of scope,** such as dependency bumps or vendored-skill updates. Leave the generated body as it is.
- **Templates for a special kind of PR win.** An example is an upstream merge with its own required sections. Follow that template and use this skill only for what it leaves open.

## Where the squash commit message goes

GitHub copies the whole PR body into the squash commit. A `---` line splits the body: the person merging deletes everything above it, and the rest becomes the commit body.

- **One block** when the same few sentences serve both the reviewer and `git log`. The body is the commit body, and there is no `---`.
- **Split** when review needs much more than history does: more explanation, Key Files, API Changes, Trade-offs, Risks, or Before Merging steps. Write the reader part, then a line with only `---`, then the commit body.

Below the `---` goes only the commit body. GitHub takes the commit subject from the PR title, so don't repeat the title there, in conventional commit form or any other.

Risk, trade-offs and decision context always go above the `---`. The commit body says what the code does.

## Judge the description's size

Judge from the diff, not the line count. Forty files of renames is simple, while thirty lines in a consensus path may not be. Scripts, CI, docs and internal tooling are usually simple even at a few hundred lines.

Default to the smallest form that works. Include what the reviewer needs to judge the change, and leave out what they would only check by reading the diff. Before adding a sentence, ask whether the reviewer would miss it.

Size targets, as a ceiling rather than a goal. Code blocks don't count toward them, but trim them to what matters.

- **One-block body:** about 60 words. A low-risk change, such as CI, scripts, config or tooling, needs only two things: what it does, and the sentence that bounds it. That is usually 2 or 3 sentences, or a lead sentence and up to 3 short bullets.
- **Each reader section in the larger structure:** 1 to 3 sentences or bullets.
- **The whole reader part of a large change:** about 300 words.
- **Commit body:** at most 60 words, in at most 4 bullets of 1 or 2 lines each. This one is firm. When more feels necessary, the extra detail belongs above the `---`.

Go over one of these only when the change truly needs it. A low-risk change never does.

Key Files and API Changes both orient the reader, so a mid-sized change needs at most one of them. A large change across several modules, around a thousand lines or more, can carry both. In that case keep API Changes to the one or two shapes that matter most.

A research, docs or design PR whose content is the point is the exception to the one-block target. Its reader part summarizes that content: the idea, what it addresses, and what the artifact shows. It then splits, with a short commit body that says what landed.

When a PR removes something that was added only days earlier, such as a feature flag or a check from the week before, call it a reversal. It is not a loss of coverage or a risk.

You will have read the diff closely and checked facts along the way. That does not make each fact worth a line. A first draft usually comes out twice as long as it should be, so cut it before posting.

## Forms

### A sentence or two

For small changes. Say what the change does, with the reason folded in. A sentence that bounds the change, such as "It only reports" or "CI output is unchanged", is often the most useful thing in the body.

```
Adds a --dry-run flag to the import command, which prints the rows it
would write and exits. Nothing is written to the database.
```

### A lead sentence and bullets

For a change made of separate, parallel pieces. The lead sentence gives the outcome, and each bullet is one piece.

```
Moves the image pipeline off the deprecated resize API, so the build
no longer warns:

- thumbnails and previews use the new resize call
- the old quality setting maps to the new compression level
- the unused crop helper is removed
```

### Too long and right-sized

The same small change, written two ways. Too long, at 110 words:

```
The nightly backup job was failing intermittently. While investigating,
we found the S3 upload timed out on archives over 2 GB, taking 31 to 47
minutes against a 30-minute limit. This raises the limit to 60 minutes
in backup.yml, renames upload_timeout to upload_timeout_minutes for
clarity, and adds a log line with the archive size. The retry helper
was also refactored to take its delay as an argument. Tested locally
with a 3 GB archive: the upload finished in 41 minutes. CI passes.

- backup.yml: timeout 30 -> 60
- upload.py: renamed setting, new log line
- retry.py: delay is now a parameter
```

Right-sized, at 25 words:

```
Raises the nightly backup's upload timeout from 30 to 60 minutes, so
archives over 2 GB finish. It also logs each archive's size.
```

The cut text was:

- the investigation and timings
- the rename and the refactor, which a reviewer sees in the diff and doesn't need to judge
- the local test and "CI passes"
- the file list

### The structure for larger changes

When a change has real complexity or risk, use this structure. Every section is optional except the summary, which has no heading. Write headings in Title Case.

```markdown
<1 to 3 sentences: what the change does and the result after merge.
Define any term a cold reader would not know.>

## Why
<1 to 3 sentences: the problem, and what goes wrong without the change.
Link a decision record or plan rather than repeating it.>

## Key Files
<For product code spread across several modules: the few files where the
real change is, in a fenced code block so the # lines don't render as
headings. Each path has its own one-line # comment above it, starting
with new: or updated:, with a blank line between entries. The note is a
short phrase, at most about 8 words, saying what the file adds or
changes, not how. Never one note over several listed paths. deleted: and
renamed: are allowed but rarely belong, since Key Files lists only the
few files where the real change is. Never the whole file list. When there
are other files, a final # comment says what they are, e.g. callers or
tests. Not for CI, scripts, config or docs changes; their summary
already says where the change is.>

## API Changes
<When an interface or data shape changes in a way the reviewer should
see: a sentence of framing, then the new shape as plain code in the
repo's language. Mark what is new or changed with short comments, not
diff markers. Show only the key types or signatures, not every one.>

## Trade-offs
<Only real trade-offs: a choice between alternatives where the one
taken gives something up. Say what was chosen, what it costs, and the
alternative. Usually one or two. Edge cases, limitations and behavior
that resolves itself are not trade-offs; leave them out unless they are
Risks.>

## Risks
<Only what could actually go wrong: breakage, something hard to undo,
or harm to users, funds, consensus or stored data. Check each one
against history before writing it; a "lost" test that never existed is
not a risk. If you can't confirm a risk, leave it out. A limitation
users will hit, such as a browser that isn't supported, goes here. An
unexplained measurement from the investigation is diagnosis, not a
risk.>

## Before Merging
<Only when the reviewer or the person merging must do something first,
such as create an external account, set a secret, or run a check CI
can't run. One line per step.>

---

<commit body>
```

Key Files example:

```
# new: joins scheduler and builder reports by epoch and height
crates/core/src/settlement_timings/ledger.rs

# updated: stamps each settlement stage
crates/core/src/execution_scheduler/settlement_scheduler.rs

# updated: times checkpoint builds, minus the five waits
crates/core/src/checkpoints/mod.rs

# the rest: metric wiring, tests, plan, decision record
```

API Changes example:

> Rate limits are now set per route instead of globally, so `Limiter::new` takes a route table:
> ```rust
> // new: one limit per route, with a default for the rest
> pub struct RouteLimits {
>     pub default: u32,
>     pub overrides: HashMap<Route, u32>,
> }
>
> impl Limiter {
>     pub fn new(routes: RouteLimits) -> Self // was new(requests_per_minute: u32)
> }
> ```
>
> Write the code as it reads after the change, with comments marking what is new or what it replaced. Don't use `+` and `-` lines; this is not a diff.

Trade-offs example:

```
Sessions are stored in the database rather than in signed cookies, so
they can be revoked. Each request now makes one more database read.
```

Risks example:

```
Existing exports are read with the new schema. An export written by
the old version that has no currency column fails to load, and there
is no migration.
```

## Leave out

- How the problem was found, and the story of the work
- Review history, fixes made in response to review, and declined suggestions (put a declined one in Trade-offs only if the reviewer would raise it again)
- Diagnosis: timings, logs, what was measured while finding the problem
- Tests and checks that were run, by CI or by hand. A check belongs in Before Merging only when someone still has to do it, or in Risks when a known gap remains.
- Secondary internal changes in a low-risk PR, such as renames, refactors or helper tweaks, which the reviewer sees in the diff. Leave them out of the commit body too.
- Test names, file lists, and restating the diff
- Claims you could not confirm
- Bare PR numbers, issue IDs and plan phases as context at the top. Put links in Why or at the end.

## The squash commit body

- **Declarative.** It states what the code does after the change, as facts: "The importer skips rows with no id." It doesn't tell a story ("X used to...", "while working on Y we found..."). Give a reason only when it isn't obvious, in at most one clause.
- **Scaled.** For a small change, write one or two sentences, or a lead sentence and bullets. For a larger change, use at most 4 bullets of 1 or 2 lines each, or a short paragraph: about 60 words either way. Each bullet is one behavior change. The details stay in the reader part.
- **No file paths**, unless the change is about that file, such as a new script or workflow.
- **Plain text that reads well raw.** Use paragraphs, `- ` bullets and inline backticks. No headings, bold, links or tables: `git log` shows them as literal characters, and lines starting with `#` are deleted when git opens an editor on the message.
- **Wrapped at 72 columns.** The subject is the PR title in conventional commit form. The body starts with its first sentence or bullet, never with the title. Keep `Closes #N` or `Part of #N` on its own line at the end.

## Before posting

Reread the body as the cold reviewer:

- Does the first sentence say what the change does?
- Would they miss each sentence if it were gone?
- Is every claim checked against the diff and the repo's history?
- Is the body within the size targets? If not, does the change truly need more?
- Is the body longer than they need in order to judge the change with confidence? If so, cut it.

## Watch CI after pushing

After opening a PR or pushing to one, watch the checks on its latest commit until they finish. Checks on earlier commits don't matter.

```
timeout 30m gh pr checks <pr> --watch --fail-fast --interval 30 >/dev/null; echo "exit=$?"
gh pr checks <pr>
gh run view <run-id> --log-failed
```

- The first command blocks and prints one line: `exit=0` means every check passed, `1` a check failed, `124` the timeout ran out. Run it in the background so the session isn't stuck.
- Wait about 30 seconds after a push: until the new commit's checks register, gh reports none of them (exit 1) or only the ones already started. If none appear after a few minutes, the workflows' path or event filters skip this change, and there is nothing to watch.
- Green: you're done, stop checking. Red: run `gh pr checks <pr>` once for the table, whose links carry the run ID, read the failed steps' log, fix what the change broke, push, and watch again.
- On a timeout, check once without `--watch` (exit 8 means still pending). If checks are still running, watch again, up to about twice the repo's usual CI time. If a check hasn't started after 15 minutes, report it as a runner or queue problem and stop.
- When the failure isn't caused by the change, such as a flaky test or main already red, say so in a PR comment rather than changing unrelated code.
- A draft PR may run fewer checks than a ready one, so watch again after marking it ready.

## Split work into PRs

Size each PR so the reviewer can read it in one sitting. The aim is throughput: never split so finely that merges slow down.

Count every added and removed line the reviewer reads, weighted the same: code, tests, scripts, config, plans and other Markdown. Lockfiles, generated files, snapshots and code merged in from upstream don't count.

- **Under 800 lines:** one PR. Don't split it for size.
- **800 to 1,200 lines:** split when the work holds separate ideas that review well on their own.
- **Over 1,200 lines:** split by idea. Rarely, keep it whole and give a one-line reason in the description.

Independent pieces go off main as separate PRs. Stack only a piece that truly builds on another, within the two-level rule below. Work that would need a longer chain groups into fewer, larger PRs.

## Stacking a PR on another

Stack at most two levels: one unmerged PR and one on top of it. Stack only on a PR that has finished its code reviews and been marked ready (not a draft), so its branch rarely changes.

- **Create the stack with `gh stack`** (`gh extension install github/gh-stack`). Open the upper PR, then link the pair with `gh stack link <lower-pr> <upper-pr>`, which also sets the upper PR's base. When the lower PR merges, GitHub rebases the upper branch onto main and retargets it. That force-pushes the branch, so run `git pull --rebase` before committing to it again.
- **When GitHub doesn't**, because the PR isn't in a GitHub stack or the rebase conflicts: if it is still in a stack, remove it with `gh stack unstack <stack-number>`, since stacks require linear history. Then merge main into the upper branch (merge, not rebase), push, and retarget it with `gh pr edit <upper-pr> --base main` if its base hasn't moved yet.
- **Merge a stacked PR from its merge box or with `gh stack merge <pr> --squash`.** Merging the upper PR also merges the lower one. `gh pr merge` can't merge a stacked PR, auto-merge isn't available, and the squash message can't be edited, so delete the part above `---` from the PR body before merging.
