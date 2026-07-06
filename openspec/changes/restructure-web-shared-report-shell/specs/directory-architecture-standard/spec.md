## ADDED Requirements

### Requirement: Report-shell UI primitives MUST live in the `shared/ui/report-shell` layer

Business-agnostic report-shell UI primitives MUST reside in
`apps/web/src/shared/ui/report-shell/`, not in any `features/<domain>` slice and
not in the legacy flat `apps/web/src/components/report-shell/` tree. The whole
legacy folder is flat-renamed: every source file — the eleven mapped primitives
(`accordion-section`, `agent-review-coming-soon`, `archive-toggle`, `lock-badge`,
`meta-row`, `report-toolbar`, `save-now-button`, `scope-toggle`,
`segmented-toggle`, `toolbar-icon-button`, `view-mode-toggle`) plus the
post-catalog additions `rotating-chevron` and `use-report-shell-url-state` — its
co-located tests, and the `__snapshots__/` directory MUST move together, filenames
unchanged, and the legacy `components/report-shell/` directory MUST NOT survive
the relocation. Because these primitives are consumed across lead, head, viewer,
weekly-report, slides, and the dashboard slice and are owned by no single domain,
they graduate to `shared/ui/` rather than `features/<domain>/ui/`; no feature
slice may claim them, and the `webSlices` cross-slice boundary in
`eslint.config.ts` MUST NOT gain a report-shell entry. Consumers MUST import the
primitives directly from `shared/ui/report-shell/*` — no public-API barrel is
introduced, as `TARGET-STRUCTURE-2026-07-02.md` prescribes none for `shared/`.
The relocation MUST be behavior-neutral (no component logic, props, or rendered
output change).

#### Scenario: Report-shell primitives land in the shared ui layer

- **WHEN** the report-shell relocation is applied
- **THEN** `apps/web/src/shared/ui/report-shell/` contains all thirteen source
  files (the eleven mapped primitives plus `rotating-chevron.tsx` and
  `use-report-shell-url-state.ts`), every co-located `*.test.tsx`/`*.test.ts`, and
  the `__snapshots__/` directory
- **AND** `apps/web/src/components/report-shell/` no longer exists
- **AND** the files reside under `shared/`, not under any `features/<domain>` slice

#### Scenario: Consumers import report-shell primitives directly from shared

- **WHEN** any surface (lead, head, viewer, weekly-report, slides, dashboard, or a
  route) renders a report-shell primitive
- **THEN** it imports the component from `shared/ui/report-shell/*` directly (no
  barrel), with the relative path recomputed from the consumer's own location
- **AND** no code outside `shared/ui/report-shell/` imports the legacy
  `components/report-shell/*` path

#### Scenario: Moved files' cross-directory imports are recomputed, not merely deepened

- **WHEN** `lock-badge.tsx` and `save-now-button.tsx` are relocated
- **THEN** `lock-badge.tsx` imports `sdlc-tooltip` from
  `../../../components/ui/sdlc-tooltip` (routed back through `components/`, not
  `shared/ui/sdlc-tooltip`)
- **AND** `save-now-button.tsx` imports the `AutosaveSnapshot` type from
  `../../../hooks/use-lead-form-autosave`
- **AND** intra-folder `./`-relative imports between the moved files stay valid
  unchanged

#### Scenario: The shared layer is not registered as a feature slice and needs no lint exemption

- **WHEN** `eslint.config.ts` is evaluated
- **THEN** the `webSlices` array contains no `report-shell` entry
- **AND** no path-pinned size/complexity exemption references any report-shell
  file (none existed for the legacy path, and the flat rename introduces none)
