## MODIFIED Requirements

### Requirement: Unified activity and activity alarm derivations remain behavior-compatible

The loaded-view-model boundary MUST preserve unified activity and activity alarm
derivations. The unified by-state view MUST be an opt-in presentation controlled
by the organization `AppSettings.unifiedActivityView` flag; the classic
Current/Next layout MUST remain the default when the flag is off. Activity card
alarm floors MUST derive from the live own-risk draft rows. Unified activity
entries for own rows MUST derive a total bucket mapping from raw item workflow
fields: `done` to `done`, `in_progress` to `in-progress`, `paused` to `paused`,
`planned` to `planned-next`, and `postponed` to `deferred`. `carriedOver` MUST
remain provenance only and MUST NOT alter the bucket. Foreign rows MUST derive
buckets from presentation status because their raw draft rows are unavailable.

#### Scenario: The classic layout remains the default

- **WHEN** `AppSettings.unifiedActivityView` is false
- **THEN** the lead form renders the classic Current/Next sections
- **AND** no persisted bucket field is required

#### Scenario: Every workflow status maps to one bucket

- **WHEN** the unified view derives a bucket for an own item
- **THEN** every allowed workflow status maps to its canonical presentation bucket
- **AND** changing only `carriedOver` does not change that bucket

#### Scenario: Unified entries derive buckets from the correct source

- **WHEN** the loaded view model builds unified activity entries
- **THEN** own rows use raw `type`, `workflowStatus`, and `carriedOver` fields
  to derive their bucket
- **AND** foreign rows use their presentation status because no raw draft row is
  available
