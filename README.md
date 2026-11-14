# actions

Composite GitHub Actions shared by Towards Type Two's repositories. They are built for those repositories' setup (pnpm, Node 24, `actions.lock`) and aren't a general-purpose product: there is no support, and the inputs can change between major versions.

## npq-check

Runs [npq](https://github.com/lirantal/npq) in its audit-only `--json` mode on each direct dependency a pull request adds or changes, at the version `pnpm-lock.yaml` resolves. npq errors fail the step, unless `package.json` lists an exception; warnings show as annotations. The action installs its own pinned npq, so the checked repo doesn't need one.

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

Run it before the repo's own `pnpm install`, so the dependencies under review haven't run any code yet. It compares with `HEAD^1`, the base branch on a pull request's merge commit (actions/checkout's default), and fails on any other checkout unless the `base` input names a commit.

An exception goes in `package.json`, and the failing step prints the entry to add:

```json
"npq": {
  "allow": [
    { "package": "sv", "check": "typosquatting", "reason": "the official Svelte CLI, built from sveltejs/cli", "date": "2026-11-14" },
    { "package": "some-package", "version": "1.2.3", "check": "author", "reason": "a maintainer listed in the project's repository", "date": "2026-11-14" }
  ]
}
```

- `check` is npq's name for it. A `typosquatting` exception holds for every version; every other check needs the exact `version` it was reviewed at.
- An install-scripts finding passes without an entry when pnpm's `allowBuilds` or `permissions` turns that package's build off.
- These can't be allowed: malicious-package findings, npm's security placeholder, a check npq couldn't finish (re-run instead), and a dependency that doesn't come from registry.npmjs.org.
- It doesn't check transitive dependencies, pnpm config dependencies or pnpmfiles, and an OSV outage reads as no vulnerabilities, so keep `pnpm audit` as the vulnerability gate.

## Versions

Releases are tagged `vX.Y.Z` on main, and `vN` moves to the latest release of each major version. Pin a full tag, or a commit through `gh actions-lock`, to get a release that doesn't change under you.

## Development

`pnpm install --dir npq-check --ignore-scripts`, then `node --test npq-check/check.test.mjs`. `test.yml` runs both on every pull request.
