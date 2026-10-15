# Spec Delta

## ADDED Requirements

### Requirement: Missing crawl outputs are reported, not dropped

The crawler MUST list every requested role whose output is missing,
unreadable, not valid JSON or not a role result, with the role and the
reason, in `report.json` and as a warning in `report.md`, and MUST exit
non-zero. The full-walk merge MUST list every pass directory whose
`report.json` is missing or unreadable, MUST carry each pass report's missing
entries into the merged report, MUST still write the partial result and MUST
exit non-zero when anything is missing. Raw role and pass outputs MUST be
left as found.

#### Scenario: A role output is corrupt

- **WHEN** one requested role's output file is truncated
- **THEN** the report lists that role as missing with the reason and still
  contains the other roles
- **AND** the run exits non-zero and the truncated file is left in place

#### Scenario: A full-walk pass left no report

- **WHEN** a state pass directory has no `report.json` and another pass
  report lists a missing role
- **THEN** the merged report lists both, keeps the results it could read and
  the merge exits non-zero
