## MODIFIED Requirements

### Requirement: Settings Sub-Tab Forms Preserve Unsaved Edits and Report Revalidation Failures Distinctly

A Settings sub-tab form MUST NOT overwrite an in-progress edit when its
local draft state is reseeded from a server query: the reseed MUST run only
when the form is not currently dirty (no unsaved local changes since the
last seed or save). This applies to every draft-holding Settings sub-tab —
Identity, Notifications, Periods, and Reminders. After the settings mutation
itself succeeds and its post-save landing-page revalidation
(`/api/revalidate-org`) fails or throws, the UI MUST still report the
settings save as successful (the underlying data write already happened)
AND MUST surface a distinct revalidation-failure signal, so a stale
landing-page cache is never reported as a fully clean save.

#### Scenario: Background refetch does not clobber an in-progress edit

- **WHEN** an admin is mid-edit in the Settings → Identity short-name or
  full-name field, has not yet saved, and the underlying organization query
  refetches in the background (e.g. on window refocus)
- **THEN** the admin's unsaved input in the field is not overwritten by the
  refetched server value

#### Scenario: Background refetch does not clobber unsaved Notifications edits

- **WHEN** an admin is mid-edit in the Settings → Notifications
  from-email field, has not yet saved, and the settings query refetches in
  the background
- **THEN** the admin's unsaved input is not overwritten by the refetched
  server value

#### Scenario: Background refetch does not clobber unsaved Periods or Reminders edits

- **WHEN** an admin is mid-edit in any Settings → Periods field (e.g.
  deadline days, grace period) or the Settings → Reminders default-timezone
  select, has not yet saved, and the settings query refetches in the
  background
- **THEN** the admin's unsaved input is not overwritten by the refetched
  server value

#### Scenario: Save succeeds while landing-page revalidation fails

- **WHEN** an admin saves the Identity or Notifications sub-tab, the
  underlying settings mutation succeeds, and the subsequent
  `/api/revalidate-org` call returns a non-2xx response or throws
- **THEN** the UI still shows its normal saved-success toast (the data write
  succeeded)
- **AND** the UI additionally shows a distinct revalidation-failure
  toast or log, so the admin knows the landing page cache may be stale
- **AND** a thrown `/api/revalidate-org` fetch never causes a successful
  save to be reported only as an error, with no success toast

#### Scenario: A legitimate server-side change reseeds a clean form

- **WHEN** any draft-holding Settings sub-tab form (Identity, Notifications,
  Periods, Reminders) has no unsaved edits (freshly loaded, or right after
  its own save completed) and the source query's data changes
- **THEN** the form fields update to reflect the new server values

#### Scenario: Independent period-policy fields change before the next render

- **WHEN** an administrator changes period length to 14 days and grace period to 48 hours before the form rerenders
- **THEN** both committed values remain in the same unsaved period-policy draft
- **AND** neither field change restores the other field's earlier value
