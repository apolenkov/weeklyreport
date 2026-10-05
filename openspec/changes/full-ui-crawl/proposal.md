# Full UI crawl

The tester-kit walk currently closes new UI before inspecting its controls and
merges report IDs into one page. TASK-145.55 requires a recursive full mode and
explicit coverage of synthetic lifecycle states, while retaining the quick mode.

## Changes

- Add `--quick` and `--full`, bounded recursion and explicit coverage records.
- Traverse nested controls, complete representative rows, admin tabs and report
  URLs; exercise finite filters with deterministic pairwise assignments.
- Prepare verified lifecycle fixtures on the guarded tester database, isolate
  mutable runs and reset even when a crawl fails.
- Report element by state results, screenshots, logs, geometry and accessibility.

## Scope

Consumers: `scripts/ui-crawl/`, `deploy/tester-kit/walk.sh`, the canonical full
seed and its guarded fixture overlay. Existing quick-mode evidence remains
separate from full acceptance. No product UI or lifecycle business rules change.

## Non-goals

- Exhaustive permutations of arbitrary action sequences.
- Production or shared data, external messages, paid AI calls or publication.
- Treating skipped, unknown, truncated or failed checks as passed.
