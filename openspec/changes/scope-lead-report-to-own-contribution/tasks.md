# Tasks: scope-lead-report-to-own-contribution

## 1. Shared / API contract (do first)

- [ ] 1.1 Decide the status-only Product context shape (per shared product:
      foreign stages + traffic-light status + author initials). Define it in
      shared types; remove or narrow `CrossAuthorSection` / `ForeignKanbanItem` /
      `ForeignRiskEntry` / `ForeignDecisionEntry`.
- [ ] 1.2 Remove `leadForm.crossAuthorSections` (full foreign content) from the
      lead path, or replace it with the status-only procedure. Trim
      `leadForm.crossAuthors` output: drop `itemCount` / `riskCount` and the
      `user.name` select (return initials only).
- [ ] 1.3 List downstream consumers (lead form + slides only) and update their
      call sites to the new shape.

## 2. Backend — repository + authorization

- [ ] 2.1 In `lead-form.prisma-repository.ts`, replace `getCrossAuthorSections`
      content selection with a status-only projection; `getCrossAuthors` returns
      stage status + initials, no counts, no full name. Derive initials from
      `user.name` server-side; never put the full name in the response.
- [ ] 2.2 Add a caller-access check on the Product context read: the caller must
      own a section in / have access to the given `reportId`, else return empty.
- [ ] 2.3 Derive foreign stage status from risks (canonical rule), not the
      blocked-item path; keep archived-product exclusion.

## 3. Frontend — own records + status-only context

- [ ] 3.1 In `lead-form.tsx`, drop the `crossAuthorSectionsQ` merge; `merged*`
      collapse to own arrays only.
- [ ] 3.2 In `lead-cross-author.ts`, remove the `mapForeign*` content mappers;
      keep only the status-only product-context projection.
- [ ] 3.3 In `sdlc-pipeline.tsx`, render foreign stages as dimmed identity-only
      chips (initials + status); remove count display; keep honest product health.
- [ ] 3.4 In `stage-chip.tsx`, the "Locked" chip shows initials, not the owner's
      full name.
- [ ] 3.5 Apply the same own-records rule to the lead slides path
      (`lead-slides-client.tsx`).

## 4. Tests

- [ ] 4.1 Repository/integration test: the Product context read returns no
      foreign item/risk/decision text, no counts, no full names — status only.
- [ ] 4.2 Negative authz test: an unrelated `reportId` returns no foreign context.
- [ ] 4.3 `sdlc-pipeline` render test: a co-lead's blocked stage colours product
      health but renders as a dimmed identity-only chip (initials) with no counts.
- [ ] 4.4 Regression: own items/risks/decisions still render in full; foreign
      records are absent on both form and slides.
- [ ] 4.5 Regression pin: foreign stage status is risk-derived, not blocked-item.

## 5. Verify + gate

- [ ] 5.1 Live-verify on the `middle` seed (a shared product, e.g. Mobile with a
      tech lead + PM): own records only, honest product colour, initials only,
      no foreign counts/text — on form and slides.
- [ ] 5.2 `npx prisma generate && pnpm typecheck && pnpm lint && pnpm test &&
    pnpm build`.

## 6. Follow-up (post-merge)

- [ ] 6.1 After the PR merges to main, archive via `opsx:archive`.
