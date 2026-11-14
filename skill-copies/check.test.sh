#!/usr/bin/env bash
# Tests for check.sh: run `bash skill-copies/check.test.sh`.

set -euo pipefail

here=$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)
check="$here/check.sh"
work=$(mktemp -d)
trap 'rm -rf "$work"' EXIT

passed=0
failed=0

# Makes a repo with one skill in both directories and prints its path.
new_repo() {
    local repo="$work/repo$((passed + failed))"
    git init -q "$repo"
    git -C "$repo" config user.email test@example.com
    git -C "$repo" config user.name test
    for dir in .claude/skills .agents/skills; do
        mkdir -p "$repo/$dir/demo/scripts"
        echo "# demo" >"$repo/$dir/demo/SKILL.md"
        printf '#!/bin/sh\necho hi\n' >"$repo/$dir/demo/scripts/run.sh"
        chmod +x "$repo/$dir/demo/scripts/run.sh"
    done
    git -C "$repo" add -A
    git -C "$repo" commit -q -m base
    echo "$repo"
}

commit() {
    git -C "$1" add -A
    git -C "$1" commit -q -m change
}

# expect <name> <pass|fail> <repo> [<substring the output must contain>...]
expect() {
    local name="$1" want="$2" repo="$3" out status=0
    shift 3
    out=$(cd "$repo" && bash "$check" ${REV:+"$REV"} 2>&1) || status=$?
    if { [ "$want" = pass ] && [ "$status" -ne 0 ]; } || { [ "$want" = fail ] && [ "$status" -eq 0 ]; }; then
        echo "FAIL $name: expected $want, exit status $status"
        echo "$out"
        failed=$((failed + 1))
        return
    fi
    local needle
    for needle in "$@"; do
        if [[ $out != *"$needle"* ]]; then
            echo "FAIL $name: output lacks \"$needle\""
            echo "$out"
            failed=$((failed + 1))
            return
        fi
    done
    echo "ok   $name"
    passed=$((passed + 1))
}

repo=$(new_repo)
expect "identical copies pass" pass "$repo" "matches"

repo=$(new_repo)
echo "# changed" >"$repo/.claude/skills/demo/SKILL.md"
commit "$repo"
expect "an edit to one side fails" fail "$repo" \
    "demo/SKILL.md: contents differ" "::error"

repo=$(new_repo)
echo "# changed" | tee "$repo/.claude/skills/demo/SKILL.md" >"$repo/.agents/skills/demo/SKILL.md"
commit "$repo"
expect "the same edit on both sides passes" pass "$repo"

repo=$(new_repo)
echo "# extra" >"$repo/.agents/skills/demo/extra.md"
commit "$repo"
expect "a file only in .agents/skills fails" fail "$repo" "demo/extra.md: only in .agents/skills"

repo=$(new_repo)
git -C "$repo" rm -q .agents/skills/demo/scripts/run.sh
commit "$repo"
expect "a file only in .claude/skills fails" fail "$repo" "demo/scripts/run.sh: only in .claude/skills"

repo=$(new_repo)
chmod -x "$repo/.agents/skills/demo/scripts/run.sh"
commit "$repo"
expect "a mode difference fails" fail "$repo" "demo/scripts/run.sh: file mode differs"

repo=$(new_repo)
echo "# changed" >"$repo/.claude/skills/demo/SKILL.md"
chmod -x "$repo/.claude/skills/demo/scripts/run.sh"
commit "$repo"
expect "every differing file is listed" fail "$repo" \
    "demo/SKILL.md: contents differ" "demo/scripts/run.sh: file mode differs"

repo=$(new_repo)
git -C "$repo" rm -rq .agents
commit "$repo"
expect "a missing directory fails" fail "$repo" ".agents/skills is not a directory"

repo=$(new_repo)
rm -r "${repo:?}/.agents/skills"
ln -s ../.claude/skills "$repo/.agents/skills"
commit "$repo"
expect "a symlinked directory fails" fail "$repo" ".agents/skills is not a directory"

repo=$(new_repo)
mkdir -p "$repo/.claude/skills/with space"
echo x >"$repo/.claude/skills/with space/SKILL.md"
commit "$repo"
expect "a path with a space is listed whole" fail "$repo" "with space/SKILL.md: only in .claude/skills"

repo=$(new_repo)
echo "# changed" >"$repo/.claude/skills/demo/SKILL.md"
commit "$repo"
REV=HEAD~1 expect "an earlier revision is compared" pass "$repo"

repo=$(new_repo)
REV=nonesuch expect "an unknown revision fails" fail "$repo" "nonesuch does not resolve"

