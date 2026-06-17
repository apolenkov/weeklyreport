# Tasks: scope-lead-report-to-own-contribution

> Sections 1–5 are the FIRST cut (shipped + open in PR #14): own-records default
>
> - status-only Product context, foreign content read deleted. They stay `[x]`.
>   Section 7 is the REVISION on the SAME branch / SAME PR #14 that adds the Record
>   visibility toggle and re-introduces a gated full-content read for the Everyone
>   state. This reverses design D4. Do section 7 next.

## 1. Shared / API contract (do first)

- [x] 1.1 Decide the status-only Product context shape (per shared product:
      foreign stages + traffic-light status + author initials). Define it in
      shared types; remove or narrow `CrossAuthorSection` / `ForeignKanbanItem` /
      `ForeignRiskEntry` / `ForeignDecisionEntry`.
- [x] 1.2 Remove `leadForm.crossAuthorSections` (full foreign content) from the
      lead path, or replace it with the status-only procedure. Trim
      `leadForm.crossAuthors` output: drop `itemCount` / `riskCount` and the
      `user.name` select (return initials only).
- [x] 1.3 List downstream consumers (lead form + slides only) and update their
      call sites to the new shape.

## 2. Backend — repository + authorization

- [x] 2.1 In `lead-form.prisma-repository.ts`, replace `getCrossAuthorSections`
      content selection with a status-only projection; `getCrossAuthors` returns
      stage status + initials, no counts, no full name. Derive initials from
      `user.name` server-side; never put the full name in the response.
- [x] 2.2 Add a caller-access check on the Product context read: the caller must
      own a section in / have access to the given `reportId`, else return empty.
      (In `LeadFormService.getCrossAuthors`: own-section OR head/admin, else `[]`.)
- [x] 2.3 Derive foreign stage status from risks (canonical rule), not the
      blocked-item path; keep archived-product exclusion. Empty `stageNames`
      means "covers all assigned stages" (review fix B1).

## 3. Frontend — own records + status-only context

- [x] 3.1 In `lead-form.tsx`, drop the `crossAuthorSectionsQ` merge; `merged*`
      collapse to own arrays only.
- [x] 3.2 In `lead-cross-author.ts`, remove the `mapForeign*` content mappers;
      keep only the status-only product-context projection. `buildCrossAuthorStageMap`
      trusts the server-derived per-stage status directly (review fix B2).
- [x] 3.3 In `sdlc-pipeline.tsx`, render foreign stages as dimmed identity-only
      chips (initials + status); remove count display; keep honest product health
      (`worstForeignSeverity` reads `ca.stages[].status`).
- [x] 3.4 In `stage-chip.tsx`, the "Locked" chip shows initials, not the owner's
      full name.
- [x] 3.5 Apply the same own-records rule to the lead slides path
      (`lead-slides-client.tsx`) AND keep honest product health on slides:
      `applyForeignProductHealth` folds the worst foreign stage into each product
      badge (review fix B3).

## 4. Tests

- [x] 4.1 Repository/integration test: the Product context read returns no
      foreign item/risk/decision text, no counts, no full names — status only.
- [x] 4.2 Negative authz test: an unrelated `reportId` returns no foreign context.
      (Service-level guard test in `lead-form.contract.test.ts`; repo-level
      content-safety in the integration test.)
- [x] 4.3 `sdlc-pipeline` render test: a co-lead's blocked stage colours product
      health but renders as a dimmed identity-only chip (initials) with no counts.
- [x] 4.4 Regression: own items/risks/decisions still render in full; foreign
      records are absent on both form and slides.
- [x] 4.5 Regression pin: foreign stage status is risk-derived, not blocked-item.
      (Incl. covers-all empty-`stageNames` blocked/at-risk cases.)

## 5. Verify + gate

- [x] 5.1 Live-verify on the `middle` seed (lead-1 Vasily, co-owned products
      with co-leads БС/ВЛ/ГМ): PASSED. crossAuthors API returns initials only,
      no authorName/counts/foreign text. Form: foreign stages render as
      initials-only chips; product health honest — CRM-Sales Hub reads at-risk
      purely from the co-lead's foreign yellow stage (own stages green). Slides:
      same — own records only, CRM-Sales Hub badge "At risk" from foreign БС, no
      foreign full names anywhere.
- [x] 5.2 `npx prisma generate && pnpm typecheck && pnpm lint && pnpm test &&
pnpm build` — all green; `pnpm --filter @customreport/api test:integration`
      green (the integration suite is excluded from `pnpm test`).

## 7. Revision — Record visibility toggle (Everyone) on the same PR #14

### 7a. Shared / API contract (do first)

- [x] 7a.1 Re-introduce the gated full-content read shape in shared types
      (`CrossAuthorSectionRow` in `lead-form-shared.ts`, revived from the
      pre-cut shape + a risk-derived per-product `stages[]`): item / risk /
      decision text, the owning author's full name, and foreign stage chips.
      Distinct from the status-only cross-author row (initials + status only).
- [x] 7a.2 Add `getCrossAuthorContent` to `lead-form.prisma-repository.ts`: full
      foreign content for products the caller co-owns on the given report. Leave
      `getCrossAuthors` (status-only) unchanged — it is still fetched in both
      states. Returns `{ coOwnsShared, rows }` so denied (co-owns nothing) and
      empty (co-owns but no records) stay distinguishable for the metric.
- [x] 7a.3 Add a `leadForm.crossAuthorContent` tRPC `protectedProcedure` taking
      `{ reportId }`, returning the full-content shape. Consumer: the lead form's
      Everyone state only (NOT slides). Role is NOT passed (no head/admin bypass).

### 7b. Backend — authorization (two-tier)

- [x] 7b.1 Gate `getCrossAuthorContent` harder than the status read: caller must
      have access to the report (own a section in it) AND co-own the product;
      an unrelated/arbitrary `reportId`, or a non-co-owned product, returns `[]`.
      Applied to ALL callers with NO head/admin bypass — the service signature
      carries no role, so a head/admin who does not co-own the product is denied
      like any other non-co-owner (see D6); the server authz does NOT key off the
      lead-form toggle. Foreign stage status is risk-derived via the existing
      `deriveForeignStageStatus` (canonical rule), reused from the status read.
- [x] 7b.2 Status-only read's gate (`getCrossAuthors`) unchanged; both reads keep
      the archived-product exclusion (`project: { archived: false }`).
- [x] 7b.3 Metric `customreport_cross_author_content_reads_total` with a `result`
      label (`allowed` / `denied` / `empty`) added to the registry and emitted in
      `LeadFormService.getCrossAuthorContent`. `denied` = no report access OR no
      co-ownership; `empty` = co-owns but no foreign records; `allowed` = rows
      returned. Payload stays `[]` in both denied and empty (no leak). See D6b.
      NOTE (spec reconcile): D6b's parenthetical lumps "co-owns nothing" into
      empty, but D6 makes co-ownership authz clause (b) and 7d.9 lists the
      no-co-ownership case as a separate DENIED row. Failing an authz gate is a
      denial, so co-ownership failure is labelled `denied`, not `empty`; `empty`
      is reserved for "passed both gates but the co-owner authored no records".

### 7c. Frontend — toggle + conditional fetch + chip hide

- [ ] 7c.1 Add the Record visibility toggle to `lead-form.tsx`: two states "Mine
      only" (default) / "Everyone", English label, lead form only.
- [ ] 7c.2 Persist the state in `localStorage` under a key namespaced by the
      current user AND `reportId` (e.g. `leadRecordVisibility:{userId}:{reportId}`)
      so "Everyone" cannot bleed across users or reports on a shared browser or
      via the dev role-switcher; first-ever load (no matching key) defaults to
      "Mine only", and a user/report context change re-scopes the lookup. See
      design D4c.
- [ ] 7c.3 Fetch `crossAuthorContent` ONLY when Everyone (conditional query);
      never fetch it in Mine only. The fetch MUST wait until the persisted
      toggle state has loaded and the UI reflects "Everyone" before firing — it
      must not fire on the pre-hydration default and then race the restored
      state (avoids a flash / early-fetch). See design D4c.
- [ ] 7c.4 Mine only: render own arrays, hide foreign stage chips, keep honest
      health from the always-fetched status read. Everyone: merge the foreign
      records read-only (restore the `mapForeign*` content mappers, used only
      when the Everyone read is present) and show foreign stage chips.
- [ ] 7c.5 Keep the toggle view-only: it must not change submit/completeness or
      published/exported output in either state. Confirm the publish and export
      flows never consume the toggle or the `crossAuthorContent` query.
- [ ] 7c.6 Purge the fetched foreign full content (query cache + component state +
      DOM) not only on Everyone→Mine only but also on logout, role switch, report
      switch, product switch, and any authorization downgrade, so no foreign
      record can carry into a new identity/context. See design D4c.

### 7d. Tests

- [ ] 7d.1 Mine only fetches NO full content: assert NO network request is issued
      to the full-content endpoint (`crossAuthorContent`) — the guarantee is the
      absent request, not client-side filtering of a fetched response — and no
      foreign text / full name / foreign chip renders.
- [ ] 7d.2 Everyone renders the co-owners' full records (text + full name +
      foreign chips), read-only, alongside the lead's own records.
