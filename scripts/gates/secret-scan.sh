#!/bin/sh
# Blocking secret scan of the working tree and the full Git history.
# Findings are redacted, so a leaked value never reaches job logs. A control
# run on synthetic secrets proves the scanner can fail before the repository
# is trusted: HEAD secret, history-only secret and a clean repository.
set -eu

BIN="${GITLEAKS_BIN:-gitleaks}"
ROOT="$(git rev-parse --show-toplevel)"
CONFIG="$ROOT/.gitleaks.toml"

if [ "$(git -C "$ROOT" rev-parse --is-shallow-repository)" != false ]; then
  echo "secret-scan: shallow clone; unshallow before scanning history" >&2
  exit 2
fi

# Relative target: allowlist paths are repository-relative, absolute ones never match.
scan_tree() { (cd "$1" && "$BIN" dir --no-banner --redact --exit-code 1 --config .gitleaks.toml .); }
scan_history() { "$BIN" git --no-banner --redact --exit-code 1 --config "$1/.gitleaks.toml" "$1"; }

expect() { # expect <pass|fail> <label> <command...>
  want="$1"; label="$2"; shift 2
  if "$@" >/dev/null 2>&1; then got=pass; else got=fail; fi
  if [ "$got" != "$want" ]; then
    echo "secret-scan: control '$label' expected $want, got $got" >&2
    exit 3
  fi
}

CONTROL="$(mktemp -d)"
trap 'rm -rf "$CONTROL"' EXIT
cp "$CONFIG" "$CONTROL/.gitleaks.toml"
git -C "$CONTROL" init -q
git -C "$CONTROL" config user.email control@example.invalid
git -C "$CONTROL" config user.name control
printf 'clean\n' > "$CONTROL/clean.txt"
git -C "$CONTROL" add -A
git -C "$CONTROL" commit -q -m clean
expect pass "clean tree" scan_tree "$CONTROL"
expect pass "clean history" scan_history "$CONTROL"

# Synthetic GitHub-token shape assembled at run time, never stored in Git.
printf 'token=%s%s\n' ghp_ 'R7kP2mXq9ZtL4vBn8WcD1sYh6JfA3gUe5NoE' > "$CONTROL/leak.txt"
git -C "$CONTROL" add -A
git -C "$CONTROL" commit -q -m "control: leak in HEAD"
expect fail "secret in HEAD tree" scan_tree "$CONTROL"
expect fail "secret in HEAD history" scan_history "$CONTROL"

git -C "$CONTROL" rm -q leak.txt
git -C "$CONTROL" commit -q -m "control: remove leak"
expect pass "history-only secret, tree" scan_tree "$CONTROL"
expect fail "history-only secret, history" scan_history "$CONTROL"

scan_tree "$ROOT" || { echo "secret-scan: secrets found in the working tree" >&2; exit 1; }
scan_history "$ROOT" || { echo "secret-scan: secrets found in Git history" >&2; exit 1; }
echo "secret-scan: tree and history clean; controls passed"
