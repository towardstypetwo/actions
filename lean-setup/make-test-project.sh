#!/usr/bin/env bash
# Makes the Lean project test.yml runs lean-setup on: DIR/project, which
# requires one package, dep, cloned from the git repository DIR/dep-origin.
# TAG goes into dep's source, so each CI run gets its own lake-manifest.json
# and package cache key. The commit is made with fixed dates, so the same TAG
# gives the same commit and manifest in every job.
set -euo pipefail

dir=$1
tag=$2
toolchain=leanprover/lean4:v4.35.0

mkdir -p "$dir/dep-origin" "$dir/project"

cd "$dir/dep-origin"
echo "$toolchain" >lean-toolchain
cat >lakefile.toml <<'EOF'
name = "dep"

[[lean_lib]]
name = "Dep"
EOF
printf 'def Dep.tag : String := "%s"\n' "$tag" >Dep.lean
git init -q -b main
git add -A
GIT_AUTHOR_DATE=2026-01-01T00:00:00Z GIT_COMMITTER_DATE=2026-01-01T00:00:00Z \
  git -c user.email=ci@example.com -c user.name=ci commit -q -m dep
rev=$(git rev-parse HEAD)

cd "$dir/project"
echo "$toolchain" >lean-toolchain
cat >lakefile.toml <<EOF
name = "project"
defaultTargets = ["Project"]

[[require]]
name = "dep"
git = "$dir/dep-origin"
rev = "main"

[[lean_lib]]
name = "Project"
EOF
echo 'import Dep' >Project.lean
# What lake update writes for this lakefile.
cat >lake-manifest.json <<EOF
{"version": "1.3.0",
 "packagesDir": ".lake/packages",
 "packages":
 [{"url": "$dir/dep-origin",
   "type": "git",
   "subDir": null,
   "scope": "",
   "rev": "$rev",
   "name": "dep",
   "manifestFile": "lake-manifest.json",
   "inputRev": "main",
   "inherited": false,
   "configFile": "lakefile.toml"}],
 "name": "project",
 "lakeDir": ".lake",
 "fixedToolchain": false}
EOF
