## Context

See `proposal.md` for motivation. The Admin route currently switches from a native picker to ten non-wrapping pills at Tailwind `sm` (640 px); Chrome measures the pill row at 883 px and the 768 px document at 115 px wider than its viewport. Settings always renders six non-wrapping Radix triggers in an `overflow-x-auto` list; at 375 px the fourth label is visibly clipped and the final destinations have no continuation affordance. Existing component tests prove DOM presence and semantics, not rendered reachability.

The existing `DESIGN.md` already defines compact native selection for mobile navigation, the line-style Radix tabs for wider surfaces, 44 px mobile controls, visible focus, and zero document-level overflow. This repair adds no token or primitive.

## Goals / Non-Goals

**Goals:**

- Make every Admin primary destination and non-zero operational count reachable at 375 and 768 px and retain the complete pill strip at 1280 px.
- Make every working Settings section discoverable at 375 px while retaining the existing line tabs from 768 px upward.
- Bind rendered evidence to full-frame, per-viewport review instead of target-only screenshot approval.

**Non-Goals:**

- No new Admin destination, Settings form behavior, URL scheme, visual token, motion, API, database, Redis, or runtime-sweep lane.
- No generic hiding of overflow; the presentation changes at the component that creates it.
- No URL deep-linking of Settings secondary state in this repair.

## Decisions

### Keep the primary Admin picker through tablet width

`AdminTabsMobileSelect` will remain visible below `lg`, and the pill navigation will start at `lg`. The boundary is provisional until real Chrome proves 1023 uses the picker and 1024 fits the full strip with both count pills at maximum display; if 1024 fails, the implementation moves the breakpoint rather than weakening the no-overflow contract. A compact status row beside/below the picker reuses the existing pending-Reopen and failed-job queries and renders only non-zero signals as links to their canonical destinations. This preserves one `ADMIN_TABS` order, one `/admin?tab=<id>` URL contract, and the operational meaning currently carried by desktop count pills.

Alternatives rejected: wrapping pills changes navigation geometry and reading order; `overflow-x-auto` would hide important destinations behind an undisclosed gesture; `overflow-x-hidden` would conceal the defect without restoring reachability.

Both the native picker and pill links will use the existing ring token with `focus-visible` and a ring offset. This replaces the inconsistent Chrome-default blue rectangle/dark oval without changing the already-closed landmark-focus rule or suppressing focus globally.

### Drive mobile Settings selection and desktop tabs from one controlled value

`SettingsTab` will own one active-section string. A labelled native select below `md` and the existing Radix line tab list from `md` upward both update that value. The select lists only the five working sections. An adjacent mobile-only inert Holidays row composes the canonical `ComingSoonBadge`, preserving the deferred-feature trace without presenting a nonexistent selection. The wide Holidays trigger stays focusable and hoverable for its shared tooltip but carries `aria-disabled="true"` and prevents focus, pointer, and keyboard activation from selecting a nonexistent panel; the modified durable requirement removes the stale claim that it is selectable. The same existing working panels render; no form state or query contract changes.

Alternatives rejected: a fade-only scroll affordance leaves keyboard/touch reachability harder to discover; shrinking or truncating labels damages meaning; a second independent mobile state can diverge from the Radix active panel; a disabled native option cannot compose the required `ComingSoonBadge` and falsely suggests a selectable panel exists.

### Separate behavioral assertions from overall visual acceptance

Focused tests will pin canonical option order, navigation targets, operational-count parity, shared Settings active state, disabled Holidays semantics, breakpoint ownership, and absence of a narrow horizontal tab strip. Fresh Chrome evidence at 375, 768, 1023, 1024, and 1280 will measure `scrollWidth - innerWidth`, use maximum-display counts at the activation boundary, inspect focus and active state, and capture every inventory-derived frame. Two fresh independent reviewers must open every image without an upstream PASS narrative and may record a narrow assertion PASS while keeping the overall visual gate blocked by any visible defect.

The period dual-state, role-coverage, and destructive-DB invariants are untouched. The Holidays deferred-feature pattern is preserved explicitly.

## Risks / Trade-offs

- [Risk] Tailwind breakpoint classes drift independently between the picker and strip -> one structural contract test pins their complementary `lg` ownership and real 768/1024/1280 browser assertions prove the rendered result.
- [Risk] Responsive status links duplicate the hidden desktop query observers -> both observers reuse identical TanStack query keys, so network work remains cache-deduplicated; focused tests pin non-zero count parity and canonical destinations.
- [Risk] Mobile select state diverges from the Radix panel -> both controls are driven by one state value and a component test changes sections through each entry point.
- [Risk] Native picker appearance differs across operating systems -> keep explicit card/text colors and the existing 44 px geometry; acceptance is reachability, focus, and layout rather than pixel-identical OS chrome.
- [Risk] A reviewer again tunnels into the named defect -> the UAT delta makes any visible defect in an enumerated frame block overall visual acceptance and requires a per-frame inspection trace.

## Migration Plan

No data or configuration migration is required. Land the focused tests and responsive source together, run scoped static and unit gates, then capture the complete Chrome matrix from the exact dirty-patch digest. Rollback is the source/test revert; it has no persistent-data effect.
