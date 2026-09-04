# Quick-entry feedback research

Date: 2026-09-04. Target feedback: `cmtmkcxgi00003dw0xod1c64h` (user-rated
3/5; screenshot shows the SitePing composer near the lower-left edge with its
submit action below the visible viewport). Sources are pinned package source,
current WeeklyReport source/specs, and the official SitePing repository.

## Finding: the Send button exists, but the popup height is under-estimated

The pinned `@siteping/widget@0.10.7` implementation creates both `Cancel` and
`Send` buttons (`node_modules/.pnpm/@siteping+widget@0.10.7*/node_modules/@siteping/widget/dist/react.js.map`,
source `../src/popup.ts`, lines 972-991 of the source map). The textarea can
grow to `max-height:152px`; together with the 2x2 type grid, padding, hint,
and button row, the rendered popup is materially taller than the constant
`popupH = 220` used by `Popup.show()` for placement (same source, lines
1067-1089). Placement therefore can clamp the popup based on 220px while the
actual box extends below the viewport. This explains a screenshot where the
hint is visible but the explicit Send button is not; it is not a missing API
or a disabled button. Send is intentionally disabled until a type is selected
and the message is non-empty (`updateSubmitState`, source lines 1165-1170).

The source's horizontal placement only flips from the annotation's left edge
to `rect.right - popupW` and then clamps to `left >= 8`; it does not measure
the rendered popup or account for a host overlay. Vertical placement prefers
below, otherwise above, otherwise clamps to `innerHeight - popupH - 8` (same
source lines 1067-1089). The official upstream source is available at
[`packages/widget/src/popup.ts`](https://github.com/NeosiaNexus/SitePing/blob/main/packages/widget/src/popup.ts).

## Public SitePing surface and constraints

The pinned declaration `node_modules/.pnpm/@siteping+widget@0.10.7*/node_modules/@siteping/widget/dist/types.d.ts`
defines the supported host controls:

- `position: "bottom-right" | "bottom-left"` controls the FAB only;
- `registerLocale(code, partialTranslations)` can change supported labels,
  including `popup.submit`, `popup.cancel`, and the instruction strings;
- `forceShow`, `minViewportWidth`, `enableRightClickComment`, `deepLink`,
  `identity`, `captureDiagnostics`, `enableScreenshot`, `onAnnotationStart`,
  and `onAnnotationEnd` are public configuration/callbacks;
- there is no public popup size, popup position, drag, collapse, or
  `Send`-button placement option. The `Popup` class is not exported as a host
  extension point.

WeeklyReport already uses the supported host-facing controls in
`apps/web/src/features/product-feedback/ui/product-feedback-widget.tsx`:
authenticated `identity`, `enableRightClickComment`, diagnostics/screenshots,
`minViewportWidth: 0`, `forceShow`, and a locale override. The durable
feedback contract explicitly says the host must not inspect or rewrite
SitePing's private injected DOM; placement, Cancel, Escape, and drawing
interception remain SitePing-owned:
`openspec/changes/improve-product-feedback-capture-ux/specs/authenticated-product-feedback/spec.md`,
requirements “SitePing opens its drawing instruction surface” and “fast
contextual path”. A CSS/DOM shim that relocates or resizes the popup would
violate that contract and become version-fragile.

## Risks

1. **P1 interaction loss:** on short viewports or when the selected region is
   near the bottom, the under-estimated height can put Send below the viewport.
   Keyboard submission (`Cmd/Ctrl+Enter`) remains available, but it is not a
   sufficient replacement for a visible primary action.
2. **P1 evidence ambiguity:** if the composer overlays a target or host toolbar,
   the user may annotate the wrong region. Right-click is a supported escape
   from the drawing toolbar, but it still anchors to the element under the
   pointer.
3. **P2 long-text growth:** textarea resize and long localized labels can make
   the actual box taller than the hard-coded placement estimate; text must wrap
   and the primary action must remain reachable without horizontal page
   overflow.
4. **P2 upstream drift:** changing the private built artifact or relying on
   selectors/classes would silently break on a SitePing upgrade. A real fix to
   popup geometry belongs upstream (or behind a versioned public API).

## Recommended acceptance contract for quick entry

The implementation/spec should make these checks executable:

1. **Entry matrix.** For every enabled authenticated role (lead, viewer,
   head, admin), the app-owned `Comment on page` action is present and submits
   one record with `annotations: []`; SitePing draw, right-click, standard
   sidebar, screenshots, diagnostics, and marker visibility remain available.
   `/feedback` remains separately role-gated by its validated allowlist.
2. **Explicit send.** In a real browser, after selecting a type and entering a
   non-empty message, a button named `Send`/`Submit` is visible, enabled, and
   inside the popup's bounding box; clicking it creates exactly one feedback
   record. Empty text or no type keeps it disabled. Cmd/Ctrl+Enter remains a
   secondary shortcut, not the only send path.
3. **Viewport containment.** At minimum test 320x640, 768x800, 1280x900, and
   1728x962; after opening the composer at top, middle, and bottom targets,
   `popupRect.top >= 0`, `popupRect.bottom <= innerHeight`, and the Send button
   is contained by the viewport. Assert that document and body scroll widths do
   not exceed `innerWidth`.
4. **Overflow text.** Submit a near-limit message and verify wrapped text,
   bounded textarea/popup growth, no clipped Send/Cancel controls, and a
   retry-safe error state. Preserve the pinned message limit and diagnostic
   bounds; do not solve layout by dropping the feedback payload.
5. **No host-side private shim.** A compatibility test should assert
   WeeklyReport only passes public SitePing configuration/callbacks and does
   not query, mutate, or style the `<siteping-widget>` private DOM. If upstream
   does not expose measured placement, carry the source fix as an exact-version
   pnpm dependency patch; never edit an installed `node_modules` tree or add a
   host-side selector workaround.

## Decision recommendation

Treat this as an upstream geometry defect in SitePing `0.10.7`, with a local
acceptance gate that catches it. Retain SitePing for contextual annotations and
carry the same package-owned placement fix as a pinned pnpm patch until an
upstream release provides measured geometry or a documented placement API.
The application must not reach into SitePing's private DOM. Do not claim the
feedback flow is complete until the visible Send and viewport checks above pass
in a real browser.
