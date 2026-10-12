# Design

## Context

See proposal.md and TASK-505. The optional reviewedBy relation currently uses SET NULL. C0038 already rejects referenced reviewer deletion through database RESTRICT and the existing typed user-conflict mapping.

## Goals / Non-Goals

Retain future non-NULL reopen authors atomically. No UI, snapshot fields, guessed legacy authors, or changes to role/lifecycle authorization.

## Decisions

Use ON DELETE RESTRICT with ON UPDATE CASCADE, approved by coordinator wrk-90 [583beb] at 2026-10-13 01:43. One atomic ALTER TABLE replaces the FK in a forward migration. Reuse the admin deletion conflict and deactivation command. Actor snapshots would expand the model and were rejected for this MVP.

Before: user deletion → FK SET NULL → review date/note survive without author.
After: user deletion with a reopen-author reference → FK refusal → existing typed conflict → optional deactivation; author/date/note survive.

The existing parameterized admin-history integration owner will cover the new relation and both writer orders. Tests use a separate requester so another FK cannot supply a false refusal. A pre-migration fixture comparison verifies nullable legacy rows and existing references survive the actual migration.

## Risks / Trade-offs

A FK replacement locks ReopenRequest while validating existing references; it is applied as one atomic statement before deploying the updated schema. Already lost NULL authors cannot be reconstructed and remain untouched. Report dual-state, canonical role builders, other reviewer constraints and the destructive guard are unchanged.

## Migration Plan

Apply the forward migration through the normal migrator before application deployment. Validate old NULL and live author rows on a guard-approved synthetic target. A failed statement rolls back atomically; no runtime feature flag or legacy compatibility path is added. Rollback to SET NULL would permit losing authors again and requires an explicit owner decision.
