# Design

## Context

See proposal.md for motivation. Existing targets use second-resolution dates;
the partial path is shared by every run with that stamp. Health and retention
consume the `weeklyreport-*.dump` glob, and restore receives an explicit filename.
The image bakes the shell entrypoints into the release; this package does not
build or deploy that image.

## Goals / Non-Goals

Preserve completed payloads and isolate each run's temporary file. Keep one-shot
status, failure cleanup, retention and health consumers compatible. Do not alter
mounted-directory permissions or the accepted credential environment contract.

## Decisions

Before: stamp → shared partial → pg_dump → replacing mv → log/prune.

After: umask 077 → stamp → mktemp-owned partial → pg_dump → mv -n → prove
the temporary source was consumed → log/prune. Failures clean only that run's
temporary file and return non-zero in one-shot mode.

Use a mktemp template ending in XXXXXX for the native shell and the image's
BusyBox utility. Derive a complete filename carrying the same dated prefix and
reserved suffix, ending in .dump. Keep partials outside the complete-dump glob.
Do not use timestamps/PIDs as a uniqueness claim. Check source disappearance
because mv -n can report zero when it skipped an existing destination.

## Risks / Trade-offs

The bounded tests exercise the actual producer and filesystem with finite
pg_dump payload stubs. They do not prove real custom-format archives, image
runtime permissions, production exposure, mount access or a restore drill.
Existing directory modes remain an operator-owned mounted-volume property.

## Migration Plan

Deploy the rebuilt backup image using normal coordinator delivery. No schema,
schedule or volume change. Health/retention retain their existing glob; the
runbook retains selecting the exact successful filename from the Job log.
