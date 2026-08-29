## ADDED Requirements

### Requirement: Compact browser acceptance is one-off and source-bound

Final UI acceptance of the `apps/web` product surface MUST use a disposable,
one-off browser invocation against the exact candidate SHA and MUST cover the
lead, head, viewer, and admin journeys at representative desktop, phone,
tablet, and landscape viewports. It MUST record console errors, failed
requests, root and required nested overflow, touch geometry, dialog focus
return, and PDF delivery. The browser helper and raw session output MUST NOT
become a tracked harness.

#### Scenario: Candidate UI is accepted

- **WHEN** the one-off browser pass exercises all required roles and viewports
  against the candidate SHA
- **THEN** every asserted journey has source identity and objective evidence
- **AND** no unexpected console error, failed request, overflow, undersized
  scoped control, focus defect, or blank PDF tab remains

#### Scenario: Source changes after capture

- **WHEN** product or acceptance-relevant source changes after browser evidence
  is captured
- **THEN** the prior capture cannot establish final UI acceptance and the
  bounded pass is repeated

### Requirement: Final evidence converges on one SHA

Format, lint, typecheck, unit tests, required integration tests, coverage,
build, strict OpenSpec validation, one-off browser acceptance, independent
read-only review, remote `main`, and CI MUST all identify the same commit for
the `apps/web` and `apps/api` release surface.

#### Scenario: A gate passed on an earlier tree

- **WHEN** any required gate or review names a different source SHA than the
  candidate
- **THEN** final acceptance remains incomplete until that evidence is
  regenerated on the candidate
