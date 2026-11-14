#!/usr/bin/env node
// Checks the direct dependencies a pull request adds or changes with npq, at
// the versions pnpm-lock.yaml resolves, against the base commit's lockfile.
// npq errors fail the run unless package.json's `npq.allow` lists them;
// warnings are printed as annotations. See README.md.
//
// Usage: node check.mjs --base <git rev>   (run from the repo root, after
// `pnpm install` in this directory, which installs the npq it runs)

import { spawnSync } from "node:child_process";
import {
  mkdtempSync,
  readFileSync,
  realpathSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

// npq comes from this action's own lockfile, never the checked repo's
// install, which the dependencies under review could have changed.
const NPQ_BIN = join(
  dirname(fileURLToPath(import.meta.url)),
  "node_modules/.bin/npq",
);
// The token npq's GitHub API calls use. action.yml passes it under this name,
// so the pnpm commands this script runs (and any pnpmfile they load) don't
// see it; only npq gets it, as GITHUB_TOKEN.
const TOKEN_VAR = "NPQ_CHECK_GITHUB_TOKEN";
const PLACEHOLDER_REASON = "<why it doesn't apply>";

const MANIFEST = "package.json";
// Checks about the name alone, so their exceptions hold for every version.
const NAME_CHECKS = new Set(["typosquatting"]);
const ENTRY_KEYS = new Set(["package", "version", "check", "reason", "date"]);
const SECTIONS = ["dependencies", "devDependencies", "optionalDependencies"];
const REGISTRY = "https://registry.npmjs.org/";
// The check names of the npq in package.json here, as its JSON reports them in
// `marshall`. Review them when that npq changes.
export const CHECKS = new Set([
  "age",
  "author",
  "deprecation",
  "downloads",
  "license",
  "maintainers_expired_emails",
  "newBin",
  "provenance",
  "repo",
  "scripts",
  "signatures",
  "snyk",
  "typosquatting",
  "version_maturity",
]);
// git and pnpm print whole lockfiles; spawnSync's default 1 MiB is too small.
const MAX_BUFFER = 256 * 1024 * 1024;
// npq audits one package at a time, a few seconds each. Capped so a long run
// fails here with a message rather than at the job's timeout.
const npqTimeoutMs = (count) => Math.min(60 + 30 * count, 6 * 60) * 1000;
// Findings no exception covers, by check, matched against npq's fixed message
// prefixes only, since the rest of a message can be text the publisher wrote.
// `snyk` carries OSV's malicious-package advisories beside ordinary
// vulnerabilities, and `license` npm's placeholder for a name taken down for
// malware.
const NEVER_ALLOWED = {
  snyk: /^Malicious package found: /,
  license: /^Package flagged for security issues and served as place-holder$/,
};
// Outages some checks report as an error finding rather than an audit
// failure. Those need a re-run, not an exception.
const UNFINISHED = {
  deprecation:
    /^GitHub API (rate limit exceeded|access forbidden for \S+|error \(\d+\)) - deprecation marshall could not evaluate /,
  snyk: /^(Unable to query vulnerabilities for packages|Snyk API request failed with status \d+)$/,
};
const unfinished = (check, message) =>
  UNFINISHED[check]?.test(message) ?? false;
const EXACT_VERSION =
  /^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?(?:\+[0-9A-Za-z.-]+)?$/;

// The exceptions in package.json's `npq.allow`: objects with package, check,
// reason and date, plus version for every check but typosquatting, which is
// about the name and holds for every version.
export function parseAllow(manifest) {
  const entries = [];
  const errors = [];
  const allow = manifest?.npq?.allow;
  if (manifest?.npq === undefined) return { entries, errors };
  if (!Array.isArray(allow)) {
    errors.push({ message: '"npq" must be an object with an "allow" list' });
    return { entries, errors };
  }
  allow.forEach((entry, index) => {
    const at = `npq.allow[${index}]`;
    const fail = (message) => errors.push({ message: `${at}: ${message}` });
    if (entry === null || typeof entry !== "object" || Array.isArray(entry)) {
      fail("expected an object");
      return;
    }
    const unknown = Object.keys(entry).filter((k) => !ENTRY_KEYS.has(k));
    if (unknown.length > 0) {
      fail(`unknown key ${unknown.join(", ")}`);
      return;
    }
    const { package: name, version, check, reason, date } = entry;
    if (typeof name !== "string" || name === "") {
      fail("package must be a package name");
      return;
    }
    if (!CHECKS.has(check)) {
      fail(`${check}: not an npq check (one of ${[...CHECKS].join(", ")})`);
      return;
    }
    if (NAME_CHECKS.has(check)) {
      if (version !== undefined) {
        fail(`${check} is about the name, so it doesn't take a version`);
        return;
      }
    } else if (typeof version !== "string" || !EXACT_VERSION.test(version)) {
      fail(`${check} needs the exact version it was reviewed at`);
      return;
    }
    if (
      typeof reason !== "string" ||
      reason.trim() === "" ||
      reason.includes(PLACEHOLDER_REASON)
    ) {
      fail("reason must say why the finding doesn't apply");
      return;
    }
    if (typeof date !== "string" || !isCalendarDate(date)) {
      fail("date must be YYYY-MM-DD");
      return;
    }
    entries.push({ index, name, version, check, reason, date });
  });
  return { entries, errors };
}

function isCalendarDate(text) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(text)) return false;
  const time = Date.parse(`${text}T00:00:00Z`);
  // Date.parse rolls 2026-02-30 over to March rather than rejecting it.
  return (
    !Number.isNaN(time) && new Date(time).toISOString().slice(0, 10) === text
  );
}

