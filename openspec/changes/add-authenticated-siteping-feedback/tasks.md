## 1. Shared Contracts and Dependencies

- [x] 1.1 Add canonical TypeScript schemas for feedback product, type, status, bounded capture wire/response, and page scope in `packages/shared`; document public exports and cover spoofed, malformed, and oversized payloads.
- [x] 1.2 Pin `@siteping/adapter-prisma@0.6.4` in `apps/api` and compatible exact widget/dashboard versions in `apps/web`; add a compatibility test for the consumed exports and wire fields.

## 2. API and Persistence

- [x] 2.1 Add feedback and annotation Prisma models with required `authorUserId`, server-derived display snapshots, product/group scope, bounded capture fields, idempotency key, timestamps, relations, and query indexes; synchronize the canonical init migration.
- [x] 2.2 Define the deep feedback repository interface and implement Prisma plus in-memory adapters; verify ownership, group scope, concurrent idempotency, status transitions, author-owned deletion, author-scoped bulk deletion, admin-wide deletion, and deep-link prioritization through the same interface.
- [x] 2.3 Implement the authenticated SitePing handler module using the existing human-session resolver, same-origin mutation check, server-owned identity/product rewrite, explicit capture-aware body limit, and bounded capture validation.
- [x] 2.4 Mount `/api/siteping` only when validated configuration enables it; add rate limiting, structured audit/log events, and method/role/scope tests for all four roles.

## 3. Web

- [x] 3.1 Add a client-only widget wrapper to authenticated WeeklyReport pages, deriving display identity from `auth.me` while treating the server as authoritative; enable bounded screenshot/console/network capture and disable the durable retry queue.
- [x] 3.2 Add a role-configurable `/feedback` inbox using the SitePing dashboard headless interface: lead/viewer see their own rows, head sees own plus group rows, and admin sees all; provide English status/error/empty states, status controls only for head/admin, and delete only for admin.
- [x] 3.3 Add navigation and route guards driven by an explicit role allowlist without changing report review/comment lifecycle behavior; retain the standard SitePing sidebar for every authenticated role.
- [x] 3.4 Preserve deep-link parameters through canonical report redirects, prioritize authorized targets beyond the first page, and add stable `data-feedback-anchor` values to key report blocks.

## 4. Migration and Runtime Acceptance

- [x] 4.1 With explicit per-run consent, recreate only an exact allowed disposable PostgreSQL target through `prisma/guards/_destructive-guard.ts`; prove schema/client generation and seed compatibility.
- [x] 4.2 On `http://localhost:3000`, verify create/list-own with screenshot/console/network persistence, head group triage, admin global triage/delete, unauthorized denial, identity spoof overwrite, no durable retry queue, pathname-only scope, concurrent idempotency, and deep-link focus beyond the first 20.
- [x] 4.3 Confirm the production-built widget stays disabled unless the validated feedback switch is explicitly enabled; confirm Development has no active ingress.

## 5. Verification

- [x] 5.1 Validate with `pnpm exec openspec validate add-authenticated-siteping-feedback --strict` and `pnpm spec:check`.
- [x] 5.2 Run focused shared/API/web tests, then `pnpm format:check`, `pnpm lint`, `pnpm typecheck`, `pnpm test`, and `pnpm build`; require every command to pass.
- [x] 5.3 Audit the final diff and dependency graph against the pre-change SHA; prove bounded capture, no durable retry payload, no public API-key trust, no external product ingress, no report lifecycle write, and no unrelated dirty file entered scope.

## Verification Evidence

- Planning baseline: `pnpm exec openspec validate add-authenticated-siteping-feedback --strict` passed.
- Exact dependencies: `@siteping/adapter-prisma@0.6.4`, `@siteping/widget@0.10.7`, and `@siteping/dashboard@0.2.5`; compatibility tests pass.
- Runtime schema acceptance: guarded reset and explicit demo seed passed against the exact disposable `customreport_e2e` database with per-run consent.
- Browser acceptance: all four roles mounted the widget and received `200`; a drawn annotation persisted a 58,079-byte JPEG, normalized region, console entry, and failed-network entry. Right-click composition, standard sidebar, screenshot detail, admin delete, lead-owned `Delete all` (`201` create, `200` delete, repeated GET `1 → 0` with `Cache-Control: no-store`), focused highlight, `x-siteping-focus-id`, retry-queue removal, and bottom-positioned drawing instructions with the top navigation visible but protected by the annotation canvas were visually/runtime verified.
- Feedback `cmtlk7bat0000hjw0dkcqwd0d`: the annotated `Sign out` control now replaces its icon with a reduced-motion-safe spinner while the logout request is pending, remains single-submit and `aria-busy`, and restores the icon after a rejected request; unit and delayed-network browser acceptance pass.
- Local acceptance contour: `pnpm dev:feedback` enables authenticated SitePing, the top-menu role switcher, seeded-user selection, guarded dataset reseeding, and an admin-only `/feedback` inbox; production dev-mode fences are unchanged.
- Screenshot compatibility: SitePing's `html2canvas@1.4.1` failed on Tailwind 4 CSS Color 4; the scoped workspace override to `html2canvas-pro@1.6.7` passed browser capture and is pinned by a compatibility test.
- Concurrent same-author POST creates one row with retry-safe responses; the focused-id handler test proves an authorized target outside the first 20 is included without broadening scope.
- Runtime regression: Turbo now forwards both feedback switches to source development; the operations gate covers this contract.
- Static acceptance: format, lint, typecheck, package tests, Prisma safety tests, operations gates, strict OpenSpec validation, and production build pass.
- Development remains outside this change; the standard SitePing sidebar bulk action deletes the active user's own rows, while an admin deletes all WeeklyReport feedback.
