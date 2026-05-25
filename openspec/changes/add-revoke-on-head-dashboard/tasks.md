# Tasks

- [ ] T1: Extract revoke mutation — audit the existing revoke logic in the
      section view (e.g., `use-revoke-section.ts` or similar hook) and expose
      it as a reusable tRPC mutation if not already available
- [ ] T2: Add Revoke button to dashboard grid — edit
      `apps/web/src/components/dashboard/lead-reports-grid.tsx` and add a
      per-row action button with revoke icon (trash/undo icon TBD)
- [ ] T3: Implement revoke action handler — bind button click to the tRPC
      mutation, handle loading/error states
- [ ] T4: Update status pill after revoke — confirm section status reverts to
      "Draft" after the mutation completes
- [ ] T5: Test multi-row revoke — revoke 2–3 sections, verify status updates
      correctly and grid reflects changes
- [ ] T-V: Verification — `pnpm typecheck`, `pnpm lint`, `pnpm test` all pass;
      manual head dashboard spot-check
