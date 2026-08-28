## Why

Following the skip link or programmatically focusing the page's main landmark can
draw Chrome's default bright-blue outline around the entire application surface,
making the header and content look visually broken even though focus moved to the
correct landmark. The current route inventory and focus contract prove
focusability but do not define or verify the landmark's presentation
(`apps/web/src/app/layout.tsx`, `apps/web/src/app/main-content-focus-contract.test.ts`,
and the `id="main-content"` route targets); the owner-observed Admin capture is
recorded in `~/work/customreport-archive/2026-08-14-desktop-frame-cli-8dfccedd/README.md`.

## What Changes

- Define one shared presentation contract for every programmatically focusable
  `main-content` landmark so it does not receive a browser-default full-surface
  outline.
- Preserve the skip link, focus transfer, landmark semantics, and a visible
  focus indicator bounded to each subsequent interactive control.
- Extend source-level regression coverage to reject a focusable main landmark
  without the shared presentation contract.
- Prove the keyboard path and rendered focus state in a real browser at mobile,
  tablet, and desktop widths.
- Non-goals: redesigning navigation chrome, changing brand colors, removing
  interactive focus indicators, or repairing unrelated responsive findings.

## Capabilities

### New Capabilities

- `main-content-focus-presentation`: Defines the shared skip-link target,
  presentation, regression, and browser-evidence contract for application main
  landmarks.

### Modified Capabilities

- None.

## Impact

- Affects the shared web presentation layer and the existing
  `main-content-focus-contract` regression test; individual route behavior and
  public APIs remain unchanged.
- Requires fresh keyboard and visual evidence for the affected application
  surface, but adds no runtime dependency, data migration, API change, or
  backend work.
- Does not claim that every pre-existing route-local control already uses the
  design-system focus token; that standardization remains separate product debt.
