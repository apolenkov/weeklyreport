# Unify the record dialogs (Item / Risk / Decision)

## Why

A lead reported the three record dialogs feel inconsistent, and one is a bug:

1. **Stages pre-selected on create.** The Item and Decision dialogs pre-check ALL
   owned stages on create (`UFB-073`), so the lead can save without ever making a
   stage decision. The Risk dialog already dropped this default in
   `fix-report-surface-integrity` W11 (task 3.10) and starts with nothing checked.
   The lead asked for the risk behaviour everywhere ("как у рисков ... защита от
   пропуска"). This is a half-finished migration, not a reversal — we propagate the
   W11 decision to the two dialogs it never reached.
2. **Decision stages ignore the product.** The Decision dialog sources its stage
   options from the department-wide union, so changing the Product picker does not
   re-scope the stages. Items and risks are product-scoped. The lead reads the
   mismatch as a bug. Decision becomes product-scoped like the other two (glossary
   updated in `CONTEXT.md`).
3. **Layouts diverge.** Product picker sits at the bottom of Item, at the top of
   Decision, and inside a right-hand panel in Risk; Risk is two-column while the
   others are one-column ("в одном месте продукт внизу, в другом вверху ... надо
   стандартизировать"). All three adopt one layout.

## What Changes

### 1. No stage pre-selection on create — CONFIRMED

The Item and Decision dialogs MUST start with NO stage selected on create, exactly
like the Risk dialog. The required-stage rule and the single-owned-stage
auto-apply are unchanged: at least one stage is required, and a product with
exactly one owned stage applies it implicitly. The selector stays multi-select.

### 2. Decision stages are product-scoped — CONFIRMED

The Decision dialog MUST source its stage options from the SELECTED product's
owned stages and reset the selection when the product changes, exactly like Item
and Risk. The department-union sourcing is removed.

### 3. One two-column layout for all three — CONFIRMED (direction chosen)

All three dialogs MUST share the Risk dialog's two-column layout: the primary text
fields on the left, and a right-hand CLASSIFICATION panel carrying the Product
picker, the SDLC Stages selector, and the Status/Severity control. The Product
picker is always present (even with a single product). The consequence-preview
banner above the stage selector is retained where it already exists (Risk).

## Out of scope

- Changing the required-stage / auto-apply rule (kept as in `risk-stage-integrity`).
- Single-select vs multi-select for items (kept multi-select per the lead's choice,
  even though the glossary convention is one stage per item).
- The pure-visual token/spacing polish beyond adopting the two-column structure and
  Product-first ordering.
