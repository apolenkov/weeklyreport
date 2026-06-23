# Tasks: code-health-audit-map

These tasks produce the map. None of them change production code, schema, or
test behavior. The only file written is `docs/code-health-map.md` (plus any
throwaway config used to measure, which is not committed).

## 1. Evidence pipeline

- [x] 1.1 Enumerate EVERY per-file lint exemption in `eslint.config.ts` —
      `max-lines`, `complexity`, `cognitive-complexity`, AND
      `sonarjs/no-nested-functions` — into the re-attestation set.
- [x] 1.2 Measure code-LOC for every source file (ESLint code-line counting;
      exclude tests and generated output). Record the exact command.
- [x] 1.3 Measure peak cognitive complexity per file, including the
      grandfathered files, via the threshold-1 config trick using the exact
      pinned invocation from design.md (repo-root config, tseslint parser,
      jsx). Record the command.
- [x] 1.4 Measure git churn per file over the recorded window (default 6
      months) using `git log --follow`. Record the command and window.
- [x] 1.5 Classify each file's risk-zone weight from HOT ZONE + authz path
      matching.

## 2. Gate-blind dimensions

- [x] 2.1 Bounded read-only structural pass over the ranked shortlist + the
      loose `components/` root files; record grouping findings against the
      stated conventions. (No tooling needed.)
- [x] 2.2 Declare dead-code and duplication as in-scope dimensions but mark them
      DEFERRED to a dedicated follow-up change (to be created) that adds
      knip/jscpd with its own dependency budget. Do NOT add tooling in this
      change.

## 3. Re-attestation

- [x] 3.1 For each exemption in the re-attestation set, derive a verdict from
      current evidence: CONFIRMED (LOC/complexity that justify it), CONTESTED
      (proposed split boundary + risk), or OBSOLETE (now under the standard →
      recommend removing the exemption line).
- [x] 3.2 Carry the lead-form target with refreshed evidence + a size verdict;
      carry the three architectural targets (client-permission, traffic-light,
      Prisma-leak) with dimension-appropriate evidence (spread count / boundary)
      and a STILL-PRESENT / RESOLVED verdict — not the size vocabulary.

## 4. Rank and assemble

- [x] 4.1 Compute the hotspot `rank_score` per target; record the normalization
      and weights in the register header.
- [x] 4.2 Sort by `rank_score`; confirm no target is ordered by size alone
      (spot-check that a hot HOT-ZONE file can outrank a larger cold file).
- [x] 4.3 Write `docs/code-health-map.md`: staleness stamp (commit hash, date,
      tool versions, exact commands), the ranked table, and per-entry evidence /
      verdict / Definition-of-Done, plus the non-authorization header.

## 5. Verify the map (not the code)

- [x] 5.1 Confirm every quantitative claim in the register reproduces from its
      recorded command.
- [x] 5.2 Confirm the non-authorization stance and the entry-vs-refactor DoD
      split are present and unambiguous.
- [x] 5.3 `openspec validate code-health-audit-map --strict` passes; no
      production code, schema, or test was modified.
