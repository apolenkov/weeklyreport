## Context

The previous campaign combined historical grades, sampled reviews, and mechanical
checks, then described the result as exhaustive. The supplied correction and the
refreshed archive show a different state: 3974 current files are inventoried, 145
reviews remain pending, and 709 accepted findings still require a final-source
disposition. A file reviewed before its last edit is not reviewed in its delivered
form, and a passing repository command proves only the checks that command owns.

This change crosses application, package, schema, test, configuration, script,
OpenSpec, and curated-documentation boundaries. The owner requires local evidence;
server-side CI is explicitly waived. Existing product behavior and wire contracts
remain stable unless a finding demonstrates conflict with a durable specification.

## Goals / Non-Goals

**Goals:**

- Give every maintained current-tree file one authoritative final-blob verdict.
- Resolve every accepted finding with reproducible, source-grounded evidence.
- Make the exemplary structural and comment standards universal across product code.
- Prove each mechanical gate owns its intended scope and fails on a planted defect.
- Generate all completion reports from the same validated ledger.

**Non-Goals:**

- Requiring or simulating server-side CI evidence.
- Replacing semantic review with lint, typecheck, tests, grades, or model confidence.
- Preserving historical exemptions merely because they already exist.
- Changing public behavior without an applicable durable-spec change.
- Importing an external style guide or adding rules without repository evidence.

## Decisions

### 1. The final worktree inventory is authoritative

The campaign will enumerate every tracked file and every non-ignored untracked file
from the final worktree. Each ledger row records path, content digest, classification,
reviewer/check identities, verdict, findings, dispositions, and evidence. Generated,
vendored, binary, and external-archive material may use an explicit classification,
but may not disappear through an implicit glob exclusion.

The alternative was to retain the historical 1326-file catalogue and append newer
results. That cannot prove current completeness because paths and contents have
changed and the baseline itself omitted files.

### 2. Review evidence is content-addressed and invalidated by edits

A terminal verdict applies only while the file digest matches the reviewed digest.
Any content change returns that row to pending until the final blob is reviewed again.
The ledger validator rejects missing paths, duplicate paths, digest mismatches,
unknown dispositions, and implicit exclusions. Completion means zero pending rows and
zero invalid terminal rows.

The alternative was timestamp or commit-based freshness. It is insufficient in a
shared worktree and cannot distinguish a reviewed blob from a later edit to the same
path.

### 3. Findings have stable identities and explicit dispositions

The 709 accepted consolidation records form the initial finding set. Generic campaign
findings are expanded into concrete per-file instances without double counting their
parent. Every instance ends as `fixed`, `overturned`, or `retained`; overturning and
retention require direct source evidence and rationale. A changed file receives a
fresh semantic review, so newly discovered defects join the same ledger rather than a
side report.

The alternative was to close generic findings when a representative example passed.
That recreates the sampling error this change exists to remove.

### 4. Mechanical enforcement and manual review are separate layers

ESLint owns semantic JavaScript/TypeScript rules and the structural thresholds;
Prettier owns formatting across every maintained supported file; Stylelint owns CSS;
TypeScript owns type correctness; type-coverage owns measured type escape; dedicated
scripts own marker, scope, and inventory integrity. Each gate gets a temporary planted
violation that must fail through the same command used at completion. Duplicate rules
across tools are removed rather than counted twice.

Manual review separately covers naming, decomposition, data flow, error behavior,
comment truthfulness, test strength, and alignment with durable specs. A file cannot
receive an exemplary verdict from mechanical results alone.

The alternative was a single composite score. A score obscures ownership gaps and can
remain high while a whole class of files is not checked.

### 5. The universal floor has no exemption escape hatch

Maintained product files must satisfy the documented limits: at most 300 lines,
functions no longer than 70 lines, cognitive complexity below 10, no avoidable `let`
or mutation, and no silent configuration fallback. ESLint directives, rule overrides,
and ignored paths are individually re-proved against the final source. If a file
cannot satisfy the floor, it cannot be reported as exemplary; it must be refactored or
classified as non-product by evidence intrinsic to the file's role.

The alternative was to raise a percentage ratchet. That permits a permanently
unreviewed tail and contradicts the requested all-file result.

