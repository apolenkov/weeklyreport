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

# pf_owned <name>: the pidfile still describes the live process pf_start
# spawned — same numeric PID, same start time, and the command line still
# carries the recorded forward target. A bare PID is not identity: reused,
# dead, old-format or partial records fail closed instead of being trusted.
pf_owned() {
  local pidf="$STATE_DIR/pf-$1.pid" pid started target
  [ -f "$pidf" ] || return 1
  IFS="$(printf '\t')" read -r pid started target <"$pidf" || return 1
  case $pid in ''|*[!0-9]*) return 1 ;; esac
  [ -n "$started" ] && [ -n "$target" ] || return 1
  kill -0 "$pid" 2>/dev/null || return 1
  [ "$(ps -o lstart= -p "$pid" 2>/dev/null)" = "$started" ] || return 1
  case "$(ps -ww -o command= -p "$pid" 2>/dev/null)" in
    *"$target"*) return 0 ;;
  esac
  return 1
}

# pf_start <name> <svc> <local-port> <remote-port>: background port-forward, pid kept in STATE_DIR.
pf_start() {
  local pidf="$STATE_DIR/pf-$1.pid" pid
  if pf_owned "$1"; then return; fi
  rm -f "$pidf"
  if lsof -iTCP:"$3" -sTCP:LISTEN >/dev/null 2>&1; then
    echo "Port $3 is busy (another stand or program). Free it and re-run." >&2
    exit 1
  fi
  nohup kubectl -n "$NS" port-forward --address 127.0.0.1 "svc/$2" "$3:$4" >"$STATE_DIR/pf-$1.log" 2>&1 &
  pid=$!
  printf '%s\t%s\t%s\n' "$pid" "$(ps -o lstart= -p "$pid" 2>/dev/null)" \
    "port-forward --address 127.0.0.1 svc/$2 $3:$4" >"$pidf"
}

# pf_stop <name>: signal only the recorded forward. A pidfile whose PID is
# alive but fails the identity check belongs to another process — it is left
# alone, never signalled.
pf_stop() {
  local pidf="$STATE_DIR/pf-$1.pid" pid rest
  [ -f "$pidf" ] || return 0
  IFS="$(printf '\t')" read -r pid rest <"$pidf" 2>/dev/null || true
  if pf_owned "$1"; then
    kill "$pid" 2>/dev/null || true
  elif [ -n "$pid" ] && kill -0 "$pid" 2>/dev/null; then
    echo "pf-$1: PID $pid is alive but is not the recorded port-forward; leaving it alone." >&2
  fi
  rm -f "$pidf"
}
