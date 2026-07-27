# Tasks

## 1. Revive the extractor

- [x] Rebuild procedure extraction on the TypeScript syntax tree instead of the
      brace counter and the `^\s*(\w+):\s*router\(\{` match — verified by the
      count moving from **0 to 94** procedures on an unchanged tree.
- [x] Make the gate exit non-zero on a zero extraction, so a parser that stops
      matching reports itself instead of reporting success.
- [x] Drop the `rg` subprocess: the audit reads the web sources in memory. The
      dependency was undeclared and absent on CI runners, and invisible for as
      long as the extractor was dead.

## 2. Fix the classifier the extractor was hiding

- [x] Decide BLACK HOLE from `refCount === 0` BEFORE the name-similarity
      heuristics, not after. Ordered the old way, 43 of 50 mutations could not
      be flagged under any circumstances.
- [x] Split the verdicts so PARTIAL (followed end to end, no read-back) and
      UNRESOLVED (left what static analysis can see) stop collapsing into one
      answer.
- [x] One unfollowable call site makes the whole mutation UNRESOLVED — a clean
      success path elsewhere is not evidence about the one never read.

## 3. Close what the working gate then found

- [x] Eleven mutations had no consumer. Built the admin activities surface for
      five `projectActivity.*` procedures, deleted two orphans, kept one as a
      documented tombstone.
- [x] Allowlist reduced to exactly three entries, each with a standing
      justification.
- [x] Gate mode writes nothing: `--check` sets an exit code and leaves the
      report markdown alone.

## 4. Known limit, recorded rather than papered over

- [x] Three aliasing shapes (object field, parameter default, assignment to an
      existing binding) are invisible to the call-site walk. None occurs in the
      tree today. Documented in `proposal.md` in BOTH failure directions —
      including the expensive one, where a correctly wired call is reported as a
      black hole and the gate fails good code.
- [x] The obvious fix — treating every non-builder use as an escape — was
      written, measured, and reverted: it zeroes all 42 VERIFIED verdicts,
      because delegated invalidation is written exactly that way.

## 5. Verification

- [x] `pnpm uat:audit --check` green: 48 mutations, 44 queries, VERIFIED 42,
      PARTIAL 2, UNRESOLVED 1, BLACK HOLE 3 (0 unexpected).
- [x] Gate has teeth: renaming a procedure's namespace prefix makes the audit
      report it. (Renaming only the procedure was NOT sufficient — the consumer
      count is a substring scan, which still matched. Recorded because the first
      attempt at proving teeth proved nothing.)
- [x] `pnpm lint`, `pnpm typecheck`, `CI=true pnpm test` green.
