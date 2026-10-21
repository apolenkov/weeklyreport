#!/bin/sh
# Blocking secret scan of the published commit tree and full Git history.
# Findings are redacted, so a leaked value never reaches job logs. A control
# run on synthetic secrets proves the scanner can fail before the repository
# is trusted: HEAD secret, history-only secret and a clean repository.
set -eu

BIN="${GITLEAKS_BIN:-gitleaks}"
ROOT="$(git rev-parse --show-toplevel)"
CONFIG="$ROOT/.gitleaks.toml"

# A reused runner checkout is usually shallow; history needs every commit.
if [ "$(git -C "$ROOT" rev-parse --is-shallow-repository)" = true ]; then
  git -C "$ROOT" fetch --unshallow --quiet
fi
if [ "$(git -C "$ROOT" rev-parse --is-shallow-repository)" != false ]; then
  echo "secret-scan: shallow clone; cannot scan history" >&2
  exit 2
fi

# Relative target: allowlist paths are repository-relative, absolute ones never match.
scan_tree() { (cd "$1" && "$BIN" dir --no-banner -v --redact --exit-code 1 --config .gitleaks.toml .); }
# Only the commits reachable from the given ref, not other branches left in a reused clone.
scan_history() { "$BIN" git --no-banner -v --redact --exit-code 1 --config "$1/.gitleaks.toml" --log-opts="$2" "$1"; }

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
expect pass "clean history" scan_history "$CONTROL" HEAD

# Synthetic GitHub-token shape assembled at run time, never stored in Git.
printf 'token=%s%s\n' ghp_ 'R7kP2mXq9ZtL4vBn8WcD1sYh6JfA3gUe5NoE' > "$CONTROL/leak.txt"
git -C "$CONTROL" add -A
git -C "$CONTROL" commit -q -m "control: leak in HEAD"
expect fail "secret in HEAD tree" scan_tree "$CONTROL"
expect fail "secret in HEAD history" scan_history "$CONTROL" HEAD

git -C "$CONTROL" rm -q leak.txt
git -C "$CONTROL" commit -q -m "control: remove leak"
expect pass "history-only secret, tree" scan_tree "$CONTROL"
expect fail "history-only secret, history" scan_history "$CONTROL" HEAD

# Match a clean CI checkout, excluding local dependencies and build caches.
# Archive failure must stop before extraction, so do not use a shell pipeline.
TREE="$CONTROL/published-tree"
mkdir "$TREE"
git -C "$ROOT" archive --format=tar --output="$CONTROL/published.tar" "${CI_COMMIT_SHA:-HEAD}"
tar -xf "$CONTROL/published.tar" -C "$TREE"
scan_tree "$TREE" || { echo "secret-scan: secrets found in the published tree" >&2; exit 1; }
scan_history "$ROOT" "${CI_COMMIT_SHA:-HEAD}" || { echo "secret-scan: secrets found in Git history" >&2; exit 1; }
echo "secret-scan: published tree and history clean; controls passed"