### 6. Readability is achieved through structure, not explanatory volume

Large files and functions are split around cohesive responsibilities. Names expose
domain intent, pure transformations are preferred, and mutation is confined only
where an external API requires it. Public exports in `packages/shared` and
`packages/ui` receive contract-focused JSDoc. Application and internal helpers do not;
their comments are limited to short, non-obvious current rationale. Load-bearing
rationale that exceeds the limit moves to the relevant durable spec before the code
comment is shortened.

The alternative was to annotate complex code. That preserves the complexity and
creates another surface that can become stale.

### 7. Remediation proceeds in dependency-aware waves

P1 findings and gate ownership are resolved first because they affect the reliability
of later evidence. P2 and P3 findings then proceed root by root, with focused tests and
the relevant static checks after each wave. Any semantic change first receives an
OpenSpec delta. The final pass re-reviews every resulting blob, runs the complete local
matrix, and only then regenerates reports.

The alternative was file-order remediation. It repeatedly invalidates downstream
reviews when shared contracts or lint configuration change late.

### 8. Product data flow and load-bearing invariants remain explicit

This campaign does not introduce a new request path, shared schema, or Prisma write
model. When a finding requires changing one, the flow must remain:

```text
before: request -> canonical middleware -> shared contract -> service -> atomic write
after:  request -> canonical middleware -> shared contract -> service -> atomic write
                                  |-> stronger validation/review evidence
```

Period writes continue to update period dual-state atomically. tRPC procedures retain
one of the eight canonical role-coverage builders by reference identity. Destructive
database operations retain the production guard. Deferred features remain loud stubs
or inert UI with their required trace. A finding may strengthen these invariants but
may not relax one without a separate explicit spec change.

### 9. Reports are projections, not independent truth

The machine-readable ledger is the sole completion source. Consolidation, roadmap,
Markdown handoff, and HTML are regenerated from it after final verification. The HTML
check renders every Mermaid diagram and rejects missing or stale source digests. No
report may override a ledger failure.

The alternative was manually synchronizing several reports, which allowed counts and
claims to diverge.

## Risks / Trade-offs

- [Edits repeatedly invalidate reviews] -> Order work by dependency, freeze completed
  roots, and validate digests before every aggregate report.
- [Style remediation changes behavior] -> Preserve contracts, add focused regression
  tests, and require a spec delta before intentional semantic change.
- [Strict rules produce noisy false positives] -> Activate rules only with measured
  repository signal and planted positive and negative probes; fix the rule centrally.
- [Generic findings inflate or hide counts] -> Preserve parent identity while tracking
  concrete child instances and validate aggregation arithmetic.
- [Generated or binary files receive meaningless prose review] -> Use explicit,
  validator-recognized classifications with objective integrity checks.
- [Local-only evidence is weaker than independent CI] -> Record the waiver and exact
  local commands, versions, exit codes, and artifact digests without claiming CI ran.
- [Disposable test databases affect concurrent work] -> Use only designated test/E2E
  databases and retain the production destructive guard.

## Migration Plan

1. Freeze the current finding set and rebuild the final-worktree inventory schema.
2. Finish P1 gate and correctness work; run focused verification and invalidate every
   changed ledger row.
3. Remediate P2 and P3 findings in dependency-aware root waves, adding spec deltas for
   behavior changes.
4. Remove or prove every suppression, override, ignored path, and structural exception.
5. Review every final blob and require the ledger validator to report zero pending and
   zero invalid rows.
6. Run full lint, typecheck, unit, build, required integration/E2E, planted-probe, and
   report-render checks locally.
7. Regenerate archive artifacts from the validated ledger, stage only campaign paths,
   commit, and push the green tree to `main`.

Rollback is ordinary Git reversion before a production point. Database test fixtures
may be reset because the MVP databases are disposable; production destructive access
remains forbidden. If a wave regresses behavior, revert that wave and its ledger
verdicts together rather than retaining stale completion evidence.

## Open Questions

None. The owner has fixed the scope, quality target, local-evidence model, and
server-CI waiver. Newly discovered product ambiguities become explicit OpenSpec
changes instead of implicit decisions inside this campaign.
