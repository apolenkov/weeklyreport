## Context

See `proposal.md` for motivation. All four findings are web-presentation defects discovered in an exact-source desktop evidence run. Existing API, schema, validation, and database behavior already provide the required truth; the web layer either presents it incorrectly or allocates insufficient layout space.

## Goals / Non-Goals

**Goals:**

- Make visible copy, accessibility semantics, and review actions agree with existing domain state.
- Keep each correction local and regression-tested.
- Produce a replacement evidence packet without overwriting the rejected packet.

**Non-Goals:**

- Change API authorization or verdict-write compatibility behavior.
- Change period persistence, validation rules, or responsive breakpoints.
- Broaden the seven-row desktop recheck into the runtime sweep.

## Decisions

### Gate verdict UI with one shared submitted-reviewable predicate

Define a small model predicate for `canReview && status === "submitted"` and reuse it for both `canReviewAny` and the verdict band. This keeps the mode toggle and its contents consistent. Duplicating the expression at both call sites was rejected because the two surfaces could drift again; changing API `canReview` was rejected because it represents reviewer designation and supports an intentional race-safe write path.

### Make period-end semantics mode-aware without changing validation

Pass the existing edit-mode boolean into the field renderer. Edit mode uses the established required marker plus native and ARIA required semantics; create mode retains the optional hint. Changing schemas or payload construction was rejected because their current create-versus-edit behavior already matches the durable contract.

### Allocate submitted-label width at the trigger boundary

Widen only the desktop trigger variant that carries the lead submission badge. The surrounding toolbar and responsive breakpoints remain unchanged. Removing the badge or reducing the date copy was rejected because both are user-relevant state.

### Reuse the shared pluralization helper

Render `lead`/`leads` through the existing formatting helper rather than a new local conditional.

### Keep visual evidence distinct from semantic test proof

The replacement manifest uses honest `coverageLabels`; executable Playwright locators and focused unit tests carry semantic assertions. Every new PNG is source-bound and independently reviewed; the earlier `ITERATE` packet remains immutable.

### Bound long admin dialogs to the viewport

Bound the group editor to `max-h-[90vh]`, keep the title and action footer fixed within the focus-trapped surface, and place overflow scrolling on the form body. A long product roster can then scroll without pushing the dialog outside the desktop viewport or hiding Cancel and Save.

## Risks / Trade-offs

- [A wider trigger could crowd narrower toolbars] -> Limit the change to the canonical desktop breakpoint and retain the current flexible mobile width.
- [Status gating could leave Review mode empty] -> Use the same predicate for toggle availability and band membership.
- [Required semantics could trigger unexpected native validation] -> The dialog uses explicit button actions, and focused tests preserve current submit behavior in both modes.
- [Screenshots can pass while behavior is wrong] -> Pair visual review with executable state locators and focused component tests.
- [Internal scrolling can hide part of a long roster] -> Keep the existing roster's own bounded scroll region and make the whole dialog scroll only when its complete surface would otherwise exceed the viewport.

## Migration Plan

No data migration or feature flag is required. Land the focused web changes and tests together; rollback is the inverse web-only patch. Period dual-state, role-coverage, destructive-database guards, and deferred-feature invariants are preserved unchanged.
