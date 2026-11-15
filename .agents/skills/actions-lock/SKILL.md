---
name: actions-lock
description: Keep .github/workflows/actions.lock in sync with the workflows. Use when adding or editing a workflow, changing a `uses:` line, bumping an action, or setting up CI in a repo that has an actions.lock.
---

# Actions lock

Applies only in a repo that has `.github/workflows/actions.lock`; don't create one otherwise. The lockfile pins every action the workflows use, and every action those use, to a verified commit. `gh actions-lock` generates it; never edit it by hand.

- After adding a workflow or changing a `uses:` line, run `gh actions-lock` and commit the lockfile with the workflow. CI runs `gh actions-lock --verify`, which fails when the two disagree.
- Install the extension at the version CI pins: `gh extension install github/gh-actions-lock --pin v0.4.1`. A newer version can write a lockfile format CI's copy can't read. Bump the pin in CI and everywhere else it appears, such as CLAUDE.md, together.
- `gh actions-lock` rewrites a partial tag (`@v4`) to the newest full tag (`@v4.2.1`). Check that tag's age against the repo's release-age wait, such as Dependabot's `cooldown`. If it is too new, set `uses:` to an older full tag and rerun.
- If the repo's allowed-actions setting blocks an action, report it instead of working around it.
