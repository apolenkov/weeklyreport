# Tasks

## 1. Coming-Soon native title removal

- [x] 1.1 Remove `title="Coming Soon"` from `report-shell/agent-review-coming-soon.tsx`
- [x] 1.2 Remove `title="Coming Soon"` from `lead/pdf-export-coming-soon.tsx`
- [x] 1.3 Remove `title="Coming Soon"` from `lead/version-coming-soon.tsx`
- [x] 1.4 Remove `title="Coming Soon"` from the Holidays `<span>` in `admin/settings-tab.tsx`
- [x] 1.5 Broaden the `coming-soon-style.test.tsx` source scan from nav-bar only to all five inert control files
- [x] 1.6 Flip the title assertions to `not.toHaveAttribute("title")` in `version-coming-soon.test.tsx`, `pdf-export-coming-soon.test.tsx`, and `lead-form.test.tsx`

## 2. Decision Owner field removal

- [x] 2.1 Remove the Owner label + helper `<p>` + read-only input + error block from `lead/decision-edit-dialog.tsx`
- [x] 2.2 Derive `owner` as a plain const from `decision?.owner ?? defaultOwner ?? ""`; drop `owner` from the errors type and the `Owner is required` validation
- [x] 2.3 Collapse the Owner+Deadline `grid sm:grid-cols-2` row into a standalone full-width Deadline field
- [x] 2.4 Update the stale "owner+deadline" left-column comment
- [x] 2.5 Add tests: owner auto-set to the author with no owner field rendered; editing preserves the decision's existing owner (not `defaultOwner`)

## 3. Docs & specs

- [x] 3.1 Clarify the `CONTEXT.md` "Decision" glossary entry (owner = author, not separately assignable)
- [x] 3.2 `record-dialog-layout` delta — drop "owner" from the decision left-column fields
- [x] 3.3 `deferred-feature-pattern` delta — add the "no stacked native title" requirement

## 4. Verification

- [x] 4.1 `pnpm typecheck` (5/5), `eslint` on changed files (0), `prettier --check` (clean)
- [x] 4.2 Full web vitest suite (1225 passed)
- [x] 4.3 Live browser check — Decision dialog renders no Owner field, save preserves the owner and keeps the decision editable (mine); Coming-Soon controls render one consistent badge tooltip
- [x] 4.4 Independent diff review (APPROVED, no blocking defects)
- [x] 4.5 Hardening — runtime assertion that the Holidays tab's accessible name still contains "Coming Soon" (backs the existing `deferred-feature-pattern` scenario); `settings-tab.test.tsx` 30 passed
- [x] 4.6 Act 2 — Codex review via the `codex:codex-rescue` runtime returned `VERDICT: REVISE` (one finding: optional `defaultOwner` → possible `owner=""`). Rejected as final arbiter with reason — `isMine` is permissive by design, the path is unreachable, and the fix churns tests documenting that design. See `PLAN-REVIEW-LOG.md` + `design.md`. (Bare `codex exec` hangs here on quota throttle; use the runtime route — `codex doctor` to diagnose.)
- [x] 4.7 Branch-commit the implementation + this change dir on branch `polish-decision-owner-and-comingsoon-tooltip`. Per the grill-with-docs-codex skill, the run stops at an approved+committed change — push, PR/merge, and `openspec archive` are the user's follow-up, not tasks of this change.
