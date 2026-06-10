# Unify Risk Severity and Stage Status

## Why

User direction (2026-06-10): «хочется, чтобы риск и статус были
согласованы». Today the coupling is half-built: a lead can have a risk
row (severity at-risk, stage Development) while the Development chip
shows on-track — nothing connects them in that direction. The existing
machinery only covers fragments: `computeUnbackedStages`
(`lead-form-sync-bridge.tsx:332`) warns about at-risk/blocked stages
WITHOUT a backing risk, `useStatusRiskSync` (`use-status-risk.ts`)
_suggests_ a chip bump when a risk is filled, and
`deriveEffectiveStageStatus` is deliberately disconnected in
`mapLeadProducts` (`lead-form.ts:399` — PRJ-2: "explicit chip status
must win"). This change SUPERSEDES the PRJ-2 decision — see design.md
D1 for why it is now safe.

## What Changes

1. Risks/blockers are authored ONLY in the Risks section — the single
   source of truth for at-risk/blocked.
2. A non-empty risk covering a stage forces that chip to at least the
   risk's severity (at-risk < blocked). A chip can never show on-track
   while covering risks exist — enforced in both the live form and the
   read-model mapper (`mapLeadProducts` re-connects risk-derived
   status; PRJ-2 superseded).
3. Setting a chip to at-risk/blocked with no covering risk opens the
   risk edit dialog prefilled (product, stage, severity); cancel leaves
   the chip unchanged. The unbacked-stage warning becomes prevention
   for new interactions (the banner stays for legacy loaded data).
4. Setting a chip back to on-track with covering risks asks
   confirmation ("this deletes N risk(s)"); on confirm the covering
   risks are removed, then the chip flips.
5. The old "bump the chip?" suggestion flow (`handleRiskFilled` →
   `requestStatusUpdateConfirmation`) is replaced by the automatic
   severity floor of (2).

Builds on `require-risk-stage` (lands first tonight): every risk has
≥1 concrete stage, so coverage is always explicit.

**Non-goals:** external issue-tracker integration (risks live in the
weekly report); item `workflowStatus` → chip derivation stays
disconnected (risk-only contract); cross-author risks never force or
delete through another lead's chips; no schema/API changes.

## Capabilities

### New Capabilities

- `status-risk-unification`: stage chip status and risk rows are one
  consistent signal — risks force a severity floor on covered chips,
  raising a chip without a risk routes through risk creation, and
  lowering a chip with covering risks routes through confirmed risk
  deletion.

### Modified Capabilities

<!-- none: risk-stage-integrity (require-risk-stage) is built upon,
not modified — its "risk has >=1 stage" contract is a precondition -->

## Impact

- `apps/web/src/hooks/use-status-risk.ts` (+ both test files) —
  interception logic, suggestion flow removal.
- `apps/web/src/components/lead/lead-form-sync-bridge.tsx` (+ test) —
  `computeUnbackedStages` reuse, floor application, dialog signal.
- `apps/web/src/lib/mappers/lead-form.ts` (+ test) — `mapLeadProducts`
  re-connects risk-derived status (PRJ-2 supersession).
- `apps/web/src/lib/stage-status.ts` (+ test) — floor helper reuse.
- `apps/web/src/components/lead/risks-section.tsx`,
  `risk-edit-dialog.tsx`, `sdlc-pipeline.tsx` (+ tests) — prefilled
  create signal, confirm-delete flow.
- No api/shared/prisma changes.
