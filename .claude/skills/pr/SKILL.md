---
name: pr
description: Carry a pull request from draft to ready, and write its description and squash commit message. Covers reviewing a change at the depth its kind needs, reviewing the fix commits, running scripts, CI and infra changes for real, watching CI, replying to comments and marking the PR ready. Use when opening a PR, reviewing your own PR, marking a PR ready, updating a PR's description, pushing to an open PR, splitting work into PRs or stacking one PR on another, including from a repo's own PR skill. A repo's process rules and any template for a special kind of PR take precedence.
---

# Pull requests

The person who reviews the PR reads many a day across several repos and arrives cold. Before the PR is marked ready, its bugs have been found and fixed, a change that only a real run can prove has been run, and its description says what the reviewer needs to judge it and nothing more.

## Defer to anything more specific

Read the repo's CLAUDE.md, AGENTS.md and PR skills first.

- **Process rules win:** draft PRs, labels, `Closes #N`, checks to run.
- **PRs whose body a bot or workflow writes are out of scope,** such as dependency bumps or vendored-skill updates. Leave the generated body as it is.
- **Templates for a special kind of PR win.** An example is an upstream merge with its own required sections. Follow that template and use this skill only for what it leaves open.

## From draft to ready

Work through these in order. The sections below give each step's checklist.

1. **Prepare the change.** If the repo has a `code-naming` skill, run its naming pass on every name the change adds or renames. Cut doc and comment text in the change to what a reader needs.
2. **Open a draft PR.** Read [reference/description.md](reference/description.md) before writing the description or editing any PR body. To split the work into several PRs or stack one on another, read [reference/split-and-stack.md](reference/split-and-stack.md) first.
3. **Review the whole PR once,** at the depth for its kind of change. Start right after opening the draft, without waiting for its CI.
4. **Fix the findings you agree with.** Keep a list of the ones you decline, each with a one-line reason.
5. **Review only the fix commits,** with the declined findings in the prompt, until a round finds nothing that is a bug. Lean laws skip this step.
6. **Run the change for real** if it is a script, CI or infra change, or note why the run was skipped.
7. **Reply to every review comment** that has no reply.
8. **Watch CI** on the commit you will mark ready. A push after this, such as a fix for a comment, means watching CI again.
9. **Mark it ready** with `gh pr ready`, then watch any checks the repo runs only on ready PRs.

What was run, what the review changed and the findings declined go in your report to whoever asked for the work, not in the PR body. A declined finding goes in the description's Trade-offs only if the reviewer would raise it again.

## Review depth

Pick the depth from what the change touches, not from its size. A PR that mixes kinds gets the depth of its deepest part.

- **Deep**, the default for any change with code: scripts, hooks, CI workflows, config, infrastructure, product code and tests. One full review, then the fix-commit rounds.
- **Deep, one round:** Lean laws. One full review, and no fix-commit rounds; the Lean kernel and the axiom check cover the proofs.
- **Standard:** docs that agents run or follow, such as skills, CLAUDE.md, AGENTS.md and READMEs with commands. Fix-commit rounds also run at this depth, with the checklist for the PR's kind.
- **Light:** a copy of a change already reviewed elsewhere, such as the same edit rolled out to more repos.
- **None:** prose that nobody runs or follows, such as reports and design notes. A plan gets the check its planning skill asks for instead.

A finding counts when it is a bug: wrong behavior, a crash, a security hole or a broken build in plausible use. Style, wording and hardening against cases nobody will hit don't count. Each finding gives the file and line, the input or state that triggers it, and what goes wrong.

The review checks, by depth:

- **Deep:**
  - Each changed function does what its name and its callers expect, including empty, missing and error cases.
  - Each call to an outside tool or service (`gh`, `git`, cloud CLIs, HTTP APIs) handles what it really returns: errors and where they are printed, exit codes, pagination and limits, and differences between platforms such as GNU and BSD tools.
  - Nothing depends on the date, time zone, locale or an unset environment variable without meaning to.
  - Tokens, secrets and permissions: least privilege, nothing secret is logged or committed, and input from a PR or user can't reach a shell unquoted.
  - A rerun, a run in parallel or a failure partway leaves state that the next run can recover from.
  - Tests fail when the code is wrong.
  - The rules in the repo's CLAUDE.md or AGENTS.md and its language skill hold.
- **Deep, Lean laws:** each law states the spec it claims, no weaker; names say the claim; types model the domain, such as an inductive rather than a `Bool`, or an `Except` that carries the reason.
- **Standard:** each command runs as written (flags, paths, quoting); each rule agrees with the code and with the other rules; nothing a reader follows leads them to a wrong action.
- **Light:** the copy matches the reviewed change, and each difference is one the target needs.

## Review the fix commits

After fixing the first review's findings, review only what the fixes changed:

```
git log -p --first-parent --no-merges <reviewed-head>..HEAD
```

