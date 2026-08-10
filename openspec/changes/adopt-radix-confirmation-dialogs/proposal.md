## Why

Keyboard users currently depend on application-owned focus trapping, Escape
handling, focus restoration, portal, and backdrop behavior in the shared
confirmation dialogs. The repository already ships audited Radix dialog
primitives, so maintaining a second modal runtime creates avoidable
accessibility and nested-dialog risk immediately before the final visual and
runtime baseline.

The inventory is concrete: `use-dialog-focus.ts`, `dialog-surface.tsx`,
`confirmation-dialog.tsx`, and `confirm-delete-dialog.tsx` implement modal
semantics that already exist in `packages/ui/src/components/ui/dialog.tsx` and
the installed `radix-ui` dependency.

## What Changes

- Preserve the public `ConfirmationDialog` and `ConfirmDeleteDialog` contracts
  while delegating their modal lifecycle to the shared Radix-based UI layer.
- Preserve current labels, preview and consequence content, pending behavior,
  action callbacks, backdrop dismissal, Escape handling, initial focus, and
  focus restoration.
- Add characterization tests for keyboard, pointer, pending, and focus behavior
  before removing the duplicated modal internals from these two components.
- Update the durable accessibility requirement so shared confirmation dialogs
  require an audited primitive instead of the custom focus hook.

### Non-goals

- Migrating every legacy feature-specific or admin CRUD overlay in this change.
- Changing product copy, destructive-action policy, or dialog visual hierarchy.
- Replacing Radix, redesigning `@customreport/ui`, or altering report data.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `dialog-listbox-a11y`: Shared confirmation dialogs delegate modal semantics
  to the Radix primitive while preserving the existing interaction contract.

## Impact

The change affects the shared confirmation-dialog implementation, its focused
tests, the `@customreport/ui` dialog surface if a small composition seam is
needed, and the durable `dialog-listbox-a11y` specification. There is no API,
database, authentication, or new-dependency impact.
