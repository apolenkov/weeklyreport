## ADDED Requirements

### Requirement: All product source reaches the exemplary standard wave-by-wave

Every product source file SHALL satisfy the Exemplary Code Standard —
file under 250 lines, functions at most 50 lines, cognitive complexity
under 10, zero `let`/reassignment/in-place mutation, no silent product-config
fallbacks — with no per-file `eslint.config.ts` exemption other than the
documented JUSTIFIED PERMANENT blocks; the rollout proceeds in per-slice
waves (never a repo-wide big-bang), each wave verified by the full gate and
an adversarial diff review before commit.

#### Scenario: A wave brings a slice to the standard

- **WHEN** a rollout wave for a slice lands on `main`
- **THEN** every reworked file in the slice passes `eslint --max-warnings 0`
  without a slice-scoped exemption entry (JUSTIFIED PERMANENT blocks excepted)
- **AND** the full gate (typecheck, lint including depcruise and knip, unit
  suite) passes with observed exit codes before the wave commit
- **AND** the wave's diff preserves runtime behavior (no feature, schema, or
  API change)

#### Scenario: Rejected churn classes stay out

- **WHEN** a rollout wave proposes fixes for review findings
- **THEN** changes belonging to the ratified reject-list (`&&`-to-ternary
  rewrites, TODO purges, `.js` import consistency sweeps, empty-catch
  logging, mass magic-string extraction, blanket explicit return types) are
  excluded from the wave
