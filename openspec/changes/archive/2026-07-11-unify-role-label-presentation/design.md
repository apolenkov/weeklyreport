## Context

Four presentation sites (`nav-bar.tsx`, `users-tab.tsx` ×2, `dashboard.ts`
chain) independently re-derive a role→label mapping instead of importing
the shared `ROLE_LABEL` (`packages/shared/src/schemas/auth.ts`). Two
membership checks (`isRole`, `VALID_ROLES`) hand-write the four-role literal
set instead of deriving it from `sessionRoleSchema`. This is a pure
follow-through of the already-landed `unify-role-type` change — no new
architecture, no data-model change.

## Goals / Non-Goals

**Goals:**

- Every role-label render goes through `ROLE_LABEL`.
- `isRole`/`VALID_ROLES` derive from `sessionRoleSchema.options` — a schema
  change to the role set updates both automatically.
- The literal-union lint gate catches a future hand-written role union the
  same way it already catches status unions.

**Non-Goals:**

- No change to the `Role`/`DbRole` axis split or their Zod declarations.
- No authorization/enforcement logic — this is presentation and dev-tooling
  only (see the separate `api-auth-role-axis-fix` follow-up for the auth
  bridge seams).
- No change to dev-login role set or dev-email values (separate follow-up).

## Decisions

- **`RoleBadge` renders `ROLE_LABEL[role]`, not the raw token.** Alternative
  considered: keep the raw token for a compact admin-table look. Rejected —
  the whole point of this change is that one label per role renders
  everywhere; a badge showing `"head"` while nav shows "Head" is the exact
  drift being fixed.
- **`dashboard.ts`'s `LeadInfo.role` becomes `DbRole`, not `Role`.** The
  value is sourced from `SubmissionDashboardRow.role`, which
  `submissionDashboardRowSchema` types as `roleSchema` — the persistence
  axis — since it is a head/admin-facing read of the lead's stored DB role,
  not a value carried on the viewer's own session. This matches the
  `role-type` spec's axis rule (`DbRole` for persistence-sourced reads).
  Caught during implementation: `lead-summary-table.test.tsx`'s two base
  fixtures set `role: "Dev Lead"` / `"QA Lead"` — free-text placeholders
  that were never valid under either axis, only unnoticed because the field
  was untyped `string`. They are corrected to real `DbRole` tokens; no test
  asserts on the role text itself, so behavior is unchanged.
- **Extend the existing scanner rather than write a second one.**
  `find-status-literal-unions.mjs` already walks every staged/tree file
  looking for banned literal vocabularies; adding a fourth pattern (the four
  role tokens) is a few lines, keeps one gate instead of two, and closes
  the prior (inaccurate) claim that this was already handled.

## Risks / Trade-offs

- [Risk] The scanner's role-token pattern could false-positive on an
  unrelated four-item union that happens to share role-like words →
  Mitigation: match on the literal string values (`"lead"`, `"head"`,
  `"admin"`, `"viewer"`) exactly as the existing status patterns do, and
  keep the same allowlist/exemption mechanism (`role-type` spec's own
  documented exemptions: Prisma seed toolchain literal mirror, e2e tree,
  catalog YAML).
- [Risk] `isRole`'s schema-derived implementation could silently diverge
  from the old hand-written chain for non-string/non-role inputs (e.g.
  `null`, numbers) → Mitigation: pinned with characterization tests before
  refactoring (TDD). Verified after implementation: `sessionRoleSchema
.safeParse(value).success` and the old `===` chain return the identical
  boolean for every input class (`null`, numbers, objects, empty string,
  unknown tokens) — `z.enum`'s `safeParse` never throws and only succeeds
  on an exact literal match, so there is no actual behavioral divergence,
  only an implementation change.
