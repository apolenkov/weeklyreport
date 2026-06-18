## MODIFIED Requirements

### Requirement: Lead and head toolbars share one control vocabulary

The lead and head report surfaces SHALL present the same control language:
segmented view toggles in one neutral family, and compact 32px grey icon buttons
for utility actions, so a user reads the two surfaces as the same interface.

The segmented toggles (Edit/Slides, Product/Leads, Mine/Everyone) SHALL use a
neutral active-selection fill (`--color-foreground`, white active text), NOT the
brand green — brand green is reserved for the header-line forward actions (Submit
Section, Publish & Lock). The toggles SHALL be visually identical across the two
surfaces, and the utility actions SHALL use the same 32px icon-button treatment
on both.

#### Scenario: a user moves between lead and head

- **WHEN** a user views the lead toolbar and then the head toolbar
- **THEN** the segmented toggles look identical (one neutral family) on both
- **AND** the utility actions use the same 32px icon-button treatment on both
- **AND** no segmented toggle uses the brand-green active fill