// Direct dependencies of the one project in `listing`, the parsed output of
// `pnpm list --lockfile-only --json --depth 0`, keyed by the name they are
// installed under.
export function directDeps(listing) {
  if (!Array.isArray(listing) || listing.length !== 1) {
    throw new Error("expected one project; pnpm workspaces are not supported");
  }
  const deps = new Map();
  for (const section of SECTIONS) {
    for (const [alias, dep] of Object.entries(listing[0][section] ?? {})) {
      deps.set(alias, {
        alias,
        // `from` is the registry name, which differs from the key for an alias.
        name: dep.from ?? alias,
        version: dep.version,
        resolved: dep.resolved ?? "",
      });
    }
  }
  return deps;
}

// Dependencies in `head` that `base` lacks or resolves to another version or
// source. A git or tarball dependency can report the same version as the
// registry release it replaces, so `resolved` is compared too.
export function changedDeps(base, head) {
  return [...head.values()].filter((dep) => {
    const before = base.get(dep.alias);
    return (
      !before ||
      before.name !== dep.name ||
      before.version !== dep.version ||
      before.resolved !== dep.resolved
    );
  });
}

// The environment for pnpm: without the token, which only npq needs.
function pnpmEnv() {
  const env = { ...process.env };
  delete env[TOKEN_VAR];
  delete env.GITHUB_TOKEN;
  return env;
}

function pnpmList(cwd) {
  const result = spawnSync(
    "pnpm",
    ["list", "--lockfile-only", "--json", "--depth", "0"],
    { cwd, encoding: "utf8", maxBuffer: MAX_BUFFER, env: pnpmEnv() },
  );
  if (result.error) throw result.error;
  if (result.status !== 0) {
    throw new Error(`pnpm list failed in ${cwd}:\n${result.stderr}`);
  }
  return JSON.parse(result.stdout);
}

function git(args) {
  const result = spawnSync("git", args, {
    encoding: "utf8",
    maxBuffer: MAX_BUFFER,
  });
  if (result.error) throw result.error;
  return result;
}

// The file at `rev` (a verified commit), or null when it has no such file.
function gitShow(rev, path) {
  const result = git(["show", `${rev}:${path}`]);
  if (result.status === 0) return result.stdout;
  if (/does not exist in|exists on disk, but not in/.test(result.stderr)) {
    return null;
  }
  throw new Error(`git show ${rev}:${path} failed:\n${result.stderr}`);
}

