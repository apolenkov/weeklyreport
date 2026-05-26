# Fix stage cross-author multi-assignment

## Problem

The Prisma schema currently stores risk stages as a comma-joined string
(e.g., "Dev,Testing,Production") in `draftRisk.stageCodes`. This creates a
fragile invariant when a risk is shared across multiple stage-owners:

1. **String parsing risk** — no validation that stages are valid enum values or
   properly delimited; a typo or trailing comma breaks parsing.
2. **Race condition** — when multiple leads edit stages on the same risk, the
   last write wins, potentially dropping stages from other authors.
3. **Audit trail** — no way to track which author added which stage.

TODO(STAGE-CROSS-AUTHOR-MULTI) at `lead-form.prisma-repository.ts:764`
suggests moving to a join table.

## Solution

Refactor the data model:

- Create a new `RiskStage` join table:

  ```sql
  CREATE TABLE RiskStage (
    id UUID PRIMARY KEY,
    draftRiskId UUID NOT NULL REFERENCES DraftRisk(id) ON DELETE CASCADE,
    stageCode VARCHAR(50) NOT NULL,
    addedByUserId UUID NOT NULL REFERENCES User(id),
    createdAt TIMESTAMP DEFAULT NOW(),
    UNIQUE(draftRiskId, stageCode)
  );
  ```

- Migrate existing comma-joined strings to rows in RiskStage.
- Update `DraftRisk` model to use `draftRisk.stages: RiskStage[]` relation.
- Update web consumers to build stage arrays instead of joined strings.

## Non-goals

- Change stage enumeration or validation rules.
- Refactor risk editing workflows.
- Touch archived or published risks.

## Source

- TODO(STAGE-CROSS-AUTHOR-MULTI) marker at `lead-form.prisma-repository.ts:764`.
- Regression surface identified in Phase 50 data-modeling audit.

## Activation trigger

(Active — schema design needed for v8.5 data integrity.)
