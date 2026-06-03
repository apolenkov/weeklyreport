# Tasks

## Decision (human)

- [ ] T1: Confirm the intended model — admin-only (align docs/UI to the API) or
      head-keeps-admin (revisit the `adminProcedure` gate). Default reading: the
      API gate (D-AUTH-03) is the truth → admin-only.

## Align sources (assuming admin-only)

- [ ] T2: `apps/web/src/lib/role-visibility.ts` — set
      `ROUTE_ROLE_MAP["/admin"] = ["admin"]`.
- [ ] T3: `apps/web/src/app/(app)/admin/layout.tsx` — update the required-roles
      array the map mirrors, so layout and map agree.
- [ ] T4: `openspec/config.yaml` Roles — drop "admin CRUD" from the `head`
      description (or restate precisely what head can still do).

## Verification

- [ ] T5: Under `head` via `/auth/dev-login`, `/admin` denial is consistent with
      the route map (no advertised-but-broken access); under `admin`, `/admin`
      renders the Admin Panel.
- [ ] T6: `rg -n "admin CRUD" openspec/config.yaml` returns nothing (doc fixed).
- [ ] T7: `openspec validate fix-admin-role-model-drift --strict` passes.

## Notes

- Evidence: live-DOM capture this session (`/tmp/catalog-findings-backup/`),
  `trpc.middleware.ts:453` (adminProcedure admin-only), `role-visibility.ts:18`.