`<reviewed-head>` is the commit the previous round read: the first review's for the first round, then each round's own HEAD. `--first-parent --no-merges` leaves out commits merged in from the base branch. Outside a stack, merge the base between rounds rather than rebasing; a stacked branch keeps linear history, so it is rebased. After a rebase, `<reviewed-head>` is no longer in the branch's history: run `git range-diff $(git merge-base <reviewed-head> origin/<base>)..<reviewed-head> origin/<base>..HEAD`, take the new commit it pairs with `<reviewed-head>`, and use that as `<reviewed-head>` in the `git log` range, since range-diff prints no patch for commits that are new. Put the declined findings in the prompt so the round doesn't raise them again. Fix the bugs it finds, then review the new fix commits the same way. Stop when a round finds nothing that is a bug; other findings don't start another round. A deep review always finds something, so rerunning the full review until it comes back clean never ends.

A new full review is only for a rework the person reviewing the PR asked for.

## Run it for real

Review reads the code but can't show how the real tool or service answers. For scripts, CI and infra, run the smallest real exercise that fits before marking the PR ready:

- **Script:** run it once on one real input. If it writes, use its `--dry-run` or a scratch target, but only a dry-run flag its usage or source shows it has; a script that ignores unknown flags does the real writes.
- **CI workflow:** let the PR's own run exercise it when it runs on `pull_request`; a `pull_request_target` run uses the default branch's copy, so it doesn't count. Otherwise, for a workflow that only reads or checks, run it with `gh workflow run <file> --ref <branch>`, which works only when the workflow has a `workflow_dispatch` trigger and is already on the default branch. Skip a workflow that publishes, deploys or writes to other repos, and a new one without a PR trigger.
- **OpenTofu or Terraform:** `tofu plan` against the real backend.
- **Hook or tool config:** trigger it once.

Skip the run when it takes too long, costs real money or needs access you don't have, and say in your report why. When someone still has to run it, it goes in the description's Before Merging.

## Review, then watch CI

Start the code review as soon as the draft PR is open, without waiting for its CI. Review fixes usually replace that commit, so its CI result would be thrown away.

Watch CI on the commit you will mark ready, after the review fixes are pushed. On a PR that is already ready, watch each push. Don't watch commits a later push will replace.

Watch with `scripts/watch-ci.sh` in this skill's directory, run by its path from the PR branch's checkout, for example `bash .agents/skills/pr/scripts/watch-ci.sh`. It takes an optional PR number and defaults to the current branch's PR. It waits for the checks to register and watches them, for up to 9 minutes in all, so run it in the foreground with the shell tool's time limit above that, and don't write a polling loop of your own. If the tool can't wait that long, pass `--minutes N` below its limit.

It ends with one line that says what to do next. The exit code is:

- `0`: every check passed or was skipped. Stop watching.
- `1`: a check failed or was cancelled; the line names each one and its run ID.
- `2`: `gh` failed or the arguments are wrong.
- `3`: no checks registered; the workflows' filters skip this change.
- `4`: the checkout isn't at the PR's head commit.
- `5`: checks are still running. Run it again.

In Claude Code, the review is `/code-review`, and the script is `.claude/skills/pr/scripts/watch-ci.sh`. Set the Bash tool's `timeout` to `600000` for the watch and leave `run_in_background` off; the default 2-minute limit is shorter than the watch.

## Reply to comments

Before marking the PR ready, and after each push to a ready PR, read its review comments:

```
gh pr view <N> --comments
gh api --paginate repos/{owner}/{repo}/pulls/<N>/comments --jq '.[] | {id, in_reply_to_id, user: .user.login, path, line, body}'
```

Reply to each comment that has no reply, saying what changed or why not. Write the reply to a file outside the checkout, such as a temp file, since backticks and `$` in an inline body are run by the shell:

- **Inline comment:** `gh api repos/{owner}/{repo}/pulls/<N>/comments/<root-id>/replies -F body=@<file>`. `<root-id>` is the thread's first comment: the comment's `in_reply_to_id` when it is set, else its `id`. GitHub doesn't accept a reply to a reply.
- **Conversation comment or review summary:** `gh pr comment <N> --body-file <file>`.

A comment that needs a person's decision, such as on design, scope or protocol behavior, gets the options as its reply and stays open.

## How each agent does it

### Claude Code

- The skill is at `.claude/skills/pr/`.
- Run the first review as `/code-review <level> <PR>`: deep is `xhigh`, standard `high` and light `medium`. It runs on the session's model.
- Run each fix-commit round in a sub-agent (the Agent tool) at effort `high`, with the `git log` range above, the checklist for the PR's kind and the declined findings in its prompt.

### Gemini CLI, and agents without a review command

Any agent without a review command, such as Codex, Cursor or Copilot, follows the review bullets here.

- Gemini loads `.agents/skills/pr/SKILL.md` without any setup, and parses only the `name` and `description` frontmatter fields. Activating the skill asks for consent; a headless run (`gemini -p`) needs `--approval-mode=yolo` or a policy that allows `activate_skill` and shell commands, or it can't load the skill or run `git`.
- There's no second reviewer. Review your own PR in one pass with the checklist for its depth, over `gh pr diff <N>`, then over each round's fix commits with the `git log` range above and the declined findings in mind. Write every finding down before fixing any of them, so the pass reads the whole diff first.
- The `code-review` extension can't take a depth or a commit range; use the checklist pass instead.
- Watch CI with `bash .agents/skills/pr/scripts/watch-ci.sh`, passing `--minutes N` below the shell tool's time limit if it has one.
