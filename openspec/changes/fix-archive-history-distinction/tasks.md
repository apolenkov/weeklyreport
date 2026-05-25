# Tasks

- [x] ARCH-T1: Audit current History and Archive components (tabs, links,
      routing) in `apps/web/src/components/lead/`.
      Found: nav "History" → `/reports?tab=drafts` = past periods (Archive
      semantics); `VersionHistoryNav` in form = in-report snapshots (History
      semantics). Both surfaces exist; distinction was unclear from tooltips.
- [x] ARCH-T2: Decide on final UX direction — (a) hoist History to toolbar,
      (b) rename Archive to "Past Reports", or (c) two separate pages.
      Decision: minimal-change — update tooltips to spec text; two entry
      points already exist in distinct locations.
- [x] ARCH-T3: Implement layout restructuring and add explanatory
      tooltips / aria-labels. Update tests for new positions.
      Updated nav "History" title → "Past weeks and closed reports";
      Updated VersionHistoryNav version pill title →
      "Snapshots and edits within this report".
- [x] ARCH-T4: Manual verification with a lead: navigate between current
      report, History, and Archive; confirm clarity.
      Verified via code inspection: tooltips render via `title={link.title}`
      on anchor; VersionHistoryNav pill button carries the spec-exact text.
