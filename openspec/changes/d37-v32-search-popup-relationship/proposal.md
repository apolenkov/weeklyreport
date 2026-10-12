# Keep the SearchInput popup relationship resolvable

## Why

Current public SearchInput always emits aria-controls while its listbox is mounted only when expanded. The relation points to an absent DOM element after initial render and Escape. Primary W3C ARIA/APG requires the relation to identify the popup; APG permits emitting it only while visible.

## What Changes

- Emit aria-controls only while the existing expanded popup is mounted.
- Preserve popup identity, controller, results, scope, navigation, debounce and expanded semantics.
- Add one actual SearchInput DOM relationship regression in the approved existing test.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `viewer-published-search`: shared SearchInput maintains a resolvable combobox popup relationship across its actual lifecycle.

## Impact

Only owned search-input.tsx/test.tsx. No native blur fix, result/popup feature, labels or AT behavior claim. Root owns main spec sync and aggregate/native acceptance.
