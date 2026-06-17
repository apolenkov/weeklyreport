# Design: realistic-small-demo-seed

## Context

The `small` demo tier (`prisma/seed-demo.ts`, arg `small`) is the opener a
presenter shows first. Baseline, verified in code:

- `SMALL_DATASET` has ONE lead (`LEAD_1_ID`, "Василий И.") owning three products:
  - `PROD_PORTAL` ("Маркетинговый портал") — owns `Development`; carries a
    `blocked` risk (the Needs-Attention demo).
  - `PROD_INTEGRATIONS` ("Платформа интеграций") — owns `Development`; `at-risk`.
  - `PROD_BI` ("Внутренний BI") — owns `Development` + `Testing`; `at-risk`.
- The seven canonical stages (`SEED_STAGES`): Planning, Analysis, Design,
  Development, Testing, DevOps, Support.
- The lead pipeline always renders all seven stages per product. A stage outside
  the section author's `ownedStages` is mapped to `ownership: "unassigned"`
  (`apps/web/src/lib/mappers/lead-form.ts`), then `StageChip` renders it with a
  dashed face, the visible label `— unassigned`, and the tooltip
  `Unassigned · Contact admin` (`stage-chip.tsx` lines ~171, ~240).

So every `small` product today has both unowned stages AND a risk — there is no
fully-green, fully-owned product to anchor the "healthy" end of the spectrum, and
the unowned chips read like an error.

The realistic multi-lead, stage-split layout lives in the `middle` tier
(`seed-simple.ts`); `small` is deliberately the minimal single-lead opener.

## Decisions

### D1 — `small` stays one lead; do not add leads

The fully-green showcase is achieved by giving the existing lead (Vasily) full
ownership of one product's stages — NOT by introducing a second lead. The
realistic multi-person split stays the `middle` tier's job. This keeps `small`
the simplest possible opener and avoids duplicating `middle`'s purpose.

### D2 — "Внутренний BI" is the fully-green, fully-owned product

`PROD_BI` is reshaped so Vasily owns all seven stages, each seeded `on-track`
(green), with no `blocked` / `at-risk` risk on the product. Result: BI's pipeline
shows seven owned green chips and no unowned chip, demonstrating a complete,
healthy product. BI is chosen (over Portal) because Portal already carries the
`blocked` Needs-Attention item the seed's banner demo depends on — leaving Portal
as-is preserves that demo.

Rejected — make a NEW fourth product green: adds a product to `small`, drifting
it toward `middle`'s density. Reusing BI keeps the product count at three.

### D3 — The other two products keep partial ownership

Portal and Integrations still own only `Development` (a subset of seven), so
their unowned stages render right beside BI's fully-owned row. The contrast
between a fully-green/fully-owned product and a partially-owned one is the demo's
point, so the muted unowned chip must remain visible on at least one product.

### D4 — Unowned stage reads muted/neutral, never an error

The `— unassigned` label and the `Unassigned · Contact admin` tooltip are
replaced with quiet neutral copy. The unowned chip stays in the 7-stage row
(structure is never hidden) but reads as low-emphasis "not part of this
contribution", not as a broken/fix-me state. The dashed/muted treatment already
present is kept; only the loud, action-prompting WORDING changes.

Rejected — hide unowned stages entirely: loses the 7-stage pipeline structure, so
a viewer can no longer see where this lead's contribution sits in the full SDLC.

### D5 — Display change is in the lead pipeline only; no contract change

The `unassigned` ownership state is already derived in `mapLeadProducts`
(`lead-form.ts`). This change only re-presents that existing state in
`stage-chip.tsx`. No tRPC procedure, shared type, or Prisma schema changes. The
change applies wherever the lead pipeline shows an unowned stage (form and
read-only / slides paths both render through `StageChip`).

### D6 — Seed values are DATA; UI strings stay English

Russian product and stage names in `seed-demo.ts` are seed DATA (allowed by the
repo UI-strings rule). The replacement chip copy in `stage-chip.tsx` is a
production UI string and stays English. The seed keeps fixed UUIDs (determinism).

## Edges

- A stage that is unowned AND carries a foreign/own risk floor: the risk-derived
  health floor on the product is unchanged — only the chip's own loud
  `unassigned` wording changes, not the product health hue.
- Admin "Products" tab `-- unassigned --` option
  (`stage-assignment-editor.tsx`) is a different surface (an assignment dropdown,
  not the lead pipeline) and is out of scope.
- The `locked` (foreign-owned) chip is a separate ownership state and is not
  changed here.

## Glossary alignment (CONTEXT.md)

The neutral copy frames an unowned stage as outside this lead's **Own
contribution** (CONTEXT.md: "their items, risks, decisions, and the stages they
own") — the chip says, in effect, "this stage is not part of what this lead is
accountable for". The other two named terms, **Product context** and **Record
visibility**, are about own-vs-foreign RECORDS on a co-owned product (the
`scope-lead-report-to-own-contribution` change), not the unowned/unassigned
stage display, so they are deliberately out of scope here.

## Open questions

- None blocking. Exact replacement copy for the muted chip is an implementation
  detail of `stage-chip.tsx`; the spec fixes only that it MUST be neutral and
  MUST NOT frame the stage as an error or demand an action.
