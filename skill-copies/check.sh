#!/usr/bin/env bash
# Claude Code reads .claude/skills and other agents read .agents/skills, so the
# two must be identical copies, file modes included.
#
# Usage: check.sh [<rev>]
#
# Compares the two directories at a commit, HEAD by default, from the git
# repository in the current directory. FIX is the text printed under the list
# of differing files.

set -euo pipefail

readonly CLAUDE=.claude/skills
readonly AGENTS=.agents/skills
readonly DEFAULT_FIX="Copy each changed file to the same path in the other directory and commit both."

# Prints an error annotation, with the characters GitHub reads as markup in a
# workflow command escaped, and exits.
fail() {
    local message="$1"
    message=${message//'%'/'%25'}
    message=${message//$'\r'/'%0D'}
    message=${message//$'\n'/'%0A'}
    echo "::error title=skill copies differ::$message" >&2
    exit 1
}

require_tree() {
    local rev="$1" dir="$2"
    if [ "$(git cat-file -t "$rev:$dir" 2>/dev/null)" != tree ]; then
        fail "$dir is not a directory at $rev, and both skills directories must exist"
    fi
}

main() {
    local rev="${1:-HEAD}" raw modes shas path reason differing=0
    if ! git rev-parse --verify --quiet "$rev^{tree}" >/dev/null; then
        fail "$rev does not resolve in this checkout; fetch it first when the checkout is shallow"
    fi
    require_tree "$rev" "$CLAUDE"
    require_tree "$rev" "$AGENTS"

    # One `:<mode> <mode> <sha> <sha> <status><TAB><path>` line per differing file, with paths
    # relative to each skills directory.
    raw=$(git -c core.quotePath=false diff-tree -r --no-renames --raw --no-abbrev \
        "$rev:$CLAUDE" "$rev:$AGENTS")
    if [ -z "$raw" ]; then
        echo "$AGENTS matches $CLAUDE at $rev"
        return
    fi

    echo "$AGENTS differs from $CLAUDE at $rev:" >&2
    while IFS=$'\t' read -r modes path; do
        read -r -a shas <<<"$modes"
        case "${shas[4]}" in
            A) reason="only in $AGENTS" ;;
            D) reason="only in $CLAUDE" ;;
            *)
                reason=""
                [ "${shas[2]}" != "${shas[3]}" ] && reason="contents differ"
                [ "${shas[0]#:}" != "${shas[1]}" ] && reason="${reason:+$reason, }file mode differs"
                ;;
        esac
        echo "  $path: $reason" >&2
        differing=$((differing + 1))
    done <<<"$raw"
    echo "${FIX:-$DEFAULT_FIX}" >&2
    fail "$AGENTS differs from $CLAUDE in $differing file(s); the log lists them"
}

main "$@"
