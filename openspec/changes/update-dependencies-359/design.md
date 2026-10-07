## Context

The baseline is GitLab main b6266ca48. Registry snapshots and execution logs are
retained outside the repository in `~/work/handoffs/task-359-evidence`.
The dependency graph uses pnpm catalogs, bounded overrides, Prisma runtime pins,
and synchronized Node/pnpm/Turbo versions in Docker and CI.

## Goals / Non-Goals

Update to the latest stable artifacts available on 2026-10-07, preserving
observable behavior and all existing checks. Avoid product changes and package
rewrites. Prerelease dist-tags do not supersede a published stable release.

## Decisions

- Commit patch/minor updates first, then isolate each breaking ecosystem group.
- Treat OpenTelemetry's coordinated 0.x packages as one breaking group.
- Read Context7 and upstream migration/changelog sources before each major.
- Check an exception by attempting the actual install, build, or relevant flow;
  record a scoped Renovate rule and a commit explanation when it fails.
- Preserve period dual-state, role-coverage, weekly rollover, and database guards.

## Risks / Trade-offs

New SDK entrypoints, lint behavior, mock defaults, package-manager behavior, and
database-major layouts can break existing consumers. Verification must distinguish
baseline/environment failures from dependency regressions without suppressions.

## Migration Plan

Reserve `customreport_e2e` and Redis DB 15. Resolve and mask the database URL,
guard every destructive reset, seed explicitly, and serialize database phases.
Use an isolated worktree and avoid restarting resources owned by other sessions.
Publish one MR and let the coordinator merge it. Retain evidence and remove only
task-owned runtime processes and worktree state after delivery.
