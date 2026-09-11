# admin-user-group-form Specification

## Purpose

Preserve explicit ownership-group absence in admin user forms while keeping
role-specific save validation and payloads consistent.

## Requirements

### Requirement: Admin user forms preserve explicit group absence

The admin user snapshot view and edit form MUST represent no owning group as
`null`, never as an empty string. The UI form state and mutation mapper MUST use
one canonical form contract. A viewer MAY submit with no owning group; a
non-viewer MUST have a non-empty owning group before its mutation payload can
be created.

#### Scenario: Admin edits a groupless viewer

- **GIVEN** a viewer whose snapshot `reportingGroupId` is null
- **WHEN** the admin opens the user form
- **THEN** the view and form group values remain null
- **AND** submitting the viewer produces `reportingGroupId: null`

#### Scenario: Groupless viewer becomes a lead with one active group

- **GIVEN** a groupless viewer and one active group
- **WHEN** the admin changes the role to Lead
- **THEN** the form selects that active group
- **AND** the confirmed save payload contains its non-empty group id

#### Scenario: Non-viewer submit has no real group

- **WHEN** a caller attempts to build a non-viewer mutation from a null, empty,
  or whitespace-only group id
- **THEN** the client mutation mapper rejects the form
- **AND** it does not normalize the missing group into a nullable wire value

#### Scenario: Existing valid group round trips

- **GIVEN** a non-viewer snapshot user with a valid owning group
- **WHEN** the user passes through the admin view, form, and mutation mapper
- **THEN** the submitted `reportingGroupId` equals the original group id
