# Catalog — web-comp-role-gate.tsx (2026-07-02)

1 files. Purpose/layer/domain per file, for the architecture-grouping analysis.

| File                                  | Layer     | Domain | Purpose                                                                                                                                                                                                          | Key exports | Deps                                          |
| ------------------------------------- | --------- | ------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------- | --------------------------------------------- |
| apps/web/src/components/role-gate.tsx | component | auth   | Server-side (SSR) role gate wrapping a route segment's children; renders children if the session's role is allowed, else the in-page ForbiddenPage wall. UX-only gate — real enforcement is API tRPC middleware. | RoleGate    | roleHomePath, getServerSession, ForbiddenPage |
