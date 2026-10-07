## Why

Reports link disabled or failed video captures and turn absent timing data into zero while overestimating nearest-rank p95. Accepted ops-crawl-video-presence C4151 and ops-crawl-report-statistics C4153 define the remaining low-priority fixes.

## What Changes

- Represent absent video as null and validate recording start/stop before returning a path.
- Report recording failures explicitly.
- Use nearest-rank p95 with sample count; distinguish no measurements from measured zero.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `ui-crawl`: confirmed recording and timing evidence in reports.

## Impact

Crawler types, recording/worker, merge/report and regression tests. No dependencies.

## Non-goals

- Other crawl behavior, database E2E, product UI/API/infra, delivery settings, lockfile and pnpm version.
