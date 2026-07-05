# Mapping — api-mod-archive (2026-07-02)

Source catalog: `docs/architecture/catalog/api-mod-archive-2026-07-02.md` (4 files).

Applying the grouping rules from `TARGET-STRUCTURE-2026-07-02.md`:

- **Domain**: all 4 files are `archive` — listed in the canonical domain table as its own
  domain (`archive` appears alongside weekly-report, viewer, search, … "as their own").
- **Layer/segment (api)**: a module stays **flat** until it either bears a load-bearing
  invariant or exceeds ~6 files (determinism knob 2). The archive module has 4 files and
  bears no load-bearing invariant (dual-state / role-coverage gate) of its own — it only
  _consumes_ report-sections' invariant-bearing repository. So it does **not** yet split into
  `domain/application/infrastructure`; every file stays flat directly under
  `apps/api/src/modules/archive/`.

Net result: this slice is a no-op for the migration — the archive module's current flat
layout already matches its target. No file moves.

| Current path                                              | Target path                                               | Layer                                         | Domain  | Move? | Note                                                                                                                                                                                                                 |
| --------------------------------------------------------- | --------------------------------------------------------- | --------------------------------------------- | ------- | ----- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| apps/api/src/modules/archive/archive-cursor.ts            | apps/api/src/modules/archive/archive-cursor.ts            | util (pure)                                   | archive | no    | Pure, zero-framework-import util (keyset cursor codec) — would live in `domain/` only if the module grows past the flat threshold; stays flat at 4 files.                                                            |
| apps/api/src/modules/archive/archive.module.ts            | apps/api/src/modules/archive/archive.module.ts            | module-wiring                                 | archive | no    | NestJS wiring file, stays at module root regardless of flat/split state.                                                                                                                                             |
| apps/api/src/modules/archive/archive.prisma-repository.ts | apps/api/src/modules/archive/archive.prisma-repository.ts | infrastructure (adapter)                      | archive | no    | Imports `@prisma/client`-backed `PrismaService` (determinism knob 5) → infrastructure-shaped, but module has too few files to warrant physically splitting into an `infrastructure/` subfolder yet.                  |
| apps/api/src/modules/archive/archive.service.ts           | apps/api/src/modules/archive/archive.service.ts           | application/domain (service + port contracts) | archive | no    | Defines the `ArchiveRepository` port + `ArchiveService` use-case; would become `application/` (service) + `domain/` (contracts) if/when the module splits, but stays flat under the 6-file / no-invariant threshold. |

## Summary

- Files in catalog: 4
- Rows with Current != Target (moves): **0**
- Rationale: archive module is below the flat→split trigger (≤6 files, no load-bearing
  invariant of its own); grouping rules keep it exactly where it is. No physical reorg
  needed for this area; note it in the migration-slice planning as "already conformant."
