# actions

Composite GitHub Actions for towardstypetwo repos. The repo is private; its Actions access setting lets repositories in the towardstypetwo organization use its actions. Consumers name an action by its full version tag and pin it in their `actions.lock`.

## npq-check

Runs [npq](https://github.com/lirantal/npq) in its audit-only `--json` mode on each direct dependency a pull request adds or changes, at the version `pnpm-lock.yaml` resolves, by comparing the lockfile with the base commit's. npq errors fail the step; warnings show as annotations on `package.json`.

The action installs npq itself, from `npq-check/package.json` and its lockfile under the install policy in `npq-check/pnpm-workspace.yaml`, so the checked repo needs no npq of its own. It needs a single-project pnpm repo, pnpm and Node 24 on the runner, and a checkout with `fetch-depth: 2` so the base commit is there.

```yaml
- uses: actions/checkout@v7.0.1
  with:
    persist-credentials: false
    fetch-depth: 2
- uses: pnpm/action-setup@v6.1.1
- uses: actions/setup-node@v7.1.0
  with:
    node-version: 24
- name: Check new and changed dependencies with npq
  if: github.event_name == 'pull_request'
  uses: towardstypetwo/actions/npq-check@v1.0.0
- run: pnpm install --frozen-lockfile
```

Run it before the repo's own `pnpm install`: it reads only the lockfile and pnpm's config, and running first keeps the dependencies under review from running any code before they are checked. On `pull_request`, checkout gives the merge of the PR into its base, so the default `base` input, `HEAD^1`, is the base branch; the step fails when HEAD isn't a merge commit. Put it in the job that is already a required status check.

### Exceptions

A false positive gets an entry in the `allow` list under `npq` in `package.json`, in the same PR:

```json
"npq": {
  "allow": [
    {
      "package": "sv",
      "check": "typosquatting",
      "reason": "the official Svelte CLI, built from sveltejs/cli with npm trusted publishing",
      "date": "2026-11-14"
    },
    {
      "package": "some-package",
      "version": "1.2.3",
      "check": "author",
      "reason": "first release by a maintainer listed in the project's repository",
      "date": "2026-11-14"
    }
  ]
}
```

- `check` is npq's name for the check, as the error prints it.
- A `typosquatting` exception is about the name, so it doesn't take a `version` and holds for every version. Every other check needs the exact `version` it was reviewed at, so an upgrade needs a new entry.
- An install-scripts (`scripts`) finding passes without an entry when pnpm's config skips the package's builds (`allowBuilds` sets it, or `name@version`, to false, or `permissions.<name>.build` is false, which wins), since pnpm then never runs the script.
- `reason` says why the finding doesn't apply, as a fact a reviewer can check. `date` is the day the entry was added.
- These can't be allowed: "Malicious package found", npm's security placeholder, a check npq couldn't finish (a rate limit or an outage), which needs a re-run, and a dependency that doesn't resolve to its own tarball on registry.npmjs.org (git, a tarball URL, `link:`), which npq can't check.
- The step prints a notice for an entry whose package or version is no longer a direct dependency.

### What it doesn't cover

- Transitive dependencies, including ones a PR adds through `overrides` or `packageExtensions`.
- Some npq checks pass quietly when their service is down: an OSV outage reads as no vulnerabilities, so `pnpm audit` stays the vulnerability gate.
- npq's `author` check errors on a version 7 days old or younger, rounded to whole days, so a version just past pnpm's 7-day wait can fail it for a few hours. Re-run the job the next day.
- The check names it accepts are those of the npq in `npq-check/package.json`; review `CHECKS` in `check.mjs` when that npq changes.

## Development

Run `pnpm install --dir npq-check --ignore-scripts`, then `node --test npq-check/check.test.mjs`; `test.yml` runs both on every PR. Release by tagging `vX.Y.Z` on main, then move each consumer's `uses:` line to it and run `gh actions-lock` there. Dependabot can't propose these bumps unless the organization lets it read private repositories.
