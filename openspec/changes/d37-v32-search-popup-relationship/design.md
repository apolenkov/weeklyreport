# Design

## Context

SearchInput computes showResults from its existing open/enabled state. The same boolean reaches aria-expanded and mounts SearchResults, but aria-controls was unconditional.

## Goals / Non-Goals

Keep the existing relation valid while the popup is present; omit it while absent. Preserve IDs, visible UI, keyboard selection, navigation and result contents. Do not add hidden popup retention, ARIA name policy, stale-result policy or Safari event handling.

## Decisions

Use the existing expanded boolean at SearchCombobox's aria-controls attribute. The same boolean already owns actual popup mounting, so no new state is introduced.

Primary references: [WAI-ARIA 1.2 combobox](https://www.w3.org/TR/wai-aria-1.2/#combobox), [APG combobox](https://www.w3.org/WAI/ARIA/apg/patterns/combobox/). APG distinguishes a hidden existing target from an unmounted target and permits the relation only while visible. Durable primary-source analysis is in the package handoff.

## Risks / Trade-offs

Public jsdom DOM proves mounted relationships, not native screen-reader speech or Safari focus/blur behavior. Existing SearchInput tests use a Query response seam; the controller and public component remain real. The new relation test uses no invented private popup props or hit identity policy.

## Validation

Initial collapsed -> valid two-character debounced query -> expanded popup -> Escape. Existing expanded relation resolves correctly; pre-fix initial and escaped relations refer to absent nodes. Existing 18 controls preserve result/navigation behavior.
