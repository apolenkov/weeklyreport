## ADDED Requirements

### Requirement: Admin CRUD dialogs source focus management from the shared primitive

The four admin CRUD dialogs MUST obtain their focus-on-open and
restore-on-close behavior from the same shared focus-managed dialog primitive
that the non-admin modals use, rather than from per-dialog hand-rolled autofocus.
This unifies the implementation so a single primitive owns focus trap and
restoration app-wide; the observable behavior already required by this capability
(focus lands on the first control on open; focus returns to the trigger on every
close path) is preserved unchanged. The governed dialogs remain the users,
products, groups, and periods-create overlays in
`apps/web/src/components/admin/users-tab.tsx`,
`apps/web/src/components/admin/products-tab.tsx`,
`apps/web/src/components/admin/groups-tab.tsx`, and
`apps/web/src/components/admin/periods-tab-dialog.tsx`.

#### Scenario: an admin dialog uses the shared primitive without changing behavior

- **GIVEN** an admin CRUD dialog migrated onto the shared focus-managed primitive
- **WHEN** it opens and later closes via Escape, Cancel, overlay click, or save
- **THEN** focus lands on its first meaningful control on open and returns to the
  opening trigger on close, exactly as before
- **AND** the dialog no longer carries its own hand-rolled focus-on-open /
  restore-on-close wiring

#### Scenario: the existing admin focus regression tests still pass

- **GIVEN** the co-located focus-on-open and restore-on-close tests for each
  admin dialog
- **WHEN** the dialogs are migrated to the shared primitive
- **THEN** those tests pass without weakening their assertions
