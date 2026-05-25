# Tasks

- [ ] T1: Audit stage selection mutation — inspect `apps/web/src/hooks/use-risk-mutation.ts`
      or the risk edit dialog to find where stage mutation is triggered
- [ ] T2: Inspect stage-multi-select component — review
      `apps/web/src/components/lead/stage-multi-select.tsx` and check how it
      reads the selected value and applies visual styling
- [ ] T3: Verify state sync — confirm that after mutation completes, the
      component's selected state prop updates correctly (check useQuery/tRPC
      refetch or local state)
- [ ] T4: Fix visual highlight — if state does update but visual does not, add
      or update CSS classes/styles to immediately reflect the new selected chip
- [ ] T5: Test stage switch → visual feedback — edit a risk, switch stage chip,
      verify immediate highlight change before dialog closes
- [ ] T-V: Verification — `pnpm typecheck`, `pnpm lint`, `pnpm test` all pass;
      manual risk-edit dialog spot-check
