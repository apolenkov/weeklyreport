# Design: code-health-audit-map

## Context

The deliverable is a map, not a refactor. The design fixes _how evidence is
gathered_ so the register is reproducible and the ranking is defensible, and
_how the map stays inside the repo's existing slice-by-slice discipline_ so it
can never become a mass-sweep task queue.

Binding constraints from existing specs:

- `code-quality-modernization` — HOT ZONE = product, group, report-period,
  query-semantics, and the `report-sections` module; refactors there need a
  characterization test first and must be behavior-preserving.
- `lint-max-strictness-standard` — softened rules live on a justified
  exclude-list; a rule absent from both enforced and excluded sets is an
  oversight.
- The memory `parallel-army-refactor-revert-bait` — metric-driven mass
  refactors pass the gate but break behavior. The map must not invite one.

## Evidence pipeline (recorded, re-runnable)

Every number in `docs/code-health-map.md` comes from one of these. The exact
invocations are pinned in the register's header so a re-run reproduces them.

### Size — code-LOC (not physical `wc -l`)

The standard counts code lines (`skipBlankLines + skipComments`). Use ESLint's
own counting so the map agrees with the gate: run `eslint` with `--format json`
and read the `max-lines` measured value from the message, or compute code-LOC
with the same skip rules. Tests (`**/*.test.*`, `**/*.spec.*`, `__tests__`) and
generated output (`**/dist/**`, Prisma client) are excluded — they are excluded
from the gate too.

### Complexity — peak cognitive complexity, including exempted files

`sonarjs/cognitive-complexity` is per-file disabled on the grandfathered files,
so a normal lint reports nothing for them. To get the real number, run a
throwaway flat config that enables `sonarjs/cognitive-complexity` (and core
`complexity`) at a threshold of `1` over the target files with `--format json`;
every function then reports its measured value in the violation message ("from
N to the 1 allowed"). Take the per-file maximum of N.

Pin the exact working invocation — the trick is fragile:

- the throwaway config MUST live at the repo root (ESLint plugin/module
  resolution), not in `/tmp`;
- it MUST set `languageOptions.parser` to `typescript-eslint`'s parser with the
  TS project + `ecmaFeatures.jsx: true`, or it produces zero output / a parser
  error;
- run from the repo root via `pnpm exec eslint --no-config-lookup --config
<throwaway> --format json <files>`.

This reads code only and is not committed. Record the exact command in the
register header.

### Churn — git change frequency over a recorded window

Per file, count commits touching it in a fixed, recorded window (default: last
6 months), following renames so slice-refactor history is not silently dropped:

```
git log --follow --since="6 months ago" --format= --name-only -- <path> | grep -c .
```

Record the window so the number is reproducible. (`--follow` takes a single
path; run it per file.)

### Risk-zone weight

A boolean/tiered weight from path matching against the HOT ZONE list above
(`apps/api/src/modules/{report-sections,period,...}`, product/group/query paths)
plus authz/permission paths. HOT ZONE files get the higher weight.

### Hotspot score

`rank_score = structural_cost × churn × risk_weight`, where
`structural_cost = (code_LOC / 300) + (peak_cognitive_complexity / 15)`. The
divisors are the repo's own standards (the 300-line `max-lines` and the 15
cognitive-complexity budget), so they are **absolute and pinned, not
set-relative** — a file's score does not move when other files enter or leave
the candidate set, which is what makes a re-run reproduce the same rank. The
exact divisors, the churn window, and the risk-weight tiers are recorded in the
register header. The ranking is sorted by `rank_score`, never by size alone.

### Dead code / unused exports — DEFERRED to a follow-up change

`knip`/`ts-prune` are not installed, and adding them is a real dependency
change. So this dimension is **declared in the register but deferred** to a named
follow-up change that owns the dependency budget. When that follow-up runs, it
MUST configure entry points so framework-reached symbols are not false
positives: NestJS providers/modules, Next.js `page`/`layout`/`route`/`*.client`
exports, tRPC router type exports, package barrels, `prisma/seed*`, and UAT/dev
scripts. Everything the tool emits is a **candidate**; only symbols that survive
a manual framework-aware pass are recorded.

### Duplication — DEFERRED to the same follow-up change

`jscpd` is not installed; same reasoning. **Declared but deferred.** When run, it
covers `apps` + `packages` (excluding tests/dist) with a recorded `min-tokens`
threshold, and a finding is recorded only when it is _harmful repeated domain
logic_ — intentional parallel shapes (per-role UI variants, schema/test
fixtures, generated types) are excluded with a one-line reason.

### Structural / grouping (gate-blind, bounded read pass)

ESLint cannot see "this file is in the wrong place." A bounded read-only pass
(top-N hotspots + the loose files at the `apps/web/src/components/` root, and
the `lib/` vs `server/` vs `hooks/` boundaries) records grouping findings
against the repo's stated convention (kebab-case role-suffixed files; domain
feature folders; NestJS module-per-domain). The pass is scoped to the ranked
shortlist, not all ~730 files, to keep it bounded and re-runnable.

## ISO/IEC 25010 as a coverage checklist only

The five maintainability sub-characteristics — modularity, reusability,
analysability, modifiability, testability — are used to confirm the map's
dimensions are not missing a whole category. They are a coverage taxonomy, not a
scored certification. Mapping: size/complexity/hotspot → analysability +
modifiability; structural/grouping → modularity; duplication → reusability;
dead code → analysability; (testability is already governed by the
characterization-test-first rule, referenced not re-measured).

## Where the map lives

- The **rules** the map must satisfy → the `architecture-refactor-backlog`
  spec (this change's delta).
- The **generated register** (the ranked table + per-entry evidence and
  verdicts) → `docs/code-health-map.md`, staleness-stamped. Keeping data out of
  the spec keeps the spec a spec.

## Non-authorization stance (the load-bearing guardrail)

The map ranks candidates. It is explicitly **not** a license to refactor.
Acting on any entry requires its own grilled OpenSpec change with a
characterization test first. The register MUST also carry an explicit
no-batch / no-parallel statement and a visible per-entry Definition of Done, so
a future agent cannot read the ranked list as a batch work queue and trigger
another revert-bait sweep.

## Decisions resolved in the grill

1. Deliverable = ranked code-health map, no code.
2. Evidence = hybrid (tools for measurable dimensions + bounded read pass for
   structure), all commands recorded.
3. Backlog relationship = re-attestation, not re-labeling. Size exemptions get
   CONFIRMED / CONTESTED / OBSOLETE; the architectural targets get
   STILL-PRESENT / RESOLVED.
4. Ranking = hotspot (complexity × churn × risk-zone) with absolute pinned
   divisors, not raw size.
5. ISO 25010 = coverage taxonomy only; dead-code + duplication declared but
   deferred to a dedicated follow-up change (no tooling added here).
