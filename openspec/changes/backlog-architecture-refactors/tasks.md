# Tasks — Architecture Refactor Backlog

Recording only. Each card is promoted into its own grilled `refactor-*` change
when picked up; none is implemented from here.

## 1. Record

- [ ] B1a Land the `architecture-refactor-backlog` capability (this change);
      `openspec validate backlog-architecture-refactors --strict` green.

## 2. Promotion (each is a future, separate change — NOT done here)

- [ ] B2a Promote **lead-form decomposition** → its own grilled `refactor-*`
      change (1938 LOC → split by responsibility, target max-lines 300).
- [ ] B2b Promote **client permission model centralization** → its own change.
- [ ] B2c Promote **traffic-light SSOT enum** → its own change (unify ~33 sites
      into `packages/shared`; align with `schema-conventions`).
- [ ] B2d Promote **repository Prisma-type leak** → its own change (map to domain
      types; align with `repository-scope-guard`).
