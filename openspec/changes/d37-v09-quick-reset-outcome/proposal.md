# Proposal

## Why

A failed quick crawl exits before a requested --reset, despite the documented promise to restore demo data afterwards. D37-V09 C0099 and the existing walk.sh/README.md command contract identify this control-flow gap; genuine subprocess RED captures the skipped reset attempt and missing independent reset diagnostic.

## What Changes

- Keep the crawler exit as the primary outcome.
- Attempt the requested reset after crawler success or failure.
- Disclose reset failure separately, returning its exit when the crawler succeeded.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `ui-crawl`: clarify the already documented quick --reset outcome.

## Impact

Only the quick branch of tester-kit walk.sh and its command-boundary regression change. The full branch's existing guarded cleanup remains intact.

## Non-goals

- Running or simulating native reset, database guards or browser acceptance.
- Resetting a quick run when --reset was not requested.
- Adding a new stand or failure recovery policy.
