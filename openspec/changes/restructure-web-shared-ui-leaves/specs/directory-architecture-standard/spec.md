## ADDED Requirements

### Requirement: Rule-of-2 leaf UI components MUST live in `shared/ui`, not a feature slice

A business-agnostic web UI component consumed by more than one domain MUST reside
in `apps/web/src/shared/ui/`, not in any `features/<domain>` slice — the web
rule-of-2. Concretely, the global search box `search-input.tsx` (consumed by the
`reports` route and the `admin` slice) and the role-guard render wrapper
`if-role.tsx` (consumed by the `dashboard` slice beside the `auth` domain) MUST
reside at `apps/web/src/shared/ui/search-input.tsx` and
`apps/web/src/shared/ui/if-role.tsx` (filenames unchanged from the legacy
`components/search/` and `components/auth/` trees), and those legacy directories
MUST NOT survive the relocation. Consumers MUST import each component directly
from `shared/ui/*` — no public-API barrel is introduced, as
`TARGET-STRUCTURE-2026-07-02.md` prescribes none for `shared/`. Because `shared/`
is not a feature slice, the `webSlices` cross-slice boundary in `eslint.config.ts`
MUST NOT gain a `search` or `auth` entry, and promoting these leaves to `shared/`
removes the admin→search and dashboard→auth cross-slice imports rather than
allowlisting them. The relocation MUST be behavior-neutral.

#### Scenario: Both leaves land in the shared ui layer

- **WHEN** the relocation is applied
- **THEN** `apps/web/src/shared/ui/` contains `search-input.tsx`, `if-role.tsx`,
  and their co-located `*.test.tsx`
- **AND** `apps/web/src/components/search/` and `apps/web/src/components/auth/`
  no longer exist
- **AND** the files reside under `shared/`, not under any `features/<domain>` slice

#### Scenario: Consumers import the leaves directly from shared

- **WHEN** the `reports` route, the `admin` products tab, or the `dashboard`
  alert bar renders these components
- **THEN** it imports `SearchInput` / `IfRole` from `shared/ui/*` directly (no barrel)
- **AND** no code imports `components/search/*` or `components/auth/*`

#### Scenario: The shared layer is not registered as a feature slice

- **WHEN** `eslint.config.ts` is evaluated
- **THEN** the `webSlices` array contains no `search` or `auth` entry
- **AND** no cross-slice allowlist entry is added for admin→search or dashboard→auth
