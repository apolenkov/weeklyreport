# Proposal

## Why

Removing or moving a stage assignment does not rewrite the stages already
stored on the author's editable records. The section write guard validated
every record in the payload, so one record still carrying a stage the author
no longer owns made every later autosave of that section fail with
`STAGE_NOT_OWNED`, even when the lead edited a different record (C2903). The
service comment already described the guard as checking new or changed rows.

## What Changes

- The stage-ownership guard skips a record saved back exactly as stored: same
  stable lineage, same product and the same stage set. New records, records
  without lineage, and records whose stages or product changed are validated
  as before, so a reused `stableId` cannot smuggle an unowned stage or move a
  record to an unowned product.
- Stored stages are not intersected or rewritten (rejected in C2903).

## Capabilities

### risk-stage-integrity

ADDED: section writes validate stage ownership of new and changed records.

## Impact

`packages/shared/src/schemas/report-sections/section-stage-ownership.ts` (used
by the section save and item-outcome write paths) and the API stage-ownership
tests.
