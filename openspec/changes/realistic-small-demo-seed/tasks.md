# Tasks: realistic-small-demo-seed

## 1. Seed — fully-green Внутренний BI (data only)

- [ ] 1.1 In `prisma/seed-demo.ts`, `SMALL_DATASET`: set the `PROD_BI` section's
      `ownedStages` to all seven SDLC stages (Planning, Analysis, Design,
      Development, Testing, DevOps, Support).
- [ ] 1.2 Set BI's `productLight` to `green` and remove the `at-risk` risk so BI
      reads fully green. `seedActiveLeadSection` writes one `stageStatus` row per
      `ownedStage` (index 0 takes `productLight`, the rest green), so a green
      `productLight` + 7 `ownedStages` yields seven explicit green stage statuses
      — no empty/dashed "set a status" chips. Confirm this writer behavior holds.
- [ ] 1.3 Keep BI's multi-stage item (Development + Testing) so the multi-stage
      demo still holds; keep fixed UUIDs (determinism).
- [ ] 1.4 Leave Маркетинговый портал and Платформа интеграций unchanged — each
      keeps single-stage ownership so their unowned stages still render.
- [ ] 1.5 Confirm `SMALL_DATASET` still has exactly ONE lead; add no new lead
      rows. Do NOT touch `prisma/seed.ts` or `seed-simple.ts` (middle tier).

## 2. Frontend — muted unowned-stage chip (display only)

- [ ] 2.1 In `apps/web/src/components/lead/stage-chip.tsx`, replace the
      `— unassigned` label (line ~240) with quiet neutral copy for the
      `unassigned` ownership state.
- [ ] 2.2 Replace the `Unassigned · Contact admin` tooltip (line ~171) with
      neutral copy that does not frame the stage as an error or demand an action.
- [ ] 2.3 Keep the muted/dashed low-emphasis treatment and the chip's place in
      the 7-stage row; do not change the `mine` or `locked` paths.
- [ ] 2.4 Keep all copy in English (repo UI-strings rule); the only Russian is
      seed product/stage DATA.

## 3. Tests

- [ ] 3.1 `stage-chip` render test: an `unassigned` chip renders muted, with no
      "Contact admin" prompt and no error framing, and stays in the pipeline.
      No current test pins the literal `— unassigned` / `Unassigned · Contact
    admin` strings (grep-confirmed), but re-check before renaming and update any
      that appear; existing `ownership: "unassigned"` data fixtures are unaffected.
- [ ] 3.2 Regression: the `mine` and `locked` chips are unchanged by the unowned
      copy change.
- [ ] 3.3 Seed-shape assertion (or live-verify, see 4.1): BI in `small` owns all
      seven stages, all green, no risk.

## 4. Update SMALL-tier-dependent test expectations (if any)

- [ ] 4.1 Grep for any test or snapshot that references `Внутренний BI`,
      `PROD_BI`, `SMALL_DATASET`, or a stage-count / ownership shape specific to
      the old `small` seed (e.g. an assertion that BI has unassigned stages or
      fewer than seven owned stages).
      Run: `grep -rn "Внутренний BI\|PROD_BI\|SMALL_DATASET\|unassigned" --include="*.test.*" --include="*.spec.*" --include="*.snap"`.
      As of this change's authoring, no such test or snapshot was found — if any
      surface, update them to reflect BI as fully owned with seven green stages,
      then re-run the gate. Do NOT touch `prisma/seed.ts` (dev/UAT fixture) or
      `prisma/seed-simple.ts` (middle tier) — only `prisma/seed-demo.ts` changes.

## 5. Verify + gate

- [ ] 5.1 `pnpm db:seed:small`, open `/lead/report/<id>` as Vasily: BI shows
      seven owned green chips and no unowned chip; Portal/Integrations show muted
      unowned chips with neutral copy and no error framing.
- [ ] 5.2 `npx prisma generate && pnpm typecheck && pnpm lint && pnpm test &&
    pnpm build` — all green.

## 6. Follow-up (post-merge)

- [ ] 6.1 After the PR merges to main, archive via `opsx:archive`.
