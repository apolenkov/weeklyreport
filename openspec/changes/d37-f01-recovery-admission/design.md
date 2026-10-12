## Context

F01 preserves all13 cards and26 original findings including recovered clauses and P1 native gaps. Head13/current sources already implement typed missing entities/references, email identity, nonzero vectors, Head membership, changed-owner activity, committed policy-hook outcomes and inactive attached Lead detachment.

## Goals / Non-Goals

**Goals:** enforce the remaining existing parser invariants at real public boundaries and retain exact compatibility.

**Non-Goals:** new date year minimum or Date-only inputs; broader Unicode policy, array caps or transforms; new Head activity/authorization rules; operational SQL work, arbitrary collision remediation or native race/performance claims.

## Decisions

One private unknown→not-null→coerced-date validator replaces fireAt/deadline/scheduledFor/createdAt/updatedAt. sentAt remains intentionally nullable and existing payload ISO validators/lifecycle stay unchanged. Full snapshot createdAt/updatedAt tests use coherent input and prove no restore transaction; minimal real reminder schemas independently prove other date failures.

The existing published lifecycle guard adds autoArchived=>archived at autoArchived issue path. Restore re-parses the actual shared snapshot before transaction; ordinary transitions set archived=true for autoArchive and clear the flag for archive/unarchive. The new forward migration adds Report_auto_archived_state_check without changing old applied migrations or data. Unknown conflicting historical rows must fail constraint validation atomically; no data repair is invented.

Activity name and each Jira account share private safeText validators with the existing write fields and their exact200/100 bounds. Read collection bounds/defaults/readonly and all UUID/attachment/auth rules stay unchanged.

The User lock candidate sort uses the existing explicit UTF-16 code-unit comparator, retaining Set deduplication, sequential NO KEY UPDATE locks and authoritative rereads. This is Root-approved maintenance on current UUID bytes; no runtime defect RED or performance benefit is fabricated.

## Risks / Trade-offs

Stricter reads may expose legacy malformed persisted Activity rows; real mapper compatibility requires Root's synthetic PG lane. Forward CHECK may refuse unknown historical contradictory flags; deployed status is UNVERIFIED and no target/data is touched. Local provision's fixed UUID/autocommit issue remains held until actual required SQL RED. Pure/DOM tests do not prove transactions, native locks or deployment.

## Migration Plan

Root granted exact new20261012110000_report_autoarchive_flag_check/migration.sql. Apply only through Root's guarded target/normal publication. Preserve existing applied migrations and unknown data; no rollback script or row update.

## Open Questions

Root must execute actual PG flag/refusal/restore compatibility and local provisioning RED. Future native race/operation/browser/remote CI acceptance remains separate.