- [ ] 7d.3 NEGATIVE authz: `getCrossAuthorContent` returns `[]` for an unrelated
      `reportId` AND for a product the caller does not co-own (two cases).
- [ ] 7d.4 Honest health holds in BOTH states and does not depend on the toggle;
      Mine only shows red health with foreign chips hidden.
- [ ] 7d.5 View-only regression: switching to Everyone then submitting yields a
      section with own records only; published/exported output unchanged.
- [ ] 7d.6 Persistence: stored "Everyone" is restored on reload; no stored value
      defaults to "Mine only".
- [ ] 7d.7 Stale-cache purge: after Everyone renders foreign records, switching
      back to Mine only purges the fetched full content from the query cache,
      component state, and DOM — assert no foreign text / name / chip remains
      rendered or cached; a later return to Everyone re-fetches, not serves stale.
      Also assert the purge fires on logout, role switch, report switch, product
      switch, and authorization downgrade (no foreign data carries into the new
      context).
- [ ] 7d.8 Submit-payload byte-identical: for the same user edits, the submit
      payload is byte-identical in "Mine only" and in "Everyone" (pins D4b
      view-only — the toggle never folds foreign records into the submission).
- [ ] 7d.8b Publish/export toggle-independent: published and exported output is
      identical regardless of the lead's toggle state, and the publish/export
      flows issue no `crossAuthorContent` read (completes D4b coverage beyond
      submit).
