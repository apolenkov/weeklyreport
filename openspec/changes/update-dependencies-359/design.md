## Context

The initial baseline was GitLab main b6266ca48. The preserved branch is now
rebased onto main 5a18cef21; stable registries were refreshed on 2026-10-09.
Original logs remain in `~/work/handoffs/task-359-evidence`; current receipts
are in `~/work/handoffs/weeklyreport-completion-20261009`.
The dependency graph uses pnpm catalogs, bounded overrides, Prisma runtime pins,
and synchronized Node/pnpm/Turbo versions in Docker and CI.

## Goals / Non-Goals

Update to the latest stable artifacts available on the execution date, preserving
observable behavior and all existing checks. Avoid product changes and package
rewrites. Prerelease dist-tags do not supersede a published stable release.

## Decisions

- Commit patch/minor updates first, then isolate each breaking ecosystem group.
- Treat OpenTelemetry's coordinated 0.x packages as one breaking group.
- Read Context7 and upstream migration/changelog sources before each major.
- Check an exception by attempting the actual install, build, or relevant flow;
  record a scoped Renovate rule and a commit explanation when it fails.
- Preserve period dual-state, role-coverage, weekly rollover, and database guards.
- Fix the owner-requested NavBrand label-in-name defect using the visible
  initials followed by visually hidden descriptive text; keep axe-core 4.14.0
  and remove its temporary Renovate hold. Prove the regression before repair.
- Use the stable React Hooks recommended compiler diagnostics instead of the
  separate RC-only plugin. Verify actual lint failures on invalid React code.
- Let the native dialog primitive own title/description IDs for Radix 1.7.
  Preserve visible copy, least-destructive focus, pending guards, and restore
  behavior under the existing `dialog-listbox-a11y` contract. Assert every ARIA
  IDREF resolves, including concurrent dialogs, before and after the repair.
- Keep disabled-action descriptions singular through native Tooltip open state.
  The closed trigger uses its persistent reason; the open native tooltip owns
  the description. Verify pointer and keyboard open/close behavior.
- Keep the latest compatible PostgreSQL 15 Bookworm image for existing local
  and Helm volumes. Trixie changes glibc collation from 2.36 to 2.41; opening the
  same data without rebuilding dependent indexes is not storage acceptance.
  Fresh CI databases use PostgreSQL 18/Trixie. Scope the Renovate storage
  exception to the two existing-volume files and PG15 Bookworm tags.

## Risks / Trade-offs

New SDK entrypoints, lint behavior, mock defaults, package-manager behavior, and
database-major layouts can break existing consumers. Verification must distinguish
baseline/environment failures from dependency regressions without suppressions.

## Migration Plan

Reserve `customreport_e2e` and Redis DB 15. Resolve and mask the database URL,
guard every destructive reset, seed explicitly, and serialize database phases.
Use an isolated worktree and avoid restarting resources owned by other sessions.
Publish one MR and let the coordinator merge it after local acceptance. Owner
decision-171/doc-411 defers corporate CI until the final assembled main; normal
Git hooks remain mandatory. Retain evidence and remove only
task-owned runtime processes and worktree state after delivery.
