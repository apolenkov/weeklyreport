## Context

Users-table row actions use 34px pills and place Delete beside Edit and lifecycle toggles. The auto-height all-content slide article can be too dense for projection even though it is appropriate for document reading. `sweep15-slide-status-accessible-label` independently owns the P1 non-color product-status correction and lands before or alongside this residual P2 change.

## Goals / Non-Goals

**Goals:** establish safe admin action hierarchy and touch targets, and offer a projection-oriented paged density without losing content.

**Non-Goals:** change permissions/lifecycle behavior, duplicate the P1 slide-status icon/text work, truncate records, or replace the standard document-reading slide mode.

## Decisions

### 1. Delete leaves the routine action row

Keep Edit and Activate/Deactivate as inline actions. Put Delete in an accessible overflow menu on each row; the edit dialog MAY also expose a clearly separated danger zone, but there is one canonical delete trigger per presentation. The trigger and menu use existing shared primitives, restore focus, and retain `ConfirmDeleteDialog`/shared confirmation behavior.

All interactive targets in the Users row are at least 40px in both dimensions or have an equivalent 40px hit area, while visual glyph/pill size may remain compact.

### 2. Presentation density is an explicit mode

Add a `Document` / `Presentation` density control at the deck shell:

- Document preserves the current auto-height article with all products/records.
- Presentation paginates by product and caps records per view using deterministic model-level pages.

Presentation pages never discard records: overflow creates continuation pages labeled with product name and page position. Priority cards remain associated with the product/page containing the source item or are placed on a dedicated first page with explicit navigation; the implementation must choose one consistent model and test no duplication/loss. Product order, record order, Mine/Everyone merge, and author attribution remain stable.

The mode is view-local, defaults to Document outside fullscreen, and may default to Presentation on explicit present/fullscreen entry only if the control state is visible and reversible.

### 3. Pagination is pure and testable

The slide model receives density limits and returns pages. Rendering does not slice arrays ad hoc. Tests flatten all pages and compare stable record identities with the document model to prove exact coverage.

No backend, role-coverage, or period-state invariant changes.

## Risks / Trade-offs

- [Overflow menu hides Delete too deeply] → Keep a predictable labeled menu and optional dialog danger zone, with keyboard tests.
- [Density pagination separates context] → Repeat product header/status and label continuation pages.
- [Records duplicate or vanish] → Identity-based flattening invariants across density modes.

## Migration Plan

Land Users action hierarchy independently. After/alongside the non-overlapping P1 status-label change, add pure density pagination, then shell controls and visual/E2E coverage. No data migration or feature flag is required.

## Open Questions

None.