- [ ] 7d.9 Positive authz matrix on the full-content read: own author (allowed),
      same-product co-owner (allowed), report member who does NOT co-own the
      product (denied → `[]`), unrelated report (denied → `[]`), head/admin who
      does NOT co-own the product (denied → `[]`, NO role bypass — see D6).
      Complements the negative tests in 7d.3.
- [ ] 7d.10 Status-only breadth (documented behavior): the status-only read
      returns initials + risk-derived status for products the caller does NOT
      co-own (within a report they have access to), and still carries no text,
      counts, or full names. Pins the intentional cross-product status disclosure
      within one reporting group (see D6 status-only bullet).

### 7e. Verify + gate

- [ ] 7e.1 Live-verify on the `middle` seed: toggle Mine only ↔ Everyone on a
      co-owned product; Mine only hides foreign chips + content with honest red
      health; Everyone shows co-owners' full records + names + foreign chips;
      slides unaffected.
- [ ] 7e.2 `npx prisma generate && pnpm typecheck && pnpm lint && pnpm test &&
  pnpm build` + `pnpm --filter @customreport/api test:integration` all green.

## 8. Follow-up (post-merge)

- [ ] 8.1 After the PR merges to main, archive via `opsx:archive`.

## Review findings (adversarial multi-lens, all fixed before commit)

- B1 (blocker): empty `stageNames` = "covers all assigned stages" was not
  honoured in `deriveForeignStageStatus`, so a co-lead's covers-all blocked risk
  coloured no foreign stage and product health read green. Fixed + tested.
- B2 (blocker): `buildCrossAuthorStageMap` re-derived the already-risk-derived
  server status with empty risks/items, collapsing a server `red` back to
  on-track — foreign chip green while health red. Fixed: trust server status.
- B3 (blocker): lead slides never read `crossAuthors`, so a co-owned product's
  health was own-only. Fixed: `applyForeignProductHealth` folds foreign worst.

## Deferred (inert, non-leaking — tracked, not done here)

- Dead foreign-render plumbing now that no foreign record reaches the lead page:
  `displayRisks` / `coveringForeign` / `CROSS_AUTHOR_LOWER_BLOCKED_MESSAGE` in
  `lead-form-sync-bridge.tsx`; the `risk.foreign` / `decision.foreign` /
  `item.foreign` render branches in `risks-section.tsx` / `decisions-section.tsx`
  / `item-card.tsx`. All inert (own-only arrays arrive), no full name can render.
  Removing spans the render layer across 4+ files — its own focused cleanup.
- `getCrossAuthors` still emits the stable foreign `authorId` (unused on the new
  frontend, but a re-identification key). Drop or opaque-key it in that cleanup.
- Head/admin bypass is privacy-correct but inert: the repo scopes to the caller's
  own stage assignments, so a head with none gets `[]`. Confirm whether heads are
  meant to receive Product context on this read; out of scope for own-records.
