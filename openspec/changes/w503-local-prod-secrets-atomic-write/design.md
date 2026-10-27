# Design

## Context

See proposal.md. `deploy/local-prod/setup.sh` writes the nine consumed secrets
with one heredoc redirect into `secrets.env`, sources the file, and validates
that every value is non-empty. The `[ ! -f secrets.env ]` gate is the only
re-run contract, and a partially written file satisfies it.

## Goals / Non-Goals

**Goals:** publish generated secrets atomically, keep the published file private,
and keep an interrupted run from leaving reusable partial input.

**Non-Goals:** change how `realm.json` is generated or rewritten; rotate,
validate, or repair operator-provided values; clean residue from older script
versions; change the secret value formats or the required-key list.

## Decisions

Reserve a temporary file with `mktemp` in `STATE_DIR`, write the heredoc into it,
set mode `600`, and `mv` it to `secrets.env` in the same directory. The rename
publishes the complete content in one step, so a later run sees either the
complete file or no file. An `EXIT` trap removes the temporary file when the run
stops before publication. `STATE_DIR` is already private (mode `700`, `umask
077`), so no broader permission change is needed.

Before: generation is interrupted -> truncated `secrets.env` -> the next run's
existence gate skips generation -> the non-empty check passes -> the truncated
password is sourced and deployed.

After: generation is interrupted -> no `secrets.env` is published and the
temporary file is removed -> the next run generates all nine values -> the
complete file is published.

The regression stays in `local-prod-certificate.test.ts`, which already runs the
real script with a stubbed `kubectl`, `envsubst`, and OpenSSL wrapper. The
fixture stubs the external `cat` writer of the heredoc so the last value reaches
the file only as a prefix, then the writer exits as interrupted. Assertions are
on observable results: the interrupted run exits nonzero with no `secrets.env`,
the next run exits zero, mutates Kubernetes, and publishes every value matching
its complete `openssl rand -hex` shape at mode `600`.

## Risks / Trade-offs

- A `SIGKILL` bypasses the `EXIT` trap and leaves an orphaned temporary file;
  the next run reserves a fresh name, so the orphan never becomes `secrets.env`.
- `mktemp` becomes a script dependency; other deploy scripts already use it.
- An operator-provided truncated file from an older run stays undetected, which
  matches the current non-empty-only validation policy.

## Migration Plan

Deliver the source, regression, and spec delta together after focused checks and
independent review; rollback is the commit reversal. The full repository gates
and integration belong to the root coordinator.
