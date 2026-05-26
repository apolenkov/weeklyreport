# Add report URL ID

## Problem

Currently, report URLs have no unique identifier (e.g.,
`http://localhost:3000/lead/report`). Users cannot tell which report they are
viewing when multiple reports are open in tabs, and there's no stable URL they
can bookmark or share.

## Solution

Add a `[id]` route segment or query parameter to lead report routes. When a
lead opens a report, the URL becomes
`/lead/report/[id]` (or `?reportId=<uuid>`), uniquely identifying the report
period. The breadcrumb, title, and browser tab should all reflect the report
identifier (e.g., "Week of 2026-05-25 — CustomReport").

## Non-goals

- Change how reports are created or stored.
- Add URL shortlinks or export-specific URLs.
- Alter the publish/archive flow (those routes stay independent).
- Add browser history navigation (navigation works as-is; we're just making
  the URL stable).

## Scope

Touches: `apps/web/src/app/lead/report` (route structure),
`lead-layout.tsx` (breadcrumb rendering), existing report query hooks.
