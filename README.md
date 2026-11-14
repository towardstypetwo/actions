# actions

Composite GitHub Actions used by Towards Type Two's repositories.

## npq-check

Runs [npq](https://github.com/lirantal/npq) in its audit-only `--json` mode on each direct dependency a pull request adds or changes, at the version `pnpm-lock.yaml` resolves. npq errors fail the step unless `package.json` lists an exception; warnings show as annotations. The action installs its own pinned npq.

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
  uses: towardstypetwo/actions/npq-check@v1
- run: pnpm install --frozen-lockfile
```

Run it before `pnpm install`. It compares the lockfile with `HEAD^1`, the base branch on a pull request's merge commit, which is what actions/checkout checks out; the `base` input sets another commit.

Exceptions go in `package.json`, and a failing step prints the entry to add:

```json
"npq": {
  "allow": [
    { "package": "sv", "check": "typosquatting", "reason": "the official Svelte CLI, built from sveltejs/cli", "date": "2026-11-14" },
    { "package": "some-package", "version": "1.2.3", "check": "author", "reason": "a maintainer listed in the project's repository", "date": "2026-11-14" }
  ]
}
```

- `check` is the npq check's name. A `typosquatting` exception covers every version of the package; other checks need the exact `version`.
- An install-scripts finding passes when pnpm's `allowBuilds` or `permissions` turns that package's build off.
- Malicious-package findings, npm's security placeholder, checks npq couldn't finish, and dependencies that don't come from registry.npmjs.org can't be allowed.
- Transitive dependencies aren't checked.

## skill-copies

Fails when `.agents/skills` differs from `.claude/skills` in any file's path, contents or mode, and lists the files that differ. It reads the checked-out commit, so `actions/checkout` runs first; the `rev` input compares another commit, which must already be fetched.

```yaml
- uses: actions/checkout@v7.0.1
  with:
    persist-credentials: false
- uses: towardstypetwo/actions/skill-copies@v1
```

## Versions

Releases are tagged `vX.Y.Z` on main, and `vN` points at the latest release of each major version.

## Development

Run `pnpm install --dir npq-check --ignore-scripts`, then `node --test npq-check/check.test.mjs`. Test skill-copies with `bash skill-copies/check.test.sh`.
