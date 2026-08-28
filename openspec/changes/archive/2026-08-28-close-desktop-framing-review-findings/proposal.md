## Why

The source-bound desktop review exposed visible contradictions that unit and structural gates missed: a submitted period label clips at 1280 px, draft sections offer review actions, an activity says `1 leads`, and an edit dialog labels a required end date as optional. These findings come from the rejected `2026-08-15-desktop-framing-4fa854dc` evidence packet and its two independent visual reviews.

## What Changes

- Keep the complete selected period label readable when the lead submission badge is present at the canonical desktop viewport.
- Show section-verdict actions, and the Read/Review toggle that exposes them, only when at least one submitted section is reviewable; draft content remains visible.
- Render activity lead counts with correct singular/plural copy.
- Make the period-end label and required accessibility semantics truthful in edit mode while preserving optional create-mode behavior.
- Add focused regression tests and regenerate the seven-row desktop evidence packet with explicit semantic oracles and clean resting states.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `web-polish-lows`: clarify the desktop period selector, activity count copy, and mode-aware period-end field semantics.
- `head-report-visibility`: clarify that consolidated-report verdict affordances are submission-gated even when draft content stays visible.

## Impact

Affected code is limited to the web period navigator, period dialog fields, admin activity row, consolidated report review projection/band, and focused web tests. No API, schema, database, Redis, authentication, or deployment behavior changes.

## Non-goals

- Changing the API's existing race-safe acceptance of a verdict against an already-draft section.
- Redesigning the toolbar, admin forms, or report information architecture.
- Reopening R188, the full runtime sweep, or the already completed 24-row desktop inventory.
