# Proposal

## Why

A dialog present when the Lead slide deck mounts is inserted into the document
body and then remounted inside the deck. The existing deck owns the dialog
container, so resolving that container must not mount the dialog elsewhere.

## What Changes

- Distinguish an absent portal provider from its unresolved target.
- Defer DocumentBodyPortal children while that target is unresolved.
- Protect the initial mount through the real LeadSlidesDeckView consumer.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `lead-dialog-lifecycle`: clarify the existing deck-owned portal lifecycle.

## Impact

Sources: `apps/web/src/shared/ui/dialogs/document-body-portal.tsx` and its existing
colocated test. Current producer:
`apps/web/src/features/slides/ui/lead/lead-slides-deck-view.tsx`. The existing
`lead-dialog-lifecycle` mount/unmount requirement owns dialog lifecycle.
C5273 evidence is preserved in the external D37-V28 handoff.

## Non-goals

- Changing fullscreen APIs, dialog focus rules, Radix portal behavior or routing.
- Adding dependencies, configuration, logout guards or a new portal fallback.
- Claiming native fullscreen or assistive-technology acceptance from jsdom.