repo=$(new_repo)
echo "# changed" >"$repo/.claude/skills/demo/SKILL.md"
commit "$repo"
out=$(cd "$repo" && FIX="Run the fixer." bash "$check" 2>&1) || true
if [[ $out == *"Run the fixer."* ]]; then
    echo "ok   the fix text is printed"
    passed=$((passed + 1))
else
    echo "FAIL the fix text is printed"
    failed=$((failed + 1))
fi

repo=$(new_repo)
echo "# changed" >"$repo/.claude/skills/demo/SKILL.md"
commit "$repo"
out=$(cd "$repo" && bash "$check" 'x%y' 2>&1) || true
if [[ $out == *"x%25y does not resolve"* ]]; then
    echo "ok   percent signs in the message are escaped"
    passed=$((passed + 1))
else
    echo "FAIL percent signs in the message are escaped"
    echo "$out"
    failed=$((failed + 1))
fi

# The fix commands.

repo=$(new_repo)
echo "# changed" >"$repo/.claude/skills/demo/SKILL.md"
commit "$repo"
expect "an edit in .claude/skills is named, with its copy and rsync commands" fail "$repo" \
    "demo/SKILL.md: contents differ (.claude/skills changed)" \
    "mkdir -p .agents/skills/demo && cp -p .claude/skills/demo/SKILL.md .agents/skills/demo/SKILL.md" \
    "rsync -a --delete .claude/skills/ .agents/skills/" \
    "git add .claude/skills .agents/skills"

repo=$(new_repo)
echo "# changed" >"$repo/.agents/skills/demo/SKILL.md"
commit "$repo"
expect "an edit in .agents/skills is copied the other way" fail "$repo" \
    "(.agents/skills changed)" \
    "cp -p .agents/skills/demo/SKILL.md .claude/skills/demo/SKILL.md" \
    "rsync -a --delete .agents/skills/ .claude/skills/"

repo=$(new_repo)
git -C "$repo" rm -q .agents/skills/demo/scripts/run.sh
commit "$repo"
expect "a file deleted in .agents/skills is removed from .claude/skills" fail "$repo" \
    "demo/scripts/run.sh: only in .claude/skills (.agents/skills changed)" \
    "rm .claude/skills/demo/scripts/run.sh"

repo=$(new_repo)
echo "# one" >"$repo/.claude/skills/demo/SKILL.md"
echo "# two" >"$repo/.agents/skills/demo/SKILL.md"
commit "$repo"
expect "an edit on both sides offers both directions" fail "$repo" \
    "Can't tell which side changed" \
    "To keep the .claude/skills version:" "To keep the .agents/skills version:"

repo=$(new_repo)
echo "# changed" >"$repo/.claude/skills/demo/SKILL.md"
git -C "$repo" add -A
git -C "$repo" commit -q --amend -m only
expect "a root commit with no base offers both directions" fail "$repo" "Can't tell which side changed"

repo=$(new_repo)
echo "# changed" >"$repo/.claude/skills/demo/SKILL.md"
commit "$repo"
echo "# more" >"$repo/.claude/skills/demo/extra.md"
commit "$repo"
out=$(cd "$repo" && BASE=HEAD~2 bash "$check" 2>&1) || true
if [[ $out == *"demo/SKILL.md: contents differ (.claude/skills changed)"* ]]; then
    echo "ok   BASE sets the commit the change started from"
    passed=$((passed + 1))
else
    echo "FAIL BASE sets the commit the change started from"
    echo "$out"
    failed=$((failed + 1))
fi

repo=$(new_repo)
echo "# changed" >"$repo/.claude/skills/demo/SKILL.md"
echo "# extra" >"$repo/.claude/skills/demo/extra.md"
git -C "$repo" rm -q .claude/skills/demo/scripts/run.sh
commit "$repo"
(cd "$repo" && bash "$check" 2>&1 | sed -n 's/^  \(rsync .*\)$/\1/p' | bash) || true
git -C "$repo" add -A
git -C "$repo" commit -q -m fixed
expect "the printed rsync command fixes the copies" pass "$repo" "matches"

repo=$(new_repo)
echo "# one" >"$repo/.claude/skills/demo/SKILL.md"
echo "# two" >"$repo/.agents/skills/demo/SKILL.md"
commit "$repo"
out=$(cd "$repo" && bash "$check" 2>&1) || true
(cd "$repo" && printf '%s\n' "$out" | sed -n '/^Can.t tell/,/^To keep the .agents/p' | sed -n 's/^  \(.*\)$/\1/p' | bash)
git -C "$repo" add -A
git -C "$repo" commit -q -m fixed
expect "the printed per-file commands fix the copies" pass "$repo" "matches"

echo "$passed passed, $failed failed"
[ "$failed" -eq 0 ]
