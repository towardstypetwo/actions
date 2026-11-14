#!/usr/bin/env bash
# Claude Code reads .claude/skills and other agents read .agents/skills, so the
# two must be identical copies, file modes included.
#
# Usage: check.sh [<rev>]
#
# Compares the two directories at a commit, HEAD by default, from the git
# repository in the current directory, and prints the commands that make them
# identical. The environment sets two optional inputs:
#
#   BASE  the commit the change started from, used to tell which directory was
#         edited. Defaults to the first parent of <rev>, or its parent when
#         <rev> is not a merge. When that commit isn't fetched, the edited side
#         is unknown.
#   FIX   text printed after the commands.

set -euo pipefail

readonly CLAUDE=.claude/skills
readonly AGENTS=.agents/skills

# Entries are "<mode> <sha>" keyed by the path inside a skills directory.
declare -A cur_claude cur_agents base_claude base_agents

# Prints an error annotation, with the characters GitHub reads as markup in a
# workflow command escaped, and exits.
fail() {
    local message="$1"
    message=${message//'%'/'%25'}
    message=${message//$'\r'/'%0D'}
    message=${message//$'\n'/'%0A'}
    echo "::error title=skills not aligned::$message" >&2
    exit 1
}

require_tree() {
    local rev="$1" dir="$2"
    if [ "$(git cat-file -t "$rev:$dir" 2>/dev/null)" != tree ]; then
        fail "$dir is not a directory at $rev, and both skills directories must exist"
    fi
}

# load <array name> <rev> <dir>: fills the array from the files in a skills
# directory at a commit, and nothing when the directory isn't there.
load() {
    local -n entries="$1"
    local rev="$2" dir="$3" record meta path
    while IFS= read -r -d '' record; do
        meta=${record%%$'\t'*}
        path=${record#*$'\t'}
        # shellcheck disable=SC2034 # entries is a nameref to the caller's array
        entries["$path"]="${meta%% *} ${meta##* }"
    done < <(git ls-tree -r -z "$rev:$dir" 2>/dev/null || true)
}

# The commit the change started from, or nothing when it isn't available.
base_commit() {
    local rev="$1" base
    if [ -n "${BASE:-}" ]; then
        base=$BASE
    elif git rev-parse --verify --quiet "$rev^2" >/dev/null; then
        base="$rev^1"
    else
        base="$rev^"
    fi
    if git cat-file -e "$base^{tree}" 2>/dev/null; then
        echo "$base"
    fi
}

# Which directory a path was edited in, comparing it with the base: claude,
# agents, or unknown.
edited_side() {
    local path="$1"
    local bc="${base_claude[$path]:--}" ba="${base_agents[$path]:--}"
    local cc="${cur_claude[$path]:--}" ca="${cur_agents[$path]:--}"
    if [ -z "$have_base" ] || [ "$bc" != "$ba" ]; then
        echo unknown
    elif [ "$cc" != "$bc" ] && [ "$ca" = "$ba" ]; then
        echo claude
    elif [ "$ca" != "$ba" ] && [ "$cc" = "$bc" ]; then
        echo agents
    else
        echo unknown
    fi
}

# The command that makes the other directory's copy of a path match <from>'s.
copy_command() {
    local path="$1" from="$2" to="$3" from_entries
    if [ "$from" = "$CLAUDE" ]; then
        from_entries=claude
    else
        from_entries=agents
    fi
    local -n source="cur_$from_entries"
    if [ -n "${source[$path]:-}" ]; then
        printf 'mkdir -p %q && cp -p %q %q\n' "$(dirname "$to/$path")" "$from/$path" "$to/$path"
    else
        printf 'rm %q\n' "$to/$path"
    fi
}

main() {
    local rev="${1:-HEAD}" path reason base have_base="" side
    local -a differing=() claude_side=() agents_side=() unknown_side=()
    local -A why=()

    if ! git rev-parse --verify --quiet "$rev^{tree}" >/dev/null; then
        fail "$rev does not resolve in this checkout; fetch it first when the checkout is shallow"
    fi
    require_tree "$rev" "$CLAUDE"
    require_tree "$rev" "$AGENTS"

    load cur_claude "$rev" "$CLAUDE"
    load cur_agents "$rev" "$AGENTS"

    local -A all=()
    for path in "${!cur_claude[@]}" "${!cur_agents[@]}"; do all["$path"]=1; done
    while IFS= read -r -d '' path; do
        local c="${cur_claude[$path]:--}" a="${cur_agents[$path]:--}"
        [ "$c" = "$a" ] && continue
        if [ "$a" = - ]; then
            reason="only in $CLAUDE"
        elif [ "$c" = - ]; then
            reason="only in $AGENTS"
        else
            reason=""
            [ "${c#* }" != "${a#* }" ] && reason="contents differ"
            [ "${c%% *}" != "${a%% *}" ] && reason="${reason:+$reason, }file mode differs"
        fi
        differing+=("$path")
        why["$path"]=$reason
    done < <(printf '%s\0' "${!all[@]}" | LC_ALL=C sort -z)

    if [ "${#differing[@]}" -eq 0 ]; then
        echo "$AGENTS matches $CLAUDE at $rev"
        return
    fi

    base=$(base_commit "$rev")
    if [ -n "$base" ]; then
        have_base=1
        load base_claude "$base" "$CLAUDE"
        load base_agents "$base" "$AGENTS"
    fi

    echo "$AGENTS differs from $CLAUDE at $rev:" >&2
    for path in "${differing[@]}"; do
        side=$(edited_side "$path")
        case "$side" in
            claude) claude_side+=("$path"); reason=" ($CLAUDE changed)" ;;
            agents) agents_side+=("$path"); reason=" ($AGENTS changed)" ;;
            *) unknown_side+=("$path"); reason="" ;;
        esac
        printf '  %s: %s%s\n' "$path" "${why[$path]}" "$reason" >&2
    done

    print_fixes
    [ -z "${FIX:-}" ] || echo "$FIX" >&2
    fail "$AGENTS differs from $CLAUDE in ${#differing[@]} file(s); the log lists them and the commands that fix them"
}

# Prints the commands for each group of differing paths, then the git add.
print_fixes() {
    local path
    if [ "${#claude_side[@]}" -gt 0 ]; then
        echo "Changed in $CLAUDE, so copy to $AGENTS:" >&2
        for path in "${claude_side[@]}"; do echo "  $(copy_command "$path" "$CLAUDE" "$AGENTS")" >&2; done
        if [ "${#agents_side[@]}" -eq 0 ] && [ "${#unknown_side[@]}" -eq 0 ]; then
            echo "or all at once:" >&2
            echo "  rsync -a --delete $CLAUDE/ $AGENTS/" >&2
        fi
    fi
    if [ "${#agents_side[@]}" -gt 0 ]; then
        echo "Changed in $AGENTS, so copy to $CLAUDE:" >&2
        for path in "${agents_side[@]}"; do echo "  $(copy_command "$path" "$AGENTS" "$CLAUDE")" >&2; done
        if [ "${#claude_side[@]}" -eq 0 ] && [ "${#unknown_side[@]}" -eq 0 ]; then
            echo "or all at once:" >&2
            echo "  rsync -a --delete $AGENTS/ $CLAUDE/" >&2
        fi
    fi
    if [ "${#unknown_side[@]}" -gt 0 ]; then
        echo "Can't tell which side changed. To keep the $CLAUDE version:" >&2
        for path in "${unknown_side[@]}"; do echo "  $(copy_command "$path" "$CLAUDE" "$AGENTS")" >&2; done
        echo "To keep the $AGENTS version:" >&2
        for path in "${unknown_side[@]}"; do echo "  $(copy_command "$path" "$AGENTS" "$CLAUDE")" >&2; done
    fi
    echo "Then run: git add $CLAUDE $AGENTS" >&2
}

main "$@"
