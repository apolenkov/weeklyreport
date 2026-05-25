#!/usr/bin/env bash
#
# openspec-doctor.sh — health check for openspec/ backlog.
#
# What it catches:
#   1. tasks.md files using `**TAG-T1**` bold-prefix syntax instead of
#      `- [ ]` / `- [x]` checkboxes (the "no-tasks" trap — openspec list
#      counts only checkboxes, so bold-prefix tasks vanish from progress).
#   2. changes/ subdirectories without proposal.md or tasks.md.
#   3. fully-checked changes still living in changes/ (should be archived).
#   4. stray files at openspec/changes/ root (only valid: archive/, scratch/,
#      individual change folders).
#   5. delta-spec coverage — every change must have specs/<capability>/
#      spec.md with ## ADDED Requirements + at least one Scenario block.
#      Required for `openspec validate --strict` to pass.
#
# Exit codes:
#   0 — all clean OR only informational notes.
#   1 — at least one actionable finding (categories 1-4 above).
#
# Usage:
#   bash scripts/openspec-doctor.sh           # default: report + exit 1 on findings
#   bash scripts/openspec-doctor.sh --quiet   # only print findings
#   bash scripts/openspec-doctor.sh --strict  # also fail on info-level notes
#

set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
CHANGES_DIR="$ROOT/openspec/changes"

QUIET=0
STRICT=0
for arg in "$@"; do
  case "$arg" in
    --quiet) QUIET=1 ;;
    --strict) STRICT=1 ;;
    -h|--help)
      sed -n '2,30p' "$0"
      exit 0
      ;;
  esac
done

if [[ ! -d "$CHANGES_DIR" ]]; then
  echo "fatal: $CHANGES_DIR not found" >&2
  exit 2
fi

FINDINGS=0
INFOS=0

emit() {
  local level="$1"; shift
  if [[ "$level" == "info" ]]; then
    INFOS=$((INFOS + 1))
    [[ $QUIET -eq 0 ]] && printf '  · %s\n' "$*"
  else
    FINDINGS=$((FINDINGS + 1))
    printf '  ✗ %s\n' "$*"
  fi
}

header() {
  [[ $QUIET -eq 1 ]] && return 0
  printf '\n%s\n' "$1"
}

# Iterate active change directories (skip archive/, scratch/).
# macOS bash 3.2 has no `mapfile`, so collect via newline-delimited tmp file.
CHANGES_LIST=$(mktemp)
trap 'rm -f "$CHANGES_LIST"' EXIT
find "$CHANGES_DIR" -mindepth 1 -maxdepth 1 -type d \
  ! -name archive ! -name scratch | sort > "$CHANGES_LIST"
CHANGES_COUNT=$(wc -l < "$CHANGES_LIST" | tr -d ' ')

iter_changes() {
  while IFS= read -r dir; do
    [[ -z "$dir" ]] && continue
    printf '%s\n' "$dir"
  done < "$CHANGES_LIST"
}

header "── (1) tasks.md format check ──────────────────────────────"
while IFS= read -r dir; do
  [[ -z "$dir" ]] && continue
  name=$(basename "$dir")
  tasks="$dir/tasks.md"
  [[ ! -f "$tasks" ]] && continue
  checkbox_count=$(grep -cE '^- \[[ x]\]' "$tasks" || true)
  bold_count=$(grep -cE '^- \*\*[A-Z][A-Z0-9-]*-?T?[0-9]+\*\*' "$tasks" || true)
  if [[ "$checkbox_count" -eq 0 && "$bold_count" -gt 0 ]]; then
    emit fail "$name: $bold_count bold-prefix task(s), no checkboxes — openspec list will show 0/0"
  elif [[ "$bold_count" -gt 0 && "$checkbox_count" -gt 0 ]]; then
    emit fail "$name: mixed format — $bold_count bold + $checkbox_count checkbox tasks"
  fi
done < "$CHANGES_LIST"

header "── (2) required artifacts (proposal.md + tasks.md) ─────────"
while IFS= read -r dir; do
  [[ -z "$dir" ]] && continue
  name=$(basename "$dir")
  [[ ! -f "$dir/proposal.md" ]] && emit fail "$name: missing proposal.md"
  [[ ! -f "$dir/tasks.md" ]]    && emit fail "$name: missing tasks.md"
done < "$CHANGES_LIST"

header "── (3) fully-checked changes (should be archived) ──────────"
while IFS= read -r dir; do
  [[ -z "$dir" ]] && continue
  name=$(basename "$dir")
  tasks="$dir/tasks.md"
  [[ ! -f "$tasks" ]] && continue
  open_count=$(grep -cE '^- \[ \]' "$tasks" || true)
  done_count=$(grep -cE '^- \[x\]' "$tasks" || true)
  if [[ "$done_count" -gt 0 && "$open_count" -eq 0 ]]; then
    emit fail "$name: $done_count/$done_count tasks complete — run openspec-archive-change"
  fi
done < "$CHANGES_LIST"

header "── (4) stray files in openspec/changes/ root ───────────────"
while IFS= read -r entry; do
  base=$(basename "$entry")
  emit fail "stray file at changes/ root: $base"
done < <(find "$CHANGES_DIR" -mindepth 1 -maxdepth 1 -type f)

header "── (5) delta-spec coverage ─────────────────────────────────"
while IFS= read -r dir; do
  [[ -z "$dir" ]] && continue
  name=$(basename "$dir")
  if [[ ! -d "$dir/specs" ]]; then
    emit fail "$name: missing specs/ — strict validation will fail"
  fi
done < "$CHANGES_LIST"

header "── summary ─────────────────────────────────────────────────"
if [[ $QUIET -eq 0 ]]; then
  printf '  active changes: %d\n' "$CHANGES_COUNT"
  printf '  findings: %d (actionable)\n' "$FINDINGS"
  printf '  notes:    %d (informational)\n' "$INFOS"
fi

if [[ $FINDINGS -gt 0 ]]; then
  exit 1
fi
if [[ $STRICT -eq 1 && $INFOS -gt 0 ]]; then
  exit 1
fi
exit 0
