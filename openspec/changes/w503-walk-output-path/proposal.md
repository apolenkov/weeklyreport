# Proposal

## Why

TASK-503 C0096: `walk.sh --out=directory` forwards the override to the crawler
without updating the full-run merge directory. Reports can therefore be written
outside the directory subsequently merged by the wrapper.

## What Changes

- Consume both existing CLI forms, `--out directory` and `--out=directory`, in
  the wrapper so quick crawls, full state passes and final merge share one path.
- Reject an empty equals-form path, as the separate-value form already does.

## Capabilities

### Modified Capabilities

- `ui-crawl`: explicit output paths propagate through the tester-kit runner.

## Impact

`deploy/tester-kit/walk.sh` and its existing mocked operation tests. Backlog:
TASK-503; evidence: `~/work/handoffs/task-503/wave-02/`. No dependencies change.

## Non-goals

- No change to crawl traversal, report format, synthetic guards or cleanup.
