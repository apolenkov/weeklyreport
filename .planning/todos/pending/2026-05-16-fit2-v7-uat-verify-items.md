# PRJ-2 v7 UAT — Unfiled / VERIFY Items

Source: `INTAKE-2026-05-15.md` + session scans 2026-05-11 → 2026-05-16.
Not in scope of the PRJ-2 consolidation branch; carried forward for next milestone.

## Items

### V1 — Report skeleton / right-rail UX feedback

**Status:** VERIFY — no commit explicitly closes this.

The right-rail skeleton was discussed but not tracked to a specific file change.
Before closing v8.1, open the lead report in a browser and confirm the skeleton
loading state appears correctly while data loads (no layout shift, no flash of
empty content).

**Recommended action:** Browser smoke-test at `/lead/report/<any-id>` with network
throttling. If broken → create bug ticket PRJ-2-V1 and fix in hotfix before merge.

---

### V2 — Draft side panel: Coming Soon vs real logic

**Status:** VERIFY — decision not locked.

The lead report has a right-side panel slot. It is either showing a "Coming Soon"
placeholder or partially wired to real draft state. The decision of which path was
chosen has not been documented in STATE.md.

**Recommended action:** Read `apps/web/src/components/lead/lead-form.tsx` around
the panel/sidebar rendering logic. Document the current behavior in STATE.md under
the current milestone. If it is a stub, add a `TODO(DRAFT-PANEL-01)` marker.

---

### V3 — DevRoleSwitcher production guard

**Status:** VERIFY — guard not verified in production mode.

`NEXT_PUBLIC_DEV_ROLE_SWITCHER=true` enables the dev-only role switcher. It should
be hidden or non-functional when `NODE_ENV=production`.

**Recommended action:** Verify the guard in `apps/web/src/components/navigation/`
reads `process.env.NODE_ENV` or `NEXT_PUBLIC_DEV_ROLE_SWITCHER` before rendering.
One smoke-test with `NODE_ENV=production pnpm build && pnpm start` confirms it.

---

### V4 — E2E Playwright strategy: which scenarios are mandatory

**Status:** UNFILED — discussed but never documented.

The question of which Playwright scenarios must be green before a prod deploy has
not been answered in writing. The regression config exists at
`e2e/regression/playwright.regression.config.ts` but coverage boundaries are unclear.

**Recommended action:** Create `e2e/README.md` documenting:

- mandatory pre-deploy scenarios (lead form submit, head publish, report export)
- optional smoke scenarios (slides mode, archive toggle, role switcher)
- CI gate: which subset blocks merge vs which is advisory

---

### V5 — Admin / settings group-period wipe / preview UX

**Status:** UNFILED — from Codex dump 2026-05-13.

The admin settings page has a group-period management UX (wipe and preview). The
interaction design was discussed but not resolved: should wipe show a confirmation
modal, should preview show a diff, should the action be two-step?

**Recommended action:** Defer to Phase 46 (Group-Scope Visibility) or create a
separate `.planning/todos/pending/` entry for admin UX with a concrete proposal.

---

## Meta

These items carry forward to the next session after PR #5 merge.
Priority order: V3 (security guard) > V1 (UX regression) > V2 (decision lock) > V4 (docs) > V5 (feature).
