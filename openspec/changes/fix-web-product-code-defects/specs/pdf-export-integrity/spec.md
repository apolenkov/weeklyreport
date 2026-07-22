## ADDED Requirements

### Requirement: PDF download read-authorization has one canonical implementation

The report-read authorization check used by the authenticated PDF download
handler (admin god-mode; otherwise the report has at least one section
within the caller's group scope) MUST be implemented in exactly one place
and reused by both the download handler and `PdfExportPrismaRepository`. A
second hand-written copy of this check MUST NOT exist, so a future change to
group-scope or admin visibility rules cannot update one copy while leaving
the other stale.

#### Scenario: Group-scope rules change

- **WHEN** the report-read authorization rule (admin god-mode or group-scope
  section check) is modified
- **THEN** updating the single shared implementation changes the behavior of
  both the PDF download handler and `PdfExportPrismaRepository.canReadReport`
- **AND** no second, independently-maintained copy of the check exists to
  fall out of sync

#### Scenario: A reviewer greps for the authorization logic

- **WHEN** a future reviewer searches for the admin/group-scope report-read
  check used by PDF export
- **THEN** exactly one implementation is found, imported by both the
  download handler and the repository
