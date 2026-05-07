#!/usr/bin/env bash
set -euo pipefail

DEST="${1:-$HOME/.gsd/defaults.json}"
PROJECT_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
DEFAULT_SRC="$PROJECT_ROOT/.planning/config.json"
RUNTIME="${GSD_RUNTIME:-}"

SKILL_DIRS=("$HOME/.codex/skills" "$PROJECT_ROOT/skills")

append_if_missing() {
  local target_ref="$1"
  local value="$2"
  local -a arr=()
  local item

  case "$target_ref" in
    skill_names)
      if [[ ${#SKILL_NAMES[@]} -gt 0 ]]; then arr=("${SKILL_NAMES[@]}"); fi
      ;;
    planner)
      if [[ ${#PLANNER_SKILLS[@]} -gt 0 ]]; then arr=("${PLANNER_SKILLS[@]}"); fi
      ;;
    executor)
      if [[ ${#EXECUTOR_SKILLS[@]} -gt 0 ]]; then arr=("${EXECUTOR_SKILLS[@]}"); fi
      ;;
    verifier)
      if [[ ${#VERIFIER_SKILLS[@]} -gt 0 ]]; then arr=("${VERIFIER_SKILLS[@]}"); fi
      ;;
    *) return 1 ;;
  esac

  if [[ ${#arr[@]} -gt 0 ]]; then
    for item in "${arr[@]}"; do
      [[ "$item" == "$value" ]] && return 0
    done
  fi

  case "$target_ref" in
    skill_names) SKILL_NAMES+=("$value") ;;
    planner) PLANNER_SKILLS+=("$value") ;;
    executor) EXECUTOR_SKILLS+=("$value") ;;
    verifier) VERIFIER_SKILLS+=("$value") ;;
  esac
}

collect_skill_names() {
  local dir="$1"
  local entry

  [[ -d "$dir" ]] || return

  for entry in "$dir"/*; do
    if [[ -d "$entry" ]]; then
      append_if_missing skill_names "$(basename "$entry")"
    fi
  done
}

join_csv() {
  local out=""
  local item

  for item in "$@"; do
    if [[ -z "$out" ]]; then
      out="$item"
    else
      out="$out,$item"
    fi
  done

  printf '%s' "$out"
}

if [[ ! -f "$DEFAULT_SRC" ]]; then
  echo "Source config not found: $DEFAULT_SRC" >&2
  exit 1
fi

if ! command -v jq >/dev/null 2>&1; then
  echo "jq is required to install gsd defaults with skill injection." >&2
  exit 1
fi

write_with_guard() {
  local src="$1"
  local dest="$2"
  local tmp_dir
  local tmp_file
  local src_real
  local dest_real

  src_real="$(realpath "$src")"
  dest_real="$(realpath -m "$dest")"
  if [[ "$src_real" == "$dest_real" ]]; then
    echo "DEST must not be source config path: $dest" >&2
    exit 1
  fi

  tmp_dir="$(dirname "$dest")"
  mkdir -p "$tmp_dir"
  tmp_file="$(mktemp "${dest}.tmp.XXXXXX")"

  shift 2
  # shellcheck disable=SC2124
  # shellcheck disable=SC2016
  "$@" >"$tmp_file"
  mv "$tmp_file" "$dest"
}

if [[ -z "$RUNTIME" ]]; then
  RUNTIME="$(jq -r '.runtime // "codex"' "$DEFAULT_SRC")"
fi

if [[ "$RUNTIME" != "codex" && "$RUNTIME" != "claude" && "$RUNTIME" != "opencode" ]]; then
  echo "Unsupported GSD_RUNTIME: $RUNTIME" >&2
  exit 1
fi

declare -a SKILL_NAMES=()
declare -a PLANNER_SKILLS=()
declare -a EXECUTOR_SKILLS=()
declare -a VERIFIER_SKILLS=()

for dir in "${SKILL_DIRS[@]}"; do
  collect_skill_names "$dir"
done

if [[ ${#SKILL_NAMES[@]} -eq 0 ]]; then
  echo "No installed skills found. Writing source config with runtime=$RUNTIME: $DEST" >&2
  # shellcheck disable=SC2016
  write_with_guard "$DEFAULT_SRC" "$DEST" jq --arg runtime "$RUNTIME" '.runtime = $runtime' "$DEFAULT_SRC"
  echo "GSD defaults installed: $DEST"
  echo "Source: $DEFAULT_SRC"
  echo "Runtime: $RUNTIME"
  exit 0
fi

for skill in "${SKILL_NAMES[@]}"; do
  if [[ "$skill" == cp-* || "$skill" == jmix-expert || "$skill" == feynman ]]; then
    append_if_missing planner "$skill"
    append_if_missing executor "$skill"
    append_if_missing verifier "$skill"
    continue
  fi

  append_if_missing executor "$skill"

  case "$skill" in
    gsd-discuss* | gsd-plan* | gsd-spec* | gsd-explore | gsd-map-codebase | \
      gsd-new-project | gsd-new-milestone | gsd-graphify | gsd-ns-context | \
      gsd-ns-ideate | gsd-ns-manage | gsd-ns-workflow | gsd-ui-phase | \
      gsd-health | gsd-autonomous | gsd-capture | gsd-ingest-docs)
      append_if_missing planner "$skill"
      ;;
  esac

  case "$skill" in
    gsd-audit* | gsd-code-review | gsd-review* | gsd-verify* | \
      gsd-validate* | gsd-forensics | gsd-secure* | gsd-eval* | gsd-ui-review)
      append_if_missing verifier "$skill"
      ;;
  esac
done

PLANNER_SKILLS_CSV="$(join_csv "${PLANNER_SKILLS[@]}")"
EXECUTOR_SKILLS_CSV="$(join_csv "${EXECUTOR_SKILLS[@]}")"
VERIFIER_SKILLS_CSV="$(join_csv "${VERIFIER_SKILLS[@]}")"

if [[ -z "$PLANNER_SKILLS_CSV" || -z "$EXECUTOR_SKILLS_CSV" || -z "$VERIFIER_SKILLS_CSV" ]]; then
  echo "Failed to build role-based skill buckets from installed skill set" >&2
  exit 1
fi

# shellcheck disable=SC2016
write_with_guard "$DEFAULT_SRC" "$DEST" jq \
  --arg planner "$PLANNER_SKILLS_CSV" \
  --arg executor "$EXECUTOR_SKILLS_CSV" \
  --arg verifier "$VERIFIER_SKILLS_CSV" \
  --arg runtime "$RUNTIME" \
  '
    .runtime = $runtime
    | .agent_skills = (.agent_skills // {})
    | .agent_skills["gsd-planner"] = $planner
    | .agent_skills["gsd-executor"] = $executor
    | .agent_skills["gsd-verifier"] = $verifier
  ' "$DEFAULT_SRC"

echo "GSD defaults installed: $DEST"
echo "Source: $DEFAULT_SRC"
echo "Runtime: $RUNTIME"
echo "Planner skills: $(tr "," "\n" <<<"$PLANNER_SKILLS_CSV" | wc -l | tr -d ' ')"
echo "Executor skills: $(tr "," "\n" <<<"$EXECUTOR_SKILLS_CSV" | wc -l | tr -d ' ')"
echo "Verifier skills: $(tr "," "\n" <<<"$VERIFIER_SKILLS_CSV" | wc -l | tr -d ' ')"
