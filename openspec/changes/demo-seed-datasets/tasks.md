# Tasks: demo-seed-datasets

## 1. Module scaffold

- [ ] 1.1 Add `prisma/seed-demo.ts` with `seedDemo(tier)` and a shared writer.
- [ ] 1.2 Define tier datasets (`small`, `middle`, `huge`) as data, not code
      branches; `middle` reuses the current `seed-simple.ts` content.
- [ ] 1.3 Add `db:seed:small|middle|huge` scripts; retire `db:seed:simple`.

## 2. Canonical-ID + determinism

- [ ] 2.1 Seed `HEAD_USER_ID`, viewer, admin, the used lead IDs,
      `DEFAULT_REPORTING_GROUP_ID`, stage IDs, and `ACTIVE_REPORT_ID` in every
      tier (reuse `seed-constants.ts`).
- [ ] 2.2 Keep all identifiers/content literal; keep period dates week-relative.

## 3. Small-tier content

- [ ] 3.1 3 products: two single-stage, one two-stage (Dev+Test), per design.
- [ ] 3.2 One `ReportSection` per owning lead for the active period with
      `StageStatus`, items (one per owned stage), one risk, one decision.
- [ ] 3.3 Seed one prior `published` period for the used leads.
- [ ] 3.4 Seed one BLOCKED item so the derived Needs-Attention banner has content
      (escalations are computed by `buildEscalationsFromReadSections`, not seeded).

## 4. Verify

- [ ] 4.1 `pnpm db:seed:small` resets cleanly; dev-login + `/head/report/<ACTIVE_REPORT_ID>` load.
- [ ] 4.2 Confirm a multi-stage item renders and single-stage products show one stage.
- [ ] 4.3 Confirm by-lead grouping partitions cleanly (no cross-author mixing).
- [ ] 4.4 Confirm the blocked item surfaces a Needs-Attention banner (dedup is
      verified in `report-card-clarity`, not here).
- [ ] 4.5 `seed.ts` untouched; full gate green (`prisma generate && typecheck && lint && test && build`).
