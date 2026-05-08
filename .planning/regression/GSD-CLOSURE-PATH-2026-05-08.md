# GSD Closure Path - 2026-05-08

## Verdict

Status: active cleanup, not final closure.

The codebase can pass engineering gates, but GSD milestone closure still has
open evidence gaps. This document separates what can be closed automatically
from what still needs a human/browser pass.

## Live GSD Sweep

Commands run from the project root:

- GSD_RUNTIME=codex gsd-sdk query validate.health --raw
- GSD_RUNTIME=codex gsd-sdk query init.progress --raw
- GSD_RUNTIME=codex gsd-sdk query progress --raw
- GSD_RUNTIME=codex node ~/.codex/get-shit-done/bin/gsd-tools.cjs audit-open --json
- GSD_RUNTIME=codex node ~/.codex/get-shit-done/bin/gsd-tools.cjs audit-uat

## Current Status

| Area                  | Result                                                       | Closure impact                                     |
| --------------------- | ------------------------------------------------------------ | -------------------------------------------------- |
| Git tree              | clean before cleanup, dirty after planned docs/archive edits | commit required after review                       |
| Root GSD health       | degraded, not broken                                         | W003 repaired; W007 roadmap/orphan warnings remain |
| Root progress         | 37 historical phase dirs complete                            | does not close v8.1 gate alone                     |
| v8.1 docs             | normalized from BACKLOG to ACTIVE                            | fixed metadata contradiction                       |
| Open audit items      | 6 total                                                      | closure blockers remain                            |
| audit-uat             | returned 0 items                                             | not authoritative; audit-open found real UAT files |
| Nested apps/web state | broken E002/E003/E004                                        | archived locally, no standalone project            |

## Repairs Applied

| Repair                     | Tool                                   | Result                       |
| -------------------------- | -------------------------------------- | ---------------------------- |
| Root .planning/config.json | gsd-sdk query validate.health --repair | created with native defaults |

## Open Items

| Item                  | Source             | Status         | Next action                                      |
| --------------------- | ------------------ | -------------- | ------------------------------------------------ |
| Quick 260426-vxp      | .planning/quick    | major-progress | keep partial unless rerun proves current closure |
| Quick 260506-231028   | .planning/quick    | completed      | no action                                        |
| Quick 260507-000000   | .planning/quick    | completed      | no action                                        |
| Phase 16 UAT          | 16-HUMAN-UAT.md    | 2 pending      | browser/manual evidence required                 |
| Phase 17 UAT          | 17-UAT.md          | 10 pending     | browser/manual evidence required                 |
| Phase 16 verification | 16-VERIFICATION.md | human_needed   | keep explicit until PDF/theme checks run         |

## Priority

1. Phase 16 human-needed verification.
2. Phase 17 UAT visual/browser checks.
3. v8.1 metadata consistency.
4. First validation batch for phases 35, 37, 38, 39.
5. Historical quick task 260426-vxp reclassification.
6. Remaining 33 validation gaps.

## Minimal Verification Batch

Do not generate all missing VERIFICATION.md files at once. The safe first
batch is:

| Phase | Reason                                                         |
| ----- | -------------------------------------------------------------- |
| 16    | only current human_needed verification blocker                 |
| 17    | only current UAT file with 10 pending visual checks            |
| 35    | current UX/product-ready feedback maps here                    |
| 37    | current logging, metrics, Grafana, evidence questions map here |
| 38    | local Docker and deployment readiness map here                 |

Phase 16 and 17 already have verification/UAT files. Phase 35, 37, and 38 now
get explicit verification docs that do not hide remaining follow-ups.

## Minimal Validation Batch

All 37 summary-bearing phases are missing VALIDATION.md. The first validation
batch is phases 35, 37, 38, and 39 because they cover the current release risk:

- UX/product-ready behavior;
- observability and log evidence;
- container/local deployment readiness;
- performance/index/load-test readiness.

The remaining 33 validation gaps stay visible and should be handled in later
small batches grouped by domain, not as a single generated dump.

## Nested apps/web Planning State

apps/web/.planning was a stale local evidence cache, not a standalone GSD
project:

- missing PROJECT.md;
- missing ROADMAP.md;
- missing STATE.md;
- ignored by root .gitignore;
- contained screenshot/evidence artifacts.

It was moved to:

    .planning/local-archive/apps-web-planning-2026-05-08

That archive path is ignored so binary screenshots do not enter the repository.

## Human-Needed Work

The following cannot be honestly closed from static review:

1. Trigger PDF export from the browser and observe BullMQ job completion.
2. Toggle theme in the browser and confirm no visible flash/layout break.
3. Execute phase 17 visual UAT routes and capture screenshots.
4. Decide whether historical quick task 260426-vxp is acceptable as partial or
   needs a fresh rerun.

## Next Gate

After the human/browser batch:

1. update phase 16 UAT/VERIFICATION frontmatter;
2. update phase 17 UAT frontmatter;
3. rerun audit-open --json;
4. rerun validate.health --raw;
5. run code gates only if code changed;
6. commit planning cleanup atomically.
