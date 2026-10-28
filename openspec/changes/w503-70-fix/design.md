# Design

## Context

Accessibility audits (C5026, C5197) identified two AT-related defects on public weekly report and slides surfaces:

1. `LeadOverviewCard` and `ProductOverviewCard` contain a badge displaying a symbol (`✓`, `!`, `✕`, `–`). Because the button computes its accessible name from its subtree, the glyph is concatenated into the button's accessible name (e.g., "✕ Маркетинговый портал Blocked · ..."), which creates duplicate and confusing announcements for screen reader users. The chevron icon at the end of the button already has `aria-hidden="true"`.
2. `SlideCell` renders an empty cell as `<span aria-label={`No ${label}`}>...</span>`. Because `span` is generic, WAI-ARIA and modern browser engines (including Chrome and Safari) ignore `aria-label` on generic elements unless they possess an explicit ARIA role or are interactive. As a result, the accessibility tree exposes no label or name for empty cells.

## Decisions

1. **Portfolio Card Status Badges**:
   Add `aria-hidden="true"` to the badge `<span>` in both `LeadOverviewCard` and `ProductOverviewCard`.
   - The status is already clearly represented textually by `{statusLabel(lead.worstStatus, "screen")}` and `{product.statusLabel}` or `"No updates"`.
   - The visual glyph remains completely unchanged.
   - The button accessible name remains descriptive and clear without decorative symbol pollution.

2. **Slide Cell Empty Placeholder**:
   Add `role="img"` to the outer `<span aria-label={`No ${label}`}>` in `SlideCell`.
   - Using `role="img"` on an element with `aria-label` transforms the generic element into an accessible image/symbol in the accessibility tree, reliably exposing the `aria-label` across all major screen readers and browser accessibility tree implementations.
   - The inner spans (the desktop `—` and the mobile `No <label>`) already have `aria-hidden="true"`. With `role="img"`, the outer element presents `No <label>` as its accessible name and hides the inner presentation.
   - Existing testing-library queries such as `screen.getByLabelText("No Risks")` or `screen.getByRole("img", { name: "No Risks" })` resolve cleanly.

## Risks / Trade-offs

- Minimal risk: `role="img"` is well-supported and recommended by W3C WAI-ARIA practices for graphical/iconic textual placeholders with `aria-label`.
- `aria-hidden="true"` on the status badge prevents any glyph text from appearing in the button calculation, improving SR announcement quality.

## Migration Plan

No migration or database changes required.
Verification through colocated Vitest/Testing Library unit tests and the 6 standard repo gates.
