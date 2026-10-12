## Context

See proposal.md and the owner decision in the external C0038-final/BRIEF.json. Three current user FKs cascade, unlike published publisher retention. removeUser already maps any non-publication P2003 into AdminUserConflictError with deactivation guidance.

## Goals / Non-Goals

Retain the referenced reviewer and live review data atomically. No new counts, JavaScript guards, serializers, errors, authorization chains, migration of historic missing data or changes to anchor/report/group cascades.

## Decisions

Before: admin targeted remove→current guards→User delete→three cascading FKs silently erase history. After: same command/guards→User delete→restrictive FK refuses→existing P2003 mapping produces typed conflict. Deactivation still writes only User.isActive.

Change only ReviewAcknowledgement.user, SectionReview.reviewer and RecordComment.reviewer onDelete to Restrict, retaining ON UPDATE CASCADE and current required identities. A forward migration replaces these constraints within one transaction. FK enforcement covers direct database writers and races, unlike pre-delete counts, so no additional JS check is needed.

The real integration owner uses a reference-free subject independently for each of the three models. Real repository deletion and direct Prisma deletion must refuse; complete history/anchor rows and unrelated user are compared before and after. Reference-free deletion and deactivation remain valid. No production seam or database emulator.

Canonical middleware, self/last-admin guards, existing publisher retention and report lifecycle tuple are unchanged. Destructive guard remains required for Root native acceptance.

## Risks / Trade-offs

[Native PostgreSQL verification is not authorized to the author] → Prepare real integration coverage, mark it NOT RUN, and require Root guarded migration/reset/seed and native acceptance before closure.

[Previously cascaded rows cannot be recovered by restrictive DDL] → This change protects existing live references; no invented restoration.

## Migration Plan

Apply the new forward migration after existing history. It changes only three foreign keys and performs no data writes; deploy together with the unchanged existing typed-error handling. Root verifies the migrated schema/native refusal before final aggregate gates. No rollback that restores cascade deletion is proposed; any rollback requires a new owner decision. No flag is needed.
