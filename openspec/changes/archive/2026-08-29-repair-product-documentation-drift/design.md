## Context

See `proposal.md` for motivation. The current tree has 165 indexed durable capability specs, while a tracked Markdown scan finds 62 distinct repo-shaped backtick references that do not exist on disk. The set mixes genuine refactor drift with legitimate runtime-generated paths, local configuration examples, historical contracts, and intentionally removed layout examples, so a blanket replacement or blanket failure would both be wrong.

## Goals / Non-Goals

**Goals:**

- Give a reader a short, truthful role-based description of the active MVP without duplicating the full capability map.
- Repair every missing reference that claims to identify current maintained source.
- Make every remaining missing repo-shaped reference explicit, counted, owned, and reasoned.
- Prevent new documentation path drift with a probe-backed deterministic check.

**Non-Goals:**

- Product, API, schema, data, runtime, deployment, or visual behavior changes.
- Validation of URLs, shell commands, globs, or archived OpenSpec content.
- Renaming historical `customreport` identifiers that remain technical contracts.

## Decisions

### Derive the MVP summary from existing authorities

`README.md` will summarize the stable role outcomes already indexed by `openspec/specs/README.md` and exposed by current routes. It will link to the capability map for detail and label deferred controls as outside the active MVP. This avoids creating a second requirements registry. The alternative—adding another product-capability document—would duplicate 165 capability owners and drift again.

Five durable capabilities need delta specs rather than a path-only edit. `directory-architecture-standard` must describe the real dashboard model owners instead of requiring a removed mock-data module. `dependency-currency` must stop treating the absent Anthropic SDK and deferred AI module as an active upgrade consumer. `head-report-visibility` must distinguish authorization to reach drafts from the implemented submitted-only default presentation and its explicit `Show all` path. `lead-form-loaded-view-model` must own the unified-view flag default, total workflow-to-bucket mapping, and the rule that `carriedOver` is provenance rather than presentation state. `carry-over-automation` must match the implemented eligibility filter by excluding postponed items and the removed legacy `completed` field. The deferred activation record remains the only place that may reintroduce the AI dependency and its verification contract.

### Validate repo-shaped Markdown references with an exact ledger

A TypeScript repository test will scan tracked `README.md`, `docs/**/*.md`, and `openspec/specs/*/spec.md` files for exact inline-code values rooted at maintained repository directories. Existing paths pass directly. Missing paths pass only when an exact ledger entry names the path, every owning document, and one bounded reason: runtime-generated output, local-only configuration, historical contract, or intentionally removed path example.

The gate will reject an unlisted missing path, an owner-set mismatch, and a stale ledger entry whose path becomes tracked source or is no longer referenced. Ignored local configuration and runtime output remain ledgered even when present on disk. Pure tests will plant all failure classes before the live tree is trusted. The alternative—prose heuristics such as accepting any paragraph containing “historical”—is too easy to satisfy accidentally; ignoring missing paths preserves the observed drift.

### Repair only source-of-truth claims

One-to-one moved files will use their tracked current paths. ADR change references will point to the dated archive directories and their statuses will change only where current source, focused tests, durable specs, and the archived implementation agree. Paths used as historical examples, generated outputs, or local setup destinations remain textually accurate and enter the ledger instead of being rewritten to unrelated files. Changed engineering requirements flow through delta specs and are synchronized to the durable specs before archival.

### Preserve load-bearing invariants

The period dual-state rule, canonical role middleware, destructive-database guard, and deferred-feature pattern are unchanged. The change reads paths and Markdown only; it performs no database, credential, process, network, or external write operation.

## Risks / Trade-offs

- [A basename match points to the wrong semantic owner] → require surrounding requirement text and current source ownership to agree before replacement.
- [The ledger becomes an exemption dump] → require exact owner sets and reject stale entries; fixes must reduce or deliberately classify the measured set.
- [The README overclaims runtime readiness] → describe repository-backed capabilities and retain the explicit separation from production/live evidence.
- [Archived prose is rewritten as current truth] → exclude `openspec/changes/archive/` from the validator and edit archives only through their existing provenance, not this change.

## Migration Plan

Land the documentation, validator, tests, ledger, and repository-test registration in one green commit. Rollback is a normal Git revert; there is no data migration, rollout order, feature flag, or destructive operation.
