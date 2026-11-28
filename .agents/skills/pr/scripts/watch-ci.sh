#!/usr/bin/env bash
# Watch the CI checks on a pull request's head commit until they finish or
# the time budget runs out, then print one line saying what to do next.
#
# Usage: watch-ci.sh [--minutes N] [PR]
#   PR         number, URL or branch; defaults to the current branch's PR
#   --minutes  total time budget, including the wait for checks to
#              register; at least 3, default 9, under the shell tool's limit
#
# Run it from the PR branch's checkout, after pushing. Exit codes:
#   0  every check passed or was skipped
#   1  a check failed or was cancelled
#   2  gh failed, or the arguments are wrong
#   3  no checks registered within 2 minutes
#   4  the checkout isn't at the PR's head commit
#   5  checks still running when the budget ran out
set -uo pipefail

minutes=9
pr=""
while [[ $# -gt 0 ]]; do
  case $1 in
    --minutes)
      if ! [[ ${2:-} =~ ^[1-9][0-9]*$ ]] || (($2 < 3)); then
        echo "ERROR: --minutes needs a whole number, 3 or more. Usage: watch-ci.sh [--minutes N] [PR]"
        exit 2
      fi
      minutes=$2
      shift 2
      ;;
    -h | --help)
      sed -n '2,16p' "$0" | sed 's/^# \{0,1\}//'
      exit 0
      ;;
    -*)
      echo "ERROR: unknown option $1. Usage: watch-ci.sh [--minutes N] [PR]"
      exit 2
      ;;
    *)
      [[ -z $pr ]] || {
        echo "ERROR: more than one PR given. Usage: watch-ci.sh [--minutes N] [PR]"
        exit 2
      }
      pr=$1
      shift
      ;;
  esac
done

poll=10
head_limit=60
settle=30
register_limit=120
start=$SECONDS
deadline=$((start + minutes * 60))
errfile=$(mktemp)
trap 'rm -f "$errfile"' EXIT
sep=$'\x1f'

one_line() { tr '\n' ' ' <"$errfile" | sed 's/  */ /g; s/ $//'; }

run_gh() {
  if command -v timeout >/dev/null 2>&1; then
    timeout 60 gh "$@"
  else
    gh "$@"
  fi
}

local_head=$(git rev-parse HEAD 2>"$errfile") || {
  echo "ERROR: not in a git checkout ($(one_line)). Run this from the PR branch's checkout."
  exit 2
}
short=${local_head:0:7}

matched_at=-1
seen=-1
while :; do
  if ! view=$(run_gh pr view ${pr:+"$pr"} --json number,headRefOid,isDraft \
    --jq "[.number, .headRefOid, .isDraft] | map(tostring) | join(\"$sep\")" 2>"$errfile"); then
    echo "ERROR: gh pr view failed: $(one_line). Check the PR argument and \`gh auth status\`; rerun once if it looks transient."
    exit 2
  fi
  IFS=$sep read -r number pr_head is_draft <<<"$view"

  if [[ $pr_head != "$local_head" ]]; then
    if ((SECONDS - start < head_limit)); then
      matched_at=-1 seen=-1
      sleep "$poll"
      continue
    fi
    pr_short=${pr_head:0:7}
    if ! git cat-file -e "$pr_head^{commit}" 2>/dev/null; then
      echo "WRONG CHECKOUT: PR #$number's head $pr_short isn't in this checkout (local HEAD is $short). Check out the PR branch and pull it, then rerun."
    elif git merge-base --is-ancestor "$pr_head" "$local_head"; then
      echo "WRONG CHECKOUT: local HEAD $short is ahead of PR #$number's head $pr_short. Push, then rerun."
    elif git merge-base --is-ancestor "$local_head" "$pr_head"; then
      echo "WRONG CHECKOUT: PR #$number's head $pr_short is ahead of local HEAD $short. Pull, then rerun."
    else
      echo "WRONG CHECKOUT: local HEAD $short and PR #$number's head $pr_short have diverged. If you amended or rebased the PR branch, push with \`git push --force-with-lease\`; otherwise check out the PR branch. Then rerun."
    fi
    exit 4
  fi
  ((matched_at < 0)) && matched_at=$SECONDS

  if checks=$(run_gh pr checks "$number" --json name,state,link \
    --jq ".[] | [.state, .name, .link] | join(\"$sep\")" 2>"$errfile"); then
    :
  elif grep -q '^no checks reported' "$errfile"; then
    checks=""
  else
    echo "ERROR: gh pr checks failed: $(one_line). Rerun once if it looks transient."
    exit 2
  fi

  count=0 pending=0 failed="" running="" queued=""
  while IFS=$sep read -r state name link; do
    [[ -z $state ]] && continue
    count=$((count + 1))
    case $state in
      SUCCESS | SKIPPED | NEUTRAL) ;;
      ERROR | FAILURE | TIMED_OUT | ACTION_REQUIRED | STARTUP_FAILURE | CANCELLED | STALE)
        detail=""
        [[ $state == FAILURE ]] || detail=$(tr '[:upper:]_' '[:lower:] ' <<<"$state")
        if [[ $link =~ /actions/runs/([0-9]+) ]]; then
          detail+="${detail:+, }run ${BASH_REMATCH[1]}"
        elif [[ -n $link ]]; then
          detail+="${detail:+, }$link"
        fi
        failed+="${failed:+; }$name${detail:+ ($detail)}"
        ;;
      EXPECTED | REQUESTED | WAITING | QUEUED)
        pending=$((pending + 1))
        queued+="${queued:+, }$name"
        ;;
      *)
        pending=$((pending + 1))
        running+="${running:+, }$name"
        ;;
    esac
  done <<<"$checks"

  if [[ -n $failed ]]; then
    echo "FAILED on $short: $failed. Read each with \`gh run view <run-id> --log-failed\`, fix what this change broke, push, and rerun. If this change didn't cause it (a flaky test, main already red), say so in a PR comment instead of changing unrelated code."
    exit 1
  fi

  waited=$((SECONDS - matched_at))
  if ((count == 0)); then
    if ((waited >= register_limit)); then
      echo "NO CHECKS on $short after $((register_limit / 60)) minutes: the workflows' path or event filters skip this change. Nothing to watch; done."
      exit 3
    fi
  elif ((pending == 0 && count == seen && waited >= settle)); then
    ready_note=""
    if [[ $is_draft == true ]]; then
      top=$(git rev-parse --show-toplevel)
      files=$(grep -lE 'ready_for_review|draft' "$top"/.github/workflows/*.y*ml 2>/dev/null |
        sed "s|^$top/||" | tr '\n' ' ' | sed 's/ $//')
      if [[ -n $files ]]; then
        ready_note=" After \`gh pr ready\`, rerun this: $files may run more checks on ready PRs."
      else
        ready_note=" After \`gh pr ready\`, rerun this only if the repo runs more checks on ready PRs, such as an app that skips drafts."
      fi
    fi
    echo "PASSED on $short: every check passed or was skipped ($count). Done; stop watching.$ready_note"
    exit 0
  fi
  seen=$count

  if ((SECONDS + poll > deadline)); then
    [[ -n $running ]] && running=" Running: $running."
    [[ -n $queued ]] && queued=" Queued: $queued; if these are still queued on the next run, report a runner or queue problem and stop."
    echo "TIMED OUT on $short after $minutes minutes: $pending of $count checks still pending.$running$queued Rerun this to keep watching, up to about twice the repo's usual CI time."
    exit 5
  fi
  sleep "$poll"
done
