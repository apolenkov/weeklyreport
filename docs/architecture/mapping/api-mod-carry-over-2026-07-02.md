# Mapping — api-mod-carry-over (2026-07-02)

Source catalog: `docs/architecture/catalog/api-mod-carry-over-2026-07-02.md`.
Target reference: `docs/architecture/TARGET-STRUCTURE-2026-07-02.md`.

## Grouping rule applied

Domain = `carry-over` (own canonical domain, target tree line "admin/ carry-over/
weekly-report/ archive/ reminders/ # MODERATE — flat + explicit port where a repo
exists"). `carry-over` is MODERATE tier, not one of the three invariant-bearing
modules (period, report-sections, review/publication) — per the grouping rules'
determinism knob #2 ("a module stays flat until it either bears a load-bearing
invariant or exceeds ~6 files") it stays **flat at the module root**: no
`domain/application/infrastructure` subfolders. The module already has exactly
6 files at `apps/api/src/modules/carry-over/` and already separates a pure
mapper (`carry-over-clones.ts`), a service (`carry-over.service.ts`), a
repository port implementation (`carry-over.prisma-repository.ts`), row-write
helpers (`carry-over-row-writes.ts`), an orchestrator (`auto-carry-over.ts`),
and module wiring (`carry-over.module.ts`) — i.e. the target's "explicit port
where a repo exists" shape is already present. No moves are indicated.

| Current path                                                    | Target path                                                     | Layer                      | Domain     | Move? | Note                                                                                                                                                       |
| --------------------------------------------------------------- | --------------------------------------------------------------- | -------------------------- | ---------- | ----- | ---------------------------------------------------------------------------------------------------------------------------------------------------------- |
| apps/api/src/modules/carry-over/auto-carry-over.ts              | apps/api/src/modules/carry-over/auto-carry-over.ts              | service (orchestrator)     | carry-over | no    | Best-effort orchestrator, correctly flat at module root per MODERATE-tier rule.                                                                            |
| apps/api/src/modules/carry-over/carry-over-clones.ts            | apps/api/src/modules/carry-over/carry-over-clones.ts            | mapper (pure)              | carry-over | no    | Pure clone builders — zero framework imports; would be a `domain/` candidate only if the module graduated to invariant-bearing split, which it has not.    |
| apps/api/src/modules/carry-over/carry-over-row-writes.ts        | apps/api/src/modules/carry-over/carry-over-row-writes.ts        | repository (helper)        | carry-over | no    | Prisma-transaction helper; stays alongside the repository it supports at module root.                                                                      |
| apps/api/src/modules/carry-over/carry-over.module.ts            | apps/api/src/modules/carry-over/carry-over.module.ts            | module-wiring              | carry-over | no    | Binds service + repository; canonical `*.module.ts` position unchanged.                                                                                    |
| apps/api/src/modules/carry-over/carry-over.prisma-repository.ts | apps/api/src/modules/carry-over/carry-over.prisma-repository.ts | repository (adapter)       | carry-over | no    | Adapter implementing the `CarryOverRepository` port defined in the service file — already the "explicit port" shape the target calls for at MODERATE tier. |
| apps/api/src/modules/carry-over/carry-over.service.ts           | apps/api/src/modules/carry-over/carry-over.service.ts           | service (+ port interface) | carry-over | no    | Domain logic + owns the `CarryOverRepository` port interface; stays flat (no invariant split) per determinism knob #2.                                     |

## Summary

6/6 files: Current path == Target path. **0 moves.**

The carry-over module is already conformant with the target structure as a
flat MODERATE-tier module with an explicit repository port — no relocation,
renaming, or internal-split work is indicated by this catalog.
