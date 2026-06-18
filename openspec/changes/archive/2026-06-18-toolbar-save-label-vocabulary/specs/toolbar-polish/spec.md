## MODIFIED Requirements

### Requirement: Lead and head toolbars share one control vocabulary

The lead and head report surfaces SHALL present the same control language: segmented view toggles in one neutral family, compact 32px icon buttons for icon-only utilities, and labeled pills for named actions — so a user reads the two surfaces as the same interface.

The segmented toggles (Edit/Slides, Product/Leads, Mine/Everyone) SHALL use the
neutral slate active-selection fill (`--color-toggle-active`, white active text),
NOT the brand green — brand green is reserved for the header-line forward actions
(Submit Section, Publish & Lock). The toggles SHALL be visually identical across
the two surfaces. Icon-only utility controls (Export PDF, archive, history, Fill,
the version/PDF Coming-soon stubs) SHALL use the same 32px icon-button treatment
on both surfaces. The lead Save control SHALL render as a labeled neutral pill at
the shared toolbar control height (icon + "Save" text), NOT the brand green; its
transient in-flight state MAY take the accent busy treatment (the one exemption
to the single forward-commit accent rule).

#### Scenario: a user moves between lead and head

- **WHEN** a user views the lead toolbar and then the head toolbar
- **THEN** the segmented toggles look identical (one neutral slate family) on both
- **AND** the icon-only utility actions use the same 32px icon-button treatment
- **AND** no segmented toggle uses the brand-green active fill

#### Scenario: the lead Save control renders

- **WHEN** the lead report toolbar renders the Save control in its idle state
- **THEN** it is a labeled neutral pill ("Save") at the shared toolbar height, not
  a brand-green button and not icon-only
- **AND** while a save is in flight it MAY show the accent busy treatment
