## Why

Three linked feedback records (`cmtluljni0000fsw049sfjbtu`,
`cmtluneeg0002fsw0wepch8vp`, and `cmtlur3010004fsw04g1todbk`) show that the
lead report is too vertically fragmented to answer the basic status question:
what was planned, what is happening now, and what comes next. The saved
screenshots and the owner-supplied three-column reference establish the need
for one compact, readable comparison surface without replacing the editor.

## What Changes

- Add an addressable compact Overview beside the existing Edit and Slides
  modes on the lead report.
- Present Products and Project Activities as peer reporting units, each shown
  once with its existing status and three aligned time columns.
- Read `Previously planned` from the authoritative immediate predecessor:
  published snapshot first, submitted section fallback, never draft or the
  incomplete `carriedOver` subset.
- Let leads edit their own Current and Next items from Overview through the
  existing draft, dialog, autosave, and write path; keep Previously planned
  immutable and retain Edit for the complete authoring surface.
- Replace nested item cards with a flatter comparison matrix whose hierarchy
  remains readable at the accepted desktop widths.
- Preserve the current palette, typography, spacing tokens, and responsive
  containment rather than copying the reference's art direction.

### Non-goals

- No new persisted Project level between Product and Project Activity.
- No mutation of previous reports, snapshots, item week types, or lifecycle
  fields.
- No second Overview mutation, draft store, autosave loop, or lifecycle flow.
- No redesign of Slides, head/viewer reports, or PDF export.

## Capabilities

### New Capabilities

- `lead-status-overview`: addressable, ACL-safe Previous/Current/Next overview
  for lead-owned Products and Project Activities.

### Modified Capabilities

None.

## Impact

The change affects the lead-report route/view-mode model, a bounded historical
read projection in shared/API contracts, and new report-section presentation
components and tests. It requires no Prisma migration or new dependency.
