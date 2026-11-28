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

## check-skills-aligned

Fails when `.agents/skills` differs from `.claude/skills` in any file's path, contents or mode, and prints the `cp`, `rm` or `rsync` commands that fix each file. With `fetch-depth: 2` on a pull request it also names the directory that was edited.

```yaml
- uses: actions/checkout@v7.0.1
  with:
    persist-credentials: false
- uses: towardstypetwo/actions/check-skills-aligned@v1
```

## lean-setup

Installs elan 4.2.4 after checking its SHA-256, and caches what a Lean CI job downloads: the toolchains in `~/.elan/toolchains` (or `$ELAN_HOME/toolchains`), keyed on `lean-toolchain`, and lake's package checkouts in `.lake/packages`, keyed on `lean-toolchain` and `lake-manifest.json`. elan has no default toolchain, so the first `lake` command installs the one `lean-toolchain` names. It runs on Linux X64 runners.

```yaml
- uses: actions/checkout@v7.0.1
  with:
    persist-credentials: false
- uses: towardstypetwo/actions/lean-setup@v1
  with:
    path: lean
- run: lake build
  working-directory: lean
```

- `path` is the directory that holds `lean-toolchain` and `lake-manifest.json`. The package cache is skipped when the project has no `lake-manifest.json` or the manifest lists no packages.
- The package cache leaves out each package's `.lake/build`, so a run skips the clones but builds the packages, or unpacks Mathlib's with `lake exe cache get`. Set `package-builds: true` to keep the builds too, when they are small enough to cache.
- `lean-toolchain` should name a release, such as `leanprover/lean4:v4.35.0`. With a channel such as `stable`, the cache keeps restoring the toolchain it first saved after the channel moves on.
- The outputs `toolchain-cache-hit` and `packages-cache-hit` say whether each cache matched its key.

## sccache-setup

Downloads a pinned release of [johnkferguson/sccache](https://github.com/johnkferguson/sccache) and checks its SHA-256, starts its server on the shared R2 bucket `tt2-builds` under the `sccache/` prefix, and sets `RUSTC_WRAPPER=sccache`. Without credentials, or when sccache fails to install or start, the job builds without it, so fork and Dependabot pull requests, which get no secrets, still build.

```yaml
- uses: actions/checkout@v7.0.1
  with:
    persist-credentials: false
- uses: Swatinem/rust-cache@v2.9.3
- uses: towardstypetwo/actions/sccache-setup@v1
  with:
    access-key-id: ${{ secrets.R2_BUILDS_WRITE_ACCESS_KEY_ID }}
    secret-access-key: ${{ secrets.R2_BUILDS_WRITE_SECRET_ACCESS_KEY }}
    account-id: ${{ vars.R2_ACCOUNT_ID }}
- run: cargo nextest run --workspace
- name: sccache stats
  if: ${{ !cancelled() && env.RUSTC_WRAPPER == 'sccache' }}
  continue-on-error: true
  run: sccache --show-stats
```

- The secrets and the `R2_ACCOUNT_ID` variable are set on the organization. A composite action can't read either, so the job passes them in.
- Run it after Swatinem/rust-cache, whose key includes `RUSTC_WRAPPER` and which sets `CARGO_INCREMENTAL=0`. sccache can't cache incremental builds, so a job without rust-cache sets that itself.
- `SCCACHE_BASEDIRS` is the workspace and `CARGO_HOME`, so the same crate built at a different checkout path still hits.
- `release` is the release tag to download and `release-sha256` the SHA-256 of its `x86_64-unknown-linux-musl` tarball; change them together. The release has only a Linux X64 binary.
- When the download, checksum or `sccache --version` fails, or on macOS and Linux ARM64 runners, or with `release: ''`, it builds the fork at `rev` with `cargo install`, which takes a few minutes, and caches the binary per commit and per version of this action. Keep `rev` on the commit the release was built from.
- It runs on Linux and macOS runners; elsewhere the job builds without it.
- With `strict: true`, a failure to get sccache running is recorded in `SCCACHE_STRICT_ERROR`, for the job to fail on after its tests. Fork pull requests and Dependabot runs are exempt from the credential check.

  ```yaml
  - name: Fail if strict sccache broke
    if: ${{ !cancelled() && env.SCCACHE_STRICT_ERROR != '' }}
    run: |
      echo "::error::$SCCACHE_STRICT_ERROR"
      exit 1
  ```

- `endpoint` replaces the R2 endpoint `account-id` names, such as with a local S3 server in a test.
- The output `binary-source` says where the binary came from: `release`, `cache` or `build`. `binary-cache-hit` says whether the built binary's cache matched its key.

## Versions

Releases are tagged `vX.Y.Z` on main, and `vN` points at the latest release of each major version.

## Development

Run `pnpm install --dir npq-check --ignore-scripts`, then `node --test npq-check/check.test.mjs`. Test check-skills-aligned with `bash check-skills-aligned/check.test.sh`. CI tests lean-setup by running it twice on a project `lean-setup/make-test-project.sh` makes: the second run builds with the package's repository deleted. CI tests sccache-setup without credentials, and against a local S3 server: with the release, where a crate's second build must hit the cache, and with a missing release and a wrong checksum, where it builds the binary and a second job must restore it from the cache.
