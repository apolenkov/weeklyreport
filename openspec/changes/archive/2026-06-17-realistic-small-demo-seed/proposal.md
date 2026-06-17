# Proposal: realistic-small-demo-seed

## Why

The `small` demo tier is the opener a presenter shows first, so it sets the
audience's first impression of the product. Today it has two weak spots.

1. No fully-green product. All three `small` products carry a risk
   (`blocked` / `at-risk`), so the pipeline never shows what a healthy,
   complete product looks like. The demo opens on problems with no contrast.
2. Unowned SDLC stages render loud. On a product whose owner holds only some of
   the 7 stages, the remaining chips show a dashed face and the label
   `— unassigned` with the tooltip `Unassigned · Contact admin`. To a first-time
   viewer that reads as a broken or error state, not as "this stage is simply
   not part of this lead's contribution".

The realistic multi-person split — several leads sharing one product's stages —
already belongs to the `middle` tier (`seed-simple.ts`). `small` should stay the
minimal, single-lead opener and gain one clean fully-green product, while the
unowned-stage chip should read quiet and neutral everywhere it appears.

## What Changes

- **`small` stays one lead.** The `small` tier keeps its single lead (Vasily);
  no additional leads are added. The realistic multi-lead split remains the
  `middle` tier's role (`seed-simple.ts`).
- **"Внутренний BI" becomes a fully-green product.** In `small`, Vasily is
  assigned to ALL seven SDLC stages of "Внутренний BI", each set to a green
  (`on-track`) status, so the product has no unowned stage and demonstrates one
  fully-green, fully-owned pipeline. Russian product/stage names stay as seed
  DATA, not UI strings.
- **Unowned stages render quietly.** A stage no one owns no longer renders as a
  loud `— unassigned` error-like chip. It renders muted/neutral — still a chip
  in the 7-stage pipeline, so the pipeline's structure is never hidden — without
  the `Contact admin` action-prompt framing. This is a small lead-pipeline
  display change in `apps/web/src/components/lead/`, applied wherever the
  pipeline shows an unowned stage.
- **The other two `small` products keep their unowned stages.** "Маркетинговый
  портал" and "Платформа интеграций" still own only some stages, so the muted
  unowned-stage rendering is visible on them right next to the fully-owned BI —
  the contrast is the point.

## Capabilities

- `demo-seed-datasets` (modified) — `small` tier keeps one lead and gains one
  fully-green, all-stages-owned product (Внутренний BI).
- `lead-pipeline-card` (modified) — an unowned SDLC stage renders muted and
  neutral, never as a loud error-like `unassigned` state, while staying part of
  the visible 7-stage pipeline.

## Impact

### Seed (data only)

- `prisma/seed-demo.ts` — `SMALL_DATASET`: the "Внутренний BI" section
  (`PROD_BI`) gets `ownedStages` covering all seven SDLC stages, each seeded with
  an `on-track` / green stage status, and no `blocked` / `at-risk` risk, so the
  product reads fully green. The other two products are unchanged. One lead only;
  no new lead rows. Determinism (fixed UUIDs) is preserved.
- The canonical test fixture `prisma/seed.ts` is NOT touched.
- The `middle` tier (`seed-simple.ts`) is NOT touched.

### Frontend (display only)

- `apps/web/src/components/lead/stage-chip.tsx` — the unowned (`ownership ===
"unassigned"`) chip: the `— unassigned` label and the
  `Unassigned · Contact admin` tooltip are replaced with quiet, neutral copy;
  the muted/dashed visual treatment is kept (already low-emphasis) so the chip
  reads as "not owned here", not "error / fix me". Editability, lock, and
  authored-status paths are unchanged.
- No API / shared-contract change: ownership is already derived in
  `apps/web/src/lib/mappers/lead-form.ts` (`ownership: "unassigned"`); only the
  presentation of that existing state changes.
- UI strings stay English (the repo UI-strings rule); only seed product/stage
  data is Russian.
