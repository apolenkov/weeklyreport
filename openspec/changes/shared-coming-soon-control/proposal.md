## Why

The inert "coming soon" trigger — a `ComingSoonTooltip` wrapping an
`aria-disabled` button that carries the same inert-chrome classes
(`cursor-default`, the `--color-border` border, the `--color-surface-empty`
background, the `--color-muted-foreground` foreground) plus a lucide icon — is
copy-pasted across five deferred-feature sites (`agent-review-coming-soon.tsx`,
`version-coming-soon.tsx`, `pdf-export-coming-soon.tsx`, and the nav-bar's inline
`LanguageComingSoonControl` / `ThemeComingSoonControl`). The five share the inert
semantics but NOT one geometry: version/PDF are `--toolbar-control-h` `rounded-full`
squares, the nav pair are fixed `h-8 w-10` `--radius-pill` pills, and agent-review
is a labelled pill with a `compact` density — so the shared primitive must own the
inert chrome while letting each site pick its shape. Nothing guarantees the five
stay in sync except two per-file source-scan tests in `coming-soon-style.test.tsx`
that grep each file for the wrapper and forbid a stray native title. That is
brittle parity-by-grep: a sixth site, or a drifted inert class on one, would pass
or fail by string luck rather than by construction. Roadmap #51.

## What Changes

- Add a `ComingSoonIconButton` (icon-only, with a `toolbar` | `nav` shape) and
  `ComingSoonControl` (icon + label, optional `compact`) primitive next to
  `ComingSoonBadge` in `packages/ui`. Each owns the full inert chrome: the
  `ComingSoonTooltip` wrapper, `aria-disabled`, the shared inert classes, the
  geometry per its shape/density variant, the lucide icon slot, and the
  `aria-label`.
- Compose the primitive in all five button sites: agent-review (labelled +
  `compact`), version and PDF-export (icon-only), and the nav-bar's Language and
  Theme controls — extracting the two inline nav-bar functions to thin wrappers
  that pass only icon + label + testid.
- Drop the five button files from the two per-file parity source-scan guards
  (the "migrated to the shared Radix wrapper" and "no stacked native title" file
  greps), replacing their coverage with one unit test on the primitive; the five
  sites can no longer diverge because they no longer carry the chrome. The two
  scans shrink to a holidays-only scope over `admin/settings-tab.tsx` (which never
  adopts the button primitive), keeping the holidays sr-only `ComingSoonBadge` and
  no-native-title guards alive.
- Holidays stays out of scope: it is an inert `<span>` nested in a `TabsTrigger`
  (a nested button would be invalid HTML), so it keeps its own
  `ComingSoonTooltip` + sr-only `ComingSoonBadge` composition, not the button
  primitive.

Behaviour is unchanged: same amber badge, same Radix portal, same
`aria-disabled` inertness, same single-announce accessibility. This is a
dedup refactor, not a behavioural change.

## Capabilities

### New Capabilities

_None._

### Modified Capabilities

- `deferred-feature-pattern`: ADD a requirement that the five inert button
  controls' chrome comes from one shared `packages/ui` primitive they compose
  (parity by construction, not by source scan); MODIFY the "no stacked native
  title" requirement so the title-absence guarantee is relocated into that
  primitive and the per-file scan is retired.

## Impact

- `packages/ui/src/components/` — new `coming-soon-control.tsx` primitive.
- `apps/web/src/components/report-shell/agent-review-coming-soon.tsx`,
  `lead/version-coming-soon.tsx`, `lead/pdf-export-coming-soon.tsx`,
  `navigation/nav-bar.tsx` — compose the primitive.
- `apps/web/src/components/coming-soon-style.test.tsx` — shrink the two source-scan
  `describe` blocks to a holidays-only scope (drop the five button files, keep
  `admin/settings-tab.tsx`); add the primitive's unit test here in `apps/web`
  (`packages/ui` has no test runner — its `test` script is `tsc --noEmit`); keep
  the render tests and the repo-wide no-bespoke-pill scan.
- No backend, API, schema, or migration impact.
