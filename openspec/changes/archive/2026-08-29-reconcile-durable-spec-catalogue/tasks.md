## 1. Validate the disposition set

- [x] 1.1 Review the five `REMOVED` delta files against current durable specs and archived changes; verify exactly five retirements and each requirement has a reason and migration note.
- [x] 1.2 Review the nine `MODIFIED` delta files against their current durable specs; verify every requirement block is complete, names match, and no tenth update or new capability is present.

## 2. Apply durable-spec reconciliation

- [x] 2.1 Apply the five retirement deltas and verify the five named durable capability directories are removed from the current `openspec/specs/` inventory while archived copies remain untouched.
- [x] 2.2 Apply the nine update deltas at their existing paths and verify each surviving requirement has the intended current wording and scenarios.
- [x] 2.3 Rebuild `openspec/specs/README.md` from the final durable inventory and verify every surviving capability is indexed exactly once with a working relative link.

## 3. Reconcile documentation counts separately

- [x] 3.1 Locate stale dynamic durable-spec or catalogue counts in curated docs and remove or replace only the confirmed stale claims; verify unrelated documentation remains unchanged.

## 4. Final verification

- [x] 4.1 Run `openspec validate reconcile-durable-spec-catalogue --strict` and verify it passes with all proposal, delta, design, and task artifacts present.
- [x] 4.2 Run the durable index inventory/duplicate/unindexed/broken-link check from `openspec/specs/README.md` and verify it emits no findings.
- [x] 4.3 Verify archived change directories and files are unchanged, and verify the final disposition totals remain RETIRE=5 and UPDATE=9.
