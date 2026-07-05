## Context

Five inert deferred-feature controls each hand-roll the same trigger chrome: a
`ComingSoonTooltip` wrapping an `aria-disabled` `<button type="button">` with the
same `cursor-default` + `--color-border` + `--color-surface-empty` +
`--color-muted-foreground` classes and a lucide icon. What differs across the five
is geometry, not the inert semantics: `version-coming-soon.tsx` and
`pdf-export-coming-soon.tsx` are `--toolbar-control-h` `rounded-full` squares
(`shrink-0`, no gap); the nav-bar's inline `LanguageComingSoonControl` /
`ThemeComingSoonControl` are fixed `h-8 w-10` `px-0` `rounded-[var(--radius-pill)]`
pills with a `gap-1.5`; and `agent-review-coming-soon.tsx` is a labelled
`rounded-[var(--radius-pill)]` pill whose padding/text switches on a `compact`
density flag. So four are icon-only (in two geometries) and one is labelled.
Parity is enforced only by two per-file source-scan `describe` blocks in
`apps/web/src/components/coming-soon-style.test.tsx` that grep each file for the
wrapper and forbid a stray `title="Coming Soon"`.

The sixth deferred control, admin Holidays, is structurally different — an inert
`<span>` nested inside a `TabsTrigger` `<button>` — and is not part of this dedup.

The `ComingSoonTooltip` wrapper and the amber `ComingSoonBadge` already live in
`@customreport/ui`. What is duplicated is the layer between them and the
consumer: the button element, its attributes, its classes, and the icon slot.

## Goals / Non-Goals

**Goals:**

- One shared `@customreport/ui` primitive owns the inert button chrome; the five
  button sites compose it and supply only their per-control differences.
- Extract the nav-bar's two inline control functions to thin wrappers.
- Replace parity-by-grep with parity-by-construction: one unit test on the
  primitive, the two per-file source scans retired.
- Zero behavioural change — same amber badge, Radix portal, inertness, and
  single-announce accessibility.

**Non-Goals:**

- The admin Holidays control (kept as its own span composition).
- The `ComingSoonBadge` primitive and the `ComingSoonTooltip` wrapper themselves
  (unchanged).
- The repo-wide no-bespoke-pill scan and the render tests (kept).
- Any backend / API / schema / migration change.

## Decisions

**D1 — Two named variants, not one boolean-heavy component.** Expose
`ComingSoonIconButton` (icon-only, props `icon` + `ariaLabel` + `testId` +
`shape: "toolbar" | "nav"`) and `ComingSoonControl` (icon + visible label, props
`icon` + `ariaLabel` + `testId` + `label` + optional `compact`). The `shape` knob
is load-bearing, not cosmetic: the four icon-only sites split into two real
geometries — `toolbar` reproduces the `--toolbar-control-h` `rounded-full`
`shrink-0` square (version, PDF-export) and `nav` reproduces the `h-8 w-10` `px-0`
`gap-1.5` `rounded-[var(--radius-pill)]` pill (language, theme) — so without it the
primitive could not render both without a consumer adding wrapper-side sizing,
which the delta spec forbids. The primitive owns the geometry classes per variant;
consumers pass NO `className`. Rationale for the two-export split: four of five
sites are icon-only, so a dedicated icon-only export keeps their call sites minimal
and avoids a required-but-empty label prop; the labelled agent-review case is the
only one needing text + `compact` density, so it gets the richer export.
Alternative — a single component with an optional `label` and a `variant` prop —
was rejected as more prop-surface for no call-site saving, working against the
"small single-purpose units" standard.

**D2 — The icon is passed as a lucide component reference, rendered by the
primitive.** The primitive renders the icon at the fixed `size={14}
strokeWidth={2} aria-hidden` the copies all used, so consumers cannot drift the
icon sizing. Alternative — accepting a ready-made `ReactNode` — was rejected
because it re-opens the drift the primitive exists to close.

**D3 — Location: `packages/ui/src/components/coming-soon-control.tsx`, next to
`coming-soon-badge.tsx`.** Keeps the whole ComingSoon family co-located, matching
the memory that all ComingSoon affordances share one primitive. The primitive
imports `ComingSoonTooltip` from `@customreport/ui/components/ui/tooltip` exactly
as the consumers do today.

**D4 — Enforcement relocates, it does not disappear.** The primitive gets a unit
test (living in `apps/web` alongside `coming-soon-style.test.tsx`, since
`packages/ui` has no test runner) asserting the chrome, `aria-disabled`, absent
native title, amber tooltip on focus, and the icon slot. The five button files are
dropped from the two per-file source-scan `describe` blocks because those controls
no longer own a chrome that could drift — but the blocks are NOT deleted outright:
they shrink to a holidays-only scope over `admin/settings-tab.tsx`, preserving the
holidays sr-only `ComingSoonBadge` accessible-name guard and the holidays
no-`title="Coming Soon"` guard. Holidays keeps its own composition (D-scope), so
its enforcement must stay a source scan; only the five button controls'
enforcement moves to the primitive unit test. The repo-wide
no-bespoke-"Coming Soon"-pill scan (a different requirement) and the existing
render tests over the three exported controls stay.

## Risks / Trade-offs

- [`packages/ui` is consumed by `apps/web`; a primitive API miss ripples to five
  call sites] → keep the API minimal (icon ref + ariaLabel + testid + shape for
  the icon-only export; icon ref + ariaLabel + testid + label + compact? for the
  labelled export), typecheck the whole workspace, and rely on the existing render tests
  which now exercise the primitive through three of the five consumers.
- [Deleting the two source scans could mask a future sixth site that hand-rolls
  chrome] → the repo-wide no-bespoke-pill scan still catches a stray visible
  "Coming Soon" label, and the deferred-feature-pattern spec now names the shared
  primitive as the mandated chrome source; a reviewer catches a hand-rolled
  chrome the same way they would catch any pattern violation.
- [Holidays looks like it "should" also adopt the primitive] → the spec and this
  doc state explicitly why it cannot (nested-button HTML validity), so a future
  contributor does not "finish the job" and break hydration.

## Migration Plan

Pure refactor, no data or runtime migration. Land in one change: add the
primitive + its unit test, compose it in the five sites, extract the two nav-bar
wrappers, then shrink the two source-scan `describe` blocks to a holidays-only
scope. Rollback is a plain
revert; no state to unwind. Gate on `pnpm typecheck && pnpm lint && pnpm test`.

## Open Questions

None. Variant split (D1) and icon-passing convention (D2) are settled above;
Holidays scope is settled by HTML validity.
