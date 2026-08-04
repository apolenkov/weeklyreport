# Change: code-health-audit-map

## Why

The maintainer's standing worry is that the codebase has drifted into
unmaintainable shape — oversized files, no domain grouping, opaque
complexity — and that a junior could not pick it up. Investigation shows the
opposite of chaos at the macro level: `pnpm typecheck` and `pnpm lint` are
green; ESLint already enforces `max-lines: 300` (code-lines), `complexity: 20`,
`sonarjs/cognitive-complexity`, and full `strictTypeChecked`; ~12 large files
are knowingly grandfathered with per-file justifications; and the repo's own
`code-quality-modernization` + `architecture-refactor-backlog` specs already
mandate slice-by-slice, characterization-test-first, behavior-preserving
refactors — the exact opposite of a mass sweep (a prior parallel-army sweep
passed the gate but broke behavior).

So the gap is not "the standards are missing." The gaps are:

1. The backlog's evidence is stale (LOC numbers from 2026-06-10/11) and was
   never ranked by real risk.
2. The grandfathered "justified permanent" exemptions have never been
   re-attested against current evidence — they are taken on faith.
3. Whole dimensions the gate cannot see — file/folder grouping consistency,
   dead code, harmful duplication — are unmeasured.

This change does not refactor anything. It turns the backlog into a
**reproducible, ranked code-health map** so the maintainer can decide, on
evidence, which one slice to grill next.

## What Changes

- Refresh `architecture-refactor-backlog` from a recorded, re-runnable evidence
  pipeline rather than hand-entered numbers; the generated register lives in
  `docs/code-health-map.md` and is staleness-stamped (commit hash, date, tool
  versions). Stale inline numbers in the legacy spec are superseded by the
  register; the lead-form requirement is modified to defer its numbers to it.
- Re-attest every per-file lint exemption in `eslint.config.ts` (including
  `sonarjs/no-nested-functions`, not only `max-lines`/`complexity`): each gets a
  verdict — CONFIRMED, CONTESTED (with a split boundary + risk), or OBSOLETE
  (the exemption is no longer needed and should be removed).
- Carry the three non-size architectural targets (client-permission,
  traffic-light, Prisma-leak) with evidence that fits their kind and a
  STILL-PRESENT / RESOLVED verdict — not the size-exemption vocabulary.
- Rank every target by a hotspot score with **absolute, pinned divisors** so a
  file's score is reproducible regardless of the candidate set: structural cost
  (code-LOC ÷ 300 + peak cognitive complexity ÷ 15) × git churn (recorded
  window, `--follow`) × risk-zone weight (HOT ZONE per
  `code-quality-modernization`).
- Declare every coverage dimension (size, complexity, hotspot, structural/
  grouping, dead code, duplication) anchored to ISO/IEC 25010 as a coverage
  taxonomy only. Dimensions whose measurement needs tooling not yet installed
  (dead-code via knip, duplication via jscpd) are declared but **explicitly
  deferred to a dedicated follow-up change (to be created)** — so coverage gaps
  are visible, not silent, and this change adds no dependency.
- State explicitly that the register is **not** authorization to refactor: each
  entry requires its own grilled change with a characterization test first, and
  the entries MUST NOT be run as a batch or in parallel.

This is a **map-only** change. It uses only already-present tooling (ESLint JSON
output, `git log`, a throwaway in-memory ESLint config to measure complexity on
exempted files). No production code, schema, test behavior, or dependency is
added by it; `docs/code-health-map.md` is the only file it writes.

## Capabilities

- `architecture-refactor-backlog` (MODIFIED behavior: the backlog is now a
  ranked, re-attested, reproducible code-health map)

## Impact

- Specs: `architecture-refactor-backlog` (adds map-discipline requirements).
- Docs: new `docs/code-health-map.md` generated register; the existing four
  named targets (lead-form, client-permission, traffic-light, Prisma-leak) are
  carried into it with refreshed evidence.
- Code: none, and no dependency added. `eslint.config.ts` is read for
  re-attestation, not edited. The throwaway complexity-measuring config is
  in-memory / not committed.
- Follow-up (out of scope here): a separate change adds the dead-code (knip) and
  duplication (jscpd) tooling with its own dependency budget and populates those
  two declared-but-deferred register dimensions.
- Related specs referenced, not changed: `code-quality-modernization`,
  `lint-max-strictness-standard`, `schema-conventions`,
  `repository-scope-guard`.
