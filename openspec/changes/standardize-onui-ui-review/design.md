## Context

onUI `v2.2.3` is installed outside the repositories and registered in Codex as `onui-local`. Its browser extension writes page snapshots to a local JSON store keyed by normalized URL; its MCP interface exposes list, report, search, metadata-update, delete, and clear operations. CoreDev already has a repository contract for that interface. WeeklyReport has no active Agentation/onUI dependency or guidance. A dormant Agentation SQLite store contains 353 sessions and 29 annotations; the owner explicitly chose irreversible deletion without archive or import.

## Goals / Non-Goals

**Goals:**

- Make onUI the only active local visual-annotation workflow for both active repositories.
- Keep every annotation traceable through interpretation, source change, automated check, and browser verification.
- Prevent local review metadata from being confused with product review/report state.
- Make tooling rollback independent of deleted Agentation data.

**Non-Goals:**

- Shipping onUI, synchronizing its store, or treating it as authenticated feedback.
- Rewriting CoreDev history or migrating stale Agentation selectors.
- Changing application code, routes, schemas, or production configuration.

## Decisions

### One external onUI interface, repository-local instructions

The shared interface is the user-level browser extension plus the `onui-local` MCP registration. Each repository carries only a short trigger-and-completion contract in `AGENTS.md`; product packages do not know onUI exists. This keeps the module deep: installation, store I/O, and MCP implementation stay behind eight tools while callers learn one workflow.

### Canonical URL identity

CoreDev annotations use `http://127.0.0.1:4177`; WeeklyReport annotations use `http://localhost:3000`. Alternate hostnames and ports are distinct pages and do not enter an acceptance denominator silently. Query-bearing pages remain distinct because onUI normalizes `origin + pathname + search`.

### Evidence-bound annotation lifecycle

The agent reads `onui_list_pages`, then `onui_get_report(level=standard)` or `onui_get_annotations`. It names the relevant IDs and interpretation before edits. Ambiguity is resolved in chat. `resolved` or deletion follows a source-bound automated check and browser verification; neither status mutates WeeklyReport review or report lifecycle state.

### Irreversible Agentation data retirement

The exact deletion target is `/Users/wrk/.agentation`, never a variable, glob, home directory, or repository. Before deletion, read-only checks must prove the directory contains only the known SQLite store files and that no Agentation process, MCP registration, dependency, or launch service is active. The 29 annotations are intentionally not retained.

## Risks / Trade-offs

- [Origin drift splits feedback] -> publish the two canonical origins and reject alternate origins from acceptance evidence.
- [Stale DOM target is treated as fixed] -> reopen the rendered page and verify the target manually.
- [MCP status is mistaken for product state] -> keep onUI terminology out of domain procedures and schemas.
- [Local store contains sensitive text] -> keep it untracked, use Standard by default, and avoid secrets/PII in annotations.
- [GPL code leaks into distribution] -> keep onUI external and assert no repository dependency or artifact exists.
- [Agentation deletion removes wanted data] -> owner explicitly accepted irreversibility; verify exact target immediately before deletion.

## Migration Plan

1. Add and validate this OpenSpec change.
2. Add the concise WeeklyReport `AGENTS.md` workflow.
3. Verify `onui-local`, native host, local store, and one real annotation roundtrip per canonical origin.
4. Prove active repositories and global runtime have no active Agentation integration.
5. Delete only `/Users/wrk/.agentation`; re-run the inventory and confirm the path is absent.

## Rollback

Restore the previous WeeklyReport `AGENTS.md` and remove/re-register `onui-local` using the pinned onUI `v2.2.3` source. Product deployments need no rollback because no runtime artifact is shipped. Deleted Agentation annotations are intentionally unrecoverable.

## Invariants

- Period dual-state: preserved; no lifecycle writer changes.
- Role-coverage gate: preserved; no tRPC procedure changes.
- Destructive-database guard: preserved; the deletion target is a local tooling directory, never PostgreSQL or Redis.
