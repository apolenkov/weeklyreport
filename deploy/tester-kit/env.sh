# Shared settings, sourced by start/reset/stop/setup. Not executed directly.
NS=${NS:-wr-tester}
STATE_DIR=${STATE_DIR:-$HOME/.local/state/wr-tester}
HERE=$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)
REPO=$(cd "$HERE/../.." && pwd)
# Browser-facing ports. Override them (with NS and STATE_DIR) to run a second
# stand beside an existing one: start.sh feeds them into the SAML URLs.
APP_PORT=${APP_PORT:-8080}
KC_PORT=${KC_PORT:-8081}
MAIL_PORT=${MAIL_PORT:-8026}

# pf_start <name> <svc> <local-port> <remote-port>: background port-forward, pid kept in STATE_DIR.
pf_start() {
  local pidf="$STATE_DIR/pf-$1.pid"
  if [ -f "$pidf" ] && kill -0 "$(cat "$pidf")" 2>/dev/null; then return; fi
  if lsof -iTCP:"$3" -sTCP:LISTEN >/dev/null 2>&1; then
    echo "Port $3 is busy (another stand or program). Free it and re-run." >&2
    exit 1
  fi
  nohup kubectl -n "$NS" port-forward --address 127.0.0.1 "svc/$2" "$3:$4" >"$STATE_DIR/pf-$1.log" 2>&1 &
  echo $! >"$pidf"
}

# pf_stop <name>
pf_stop() {
  local pidf="$STATE_DIR/pf-$1.pid"
  [ -f "$pidf" ] && kill "$(cat "$pidf")" 2>/dev/null || true
  rm -f "$pidf"
}
