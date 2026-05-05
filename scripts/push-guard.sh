#!/usr/bin/env bash
#
# 34-07 push-guard helper.
#
# `git push origin main` requires VPN access to the corporate GitHub. When
# DNS resolution fails (off-VPN), git emits a generic "could not resolve
# host" error without saying "this is the recurring proxy/DNS thing —
# here's the workaround."
#
# This script detects the no-DNS state and prints the workaround inline,
# OR transparently re-runs the push with the proxy variables unset (which
# is the actual fix for the corporate-GitHub-via-VPN scenario).
#
# Usage:
#   scripts/push-guard.sh                # detect + push
#   scripts/push-guard.sh --quiet        # detect + push, suppress info
#   scripts/push-guard.sh --check-only   # exit 0 if pushable, 1 otherwise
#
# Add to your shell rc as:   alias gpush='scripts/push-guard.sh'
#
# Closes the recurring "13+ commits ahead, can't push" bind.

set -euo pipefail

QUIET=0
CHECK_ONLY=0
for arg in "$@"; do
  case "$arg" in
    --quiet) QUIET=1 ;;
    --check-only) CHECK_ONLY=1 ;;
    *) echo "[push-guard] unknown flag: $arg" >&2; exit 2 ;;
  esac
done

log() {
  if [ "$QUIET" -eq 0 ]; then
    echo "[push-guard] $*"
  fi
}

# Resolve the configured remote URL for `origin`.
REMOTE_URL=$(git config --get remote.origin.url 2>/dev/null || true)
if [ -z "$REMOTE_URL" ]; then
  echo "[push-guard] no `origin` remote configured" >&2
  exit 2
fi

# Extract host. Handles ssh-style (git@host:path) and https-style.
HOST=""
if [[ "$REMOTE_URL" =~ ^git@([^:]+): ]]; then
  HOST="${BASH_REMATCH[1]}"
elif [[ "$REMOTE_URL" =~ ^https?://([^/]+) ]]; then
  HOST="${BASH_REMATCH[1]}"
else
  echo "[push-guard] unrecognised remote URL format: $REMOTE_URL" >&2
  exit 2
fi

log "remote host: $HOST"

# Probe DNS. `getent` is reliable on Linux; fall back to host/dscacheutil on macOS.
dns_ok=1
if command -v getent >/dev/null 2>&1; then
  getent hosts "$HOST" >/dev/null 2>&1 || dns_ok=0
elif command -v host >/dev/null 2>&1; then
  host -W 2 "$HOST" >/dev/null 2>&1 || dns_ok=0
elif command -v dscacheutil >/dev/null 2>&1; then
  dscacheutil -q host -a name "$HOST" 2>/dev/null | grep -q '^ip_address:' || dns_ok=0
else
  log "no DNS-probe tool available; skipping detection"
fi

if [ "$CHECK_ONLY" -eq 1 ]; then
  if [ "$dns_ok" -eq 1 ]; then
    log "host $HOST resolves — push should work"
    exit 0
  else
    log "host $HOST does NOT resolve — likely off-VPN"
    exit 1
  fi
fi

if [ "$dns_ok" -eq 1 ]; then
  log "host $HOST resolves; running plain push"
  exec git push "$@"
fi

# DNS failed. Most often this is the corporate proxy + missing VPN scenario:
# unsetting http_proxy / https_proxy lets the push go direct.
log "host $HOST did NOT resolve."
log "Most common cause: corporate VPN not connected, or proxy env vars routing"
log "                   the request through an unreachable proxy."
log ""
log "Trying workaround: https_proxy=\"\" http_proxy=\"\" git push"
log ""

exec env https_proxy="" http_proxy="" HTTPS_PROXY="" HTTP_PROXY="" git push
