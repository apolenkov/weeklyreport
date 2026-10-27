# Design

## Context

See proposal.md for motivation. SaveNowButton owns the spinner's inline animation and local reduced-motion stylesheet. SearchInput owns the input and popup; its controller handles keys only on the input, while dropdown result buttons were still separate Tab stops. Both have current public callers and existing component tests.

TASK-503.23 contains additional evidence and policy clauses. A failed auth refetch with cached data does not prove that stale identity or permissions are safe to render. Existing historical warm-refetch tests already exercise fail-closed recovery; duplicating them or asserting stale authenticated rendering would not establish the missing policy.

## Goals / Non-Goals

Deliver the input-owned keyboard model and the active-result reveal at the existing SearchInput owner, proven by component tests that drive the real combobox and popup. The saving-motion repair still waits for native observation; auth, cached-error/debounce selection and clipping findings stay individually assessed in the external evidence packet.

## Decisions

- Keep the option id contract in one helper (`searchOptionId`) so the input's `aria-activedescendant` and the popup's reveal effect address the same node.
- Strengthen the existing focus-exit test using installed user-event Tab traversal. The previous test manually supplied an external blur target, bypassing the option buttons that a real focus traversal encounters. Keep the existing fixture and navigation controls; do not add a production seam or a second setup harness.
- Take result options out of the Tab order (`tabIndex={-1}`) instead of syncing `onFocus` with the active index. Options already prevent the pointer-down focus transfer, so with no focusable option the combobox stays the only stop and never loses keyboard ownership.
- Let the popup reveal its active option itself with `scrollIntoView({ block: "nearest" })`. The nearest block keeps an already visible or hovered selection still and avoids displacing the document.
- Observe native saving motion through the current Lead autosave path before choosing a CSS repair. The existing pending-save/offline E2E scenario can hold a real saving state. Computed styles and successive rendered frames are required; jsdom style text cannot substitute for motion proof.
- Observe long-list geometry through the current History or Admin Products caller as the remaining receipt. Component tests prove the reveal call and the focus owner, not the rendered bounds or document displacement.
- Do not change global card overflow without one traced descendant and a whole-page clipping observation. AccordionSection is a current card consumer, but its header has padding and is not itself proof of a clipped ring. Portal targets and their ancestors must be traced separately.

## Risks / Trade-offs

- Component Tab traversal does not establish native browser focus or assistive-technology behavior → keep those as separate acceptance receipts.
- Stale identity can retain revoked authorization → preserve fail-closed behavior until an explicit safety policy is adopted.
- Search retaining hits during a same-query refetch is intentional → retain that existing control and assess error announcements and changed-query navigation separately.
- Native save setup writes synthetic data → use an exact approved target, guarded reset/seed and a bounded window with owned browser cleanup before execution.

Period lifecycle, canonical API authorization builders and destructive-target guards remain unchanged. No deployment order, dependency installation, migration or runtime start is part of this preparation.
