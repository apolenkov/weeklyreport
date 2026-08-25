## ADDED Requirements

### Requirement: Runtime-sweep preflight modules MUST expose bounded ownership groups

Each direct directory under `e2e/runtime-sweep/preflight/` MUST remain within
the repository's existing 30-file ownership limit. Diagnostic sidecars, launch
continuations, and reusable reveal-continuation contracts MUST live in explicit
child ownership groups, with all imports and the runtime-sweep catalogue naming
their physical canonical paths. The structural baseline MUST describe the final
tree and MUST NOT relax the file-count limit.

#### Scenario: Preflight ownership groups pass the directory gate

- **WHEN** the directory-architecture gate counts direct files after the move
- **THEN** `preflight/diagnostics`, `preflight/launch`, and
  `preflight/reveal/continuation` each contain no more than 30 direct files
- **AND** no new exception or higher limit is introduced

#### Scenario: Catalogue and imports follow physical ownership

- **WHEN** the moved runtime-sweep modules are resolved by tests, static imports,
  and the scenario catalogue
- **THEN** every consumer resolves the canonical child-directory path
- **AND** no compatibility copy, shim, or duplicate module remains at the old path

## REMOVED Requirements

### Requirement: The head report shell MUST live in the report-sections slice

`head-report-shell.tsx` MUST reside at `apps/web/src/features/report-sections/ui/`
(filename unchanged from `components/head/`), because it is a report-sections
page-level shell composing report-shell primitives plus weekly-report/period/slides
UI — not a standalone `head` domain. The legacy `components/head/` directory MUST
NOT survive. Its route consumer under `app/(app)/head/report/[reportId]/` MUST
import it from `features/report-sections/ui/head-report-shell`. The relocation MUST
be behavior-neutral.

#### Scenario: The head shell lands in report-sections

- **WHEN** the relocation is applied
- **THEN** `apps/web/src/features/report-sections/ui/head-report-shell.tsx` exists
- **AND** `apps/web/src/components/head/` no longer exists
- **AND** the head report route imports it from `features/report-sections/ui/*`

**Reason**: This requirement is superseded by the later page-assembly rule that
keeps `features/report-sections` a pure lower floor and owns the Head shell in
`features/report-pages`.

**Migration**: Retain the existing `features/report-pages` ownership and its
public facade; remove only this contradictory historical requirement.
