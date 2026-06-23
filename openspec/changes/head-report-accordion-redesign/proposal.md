# Redesign the head report ProductAccordion (Editorial Gutter)

## Why

Live head-report feedback (2026-06-23, items R1/R2): the `ProductAccordion`
edit/review surface reads as "топорно/коряво" — crude and unaligned. Concretely:

- **Text jumps.** Each item row puts a variable-width stage chip
  (`Development · ВИ` 103px vs `Testing · МК` 74px vs `Planned` 55px) inline
  before the text, so the work text's left edge wanders row to row. The head
  cannot scan a clean text column.
- **Four chip vocabularies** across Current/Next/Risks/Decisions read as noise.
- **Risk rows are a wall of text** — `problem — Impact: … — Mitigation: …` run
  together with no structure.
- **Next Week items hide their stage and owner**, and items show no per-item
  workflow status.

The user reviewed four redesign rounds in a live browser and signed off on the
"Editorial Gutter" direction (verbatim: "заходит, реализуй"). Before/after
screenshots are recorded under `docs/` (see Impact). This change implements that
approved direction. The redesign is component-level layout polish — not a theme
or palette rebrand — and stays within the existing token system.

## What Changes

- **Uniform row anatomy.** Every row (item / risk / decision) is one CSS grid:
  `priority | status rail | gutter (stage + owner initials) | content |
status badge`. The gutter is fixed-width, so every row's stage label and every
  row's content share one left edge — the text no longer jumps.
- **Status as a right-aligned badge** on item rows (`Blocked` / `In Progress` /
  `Done` / `Planned`), drawn from `item.status`. Risks keep severity on the rail
  - the red `Impact` label; decisions carry no status (they have none).
- **Priority moves to a dedicated left column** (gold rank `1`/`2`/…) so the
  gutter never shifts vertically when an item is prioritized — scales to several
  priorities without stacking heavy washes.
- **Owner initials on every row**, including Next Week, Risks, and Decisions
  (the section author's initials — already available in the mapper, currently
  discarded for next-week items and never attached to risks/decisions).
- **Structured risk body**: problem line, then labeled `Impact` (red) and
  `Mitigation` (green) — replacing the merged run-on string in the card.
- **New named token** `--color-status-in-progress-*` for the In Progress badge
  (no existing token fit; status-color-semantics permits adding a named token).
- The print template (`print-report-template.tsx`) is untouched — new
  presentation fields are additive; `stageLead` / risk `text` / `badge` keep
  their current shape for print and back-compat.

## Impact

- Affected specs: `report-card-clarity` (ADDED: uniform row anatomy),
  `status-color-semantics` (ADDED: item status-badge surface + in-progress
  token).
- Affected code:
  - `apps/web/src/components/weekly-report/product-accordion.tsx` (body rewrite)
  - `apps/web/src/lib/mappers/weekly-report-groupers.ts` (populate stage/owner on
    next-week items; attach owner + structured fields to risks/decisions)
  - `apps/web/src/lib/mappers/weekly-report-types.ts` (required new fields)
  - `apps/web/src/components/dashboard/mock-data.ts` (optional new fields)
  - `apps/web/src/app/globals.css` (in-progress status token)
  - `apps/web/src/components/weekly-report/product-accordion.test.tsx` (rewrite
    against the new contract)
- Not changed: print template, slides (own row model), lead-side components.
- Sign-off + visual acceptance (status-color-semantics requirement): user
  approved "Editorial Gutter" v4 in a live browser 2026-06-23; same-viewport
  before/after captured at `docs/accordion-redesign-2026-06-23/` (current vs v4).
