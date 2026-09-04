## Why

Two linked observations in `cmtluneeg0002fsw0wepch8vp` and
`cmtlus8100006fsw0cf4wvokv` show that contextual capture can obstruct the page
and cannot express a comment about the whole page. SitePing research confirms
that its composer is DOM-anchored and has no supported drag/collapse API, while
its official wire contract safely permits a feedback record with zero
annotations.

## What Changes

- Keep stock SitePing for drawn and right-click contextual annotations.
- Add an application-owned `Comment on page` flow using the authenticated
  feedback boundary with `annotations: []`, never a fabricated DOM anchor.
- Distinguish Page feedback from Annotation in `/feedback`; page feedback opens
  its normalized page without promising marker focus.
- Shorten the supported drawing instruction while leaving placement, Cancel,
  Escape, and drawing interception owned by SitePing.
- Treat right-click as the fast contextual path that avoids the drawing hint.

### Non-goals

- No SitePing fork, minified-package patch, draggable composer, or Plannotator
  runtime dependency.
- No project-global scope: this change adds page-level feedback only.
- No change to role scopes, deletion policy, diagnostics bounds, or Core Dev.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `authenticated-product-feedback`: support honest page-level records and
  distinguish their navigation from DOM-anchored feedback.

## Impact

The change affects the shared feedback contract, authenticated SitePing
gateway tests, product-feedback widget and inbox UI, and browser acceptance.
Existing tables already permit zero annotations, so no migration or new runtime
dependency is required.
