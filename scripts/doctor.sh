#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
CONFIG="$ROOT_DIR/.planning/config.json"
FAIL=0

pass() {
  printf '[doctor] PASS %s\n' "$*"
}

warn() {
  printf '[doctor] WARN %s\n' "$*" >&2
}

fail() {
  printf '[doctor] FAIL %s\n' "$*" >&2
  FAIL=1
}

need_cmd() {
  local cmd="$1"
  if command -v "$cmd" >/dev/null 2>&1; then
    pass "command available: $cmd"
  else
    fail "command missing: $cmd"
  fi
}

need_cmd jq
need_cmd gsd-sdk
need_cmd pnpm
need_cmd docker

if command -v codex-proxy >/dev/null 2>&1; then
  pass 'codex-proxy command available'
elif grep -Eq '^[[:space:]]*codex-proxy\(\)' "$HOME/.zshrc" 2>/dev/null; then
  pass 'codex-proxy function defined in ~/.zshrc'
else
  fail 'codex-proxy missing'
fi

if [[ -f "$CONFIG" ]]; then
  pass "config exists: .planning/config.json"
else
  fail "config missing: .planning/config.json"
fi

if command -v jq >/dev/null 2>&1 && [[ -f "$CONFIG" ]]; then
  runtime="$(jq -r '.runtime // ""' "$CONFIG")"
  if [[ "$runtime" == "codex" ]]; then
    pass 'GSD runtime is codex'
  else
    fail "GSD runtime is $runtime, expected codex"
  fi

  if [[ "$(jq -r '.model_profile_overrides.codex.opus // ""' "$CONFIG")" == "gpt-5.5" ]]; then
    pass 'Codex heavy tier maps to gpt-5.5'
  else
    fail 'Codex heavy tier mismatch'
  fi
  if [[ "$(jq -r '.model_profile_overrides.codex.sonnet // ""' "$CONFIG")" == "gpt-5.3-codex" ]]; then
    pass 'Codex standard tier maps to gpt-5.3-codex'
  else
    fail 'Codex standard tier mismatch'
  fi
  if [[ "$(jq -r '.model_profile_overrides.codex.haiku // ""' "$CONFIG")" == "gpt-5.4-mini" ]]; then
    pass 'Codex light tier maps to gpt-5.4-mini'
  else
    fail 'Codex light tier mismatch'
  fi

  if [[ "$(jq -r '.dynamic_routing.tier_models.heavy // ""' "$CONFIG")" == "opus" ]] \
    && [[ "$(jq -r '.dynamic_routing.tier_models.standard // ""' "$CONFIG")" == "sonnet" ]] \
    && [[ "$(jq -r '.dynamic_routing.tier_models.light // ""' "$CONFIG")" == "haiku" ]]; then
    pass 'dynamic routing tiers are heavy/standard/light -> opus/sonnet/haiku'
  else
    fail 'dynamic routing tier aliases mismatch'
  fi

  for key in workflow.code_review workflow.ui_review workflow.nyquist_validation graphify.enabled; do
    if [[ "$(jq -r ".$key // false" "$CONFIG")" == "true" ]]; then
      pass "$key enabled"
    else
      fail "$key disabled"
    fi
  done
fi

if [[ "${GSD_RUNTIME:-codex}" == "codex" ]]; then
  pass 'GSD_RUNTIME resolves to codex'
else
  warn "GSD_RUNTIME=${GSD_RUNTIME}; use codex-proxy or GSD_RUNTIME=codex for Codex sessions"
fi

if [[ -d /Users/ap/work/core-principles ]]; then
  pass 'managed source exists: /Users/ap/work/core-principles'
else
  warn 'managed source not found: /Users/ap/work/core-principles'
fi

if [[ -f "$ROOT_DIR/scripts/bootstrap-gsd-defaults.sh" ]]; then
  pass 'bootstrap-gsd-defaults.sh exists'
else
  fail 'bootstrap-gsd-defaults.sh missing'
fi

if docker compose -f "$ROOT_DIR/docker-compose.yml" -f "$ROOT_DIR/docker-compose.dev.yml" config -q >/dev/null 2>&1; then
  pass 'Docker Compose dev config is valid'
else
  fail 'Docker Compose dev config is invalid'
fi

if [[ $FAIL -ne 0 ]]; then
  exit 1
fi

printf '[doctor] OK\n'
