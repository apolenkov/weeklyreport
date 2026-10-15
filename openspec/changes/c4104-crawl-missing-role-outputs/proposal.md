# Proposal

## Why

The UI crawler writes `report.json` and `report.md` from whichever role
outputs it can read. A missing, unreadable, corrupt or wrongly shaped
`role-<name>.json` is dropped silently: the process exits non-zero, but the
report itself does not say which role is absent, while the error says
"see report" (C4104). The full-walk merge (`scripts/ui-crawl/merge.ts`) has
the same gap one level up: a pass directory without `report.json` is skipped
and a pass report's own gaps are not carried into the merged report.

## What Changes

- Each requested role whose output cannot be used is listed in `report.json`
  (`missing`, with role and reason) and as a warning at the top of
  `report.md`; the run still exits non-zero.
- The full-walk merge lists pass directories with a missing or unreadable
  `report.json` and carries every pass's `missing` entries into the merged
  report, writes the honest partial result and exits non-zero.
- Raw role and pass outputs are kept as found; nothing is repaired or deleted.

## Capabilities

### ui-crawl

ADDED: missing crawl outputs are reported, not dropped.

## Impact

`scripts/ui-crawl/crawl.ts`, `scripts/ui-crawl/merge.ts`,
`scripts/ui-crawl/report.ts`, a new role-output reader and their tests;
`deploy/tester-kit/walk.sh` keeps a failed merge in its exit status.
