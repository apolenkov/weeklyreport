# Add a Shared RoleGate for SSR Role Guards

## Why

Six route guards repeat the same ~10-line block: call `getServerSession`,
check the role against an in-file `REQUIRED` array, render `ForbiddenPage`
in place with a `roleHomePath` fallback. Verified at HEAD: 5 layouts
(`admin`, `head`, `head/report`, `lead`, `reports`) plus the page variant
`lead/report/[reportId]/preview/page.tsx` (`session?.role !== "lead"`).
The copies have already drifted once — the 2026-06-03 `homeHref` drift fix
(65c939a0) is the documented bug history. A shared seam removes ~100
duplicated LOC, prevents the next drift, and finally puts the guard logic
under unit coverage (vitest excludes `src/app/**/layout.tsx` and
`page.tsx`).

## What Changes

1. New async server component `RoleGate({ allowedRoles, children })` in
   `apps/web/src/components/role-gate.tsx`, composing the existing
   `getServerSession`, `roleHomePath`, and `ForbiddenPage` — with unit
   tests.
2. The 5 layouts become one-line
   `<RoleGate allowedRoles={REQUIRED}>{children}</RoleGate>` wraps; each
   `REQUIRED` const and its AUTH-07/threat-model comment stays in-file
   (per-route policies are intentionally distinct).
3. The lead preview page guard migrates to
   `RoleGate allowedRoles={["lead"]}` — exactly-lead semantics preserved
   (head/admin/viewer/anonymous all walled).
4. Delta spec on `ui-role-route-access`: future role gates MUST route
   through the shared component.

Scope fence: this implements ONLY the SSR route-gate seam; the broader
client permission-model centralization stays deferred in
`architecture-refactor-backlog`. Process gate: that spec requires an
explicit grilled-proposal sign-off for this area before code lands — this
change is the proposal to grill.

**Non-goals:** no change to `getServerSession` (interface or body; the
React `cache()` wrap is a noted follow-up, see `design.md`); no change to
`api/revalidate-org/route.ts` (keeps the raw session, returns 401 JSON);
no change to `ForbiddenPage` or its snapshot; no role logic in `proxy.ts`;
no tRPC middleware changes; no experimental `forbidden()`/authInterrupts;
no centralized route→roles map.

## Sequencing

Wave 1 — independent; no file overlap with anything active or captured.

## Capabilities

### Modified Capabilities

- `ui-role-route-access`: adds the requirement that role gates route
  through the shared `RoleGate` component; the existing in-page-wall and
  roleHomePath-fallback requirements are preserved unchanged.

## Impact

- NEW: `apps/web/src/components/role-gate.tsx` + `role-gate.test.tsx`.
- MIGRATE: the 5 layouts and 1 preview page listed above.
- Behavior-preserving; effort S; web-only.
