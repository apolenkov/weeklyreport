# WeeklyReport product-excellence plan

## Owner decisions

- Use the product name **WeeklyReport**. Historical `customreport` identifiers
  may remain only where renaming would break a technical contract.
- Work product-first. Do not recreate a root E2E, UAT, route catalog, browser
  acceptance, exhaustive-runtime, campaign, continuation or evidence-harness
  tree.
- Keep strict architecture, style, complexity and immutability rules on
  maintained production code. Keep test rules deliberately simpler: readable,
  deterministic and capable of failing for the behavior they name.
- Do not start the six deferred `fix-mobile-*` changes (15 tasks) without a new
  owner decision.
- Use the repository authority in `goal.md` without waiting for routine
  implementation approval. Stop only at the explicit authority boundaries.

## Execution order

1. Reconcile active requirements and delete superseded process artifacts.
   OpenSpec, source, commands and documentation must describe the same current
   product. Completed changes are synchronized and removed from the active list;
   historical Git remains the recovery mechanism.
2. Improve product architecture and code quality by ownership boundary, not by
   global churn. Remove dead seams and duplicate writers before splitting code;
   preserve period dual-state and canonical role middleware on every write path.
3. Complete active product behavior in owner-priority order. Give each defect or
   change the smallest focused regression that proves its product contract.
4. Maintain the production operational floor: fail-closed configuration,
   deployable Docker images, dependency health, structured logs, metrics and
   traces, guarded recovery operations and current runbooks.
5. Land clean checkpoints in `main`. Before each delivery, review the exact diff
   and run checks proportional to the changed surface. Remote CI is the final
   delivery read-back; it is not a substitute for product judgment.

## Required deterministic checks

For a product-code checkpoint, run from the repository root:

```bash
pnpm format:check
pnpm lint
pnpm typecheck
pnpm test
pnpm build
pnpm exec openspec validate --all --strict
```

Documentation-only or planning-only changes may use their exact focused
format/link/spec checks locally; the pushed `main` SHA still receives the full
configured remote CI workflow.

## Closure report

Report product outcome first, then exact SHA/tree, local checks, remote CI,
cleanup state, explicitly deferred mobile scope and any external authority tail.
Do not claim the broader product goal complete while an active non-deferred
product requirement remains.
