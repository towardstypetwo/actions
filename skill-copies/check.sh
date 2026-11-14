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

fail() {
    echo "::error title=skill copies differ::$1" >&2
    exit 1
}

# One `mode type sha<TAB>path` line per file in a skills directory at a commit.
listing() {
    local rev="$1" dir="$2"
    if [ "$(git cat-file -t "$rev:$dir" 2>/dev/null)" != tree ]; then
        fail "$dir is not a directory at $rev, and both skills directories must exist"
    fi
    git -c core.quotePath=false ls-tree -r "$rev:$dir"
}

main() {
    local rev="${1:-HEAD}" claude agents differing
    if ! git rev-parse --verify --quiet "$rev^{tree}" >/dev/null; then
        fail "$rev does not resolve in this checkout"
    fi

    claude=$(listing "$rev" "$CLAUDE")
    agents=$(listing "$rev" "$AGENTS")
    if [ "$claude" = "$agents" ]; then
        echo "$AGENTS matches $CLAUDE at $rev"
        return
    fi

    differing=$(awk -F '\t' -v claude="$CLAUDE" -v agents="$AGENTS" '
        FILENAME == ARGV[1] { c[$2] = $1; paths[$2] = 1; next }
        { a[$2] = $1; paths[$2] = 1 }
        END {
            for (p in paths) {
                if (!(p in a)) { print p "\tonly in " claude; continue }
                if (!(p in c)) { print p "\tonly in " agents; continue }
                if (c[p] == a[p]) continue
                split(c[p], cf, " "); split(a[p], af, " ")
                reason = ""
                if (cf[3] != af[3]) reason = "contents differ"
                if (cf[1] != af[1]) reason = reason (reason == "" ? "" : ", ") "file mode differs"
                print p "\t" reason
            }
        }' <(echo "$claude") <(echo "$agents") | LC_ALL=C sort)

    echo "$AGENTS differs from $CLAUDE at $rev:" >&2
    while IFS=$'\t' read -r path reason; do
        echo "  $path: $reason" >&2
    done <<<"$differing"
    echo "${FIX:-Copy each changed file to the other directory and commit both.}" >&2
    fail "$AGENTS differs from $CLAUDE in $(wc -l <<<"$differing" | tr -d ' ') file(s); see the log for the list"
}

main "$@"
