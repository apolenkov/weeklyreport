# Tasks — Add a Shared RoleGate for SSR Role Guards

Decisions: `design.md`. Evidence anchors: `proposal.md` (inventory
verified at HEAD, 2026-06-10). NOT STARTED — implementation is gated on
the grilled-proposal sign-off required by `architecture-refactor-backlog`
for this area.

**Execution note: Sequential single-writer edits only; parallel agents
only for read-only analysis (repo lesson: parallel mechanical edits pass
gates but break behavior).**

This change is web-only — no shared/ui or api work exists, so the
shared/ui → api → web grouping is trivially satisfied.

## 1. web: RoleGate component (test-first)

- [x] 1.1 NEW `apps/web/src/components/role-gate.test.tsx`: vi.mock
      `../lib/server/get-server-session` (the `server-only` guard is
      already stubbed in `apps/web/vitest.config.ts:51`); render the
      awaited component result
      (`const ui = await RoleGate({...}); render(ui)`). Cases:
      (a) session role in `allowedRoles` → children render with no
      wrapper element around them; (b) role outside `allowedRoles` →
      ForbiddenPage with the joined `requiredRoles` label and
      `homeHref === roleHomePath(session.role)`; (c) null session →
      ForbiddenPage with `homeHref === "/"`; (d) `allowedRoles=["lead"]`
      denies head AND admin (pins the preview-page lead-only semantics
      before migration).
- [x] 1.2 NEW `apps/web/src/components/role-gate.tsx`: async server
      component with props
      `{ allowedRoles: readonly Role[]; children: ReactNode }`; await
      `getServerSession()`; allowed → return children unwrapped; denied →
      `<ForbiddenPage requiredRoles={allowedRoles} homeHref={session ?
roleHomePath(session.role) : "/"} />`. Doc comment: UX gate only,
      security boundary is the API role middleware (T1); spec
      `ui-role-route-access`. Lands in one commit with 1.1; gates green.

## 2. web: migrate the 5 role-gated layouts

- [ ] 2.1 One commit, files edited sequentially, each diff reviewed
      individually before commit:
      `apps/web/src/app/(app)/admin/layout.tsx` (REQUIRED `["admin"]`),
      `apps/web/src/app/(app)/head/layout.tsx` (`["head","admin"]`),
      `apps/web/src/app/(app)/head/report/layout.tsx`
      (`["head","admin"]`), `apps/web/src/app/(app)/lead/layout.tsx`
      (`["lead","head","admin"]`),
      `apps/web/src/app/(app)/reports/layout.tsx`
      (`["lead","head","admin","viewer"]`). Each body becomes
      `return <RoleGate allowedRoles={REQUIRED}>{children}</RoleGate>`;
      the layout function becomes sync; remove the now-unused
      `ForbiddenPage`/`roleHomePath`/`getServerSession` imports. KEEP each
      in-file `REQUIRED` const and its AUTH-07/UFB-038/threat-model doc
      comments. Do NOT centralize a route→roles map.

## 3. web: migrate the lead preview page

- [ ] 3.1 Separate commit (semantics differ from the layouts):
      `apps/web/src/app/(app)/lead/report/[reportId]/preview/page.tsx` —
      replace the inline `session?.role !== "lead"` guard with
      `<RoleGate allowedRoles={["lead"]}>` wrapping the existing `<main>`
      content. Verify exact equivalence: head, admin, viewer AND anonymous
      all get the in-page wall; `homeHref` resolves per role (admin →
      `/admin`, head → `/head/dashboard`). The existing inner Suspense
      stays below the gate.

## 4. Verification

- [ ] 4.1 Gates: `pnpm typecheck && pnpm lint && pnpm test && pnpm build`
      — record results here. `pnpm build` is the load-bearing check for
      the `server-only` import chain (unit tests cannot catch a client
      boundary import because vitest stubs `server-only`).
- [ ] 4.2 Pinned tests pass UNMODIFIED:
      `apps/web/src/lib/server/get-server-session.test.ts` (any needed
      edit signals an accidental interface change — out of contract) and
      `apps/web/src/components/forbidden-page.test.tsx` +
      `apps/web/src/components/__snapshots__/forbidden-page.test.tsx.snap`
      byte-identical.
- [ ] 4.3 Live behavioral check (dev server + `/auth/dev-login`; no unit
      test renders layouts — coverage excludes `src/app/**/layout.tsx`
      and `page.tsx`): viewer at `/lead/report` → wall, home
      `/reports?tab=published`; head at `/lead/report/:id/preview` →
      wall, home `/head/dashboard`; anonymous at `/admin` → wall, home
      `/`; allowed roles see their pages unaffected; zero console errors.
- [ ] 4.4 Archive after merge per lifecycle rules
      (`openspec archive add-role-gate` on main).
