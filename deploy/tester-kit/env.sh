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
# Returns only once the recorded child itself listens on the local port. Check
# and start run under a per-name mkdir lock (atomic; macOS has no flock), so two
# callers cannot both start a forward and lose one PID.
pf_start() {
  local lock="$STATE_DIR/pf-$1.lock" held=0
  for _ in $(seq 1 300); do
    if mkdir "$lock" 2>/dev/null; then held=1; break; fi
    sleep 0.1
  done
  [ "$held" = 1 ] || { echo "pf-$1: $lock is held; remove it if no pf_start is running." >&2; exit 1; }
  # Bind the path now: function locals are gone when an exit runs the trap.
  ( trap "rmdir $(printf '%q' "$lock")" EXIT; pf_start_locked "$@" ) || exit $?
}

pf_start_locked() {
  local pidf="$STATE_DIR/pf-$1.pid" log="$STATE_DIR/pf-$1.log" pid recorded
  local want="port-forward --address 127.0.0.1 svc/$2 $3:$4"
  if pf_owned "$1"; then
    IFS="$(printf '\t')" read -r pid _ recorded <"$pidf"
    # Reuse only the requested forward whose own process listens now. A verified-owned
    # record for another target or one that never listened is replaced (pf_owned already
    # proved the PID is ours); a foreign process never reaches this branch.
    if [ "$recorded" = "$want" ] && lsof -a -p "$pid" -iTCP:"$3" -sTCP:LISTEN >/dev/null 2>&1; then return; fi
    pf_stop "$1"
    for _ in $(seq 1 25); do lsof -iTCP:"$3" -sTCP:LISTEN >/dev/null 2>&1 || break; sleep 0.2; done
  fi
  rm -f "$pidf"
  if lsof -iTCP:"$3" -sTCP:LISTEN >/dev/null 2>&1; then
    echo "Port $3 is busy (another stand or program). Free it and re-run." >&2
    exit 1
  fi
  nohup kubectl -n "$NS" port-forward --address 127.0.0.1 "svc/$2" "$3:$4" >"$log" 2>&1 &
  pid=$!
  for _ in $(seq 1 50); do
    if lsof -a -p "$pid" -iTCP:"$3" -sTCP:LISTEN >/dev/null 2>&1; then
      printf '%s\t%s\t%s\n' "$pid" "$(ps -o lstart= -p "$pid" 2>/dev/null)" \
        "$want" >"$pidf"
      return
    fi
    kill -0 "$pid" 2>/dev/null || break
    sleep 0.2
  done
  kill "$pid" 2>/dev/null || true
  echo "pf-$1: port-forward to svc/$2 did not listen on $3; see $log" >&2
  tail -n 5 "$log" >&2 || true
  exit 1
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