// The base commit's dependencies, listed from its own manifest, lockfile and
// .npmrc (whose registry settings shape `resolved`). Its pnpm-workspace.yaml
// is left out: the lockfile alone gives the versions, and the PR's pnpm may
// reject settings an older file has.
export function baseDeps(rev) {
  if (git(["rev-parse", "--verify", "--quiet", `${rev}^{commit}`]).status) {
    throw new Error(
      `base ${rev} is not a commit in this checkout; on a PR, check out with fetch-depth: 2`,
    );
  }
  const lockfile = gitShow(rev, "pnpm-lock.yaml");
  const manifest = gitShow(rev, "package.json");
  if (lockfile === null || manifest === null) return new Map();
  const npmrc = gitShow(rev, ".npmrc");
  const dir = mkdtempSync(join(tmpdir(), "npq-check-base-"));
  try {
    writeFileSync(join(dir, "package.json"), manifest);
    writeFileSync(join(dir, "pnpm-lock.yaml"), lockfile);
    if (npmrc !== null) writeFileSync(join(dir, ".npmrc"), npmrc);
    // Run the PR's pnpm here too, not the one the base's packageManager names.
    writeFileSync(join(dir, "pnpm-workspace.yaml"), "pmOnFail: ignore\n");
    return directDeps(pnpmList(dir));
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

// npq's JSON report on `specs`. Exit codes 0 (clean) and 1 (findings) both
// carry a report; anything else, or a report with failures, means npq could
// not check every package.
export function runNpq(npqBin, specs) {
  const env = { ...process.env };
  // Each MARSHALL_DISABLE_<CHECK> variable turns an npq check off, and the
  // SNYK_ variables point its vulnerability check elsewhere; exceptions
  // belong in package.json, where review sees them.
  for (const key of Object.keys(env)) {
    if (/^(MARSHALL_|SNYK_|NODE_OPTIONS$)/.test(key)) delete env[key];
  }
  delete env[TOKEN_VAR];
  if (process.env[TOKEN_VAR]) env.GITHUB_TOKEN = process.env[TOKEN_VAR];
  // The registry pnpm's `resolved` was checked against, whatever npm config
  // the repo or runner sets.
  const args = ["--json", `--registry=${REGISTRY}`, ...specs];
  const result = spawnSync(npqBin, args, {
    encoding: "utf8",
    env,
    maxBuffer: MAX_BUFFER,
    timeout: npqTimeoutMs(specs.length),
  });
  if (result.error?.code === "ETIMEDOUT") {
    throw new Error(
      `npq took longer than ${npqTimeoutMs(specs.length) / 1000}s for ${specs.length} packages`,
    );
  }
  if (result.error) {
    throw new Error(`could not run ${npqBin}: ${result.error.message}`);
  }
  let report;
  try {
    report = JSON.parse(result.stdout);
  } catch {
    throw new Error(
      `npq didn't print a JSON report (exit ${result.status}):\n${result.stderr}${result.stdout}`,
    );
  }
  if (report.schemaVersion !== 1) {
    throw new Error(
      `npq report schemaVersion ${report.schemaVersion}; check.mjs reads version 1`,
    );
  }
  const failures = report.failures ?? [];
  if (failures.length > 0) {
    const reasons = failures
      .map(
        (f) =>
          `${f.package ?? "npq"}${f.marshall ? ` (${f.marshall})` : ""}: ${f.code}: ${f.message}`,
      )
      .join("\n");
    throw new Error(
      `npq could not complete the audit:\n${reasons || JSON.stringify(report)}`,
    );
  }
  if (![0, 1].includes(result.status) || !Array.isArray(report.packages)) {
    throw new Error(
      `unexpected npq result (exit ${result.status}): ${result.stdout}`,
    );
  }
  return report;
}

// Whether `entry` names `dep`: by name for a name check, else name and version.
function coversDep(entry, dep) {
  return (
    entry.name === dep.name &&
    (entry.version === undefined || entry.version === dep.version)
  );
}

function allowable(check, message) {
  return (
    CHECKS.has(check) &&
    !(NEVER_ALLOWED[check]?.test(message) ?? false) &&
    !unfinished(check, message)
  );
}

// Whether a config key (`name`, `name@1.0.0` or `name@1.0.0 || 1.0.1`)
// covers `dep`.
function keyCovers(key, dep) {
  const at = key.lastIndexOf("@");
  if (at <= 0) return key === dep.name;
  if (key.slice(0, at) !== dep.name) return false;
  return key
    .slice(at + 1)
    .split("||")
    .some((v) => v.trim() === dep.version);
}

// Whether pnpm skips `dep`'s install scripts. pnpm denies a build when any
// `allowBuilds` key or `permissions.<key>.build` covering the package says
// false, whatever else allows it.
export function buildsSkipped(dep, allowBuilds = {}, permissions = {}) {
  const denied = (map, read) =>
    Object.entries(map ?? {}).some(
      ([key, value]) => keyCovers(key, dep) && read(value) === false,
    );
  return denied(allowBuilds, (v) => v) || denied(permissions, (v) => v?.build);
}

// Sorts npq's findings into errors (failing), allowed errors and warnings.
// `deps` are the checked dependencies, in the order they were passed to npq,
// which keeps its package reports in that order. An install-scripts finding
// passes when pnpm's config sets the package's builds off (`buildsSkipped`),
// since pnpm then never runs the script.
export function evaluate(deps, report, allow, builds = {}) {
  const errors = [];
  const allowed = [];
  const warnings = [];
  if (report.packages.length !== deps.length) {
    throw new Error(
      `npq reported ${report.packages.length} packages for ${deps.length} requested`,
    );
  }
  deps.forEach((dep, index) => {
    const requested = report.packages[index].requested;
    if (requested !== `${dep.name}@${dep.version}`) {
      throw new Error(
        `npq reported ${requested} where ${dep.name}@${dep.version} was requested`,
      );
    }
    for (const finding of report.packages[index].findings ?? []) {
      const item = { dep, check: finding.marshall, message: finding.message };
      if (finding.severity === "warning") {
        warnings.push(item);
        continue;
      }
      if (!allowable(finding.marshall, finding.message)) {
        errors.push(item);
        continue;
      }
      if (
        finding.marshall === "scripts" &&
        buildsSkipped(dep, builds.allowBuilds, builds.permissions)
      ) {
        allowed.push({ ...item, by: "pnpm's config, which skips its builds" });
        continue;
      }
      const entry = allow.find(
        (e) => e.check === finding.marshall && coversDep(e, dep),
      );
      if (entry) {
        allowed.push({ ...item, by: `npq.allow[${entry.index}]` });
      } else {
        errors.push(item);
      }
    }
  });
  return { errors, allowed, warnings };
}

function escapeData(text) {
  return String(text)
    .replace(/%/g, "%25")
    .replace(/\r/g, "%0D")
    .replace(/\n/g, "%0A");
}

function escapeProperty(text) {
  return escapeData(text).replace(/:/g, "%3A").replace(/,/g, "%2C");
}

function annotate(level, message, { file, line } = {}) {
  const props = [];
  if (file) props.push(`file=${escapeProperty(file)}`);
  if (line) props.push(`line=${line}`);
  console.log(
    `::${level}${props.length ? ` ${props.join(",")}` : ""}::${escapeData(message)}`,
  );
}

// The registry.npmjs.org tarball URL for name@version. Any other `resolved`,
// a registry URL for another package included, means npq would check a
// different package than the one installed.
export function registryTarball(name, version) {
  if (!EXACT_VERSION.test(version)) return null;
  const base = name.slice(name.lastIndexOf("/") + 1);
  return `${REGISTRY}${name}/-/${base}-${version}.tgz`;
}

// Top-level keys sit at the indentation of the first one.
function topIndent(lines) {
  return lines.find((l) => /^\s+"/.test(l))?.match(/^\s+/)[0] ?? "";
}

// The package.json line of the top-level key `key`.
export function topLevelLine(manifestText, key) {
  const lines = manifestText.split("\n");
  const prefix = `${topIndent(lines)}${JSON.stringify(key)}:`;
  const index = lines.findIndex((l) => l.startsWith(prefix));
  return index === -1 ? undefined : index + 1;
}

// The package.json line that declares `alias`, searched only inside the
// dependency sections, since a script can have the same name.
export function manifestLine(manifestText, alias) {
  const lines = manifestText.split("\n");
  const key = `${JSON.stringify(alias)}:`;
  const indent = topIndent(lines);
  for (const section of SECTIONS) {
    const start = lines.findIndex((l) =>
      new RegExp(`^${indent}${JSON.stringify(section)}:\\s*\\{\\s*$`).test(l),
    );
    if (start === -1) continue;
    for (let i = start + 1; i < lines.length; i++) {
      const line = lines[i].trimStart();
      if (line.startsWith("}")) break;
      if (line.startsWith(key)) return i + 1;
    }
  }
  return undefined;
}

// A map setting from the repo's pnpm config, or {} when it isn't set.
function pnpmConfigMap(key) {
  const result = spawnSync("pnpm", ["config", "get", key, "--json"], {
    encoding: "utf8",
    maxBuffer: MAX_BUFFER,
    env: pnpmEnv(),
  });
  if (result.error) throw result.error;
  if (result.status !== 0) {
    throw new Error(`pnpm config get ${key} failed:\n${result.stderr}`);
  }
  const text = result.stdout.trim();
  if (text === "" || text === "undefined") return {};
  const value = JSON.parse(text);
  return value && typeof value === "object" ? value : {};
}

// The exception to suggest for an npq error, as package.json takes it.
export function suggestion(dep, check, today) {
  const entry = { package: dep.name };
  if (!NAME_CHECKS.has(check)) entry.version = dep.version;
  return JSON.stringify({
    ...entry,
    check,
    reason: PLACEHOLDER_REASON,
    date: today,
  });
}

// One log line, with line breaks removed so registry text can't start a
// workflow command.
function logLine(text) {
  console.log(String(text).replace(/[\r\n]+/g, " "));
}

export function main(argv, { npqBin = NPQ_BIN } = {}) {
  const baseIndex = argv.indexOf("--base");
  const base = baseIndex === -1 ? undefined : argv[baseIndex + 1];
  if (!base) {
    console.error("usage: check.mjs --base <git rev>");
    return 2;
  }
  // HEAD's first parent is the base branch only on a pull request's merge
  // commit; on any other checkout it would skip the PR's earlier commits. A
  // base given as a commit hash is taken as meant.
  const commit = (rev) =>
    git(["rev-parse", "--verify", "--quiet", `${rev}^{commit}`]).stdout.trim();
  if (/^HEAD(\^1?|~1?)$/.test(base) && !commit("HEAD^2")) {
    throw new Error(
      "HEAD is not a merge commit, so HEAD^1 is not the base branch; check out the pull request's merge ref (actions/checkout's default) or pass base",
    );
  }

  const manifest = readFileSync(MANIFEST, "utf8");
  const allow = parseAllow(JSON.parse(manifest));
  const npqLine = topLevelLine(manifest, "npq");
  for (const e of allow.errors) {
    annotate("error", `${MANIFEST}: ${e.message}`, {
      file: MANIFEST,
      line: npqLine,
    });
  }

  const head = directDeps(pnpmList(process.cwd()));
  const changed = changedDeps(baseDeps(base), head);
  const where = (dep) => ({
    file: MANIFEST,
    line: manifestLine(manifest, dep.alias),
  });

  const notRegistry = [];
  const toCheck = [];
  for (const d of changed) {
    (d.resolved === registryTarball(d.name, d.version)
      ? toCheck
      : notRegistry
    ).push(d);
  }
  for (const dep of notRegistry) {
    annotate(
      "error",
      `${dep.alias}: resolves to ${dep.resolved || dep.version}, not its own tarball on ${REGISTRY}, so npq can't check it, and no exception covers this`,
      where(dep),
    );
  }

  let result = { errors: [], allowed: [], warnings: [] };
  if (toCheck.length > 0) {
    console.log(
      `npq: checking ${toCheck.map((d) => `${d.name}@${d.version}`).join(", ")}`,
    );
    const report = runNpq(
      npqBin,
      toCheck.map((d) => `${d.name}@${d.version}`),
    );
    result = evaluate(toCheck, report, allow.entries, {
      allowBuilds: pnpmConfigMap("allowBuilds"),
      permissions: pnpmConfigMap("permissions"),
    });
  } else {
    console.log("npq: no new or changed direct dependencies");
  }

  for (const w of result.warnings) {
    annotate(
      "warning",
      `npq ${w.check}: ${w.dep.name}@${w.dep.version}: ${w.message}`,
      where(w.dep),
    );
  }
  for (const a of result.allowed) {
    logLine(
      `allowed by ${a.by}: npq ${a.check}: ${a.dep.name}@${a.dep.version}: ${a.message}`,
    );
  }
  const today = new Date().toISOString().slice(0, 10);
  for (const e of result.errors) {
    const hint = unfinished(e.check, e.message)
      ? "\nnpq couldn't finish this check; re-run the job."
      : allowable(e.check, e.message)
        ? `\nIf this is a false positive, add an exception to the "allow" list under "npq" in ${MANIFEST}, and say in the reason why it doesn't apply:\n${suggestion(e.dep, e.check, today)}`
        : "";
    annotate(
      "error",
      `npq ${e.check}: ${e.dep.name}@${e.dep.version}: ${e.message}${hint}`,
      where(e.dep),
    );
  }
  // An exception for a package or version no longer installed is dead weight;
  // flag it so it goes with the change that replaced it.
  for (const entry of allow.entries) {
    const dep = [...head.values()].find((d) => coversDep(entry, d));
    if (!dep) {
      const what = entry.version
        ? `${entry.name}@${entry.version}`
        : entry.name;
      annotate(
        "notice",
        `${MANIFEST}: npq.allow[${entry.index}] names ${what}, which is not a direct dependency; remove it`,
        { file: MANIFEST, line: npqLine },
      );
    }
  }

  const failed =
    allow.errors.length + notRegistry.length + result.errors.length;
  console.log(
    `npq: ${result.errors.length} error(s), ${result.allowed.length} allowed, ${result.warnings.length} warning(s)`,
  );
  return failed > 0 ? 1 : 0;
}

// import.meta.url has symlinks resolved and argv[1] doesn't, so resolve both;
// a mismatch would skip main() and pass without checking anything.
const entry = process.argv[1] && pathToFileURL(realpathSync(process.argv[1]));
if (entry && import.meta.url === entry.href) {
  try {
    process.exitCode = main(process.argv.slice(2));
  } catch (error) {
    annotate("error", `npq check: ${error.message}`);
    process.exitCode = 1;
  }
}
