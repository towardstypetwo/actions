# Split work into PRs and stack them

Size each PR so the reviewer can read it in one sitting. The aim is throughput: never split so finely that merges slow down.

Count every added and removed line the reviewer reads, weighted the same: code, tests, scripts, config, plans and other Markdown. Lockfiles, generated files, snapshots and code merged in from upstream don't count.

- **Under 800 lines:** one PR. Don't split it for size.
- **800 to 1,200 lines:** split when the work holds separate ideas that review well on their own.
- **Over 1,200 lines:** split by idea. Rarely, keep it whole and give a one-line reason in the description.

Independent pieces go off main as separate PRs. Stack only a piece that truly builds on another, within the two-level rule below. Work that would need a longer chain groups into fewer, larger PRs.

## Stack a PR on another

Stack at most two levels: one unmerged PR and one on top of it. Stack only on a PR that has finished its code reviews and been marked ready (not a draft), so its branch rarely changes.

- **Create the stack with `gh stack`** (`gh extension install github/gh-stack`). Open the upper PR, then link the pair with `gh stack link <lower-pr> <upper-pr>`, which also sets the upper PR's base. When the lower PR merges, GitHub rebases the upper branch onto main and retargets it. That force-pushes the branch, so run `git pull --rebase` before committing to it again.
- **When GitHub doesn't**, because the PR isn't in a GitHub stack or the rebase conflicts: if it is still in a stack, remove it with `gh stack unstack <stack-number>`, since stacks require linear history. Then merge main into the upper branch (merge, not rebase), push, and retarget it with `gh pr edit <upper-pr> --base main` if its base hasn't moved yet.
- **Merge a stacked PR from its merge box or with `gh stack merge <pr> --squash`.** Merging the upper PR also merges the lower one. `gh pr merge` can't merge a stacked PR, auto-merge isn't available, and the squash message can't be edited, so delete the part above `---` from the PR body before merging.
