## ADDED Requirements

### Requirement: The lead quick-add control holds a stable document-action slot across view modes

The lead "+ Add" quick-add control MUST render in both edit and slides modes for
an editable (non-read-only) section, so it does not disappear when the lead
switches to slides — today it is gated `!isSlidesMode` and vanishes (annotations
C2). The control is `apps/web/src/components/lead/quick-add-button.tsx`, rendered
by `apps/web/src/components/lead/lead-form.tsx` inside the header line's
`DocumentActionGroup`. Within
the document-action group it MUST sit immediately before the forward commit (the
Submit Section primary) — after Save and Fill-From (annotations C1) — so the
single-forward-primary accent hierarchy is preserved: "+ Add" takes the
neutral/outline treatment and MUST NOT carry a resting solid brand-accent fill,
which stays reserved for the Submit Section commit. On a read-only past period
"+ Add" MUST be hidden together with the other mutating document actions (Save,
Submit Section, Fill-From), and it MUST stay disabled when the lead owns no
product (there is no valid per-type dialog target).

#### Scenario: switching edit to slides keeps + Add present

- **WHEN** a lead toggles the view-mode control from edit to slides on an
  editable section
- **THEN** the "+ Add" control remains present in the document-action group
- **AND** it does not disappear or change position

#### Scenario: + Add sits immediately before the Submit primary

- **WHEN** a lead opens their editable, not-yet-submitted report
- **THEN** the "+ Add" control renders after Save and Fill-From and immediately
  before the Submit Section commit
- **AND** "+ Add" carries a neutral/outline treatment, not the resting solid
  brand-accent fill

#### Scenario: a read-only past period hides + Add

- **WHEN** a lead opens a read-only past period
- **THEN** the "+ Add" control is hidden alongside Save, Submit Section, and
  Fill-From

#### Scenario: a lead with no products cannot quick-add

- **WHEN** the lead owns no product
- **THEN** the "+ Add" control renders but is disabled
