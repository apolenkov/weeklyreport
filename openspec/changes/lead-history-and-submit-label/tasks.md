# Tasks

## 1. Submit label

- [ ] 1.1 `lead-form.tsx`: change the forward commit button text from
      "Submit Section" to "Submit" (the `!isSubmitted && !isReadOnly`
      header button).
- [ ] 1.2 `lead-form.tsx`: in the submit confirmation dialog keep the
      explanatory title/body, but set the primary action button to
      "Submit".
- [ ] 1.3 Update comments that name the control "Submit Section" in
      `lead-form.tsx` and `report-toolbar.tsx` to "Submit".
- [ ] 1.4 Update tests asserting "Submit Section" (lead-form,
      report-toolbar, segmented-toggle, save-now-button, lead-form-
      visibility) to the new label.

## 2. History order (newest period first)

- [ ] 2.1 `apps/api` `reports.myHistory`: change `orderBy` from
      `{ createdAt: "desc" }` to order by the related report's
      `periodStart` descending, with a stable secondary tiebreak.
      VERIFY the Prisma relation-orderBy shape against the installed
      Prisma version at implementation time (e.g. the to-one form
      `[{ report: { periodStart: "desc" } }, { createdAt: "desc" }]`);
      if relation orderBy is unavailable, fetch and sort in the resolver
      after the query.
- [ ] 2.2 Confirm `reports.compiledHistory` already orders by
      `periodStart desc` (it does) so both reads agree; no change needed
      there.
- [ ] 2.3 Verify the summary-rail streak loop in
      `lead-history-sidebar.tsx` now reads a genuinely newest-period-
      first list (no code change expected — the fix is upstream order —
      but assert it in a test).

## 3. Summary footer denominator

- [ ] 3.1 `lead-history-sidebar.tsx`: change the traffic-light footer's
      "across {total} periods" to use the completed-period count
      (`submitted`), so numerator and denominator describe the same set.
- [ ] 3.2 Keep the existing "N draft not included in aggregates" note.
- [ ] 3.3 Confirm the head/viewer (compiled) path is unaffected — its
      entries are all completed, so `submitted === total`.

## 4. Dead `tab` cleanup

- [ ] 4.1 `lead/history/page.tsx`: redirect to `/reports` (drop
      `?tab=drafts`); update the comment.
- [ ] 4.2 `head/history/page.tsx`: redirect to `/reports` (drop
      `?tab=published`); update the comment.
- [ ] 4.3 `reports/page.tsx`: remove the "role-default tabs" promise from
      the file header comment; describe the single role-defaulted view.

## 5. Docs + gates

- [ ] 5.1 `CONTEXT.md` glossary already updated (Document action label →
      "Submit"; Lead submission → history aggregate + ordering note);
      re-read to confirm it still matches the shipped behavior.
- [ ] 5.2 `pnpm typecheck && pnpm lint && pnpm test && pnpm build` green.
- [ ] 5.3 `openspec validate lead-history-and-submit-label --strict` green.
- [ ] 5.4 Live-verify on `:3000`: latest period on top, footer
      denominator matches, draft note present, button reads "Submit",
      `/lead/history` lands on `/reports` with no `tab`.
