## Why

Current reminder recovery date coercion accepts null as epoch before restore. Current published lifecycle admission accepts autoArchived on a nonarchived report. ProjectActivity persisted reads use weaker text formats than their existing write boundary.

## What Changes

- Reject null before coercion for the five mandatory reminder dates, preserving non-null Date/ISO coercion and nullable sentAt.
- Require archived when autoArchived is true at shared lifecycle and snapshot admission, with one forward-only database CHECK.
- Reuse private safeText validators for Activity name and Jira account read/create/update fields without transforming bytes or adding read cardinality limits.
- Use an explicit code-unit comparator for the actual deduplicated current/desired project-owner User locks, approved as source maintenance only.
- Update an existing stale lifecycle-order test spy to recognize the current complete-tuple OR scan.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `admin-snapshot-restore`: mandatory recovery null-date refusal before transaction.
- `period-dual-state`: current autoArchived provenance requires archived.
- `schema-conventions`: ProjectActivity persisted text format matches its write guard.

## Impact

F01 exact owners plus Root-granted forward migration. Existing Head13 repairs and email/nonzero-vector migrations are reused. Old migrations, Head2 tests, shared index/primitives/error mapper and deployment provision SQL remain unchanged. Local provision still requires actual SQL RED and remains NE. Source checkpoint does not establish PG/native/full acceptance; Root owns those lanes and publication. TASK-287/D37-F01 source handoff is external, canonical registry and Backlog stay read-only.
