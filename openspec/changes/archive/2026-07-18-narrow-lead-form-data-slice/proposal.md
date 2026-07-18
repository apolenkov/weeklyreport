## Why

`deepen-lead-form-draft-module` narrowed every draft/write-action prop in the lead-form component tree, but deferred one deliberate leftover: `LeadFormLoaded` still takes `data: ReturnType<typeof useLeadFormData>` — a whole-hook blob prop. Understanding what `LeadFormLoaded` and its children may actually read from the data hook still means chasing the hook's return type instead of reading a declared interface. This is the next recorded slice of the lead-form decomposition target in `architecture-refactor-backlog`.

## What Changes

- Declare a purpose-built `LeadFormLoadedData` slice interface: exactly the fields `LeadFormLoaded` and its children read from `useLeadFormData` (inventory first — expected: section read model, period metadata, cross-author context, `isEveryone`, refetch).
- Populate the slice at the `lead-form.tsx` seam; `useLeadFormData`'s own interface is unchanged.
- Remove the last `ReturnType<typeof useX>` from the lead-form component tree; add a lint-greppable assertion to the module's tests that no props type references a hook return type.

## Capabilities

### New Capabilities

<!-- none -->

### Modified Capabilities

- `lead-form-draft-module`: the narrow-props requirement extends to the data hook — no whole-hook return types anywhere in the tree.

## Impact

- Web only: `lead-form.tsx`, `lead-form-loaded.tsx`, child components reading `props.data`, and their tests. Pure interface narrowing — no behavior change, no API/schema surface.

## Non-goals

- Restructuring `useLeadFormData` itself (query composition stays as-is).
- Any change to the draft module handle landed by `deepen-lead-form-draft-module`.
