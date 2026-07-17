## Context

The chosen viewer model is operational observer: Status can show the current open/reopened report with drafts, while History and Search remain published-only. The read gate is already correct; the missing piece is authority labeling on the displayed surface.

## Goals / Non-Goals

**Goals:** make live working content unmistakable and expose lifecycle state in the viewer header.

**Non-Goals:** revisit viewer visibility, search scope, or mutation authority.

## Decisions

Use the loaded report's `periodStatus` as the only authority source. For `open` or `reopened`, render the exact banner `Working report — includes drafts` and a header state of `Draft` or `Reopened`. For `published`, omit the working banner and show `Published`.

The label belongs in the shared report header/toolbar state already visible above both form and slide modes, not inside individual content cards. That keeps authority visible before reading content and prevents disagreement between duplicated banners.

Search remains published-only and receives no working-state selector or copy. The report stays strictly read-only for viewers.

## Risks / Trade-offs

- `Draft` could be confused with one section's status → pair it with the explicit working-report banner.
- Shared header changes could affect head rendering → pass an explicit viewer authority model and test head labels remain unchanged.

## Invariants

Published-or-current authorization, group scoping, role coverage, and period lifecycle are preserved. No schema or write path changes.
