# Tasks: demo-seed-datasets

## 1. Module scaffold (surgical — see design.md "Structure")

- [x] 1.1 Add `prisma/seed-demo.ts` with `seedDemo(tier: "small" | "huge")`, a
      shared writer, and a `process.argv` tier dispatch.
- [x] 1.2 Define the `small` + `huge` tier datasets as plain data, not code
      branches. `middle` is NOT folded in — it delegates to the proven
      `seed-simple.ts` as-is (preserves the byte-stable visual baseline +
      reset-hard's manual-UAT baseline).
- [x] 1.3 Add `db:seed:small|middle|huge` scripts (`small` default;
      `middle` → `tsx prisma/seed-simple.ts`). No `db:seed:simple` to retire.

## 2. Canonical-ID + determinism

- [x] 2.1 Seed `HEAD_USER_ID`, viewer, admin, the used lead IDs,
      `DEFAULT_REPORTING_GROUP_ID`, stage IDs, and `ACTIVE_REPORT_ID` in every
      tier (reuse `seed-constants.ts`).
- [x] 2.2 Keep all identifiers/content literal; keep period dates week-relative.

## 3. Small-tier content

- [x] 3.1 3 products: two single-stage, one two-stage (Dev+Test), per design.
- [x] 3.2 One `ReportSection` per owning lead for the active period with
      `StageStatus`, items (one per owned stage), one risk, one decision.
- [x] 3.3 Seed one prior `published` period for the used leads.
- [x] 3.4 Seed one BLOCKED item so the derived Needs-Attention banner has content
      (escalations are computed by `buildEscalationsFromReadSections`, not seeded).

## 4. Verify

- [x] 4.1 `pnpm db:seed:small` resets cleanly; dev-login + `/head/report/<ACTIVE_REPORT_ID>` load.
- [x] 4.2 Confirm a multi-stage item renders and single-stage products show one stage.
- [x] 4.3 Confirm by-lead grouping partitions cleanly (no cross-author mixing).
- [x] 4.4 Confirm the blocked item surfaces a Needs-Attention banner (dedup is
      verified in `report-card-clarity`, not here).
- [x] 4.5 `seed.ts` untouched; full gate green (`prisma generate && typecheck && lint && test && build`).
