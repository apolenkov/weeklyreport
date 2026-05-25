# Audit log coverage before UAT

## Problem

Before the next major UAT cycle (particularly for IE/cache/index edge cases), it
is unclear how well application logging covers critical paths. Missing logs
make it difficult to diagnose UAT failures related to stale caches, missing
index entries, or browser-specific issues.

## Solution

Audit the logging footprint across lead-write paths, cache invalidation,
database index operations, and browser-facing API routes. Document coverage gaps
and propose minimal targeted logging additions for visibility during UAT.

## Non-goals

- Add comprehensive structured logging (out of scope for MVP).
- Change log verbosity or format.
- Modify any business logic.

## Source

Operational observation: Phase 61+ UAT requires better log visibility for
rapid issue diagnosis.

## Activation trigger

Activate before the next major UAT sweep (e.g., v8.5 or v9.0 UAT phase) to
ensure logging infrastructure is adequate.
