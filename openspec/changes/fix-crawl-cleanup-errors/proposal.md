## Why

A failed profile write currently prevents browser shutdown and replaces the crawl failure. A failed shutdown is silently accepted. Tickets C4109 and C4179 require every failure to remain observable and cleanup to run independently.

## What Changes

- Attempt browser shutdown even if writing the profile fails.
- Preserve the original crawl error together with cleanup errors.
- Propagate failed shutdown with session identity and its original cause.
- Cover actual filesystem failures and the browser transport boundary with regression tests.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `ui-crawl`: role cleanup must attempt all operations and preserve every failure.

## Impact

Changes are limited to the crawler driver, role worker and their tests. No database, application UI, dependency, CI or delivery configuration changes are required.

## Non-goals

Recording cleanup, recovery, login, traversal and other crawler tickets are separate groups.
