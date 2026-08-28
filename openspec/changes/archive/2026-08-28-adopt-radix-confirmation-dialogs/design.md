## Context

See `proposal.md` for the motivation. The web app has two shared confirmation
components built from `DocumentBodyPortal`, `DialogSurface`, and
`useDialogFocus`, while `@customreport/ui` already exposes a Radix-based dialog
family. Consumers depend on current props and visual classes, so the migration
must replace lifecycle ownership without forcing feature-level rewrites.

The period dual-state, role-coverage gate, destructive-database guard, and
deferred-feature pattern are unaffected. This change has no data flow, API, or
database path.

## Goals / Non-Goals

**Goals:**

- Make Radix the sole modal-lifecycle owner for the two shared confirmation
  components.
- Preserve product copy, content slots, visual geometry, action semantics,
  pending-state guards, stable test selectors, and focus restoration.
- Keep the app-facing API small and immutable while reusing a public UI-package
  primitive.

**Non-Goals:**

- Migrating all legacy feature-specific and admin dialogs.
- Reworking button tokens, dialog sizes, product wording, or action policy.
- Adding a fallback custom focus runtime when Radix behavior is unavailable.

## Decisions

### Reuse the existing Dialog family from `@customreport/ui`

The shared confirmation components will compose the existing typed Radix Dialog
root and content wrappers. Dialog provides focus containment, Escape handling,
outside-pointer dismissal, portal mounting, background isolation, and the
focus-lifecycle callbacks. The UI wrapper accepts typed initial and restore
targets, backdrop selector, and layer styling so applications supply targets
without installing lifecycle listeners. Outside-interaction callbacks remain
required because the durable product contract permits backdrop dismissal.

Alternative considered: Radix AlertDialog. Rejected because its content omits
the outside-pointer and interact-outside callbacks by design, so it cannot
preserve the existing backdrop-dismiss behavior without adding another custom
event layer. Importing `radix-ui` directly in `apps/web` was also rejected
because it bypasses the established UI package boundary.

### Preserve app-level confirmation APIs

`ConfirmationDialog` and `ConfirmDeleteDialog` remain controlled components.
Their `open`, callback, copy, pending, preview, consequence, and test props stay
stable. Internally, `onOpenChange(false)` routes to the guarded close callback.
Existing styled buttons remain native buttons inside the Radix content.

Alternative considered: migrate all consumers directly to AlertDialog parts.
Rejected because it expands the change across unrelated features and makes
visual regression review harder.

### Let the primitive own keyboard and focus behavior

The shared components remove `useDialogFocus`, `DialogSurface`,
`DocumentBodyPortal`, and document-level Enter handling. Native button Enter
activation remains sufficient. The UI Dialog wrapper owns the primitive's
open/close autofocus callbacks; app components supply only the Cancel and
trigger refs. Pending state prevents close and action callbacks without
installing another listener.

Alternative considered: keep the custom focus hook as a backup. Rejected by
the no-fallback rule and because two simultaneous lifecycle owners recreate the
original risk.

## Risks / Trade-offs

- [Existing CSS geometry shifts under Radix positioning] -> Preserve the
  dialog layer, use a viewport-bounded compact width without fixed margins,
  preserve padding/radius/color, and include the surfaces in the R61 capture.
- [Radix dismissal semantics differ from existing backdrop behavior] -> Add
  characterization tests for normal and pending backdrop/Escape paths before
  accepting the migration.
- [Consumer tests query the old DOM wrapper] -> Preserve roles, accessible
  names, descriptions, and explicit test IDs; update only implementation-bound
  assertions.
- [A pending Dialog would normally dismiss on outside interaction or Escape]
  -> Prevent those two primitive events while pending and keep the controlled
  open state true; do not add a global document listener.

## Migration Plan

1. Characterize both shared components' current observable behavior.
2. Replace their internal lifecycle with the existing UI-package Dialog and
   delete imports that become unused.
3. Run focused UI/web tests, typecheck, lint, strict OpenSpec validation, and
   the final visual/runtime gates.
4. Roll back the single migration commit if characterization or R61 visual
   evidence shows a contract regression.
