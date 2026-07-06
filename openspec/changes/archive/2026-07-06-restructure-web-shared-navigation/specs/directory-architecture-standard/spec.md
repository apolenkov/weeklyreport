## ADDED Requirements

### Requirement: App-wide navigation chrome MUST live in the `shared/ui/navigation` layer

Business-agnostic, app-wide web chrome MUST reside in `apps/web/src/shared/`, not
in any `features/<domain>` slice. Concretely, the navigation bar and its
hydration skeleton MUST reside in `apps/web/src/shared/ui/navigation/`
(`nav-bar.tsx`, `nav-bar-skeleton.tsx`, filenames unchanged from the legacy
`apps/web/src/components/navigation/` tree), and the legacy
`components/navigation/` directory MUST NOT survive the relocation. Because nav
chrome is mounted app-wide (`app/(app)/layout.tsx`) and owned by no single domain
slice, it graduates to `shared/ui/` rather than `features/<domain>/ui/`; no
feature slice may claim it. A consumer MUST import the components directly from
`shared/ui/navigation/*` — no public-API barrel is introduced, as
`TARGET-STRUCTURE-2026-07-02.md` prescribes none for `shared/`. `shared/` is not
a feature slice, so the `webSlices` cross-slice boundary in `eslint.config.ts`
MUST NOT gain a navigation entry. The relocation MUST be behavior-neutral (no
component logic, props, or rendered output change).

#### Scenario: Navigation chrome lands in the shared ui layer

- **WHEN** the navigation relocation is applied
- **THEN** `apps/web/src/shared/ui/navigation/` contains `nav-bar.tsx`,
  `nav-bar-skeleton.tsx`, and the co-located `nav-bar.test.tsx`
- **AND** `apps/web/src/components/navigation/` no longer exists
- **AND** the files reside under `shared/`, not under any `features/<domain>` slice

#### Scenario: The layout consumer imports nav chrome directly from shared

- **WHEN** the `app/(app)/layout.tsx` root layout renders the nav chrome
- **THEN** it imports `NavBar` and `NavBarSkeleton` from
  `shared/ui/navigation/*` directly (no barrel)
- **AND** no code outside `shared/ui/navigation/` imports `components/navigation/*`

#### Scenario: The shared layer is not registered as a feature slice

- **WHEN** `eslint.config.ts` is evaluated
- **THEN** the `webSlices` array contains no `navigation` entry
- **AND** the two path-pinned lint exemptions for `nav-bar.tsx` reference the
  `shared/ui/navigation/` path, not the legacy `components/navigation/` path
