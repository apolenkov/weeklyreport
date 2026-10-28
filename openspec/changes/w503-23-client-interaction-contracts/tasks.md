# Tasks

## 1. Contract and keyboard RED preparation

- [x] 1.1 Trace the current callers and existing coverage; retain exact six-ID clause assessments and source hashes in the external TASK-503.23 packet.
- [x] 1.2 Strengthen the existing SearchInput focus-exit test with user-event Tab traversal; verify the diff adds no production seam or duplicate harness.
- [x] 1.3 Execute the focused pre-fix test and record the expected focus assertion failure separately from dependency/setup failures.

## 2. Saving motion

- [x] 2.1 Observe the actual pending-save Lead control under native reduce and no-preference modes; capture media match, computed animation properties, frame samples and full-page screenshots. Evidence: ~/work/handoffs/wr-513/s26/max/rm23-RESULT.md §2.1 and ~/work/handoffs/wr-513/s26/max/rm23-evidence/.
- [x] 2.2 After the scoped repair decision, fix the saving indicator at its owner and verify native stationary/animated controls without changing busy, disabled, success or retry behavior. Defect fixed in 7125b033e; evidence: ~/work/handoffs/wr-513/s26/max/rm23-RESULT.md §2.2.

## 3. Search keyboard behavior

- [x] 3.1 Reproduce native Tab traversal and ArrowDown across a long result popup through History or Admin Products; capture focus, active descendant, option/popup bounds, document scroll and navigation. Evidence: ~/work/handoffs/wr-513/s26/accept1/RESULT.md section B.
- [x] 3.2 Keep keyboard ownership on the input and reveal the active option from the popup; the strengthened Tab and reveal component tests pass.
- [x] 3.3 Rerun the native Tab and ArrowDown cases against the repaired caller and record focus, bounds and navigation. Evidence: ~/work/handoffs/wr-513/s26/accept1/RESULT2.md.

## 4. Integration acceptance

- [x] 4.1 Obtain independent review of the exact implementation tree and pass the six repository gates on the reviewed tree through the coordinated lane. Independent review: ~/work/handoffs/wr-513/s26/max/rev23-RESULT.md (APPROVE WITH CHANGES, P1/P2 none). The coordinated push lane ran `check:push` on every delivery commit and passed format:check, lint, typecheck, test, spec:check, audit:dependencies and scan:secrets — ~/work/handoffs/wr-513/s26/int2/b1-push.log (caf20a0a8), t23b-push.log (898a06700), e513b-push.log (7125b033e), rm23-push.log (eeb33c994). `pnpm build` is not part of the pre-push lane and has no recorded receipt on these SHAs.
- [x] 4.2 Deliver through normal hooks and atomic push when authorized; record main SHA and actual CI separately, with remaining TASK-503.23 clauses preserved for Root disposition. Delivered to main: 898a06700 (search popup out of the Tab order), 7125b033e (stationary saving under reduced motion) and eeb33c994 (evidence record). CI on main is not awaited by the owner's 2026-10-11 decision, so no actual CI result is recorded. Durable evidence: ~/work/handoffs/wr-513/s26/accept1/RESULT.md section B, accept1/RESULT2.md and max/rm23-RESULT.md; the remaining clauses (C5220/C5339/C5352/C0007) stay in the wave card for Root disposition.

## Workflow follow-up

- Root owns any auth stale-role policy and the whole-clause disposition of C5220/C5339/C5352/C0007; delivering the search keyboard contract does not promote those clauses.
- Archive only after authorized implementation, independent acceptance and durable evidence preservation.
