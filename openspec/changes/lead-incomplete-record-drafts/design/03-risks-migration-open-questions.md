# Risks, migration and open questions

Part of [design.md](../design.md).

## Risks / Trade-offs

- Global graph-lane contention → reuse the existing lane rather than introduce another lock hierarchy; exercise queued auto-publish/save and assignment changes in guarded integration tests.
- Nullable rows leak through an untraced direct query → source-owner consumer matrix plus negative fixtures for byPeriod/Everyone, raw SQL and assistant before enabling writes; do not regard mapper tests as exhaustive protection.
- Old clients cannot parse nullable own drafts → fail visibly/reload to upgraded client; no fake fields and no silent deletion. Server omission rejection protects their writes. Coordinated deployment avoids mixed old servers writing the new data.
- Omission metadata itself leaks context → scope before serialization, no record IDs/text, and separate scoped counts from existing organization progress metrics.
- Multiple changes touch the same web/schema files → single owner per file and integrate dependent quick-entry work serially; no competing workers.

## Migration Plan

1. Confirm deployment state with the gate. Default to a forward additive migration: relax only three detail columns, extend frozen scope totals as nullable, preserve all parent/severity/lineage checks and generated full-text columns. Existing complete rows stay byte-equivalent. A preproduction canonical-init rebaseline is allowed only after proving no production deployment and retaining its contract test; this specification does not authorize a reset of the owner's preview.
2. Deploy shared readers, projection filtering, old-client omission guards, published-decision completeness guard, Fill From source exclusion and target protection, locked reviewer create/delete checks, all-route private-read entitlement, recovery and consumer transports together while incomplete creation remains unavailable. Regenerate Prisma. Rebuild scope projections from validated existing snapshots; legacy unknown remains null. Do not mutate historical snapshot JSON or completed PDF jobs.
3. Drain old API/web processes before allowing new nullable saves. Enable only when every consumer and source writer in the matrix is covered and the gate has independent review, DB race tests and browser evidence. Use deployment sequencing, not a speculative permanent feature-flag framework.
4. Rollback before nullable writes can restore the prior application after schema compatibility checks. After nullable writes exist, disable new capture but keep null-aware reads, protection and recovery; fix forward. Never set NOT NULL, delete drafts or invent details to force an old binary to run. Narrowing storage requires all affected authors' explicit completion/deletion through eligible flows and separate verified migration.

## Open Questions

No unresolved product-policy choice is deferred to implementers. Actual concurrency safety, query cost and lifecycle/authorization edge behavior remain **unproven implementation gates**, not assumptions of success. Deployment history determines forward migration versus permitted preproduction rebaseline; exact operational scheduling is for the gate. No source evidence establishes a retention duration, so this change specifies none. Current authoring-role revocation denies private text and retained discovery everywhere while preserving unrelated complete-history access. The existing independent review required F1–F5 repairs; a fresh focused independent re-review of these repairs remains pending and must not be substituted with the author's structural checks.
