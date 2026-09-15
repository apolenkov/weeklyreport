## Why

Leads need an Activity name and description specific to their report week without renaming the shared catalogue entry or changing another lead's report. Weekly notes already exist, but the title currently comes from the catalogue.

## What Changes

- Add a title override owned by the existing lead/week Activity status row.
- Reuse the existing note for the weekly description and expose both through canonical draft saving.
- Freeze effective titles and descriptions in published reports, slides and PDF.
- Define reset, omission, cross-week initialization and concurrent-save behavior.

## Capabilities

### New Capabilities

- `weekly-activity-presentation`: Per-section Activity title and description with immutable published presentation.

### Modified Capabilities

None. Existing `activity-reporting-unit` identity and independent status requirements remain dependencies.

## Impact

ActivityStatus storage, shared schemas, section save/merge, report-persistence mapping and Activity form/report consumers. Reuse parent ACT-01 source trace and architecture snapshot packet. No duplicate description field is needed.

## Non-goals

- Catalogue renames, cross-lead shared overrides, new Activity identities or a second save path.
- Mobile or unapproved database reset/migration-history operations.
