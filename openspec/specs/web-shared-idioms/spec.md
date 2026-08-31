# web-shared-idioms Specification

## Purpose

Centralize repeated web presentation and navigation idioms into shared homes for card surfaces, chevrons, dates, role labels, landing routes, and report-shell URL state.

## Requirements

### Requirement: Card surface chrome has a single shared idiom

The web layer SHALL expose exactly one shared card-surface idiom: the
`.card-surface` utility in `packages/ui/src/styles/utilities.css`. It
encapsulates the border + white-gradient + layered-shadow chrome, and every
matching surface MUST consume it together with the shared hover modifier when
hover treatment is required. No
web file MUST carry a second verbatim copy of the surface class string.

#### Scenario: A restyle of the card surface is a single edit

- **GIVEN** the card-surface chrome is homed in one shared idiom consumed by
  accordion-section, product-accordion, portfolio-overview-table,
  lead-summary-table, blocked-at-risk-table, the skeleton and history surfaces)
- **WHEN** the surface border, gradient, or shadow is changed once in that idiom
- **THEN** every consuming surface reflects the change
- **AND** no other web file needs a synchronised edit to stay visually consistent

#### Scenario: A reintroduced inline copy is rejected

- **GIVEN** the single shared card-surface idiom exists
- **WHEN** a new component inlines the border+gradient+shadow class string instead
  of consuming the idiom
- **THEN** the guard (source-scan test or lint) fails
- **AND** the component MUST be changed to consume the shared idiom

### Requirement: The rotating chevron is one shared component over lucide

The web layer SHALL provide a single `RotatingChevron` component that wraps
`lucide-react`'s `ChevronDown` with the shared rotate transition.
`shared/ui/report-shell/accordion-section.tsx`,
`features/report-pages/ui/product/product-accordion.tsx`, and
`features/dashboard/ui/blocked-at-risk-table.tsx` MUST use it. No report-shell
sibling MUST hand-roll a _rotating_ chevron while
`lucide-react` is available. The _static_ split-button dropdown glyph in
`features/period/ui/fill-from-button.tsx` (a non-rotating `h-3 w-3` `ChevronDown` with no
`expanded` prop) MUST NOT be routed through `RotatingChevron` — homing it there
would change its rendered size and add rotation semantics, violating behaviour
preservation; it MUST instead import `lucide-react`'s `ChevronDown` directly at
`h-3 w-3`.

#### Scenario: Expanded state drives the shared chevron rotation

- **GIVEN** an accordion or expandable row consuming the shared `RotatingChevron`
- **WHEN** the row toggles between collapsed and expanded
- **THEN** the chevron rotates via the shared transition
- **AND** no local rotating `ChevronDown` definition exists

#### Scenario: The static split-button glyph is left non-rotating

- **GIVEN** `features/period/ui/fill-from-button.tsx` renders a static `h-3 w-3`
  dropdown glyph
  with no `expanded` prop
- **WHEN** the rotating-chevron idiom is homed
- **THEN** that glyph is NOT routed through `RotatingChevron`
- **AND** it renders `lucide-react`'s `ChevronDown` directly at `h-3 w-3`, keeping
  its size and non-rotating behaviour unchanged

#### Scenario: The chevron carries the correct accessibility attributes once

- **GIVEN** the shared `RotatingChevron` is rendered inside a toggle control
- **WHEN** the surface is inspected for accessibility
- **THEN** the chevron SVG is `aria-hidden` in one place
- **AND** consuming surfaces do not repeat ad-hoc `aria-hidden` wiring

### Requirement: Short date and timestamp formatting has one home

`apps/web/src/shared/lib/format/format-date.ts` SHALL own the short-month table
and expose `formatTimestampShort`. All web date and timestamp presentation MUST
use this canonical formatter home; no other web file may declare a private
short-month array for display formatting.

#### Scenario: The external formatter copies consume the shared home

- **GIVEN** `formatTimestampShort` is defined in `format-date.ts`
- **WHEN** the reminders, lead-form, and lead-history formatter sites render a
  short date or timestamp
- **THEN** they call the shared exports
- **AND** no local `["Jan", "Feb", ...]` array remains in those files

#### Scenario: A month-label correction propagates from one place

- **GIVEN** all short-date rendering flows through the shared formatter
- **WHEN** the month labels are edited once in `format-date.ts`
- **THEN** every consuming surface reflects the change
- **AND** no other file needs editing to stay consistent

### Requirement: Role labels have a single shared source

`packages/shared` SHALL export exactly one `ROLE_LABEL` map keyed by the canonical
role enum (next to `roleSchema` in
`packages/shared/src/schemas/auth/auth.ts`). Every role-label surface
MUST consume it, and the canonical head label MUST be `Head`. No web or API file
MUST derive a role's display label from a role token inline.

#### Scenario: Role-label surfaces agree

