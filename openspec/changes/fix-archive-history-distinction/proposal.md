# Fix archive/history distinction UX

## Problem

Users are confused about the difference between **Archive** and **History**
tabs. Archive shows past reports; History shows edits and snapshots within a
single report. The naming and positioning do not make the distinction clear.

## Solution

Clarify the UX hierarchy: hoist the History tab closer to the report view
(e.g., inside the report toolbar), and rename or reposition Archive to a
separate, lower-priority section. Add explanatory tooltips:

- **History** — "Snapshots and edits within this report"
- **Archive** — "Past weeks and closed reports"

Alternatively, split into two separate views: report-level sidebar for History,
and a separate "Past Reports" page for Archive.

## Non-goals

- Delete or disable Archive functionality.
- Change the underlying data model.
- Alter the timeline or sorting of entries.
