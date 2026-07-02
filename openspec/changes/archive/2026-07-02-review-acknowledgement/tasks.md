## 1. Schema

- [ ] 1.1 Add `ViewerGroupAccess.canReview: Boolean @default(false)`.
- [ ] 1.2 Add `ReviewAcknowledgement` (`userId`, `reportId`, `groupId`, `seenAt`; unique `(userId, reportId, groupId)` — per-group, so a viewer with two groups acks each separately).
- [ ] 1.3 Add `SectionReview` (`reportSectionId`, `reviewerId`, `verdict` enum `approved|changes_requested`, `judgedVersion` Int, timestamps; unique `(reportSectionId, reviewerId)`).
- [ ] 1.4 Add `RecordComment` (`reviewerId`, `text`, exactly one of `itemId|riskId|decisionId`, each `onDelete: Cascade`).
- [ ] 1.5 `prisma migrate reset` with the AI-consent flag (MVP DBs are disposable); regenerate the client.

## 2. API — authorization helper

- [ ] 2.1 Add a `requireReviewer(session, groupId)` check: head-of-group OR admin OR a `ViewerGroupAccess` row for that group with `canReview = true`; throw FORBIDDEN otherwise. Key it on the SECTION's group, never "any reviewable group".
- [ ] 2.2 Confirm all `review.*` procedures are built on `leadershipProcedure`; add none-new-builder; keep `role-coverage-gate` green.

## 3. API — acknowledgement

- [ ] 3.1 `review.acknowledge` mutation (`leadershipProcedure`): take the target `groupId`, assert the caller's group scope covers it, then upsert a `ReviewAcknowledgement` for `(session.userId, reportId, groupId)` (idempotent timestamp refresh).
- [ ] 3.2 Expose acknowledgements to the head (who has acknowledged the current period's report for their group).

## 4. API — comments

- [ ] 4.1 `review.comment` mutation (`leadershipProcedure`): resolve the anchor record → its section → its group; `requireReviewer`; store a `RecordComment` with `session.userId` and the single anchor.
- [ ] 4.2 `review.deleteComment` for the authoring reviewer (and admin); rely on cascade for record deletion.
- [ ] 4.3 Read path: include the relevant `RecordComment`s where the report is rendered for the lead and for reviewers.

## 5. API — verdict + auto-un-submit

- [ ] 5.1 `review.verdict` mutation (`leadershipProcedure`): resolve the section → group; `requireReviewer`; reject unless the period is `open`/`reopened`.
- [ ] 5.2 Upsert the `SectionReview` for `(reportSectionId, reviewerId)`, stamping `judgedVersion = section.version` at verdict time.
- [ ] 5.4 Read path: treat a `SectionReview` as current only when `judgedVersion === section.version`; a re-submitted section (bumped version) reads as awaiting review, not "needs changes".
- [ ] 5.3 On `changes_requested` and a currently-`submitted` section, run the head-revoke transition inside a transaction that re-checks `status = submitted` and the `ReportSection.version` optimistic lock; stamp the reviewer as the un-submitter. On `approved`, or on an already-`draft` section, record the verdict and apply no transition.

## 6. Web — review surface (head + designated reviewer)

- [ ] 6.1 Acknowledge button (any access-holder) on the group's current-period report.
- [ ] 6.2 Per-record comment affordance on items/risks/decisions, gated to designated reviewers; render existing comments inline with the reviewer's name, never duplicating record text.
- [ ] 6.3 Per-section verdict control (`approved` / `changes_requested`); no publish/lock control for a viewer-reviewer.

## 7. Web — submitted-only default + toggle

- [ ] 7.1 Add a per-user submitted/all toggle on the live current period for head + viewer; default `submitted-only`.
- [ ] 7.2 Filter rendered sections by the toggle WITHOUT touching the read gate / group scope.
- [ ] 7.3 Anti-empty-state guard: when draft content exists but is filtered out, show a "N in draft — show all" signal, not the "No submissions yet" empty state; keep the empty state for a content-less period; cover the reopened-period case.
- [ ] 7.4 Leave the published snapshot unfiltered; toggle inert on a published report.

## 8. Web — lead surfacing

- [ ] 8.1 On the lead's own report, surface a returned (`draft`) section's reviewer comments inline on their anchor records, with a noticeable count/marker so the return is not silent. In-app only.

## 9. Docs

- [ ] 9.1 Write ADR 0009 (review capability + un-submit expansion; amends 0008).
- [ ] 9.2 Write ADR 0010 (submitted-only default on the live period; amends 0007).
- [ ] 9.3 `CONTEXT.md` glossary terms (already drafted in this change's session) — verify they match the shipped behavior.

## 10. Tests

- [ ] 10.1 Authz: lead rejected on every `review.*`; plain viewer can ack but not verdict/comment; `canReview` does not cross groups.
- [ ] 10.2 Verdict: `changes_requested` un-submits a submitted section; `approved` leaves it submitted; `changes_requested` on a draft un-submits nothing; a head posts a verdict on their own group's section (implicit-designation path); re-submission supersedes a prior verdict (`judgedVersion` no longer matches → stale).
- [ ] 10.3 Concurrency: two concurrent `changes_requested` transition the section exactly once (version re-check).
- [ ] 10.4 Comment: cascade-deletes with its record; carry-over does NOT copy comments to the next period.
- [ ] 10.5 Visibility: submitted-only default hides drafts; toggle reveals them; all-draft period signals hidden content (no misleading empty state); published snapshot unaffected.
- [ ] 10.6 `role-coverage-gate` green with the new `review.*` procedures.

## 11. Verification

- [ ] 11.1 `pnpm --filter @customreport/api db:generate`, then `pnpm typecheck` and `pnpm lint` until green.
- [ ] 11.2 `pnpm test` (api + web) until green.
- [ ] 11.3 `openspec validate "review-acknowledgement" --strict` until it exits 0.
