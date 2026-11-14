import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import {
  chmodSync,
  mkdtempSync,
  rmSync,
  symlinkSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { after, test } from "node:test";
import { fileURLToPath } from "node:url";
import {
  baseDeps,
  buildsSkipped,
  changedDeps,
  directDeps,
  evaluate,
  manifestLine,
  parseAllow,
  registryTarball,
  runNpq,
  suggestion,
  topLevelLine,
} from "./check.mjs";

const here = dirname(fileURLToPath(import.meta.url));

const dep = (alias, version, name = alias) => ({
  from: name,
  version,
  resolved: registryTarball(name, version),
});

const tempDirs = [];
after(() => {
  for (const dir of tempDirs) rmSync(dir, { recursive: true, force: true });
});

function tempDir(prefix) {
  const dir = mkdtempSync(join(tmpdir(), prefix));
  tempDirs.push(dir);
  return dir;
}

function report(...packages) {
  return {
    schemaVersion: 1,
    packages: packages.map(([requested, ...findings]) => ({
      requested,
      findings: findings.map(([severity, marshall, message]) => ({
        severity,
        marshall,
        message,
      })),
    })),
  };
}

const allowOf = (...allow) => parseAllow({ npq: { allow } }).entries;

test("parseAllow reads name-only typosquatting and per-version entries", () => {
  const { entries, errors } = parseAllow({
    npq: {
      allow: [
        {
          package: "sv",
          check: "typosquatting",
          reason: "the official Svelte CLI",
          date: "2026-11-14",
        },
        {
          package: "@bufbuild/buf",
          version: "1.75.0",
          check: "author",
          reason: "first release by a new team member",
          date: "2026-11-14",
        },
      ],
    },
  });
  assert.deepEqual(errors, []);
  assert.deepEqual(
    entries.map((e) => [e.name, e.version, e.check]),
    [
      ["sv", undefined, "typosquatting"],
      ["@bufbuild/buf", "1.75.0", "author"],
    ],
  );
});

test("parseAllow returns nothing for a manifest without npq", () => {
  assert.deepEqual(parseAllow({ name: "x" }), { entries: [], errors: [] });
});

test("parseAllow rejects malformed entries", () => {
  const base = { package: "a", reason: "r", date: "2026-11-14" };
  const bad = [
    { ...base, check: "typosquatting", version: "1.0.0" },
    { ...base, check: "author" },
    { ...base, check: "author", version: "^1.0.0" },
    { ...base, check: "typosquat" },
    { ...base, check: "typosquatting", date: "2026-02-30" },
    { ...base, check: "typosquatting", reason: " " },
    { ...base, check: "typosquatting", note: "x" },
    { check: "typosquatting", reason: "r", date: "2026-11-14" },
    "a typosquatting",
  ];
  const { entries, errors } = parseAllow({ npq: { allow: bad } });
  assert.equal(entries.length, 0);
  assert.equal(errors.length, bad.length);
  assert.match(errors[0].message, /^npq\.allow\[0\]: typosquatting is about/);
});

test("parseAllow rejects an npq field without an allow list", () => {
  assert.equal(parseAllow({ npq: { allow: {} } }).errors.length, 1);
});

test("directDeps merges sections and keeps an alias's registry name", () => {
  const deps = directDeps([
    {
      dependencies: { a: dep("a", "1.0.0"), b: dep("b", "2.0.0", "real-b") },
      devDependencies: { c: dep("c", "3.0.0") },
    },
  ]);
  assert.deepEqual([...deps.keys()], ["a", "b", "c"]);
  assert.equal(deps.get("b").name, "real-b");
});

test("directDeps refuses a workspace with several projects", () => {
  assert.throws(() => directDeps([{}, {}]), /workspaces/);
});

test("changedDeps returns new, re-resolved and re-sourced dependencies", () => {
  const base = directDeps([
    {
      dependencies: {
        a: dep("a", "1.0.0"),
        b: dep("b", "1.0.0"),
        d: dep("d", "1.0.0"),
      },
    },
  ]);
  const head = directDeps([
    {
      dependencies: {
        a: dep("a", "1.0.0"),
        b: dep("b", "1.1.0"),
        c: dep("c", "1.0.0"),
        d: {
          from: "d",
          version: "1.0.0",
          resolved: "https://codeload.github.com/someone/d/tar.gz/abc",
        },
      },
    },
  ]);
  assert.deepEqual(
    changedDeps(base, head).map((d) => `${d.name}@${d.version}`),
    ["b@1.1.0", "c@1.0.0", "d@1.0.0"],
  );
});

test("evaluate matches typosquatting by name and other checks by version", () => {
  const deps = [
    { alias: "sv", name: "sv", version: "1.4.0" },
    { alias: "x", name: "x", version: "2.0.0" },
    { alias: "y", name: "y", version: "3.0.0" },
  ];
  const npq = report(
    [
      "sv@1.4.0",
      ["error", "typosquatting", "like ms"],
      ["warning", "age", "old"],
    ],
    ["x@2.0.0", ["error", "author", "new maintainer"]],
    ["y@3.0.0", ["error", "author", "new maintainer"]],
  );
  const allow = allowOf(
    { package: "sv", check: "typosquatting", reason: "r", date: "2026-11-14" },
    {
      package: "x",
      version: "2.0.0",
      check: "author",
      reason: "r",
      date: "2026-11-14",
    },
    {
      package: "y",
      version: "2.9.0",
      check: "author",
      reason: "r",
      date: "2026-11-14",
    },
  );
  const { errors, allowed, warnings } = evaluate(deps, npq, allow);
  assert.deepEqual(
    allowed.map((a) => `${a.dep.name} ${a.check} ${a.by}`),
    ["sv typosquatting npq.allow[0]", "x author npq.allow[1]"],
  );
  assert.deepEqual(
    errors.map((e) => `${e.dep.name} ${e.check}`),
    ["y author"],
  );
  assert.deepEqual(
    warnings.map((w) => `${w.dep.name} ${w.check}`),
    ["sv age"],
  );
});

test("evaluate passes install scripts only when pnpm skips the package's builds", () => {
  const deps = [
    { alias: "esbuild", name: "esbuild", version: "0.28.2" },
    { alias: "sharp", name: "sharp", version: "1.0.0" },
    { alias: "other", name: "other", version: "1.0.0" },
  ];
  const npq = report(
    ["esbuild@0.28.2", ["error", "scripts", "postinstall: node install.js"]],
    ["sharp@1.0.0", ["error", "scripts", "install: node build.js"]],
    ["other@1.0.0", ["error", "scripts", "postinstall: node x.js"]],
  );
  const { errors, allowed } = evaluate(deps, npq, [], {
    allowBuilds: { esbuild: false, sharp: true },
  });
  assert.deepEqual(
    allowed.map((a) => a.dep.name),
    ["esbuild"],
  );
  assert.deepEqual(
    errors.map((e) => e.dep.name),
    ["sharp", "other"],
  );
});

test("buildsSkipped lets permissions, then an exact-version key, decide", () => {
  const d = { name: "esbuild", version: "0.28.2" };
  assert.equal(buildsSkipped(d, { esbuild: false }), true);
  assert.equal(
    buildsSkipped(d, { esbuild: false, "esbuild@0.28.2": true }),
    false,
  );
  assert.equal(
    buildsSkipped(d, { esbuild: true, "esbuild@0.28.2": false }),
    true,
  );
  assert.equal(
    buildsSkipped(d, { esbuild: false }, { esbuild: { build: true } }),
    false,
  );
  assert.equal(buildsSkipped(d, {}, { esbuild: { build: false } }), true);
  assert.equal(buildsSkipped(d, null, null), false);
});

test("evaluate reads only npq's own prefixes, not text a publisher wrote", () => {
  const deps = [{ alias: "a", name: "a", version: "1.0.0" }];
  const npq = report([
    "a@1.0.0",
    [
      "error",
      "scripts",
      'Detected a possible malicious intent script, audit required: postinstall: echo "API request failed"',
    ],
  ]);
  const { allowed } = evaluate(deps, npq, [], { allowBuilds: { a: false } });
  assert.equal(allowed.length, 1);
});

test("evaluate never allows malicious, placeholder or unfinished findings", () => {
  const deps = [
    { alias: "a", name: "a", version: "1.0.0" },
    { alias: "b", name: "b", version: "0.0.1-security" },
    { alias: "c", name: "c", version: "1.0.0" },
  ];
  const npq = report(
    ["a@1.0.0", ["error", "snyk", "Malicious package found: MAL-2026-1"]],
    [
      "b@0.0.1-security",
      [
        "error",
        "license",
        "Package flagged for security issues and served as place-holder",
      ],
    ],
    [
      "c@1.0.0",
      [
        "error",
        "deprecation",
        "GitHub API rate limit exceeded - deprecation marshall could not evaluate repository archive status",
      ],
    ],
  );
  const allow = allowOf(
    {
      package: "a",
      version: "1.0.0",
      check: "snyk",
      reason: "r",
      date: "2026-11-14",
    },
    {
      package: "b",
      version: "0.0.1-security",
      check: "license",
      reason: "r",
      date: "2026-11-14",
    },
    {
      package: "c",
      version: "1.0.0",
      check: "deprecation",
      reason: "r",
      date: "2026-11-14",
    },
  );
  assert.equal(evaluate(deps, npq, allow).errors.length, 3);
});

test("evaluate fails when npq reports another package than requested", () => {
  const deps = [{ alias: "a", name: "a", version: "1.0.0" }];
  assert.throws(
    () => evaluate(deps, report(["b@1.0.0"]), []),
    /reported b@1.0.0/,
  );
});

test("suggestion leaves the version out of a typosquatting exception only", () => {
  const d = { name: "sv", version: "1.3.0" };
  assert.deepEqual(JSON.parse(suggestion(d, "typosquatting", "2026-11-14")), {
    package: "sv",
    check: "typosquatting",
    reason: "<why it doesn't apply>",
    date: "2026-11-14",
  });
  assert.equal(
    JSON.parse(suggestion(d, "author", "2026-11-14")).version,
    "1.3.0",
  );
});

test("registryTarball gives the registry URL for plain and scoped names", () => {
  assert.equal(
    registryTarball("@astrojs/mdx", "8.1.1"),
    "https://registry.npmjs.org/@astrojs/mdx/-/mdx-8.1.1.tgz",
  );
  assert.equal(
    registryTarball("ms", "2.1.3"),
    "https://registry.npmjs.org/ms/-/ms-2.1.3.tgz",
  );
  assert.equal(registryTarball("ms", "link:../ms"), null);
});

test("manifestLine finds the dependency, not a script or nested block", () => {
  const manifest = JSON.stringify(
    {
      pnpm: { packageExtensions: { x: { dependencies: { astro: "1" } } } },
      scripts: { astro: "astro" },
      devDependencies: {},
      dependencies: { astro: "^7.0.0" },
      npq: { allow: [] },
    },
    null,
    2,
  );
  const lines = manifest.split("\n");
  assert.equal(
    lines[manifestLine(manifest, "astro") - 1].trim(),
    '"astro": "^7.0.0"',
  );
  assert.equal(lines[topLevelLine(manifest, "npq") - 1].trim(), '"npq": {');
});

function fakeNpq(script) {
  const bin = join(tempDir("fake-npq-"), "npq");
  writeFileSync(bin, `#!/usr/bin/env node\n${script}\n`);
  chmodSync(bin, 0o755);
  return bin;
}

test("runNpq accepts a findings report and hides MARSHALL_ variables from npq", () => {
  process.env.MARSHALL_DISABLE_TYPOSQUATTING = "1";
  const bin = fakeNpq(`
    const disabled = Object.keys(process.env).filter((k) => k.startsWith("MARSHALL_"));
    console.log(JSON.stringify({ schemaVersion: 1, status: "findings", failures: [], packages: [{ requested: process.argv[3], findings: [{ severity: "error", marshall: "env", message: disabled.join(",") }] }] }));
    process.exitCode = 1;
  `);
  try {
    const result = runNpq(bin, ["a@1.0.0"]);
    assert.equal(result.packages[0].requested, "a@1.0.0");
    assert.equal(result.packages[0].findings[0].message, "");
  } finally {
    delete process.env.MARSHALL_DISABLE_TYPOSQUATTING;
  }
});

test("runNpq fails when npq could not complete the audit", () => {
  const bin = fakeNpq(`
    console.log(JSON.stringify({ schemaVersion: 1, status: "failed", failures: [{ code: "PACKAGE_LOOKUP_FAILED", message: "Unable to retrieve package metadata", package: "a@1.0.0" }], packages: [] }));
    process.exitCode = 2;
  `);
  assert.throws(() => runNpq(bin, ["a@1.0.0"]), /PACKAGE_LOOKUP_FAILED/);
});

test("runNpq fails on another report schema", () => {
  const bin = fakeNpq(
    `console.log(JSON.stringify({ schemaVersion: 2, packages: [] }));`,
  );
  assert.throws(() => runNpq(bin, ["a@1.0.0"]), /schemaVersion 2/);
});

test("runNpq fails when npq prints no report", () => {
  const bin = fakeNpq(`console.error("boom"); process.exitCode = 1;`);
  assert.throws(() => runNpq(bin, ["a@1.0.0"]), /didn't print a JSON report/);
});

test("runNpq names the cause when npq can't be started", () => {
  assert.throws(
    () => runNpq(join(tmpdir(), "no-such-npq"), ["a@1.0.0"]),
    /could not run .*ENOENT/,
  );
});

test("baseDeps fails on a base commit that isn't there", () => {
  assert.throws(
    () => baseDeps("0000000000000000000000000000000000000000"),
    /not a commit/,
  );
});

test("check.mjs runs when reached through a symlink", () => {
  const link = join(tempDir("npq-link-"), "check.mjs");
  symlinkSync(join(here, "check.mjs"), link);
  const result = spawnSync(process.execPath, [link], { encoding: "utf8" });
  assert.equal(result.status, 2);
  assert.match(result.stderr, /usage/);
});

function sh(cwd, cmd, args) {
  const result = spawnSync(cmd, args, { cwd, encoding: "utf8" });
  assert.equal(result.status, 0, `${cmd} ${args.join(" ")}: ${result.stderr}`);
  return result.stdout;
}

// A pnpm v9 lockfile for a project whose direct dependencies are `deps`
// (name to version), all from the registry.
function lockfile(deps) {
  const importer = Object.entries(deps)
    .map(
      ([n, v]) => `      ${n}:\n        specifier: ${v}\n        version: ${v}`,
    )
    .join("\n");
  const packages = Object.entries(deps)
    .map(([n, v]) => `  ${n}@${v}:\n    resolution: {integrity: sha512-AAAA}`)
    .join("\n\n");
  const snapshots = Object.entries(deps)
    .map(([n, v]) => `  ${n}@${v}: {}`)
    .join("\n\n");
  return `lockfileVersion: '9.0'\n\nsettings:\n  autoInstallPeers: true\n  excludeLinksFromLockfile: false\n\nimporters:\n\n  .:\n    dependencies:\n${importer}\n\npackages:\n\n${packages}\n\nsnapshots:\n\n${snapshots}\n`;
}

function project(dir, deps, npq) {
  const manifest = { name: "p", private: true, dependencies: deps };
  if (npq) manifest.npq = npq;
  writeFileSync(
    join(dir, "package.json"),
    `${JSON.stringify(manifest, null, 2)}\n`,
  );
  writeFileSync(join(dir, "pnpm-lock.yaml"), lockfile(deps));
}

const hasPnpm = spawnSync("pnpm", ["--version"]).status === 0;

test("check.mjs fails an unlisted lookalike and passes it once allowed", {
  skip: !hasPnpm && "pnpm not installed",
}, () => {
  const dir = tempDir("npq-repo-");
  sh(dir, "git", ["init", "-q", "-b", "main"]);
  sh(dir, "git", ["config", "user.email", "t@example.com"]);
  sh(dir, "git", ["config", "user.name", "t"]);
  project(dir, { ms: "2.1.3" });
  sh(dir, "git", ["add", "."]);
  sh(dir, "git", ["commit", "-qm", "base"]);
  const npq = fakeNpq(`
    const findings = { "sv@1.3.0": [{ severity: "error", marshall: "typosquatting", message: "Potential typosquatting with popular package(s): ms" }] };
    const specs = process.argv.slice(3);
    console.log(JSON.stringify({ schemaVersion: 1, status: "findings", failures: [], packages: specs.map((s) => ({ requested: s, findings: findings[s] ?? [] })) }));
    process.exitCode = 1;
  `);
  const run = (base) =>
    spawnSync(process.execPath, [join(here, "check.mjs"), "--base", base], {
      cwd: dir,
      encoding: "utf8",
      env: { ...process.env, NPQ_CHECK_NPQ_BIN: npq },
    });

  project(dir, { ms: "2.1.3", sv: "1.3.0" });
  sh(dir, "git", ["commit", "-qam", "add sv"]);
  let result = run("HEAD~1");
  assert.equal(result.status, 1, result.stdout + result.stderr);
  assert.match(
    result.stdout,
    /::error file=package\.json,line=\d+::npq typosquatting: sv@1\.3\.0/,
  );
  assert.match(result.stdout, /"package":"sv","check":"typosquatting"/);

  project(
    dir,
    { ms: "2.1.3", sv: "1.3.0" },
    {
      allow: [
        {
          package: "sv",
          check: "typosquatting",
          reason: "the Svelte CLI",
          date: "2026-11-14",
        },
      ],
    },
  );
  sh(dir, "git", ["commit", "-qam", "allow sv"]);
  result = run("HEAD~2");
  assert.equal(result.status, 0, result.stdout + result.stderr);
  assert.match(result.stdout, /allowed by npq\.allow\[0\]/);
});

test("check.mjs refuses HEAD^1 when HEAD isn't a merge commit", {
  skip: !hasPnpm && "pnpm not installed",
}, () => {
  const dir = tempDir("npq-repo-");
  sh(dir, "git", ["init", "-q", "-b", "main"]);
  sh(dir, "git", ["config", "user.email", "t@example.com"]);
  sh(dir, "git", ["config", "user.name", "t"]);
  project(dir, { ms: "2.1.3" });
  sh(dir, "git", ["add", "."]);
  sh(dir, "git", ["commit", "-qm", "one"]);
  sh(dir, "git", ["commit", "-q", "--allow-empty", "-m", "two"]);
  const result = spawnSync(
    process.execPath,
    [join(here, "check.mjs"), "--base", "HEAD^1"],
    {
      cwd: dir,
      encoding: "utf8",
    },
  );
  assert.equal(result.status, 1);
  assert.match(result.stdout, /not a merge commit/);
});
