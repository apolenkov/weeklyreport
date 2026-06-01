# Tasks — Architecture Refactor Backlog

Recording only. Each card is promoted into its own grilled `refactor-*` change
when picked up; none is implemented from here.

## 1. Record

- [x] B1a Land the `architecture-refactor-backlog` capability (this change);
      `openspec validate backlog-architecture-refactors --strict` green.
      → recording complete; `openspec validate --strict` green (2026-06-01). This
      is the change's whole purpose; it is archived once the recording lands.

## 2. Promotion (each is a future, separate change — NOT a completion gate here)

These are durable markers of future work, intentionally left unchecked: each
card is grilled and designed into its own `refactor-*` change when picked up.
Archiving this recording does NOT require them.

- [ ] B2a Promote **lead-form decomposition** → its own grilled `refactor-*`
      change (1938 LOC → split by responsibility, target max-lines 300).
      → NOTE (2026-06-01): now in-flight via `ratchet-lint-to-strict` — its
      `max-lines` 300 enforcement forces this decomposition, so card #1 is being
      addressed there rather than as a standalone change.
- [ ] B2b Promote **client permission model centralization** → its own change.
- [ ] B2c Promote **traffic-light SSOT enum** → its own change (unify ~33 sites
      into `packages/shared`; align with `schema-conventions`).
- [ ] B2d Promote **repository Prisma-type leak** → its own change (map to domain
      types; align with `repository-scope-guard`).
