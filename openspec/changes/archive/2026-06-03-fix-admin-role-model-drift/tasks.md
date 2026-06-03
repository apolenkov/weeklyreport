# Tasks

## Decision (human)

- [x] T1: Confirm the intended model — admin-only (align docs/UI to the API) or
      head-keeps-admin (revisit the `adminProcedure` gate). Default reading: the
      API gate (D-AUTH-03) is the truth → admin-only. **DECIDED: admin-only.**

## Align sources (assuming admin-only)

- [x] T2: `apps/web/src/lib/role-visibility.ts` — set
      `ROUTE_ROLE_MAP["/admin"] = ["admin"]`. (Was the only stale source besides
      config; updated `role-visibility.test.ts` head case true→false.)
- [x] T3: `apps/web/src/app/(app)/admin/layout.tsx` — already aligned:
      `REQUIRED = ["admin"]` (UFB-038, "D-AUTH-03 retired — admin-only"). No edit
      needed; nav-bar already hid /admin from head. Verified.
- [x] T4: `openspec/config.yaml` Roles — dropped "admin CRUD" from the `head`
      description (now "lead capabilities + review + publish + PDF export").

## Verification

- [x] T5: Verified at unit level — `role-visibility.test.ts` (head `/admin`
      false, admin true) and `nav-bar.test.tsx` (head: /admin link missing;
      admin: present) pass (44 tests). Layout `REQUIRED=["admin"]` enforces the
      gate. NOTE: the live per-role `/auth/dev-login` render ("admin sees Admin
      Panel") was NOT run this session — it belongs to the SC-9 runtime sweep.
- [x] T6: `rg -n "admin CRUD" openspec/config.yaml` returns nothing (doc fixed).
- [x] T7: `openspec validate fix-admin-role-model-drift --strict` passes.

## Notes

- Evidence: live-DOM capture this session (`/tmp/catalog-findings-backup/`),
  `trpc.middleware.ts:453` (adminProcedure admin-only), `role-visibility.ts:18`.
