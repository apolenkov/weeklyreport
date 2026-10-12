# Design

## Context

See proposal.md. LeadSlidesDeckView initializes its target to null and resolves
it from a ref callback. DocumentBodyPortal currently conflates that pending
value with an absent provider. The real consumer regression records two DOM
mounts on baseline, first in body and then inside the deck.

## Goals / Non-Goals

Preserve deck ownership during target resolution. No changes to fullscreen APIs,
focus behavior, Radix dialogs, auth, data writes, dependencies or configuration.

## Decisions

Use undefined only as the context default for an absent provider. Keep the
provider input unchanged (HTMLElement or null). Null defers DocumentBodyPortal;
undefined keeps its existing document-body placement. All hooks remain
unconditional, preserving SSR and hydration. Returning no content while the
owned target is pending is smaller than moving an already-mounted dialog.

The existing usePortalTarget consumer, ConfirmDeleteDialog, already accepts
undefined and retains its current Radix container behavior. This change makes
no claim about a different portal implementation.

## Risks / Trade-offs

- An unresolved provider continues to defer its content: the current producer
  resolves it from an actual mounted ref; the regression exercises that producer.
- jsdom cannot prove fullscreen painting or focus/AT acceptance: Root owns the
  native acceptance and full gates.
- Period lifecycle, role builders and destructive guards are untouched.

No migration, feature flag, request or persistence changes are required.
