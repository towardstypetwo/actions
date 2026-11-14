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

echo "$passed passed, $failed failed"
[ "$failed" -eq 0 ]
