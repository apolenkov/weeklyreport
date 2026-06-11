# Design — Add a Shared RoleGate for SSR Role Guards

## Component API

```tsx
// apps/web/src/components/role-gate.tsx (NEW)
interface RoleGateProps {
  readonly allowedRoles: readonly Role[];
  readonly children: ReactNode;
}
export async function RoleGate({ allowedRoles, children }: RoleGateProps);
```

- Allowed (`session && allowedRoles.includes(session.role)`): return
  children unwrapped — no extra DOM element.
- Denied: render `<ForbiddenPage requiredRoles={allowedRoles}
homeHref={session ? roleHomePath(session.role) : "/"} />` in place.
- Location: next to `forbidden-page.tsx`. It is a component, and it lands
  inside vitest coverage (layouts/pages are excluded), so it ships with
  full unit coverage and protects the 70% web floor.
- `server-only` arrives transitively via `get-server-session`; importing
  RoleGate from a `"use client"` module fails `pnpm build` — desired.
  Build is the only catch: vitest aliases `server-only` to a stub
  (`apps/web/vitest.config.ts:51`).

## Decision: deny in place, not redirect()/notFound()/forbidden()

Researched against Next.js v16.2.2 docs and the installed 16.2.6:

- **In-place ForbiddenPage (chosen).** The official authentication guide
  renders role denials in place; redirect is reserved for unauthenticated
  visitors (already handled by `proxy.ts` with `?next=`). 401-vs-403
  semantics: no session → login redirect; wrong role → honest wall at the
  requested URL. The `ui-role-route-access` spec mandates exactly this
  ("never by redirecting").
- **forbidden()/authInterrupts (rejected for now).** Still behind
  `experimental.authInterrupts` in 16.2.6; `forbidden.tsx` takes no props
  (no `requiredRoles`/`homeHref`) and exists only at the app root; and
  `forbidden()` thrown from a layout renders a generic 403 instead of
  `forbidden.tsx` (open bug vercel/next.js#83671) — this repo's gates live
  in layouts. Revisit when stabilized; would also require a spec change.
- **redirect(roleHomePath(role)) (rejected).** Spec-prohibited; loses the
  requested URL; un-assertable in UAT/driver checks; redirect-loop risk.
- **notFound() (rejected).** Masking fits secret resources; the `/lead`,
  `/head`, `/admin` prefixes are public in navigation. Role
  anti-enumeration is already handled differently (ForbiddenPage never
  shows the visitor's role — T4).
- **Role matrix in proxy.ts (rejected).** Official guidance: middleware
  does optimistic cookie checks only and must never be the sole
  protection (CVE-2025-29927 postmortem). `proxy.ts` keeps its current
  presence-check + login-redirect role, untouched.

Sources: Next.js v16.2.2 `authentication.mdx`, `forbidden.mdx` (function
and file convention), `layout.mdx`, `cookies.mdx`; Vercel "How to Think
About Security in Next.js"; vercel/next.js#83671; Vercel CVE-2025-29927
middleware-bypass postmortem.

## Layout vs page gating

- Official caveat (authentication.mdx): layouts do not re-render on
  client-side navigation — within-segment soft navs skip the gate; a role
  downgrade stays invisible until hard reload or cookie expiry
  (documented as T3).
- Partial rendering: on soft navigation the server renders the page
  payload without re-running the layout — a layout gate does not stop the
  page segment's server code. RoleGate is therefore a UX gate only; the
  security boundary stays the tRPC role middleware (threat model T1 in
  `get-server-session.ts`). The change must not advertise RoleGate as
  enforcement.
- Page-level gates stay for rules stricter than their segment: the lead
  preview page (`["lead"]` under the `["lead","head","admin"]` /lead
  layout) keeps its page gate, just via RoleGate.
- Behavior-equivalence trap: the preview guard is strict equality
  (`session?.role !== "lead"`). Reusing the layout's roles would silently
  widen access — the exact bug class of 65c939a0. The migration pins
  exactly-lead semantics with a unit test before touching the page.

## Constraints folded from research

- No Suspense around RoleGate: the async gate intentionally blocks
  streaming of children until auth.me answers; otherwise the wall can
  flash in after content skeletons. The existing Suspense inside the
  preview page stays — it sits below the gate.
- `cookies()` is a request-time API, so all gated segments render
  dynamically (already true today). RoleGate/getServerSession must not be
  called inside a `"use cache"` scope.
- React Compiler: non-issue — async server components are not memoized;
  no `"use no memo"` directive needed.

## Invariants

- `ui-role-route-access`: preserved and tightened (delta adds the
  shared-component requirement).
- `role-coverage-gate`, `period-dual-state`, `deferred-feature-pattern`,
  `destructive-db-guard`: untouched — no tRPC procedure, no Report write
  path, no deferred UI element, no guard changes.

## Noted follow-ups (out of scope)

- Wrap `getServerSession` in React `cache()` to dedupe the double auth.me
  roundtrip when nested gates run in one request (`head/layout` +
  `head/report/layout`) — the official DAL pattern. Out of scope because
  `get-server-session.ts` is read-only in this change.
- ESLint `no-restricted-imports` ratchet forbidding direct
  `getServerSession` imports outside `role-gate.tsx` and the
  revalidate-org route.
