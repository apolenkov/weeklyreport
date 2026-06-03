# Reconcile the admin role model (head vs admin)

## Problem

Whether `head` may access admin functionality is described inconsistently across
the codebase — the documented model and the enforced model disagree. Surfaced by
live-DOM capture: `head` is DENIED on `/admin` ("Page unavailable for your role"),
which contradicts two sources that grant it.

- **Enforced (current truth):** `adminProcedure`
  (`apps/api/src/infrastructure/trpc/trpc.middleware.ts:453`) — "adminProcedure is
  now its own gate that ONLY admins pass. Heads can no [longer pass]" (per
  D-AUTH-03). So `admin.*` procedures reject `head`. Live DOM matches this.
- **Stale grant #1:** `apps/web/src/lib/role-visibility.ts` —
  `ROUTE_ROLE_MAP["/admin"] = ["admin", "head"]` still lists `head`, and its
  comment says it MIRRORS the `(app)/admin/layout.tsx` required-roles. So the
  client route map advertises an access `head` no longer has at the API.
- **Stale grant #2:** `openspec/config.yaml` Roles — "head — lead capabilities +
  review + publish + admin CRUD + PDF export". The "admin CRUD" claim is stale if
  admin is now admin-only.

The drift is harmful: the route map lets `head` navigate toward `/admin` UI whose
data calls then fail, and the project context doc misstates the role model. The
now-removed Playwright specs (`admin-panel.spec.ts`, `admin-advanced.spec.ts`,
`url-routing.spec.ts` SC-305) encoded the OLD "head sees Admin Panel" assumption.

## Solution

Decide the intended model, then make all sources agree:

- If admin is intentionally admin-only (what the code enforces): update
  `ROUTE_ROLE_MAP["/admin"]` to `["admin"]` (and the `(app)/admin/layout.tsx`
  required-roles it mirrors), and correct the `config.yaml` Roles description to
  drop "admin CRUD" from `head`.
- If `head` SHOULD retain admin access: revisit the `adminProcedure` gate
  (D-AUTH-03) instead.

Pick one source of truth and align the other three (API gate, route map, layout,
config doc).

## Non-goals

- Not re-litigating D-AUTH-03 unless the decision is "head keeps admin".
- No new role; no change to lead/viewer access.
- Test re-coverage happens via agent-driven testing after the model is settled
  (the old e2e specs were removed on `chore/wipe-e2e-tests`).