- **GIVEN** `ROLE_LABEL` is homed once in `packages/shared`
- **WHEN** the login-page role map, the dev role-switcher, and the inline
  role-derivation site (`lead-form.ts`) render a role label
- **THEN** all three render the same label for a given role
- **AND** every head label renders `Head`

#### Scenario: Adding a role forces a label entry

- **GIVEN** `ROLE_LABEL` is typed exhaustively on the role enum
- **WHEN** a new role is added to the enum without a label entry
- **THEN** the type check fails at the shared map
- **AND** no consumer silently renders a missing label

### Requirement: Role-to-route landing has a single non-divergent map

`packages/shared` SHALL export exactly one role→route landing map
`ROLE_HOME_PATH` (next to `roleSchema` in
`packages/shared/src/schemas/auth/auth.ts`) that backs the API
`dev-login.routes.ts` fallback, the web `devLoginHref` and `defaultRedirectFor`
helpers in `app/login-page-roles.ts`, and the web `nav-active.ts` / `role-gate.tsx`
home consumers — so a role's landing route cannot diverge between them. The map
MUST be exhaustively typed on the role enum with NO runtime fallback at the
shared home; unknown non-`Role` runtime values stay the responsibility
of the web call site (the existing `defaultRedirectFor` `FALLBACK_REDIRECT`
guard), documented there. The viewer target MUST be `/reports/latest`, the
viewer's canonical primary entry to its report per the
`viewer-report-navigation` spec — never the divergent `/reports?tab=published`
list surface. In the API dev-login handler the map is the post-sanitizer
fallback only: it is passed as the `fallbackPath` to
`resolveDevLoginRedirectUrl`, and the `safeRedirectPath` open-redirect
precedence and ordering are unchanged.

#### Scenario: The viewer landing route is canonical

- **GIVEN** the single shared role→route map with viewer target `/reports/latest`
- **WHEN** a viewer completes a param-less dev-login (API — no explicit `redirect`
  query param, e.g. from the dev role-switcher), the web login page computes the
  viewer's default redirect, and `ROLE_HOME_PATH.viewer` resolves
- **THEN** all resolve to `/reports/latest`
- **AND** none resolves to `/reports?tab=published`

#### Scenario: An explicit dev-login redirect param still wins over the map

- **GIVEN** a dev-login request carrying an explicit `redirect` query param that
  passes `safeRedirectPath`
- **WHEN** the redirect is resolved
- **THEN** the sanitized param is honoured and the role→route map is not consulted
- **AND** the map is used only as the `fallbackPath` when no valid param is present

#### Scenario: A landing-route change is a single edit across every surface

- **GIVEN** the API redirect, the web `devLoginHref` / `defaultRedirectFor`
  helpers, and the `nav-active.ts` / `role-gate.tsx` consumers all use the one
  shared role→route map
- **WHEN** a role's landing route is changed once in the shared map
- **THEN** the API redirect, web login default, brand-link, and role-gate home
  all reflect it
- **AND** none of the three can fall out of sync

### Requirement: The report-shell URL-state logic has a single hook

The web layer SHALL provide one `useReportShellUrlState` hook that owns the shared
head/viewer report-shell URL-state (the search-params reader, the
`URLSearchParams`-based setter, and the archive/scope derivations), and both
`head-report-shell.tsx` and `viewer-report-shell.tsx` MUST consume it. The hook
MUST accept a `stripParams` list whose members the setter deletes on EVERY call
(not once, not conditionally); the head passes `[]` and the viewer passes
`["source", "recovery"]`, preserving the viewer's load-bearing one-shot-marker
strip that prevents the Status-bounce recovery loop. The viewer-only
recovery/source concerns are realised through this strip-list, NOT by re-forking
the setter into the head shell or by an override that could skip the strip.

#### Scenario: Both shells share one URL-state implementation

- **GIVEN** `useReportShellUrlState` owns the archive toggle and scope derivation
- **WHEN** the head shell and the viewer shell read or update their shell URL state
- **THEN** both route through the shared hook
- **AND** neither shell owns a private `searchParams`/`URLSearchParams` block

#### Scenario: The viewer strip-list runs on every in-shell navigation

- **GIVEN** the viewer shell consumes the hook with `stripParams = ["source",
"recovery"]`
- **WHEN** any in-shell navigation updates the URL (period navigator, scope,
  archive, or view-mode toggle)
- **THEN** the setter deletes `source` and `recovery` from the params on that call
- **AND** the head shell, passing `stripParams = []`, strips nothing, so neither
  shell loses its declared behavior

#### Scenario: A URL-state fix lands once for both shells

- **GIVEN** both shells consume the shared hook
- **WHEN** the archive-param or scope-param handling is corrected once in the hook
- **THEN** the head and viewer shells both get the fix
- **AND** no per-shell copy needs a parallel edit
