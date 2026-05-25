# Tasks

- [ ] T1: Audit AI summary component — inspect
      `apps/web/src/components/lead/ai-summary-card.tsx` (or similar) and
      document current corner radius, spacing, and background styles
- [ ] T2: Compare with design system — check `packages/ui/src/tokens/` for
      canonical border-radius, spacing, and color tokens
- [ ] T3: Identify mismatch — note which styles deviate from the design system
      (e.g., rounded-md vs rounded-lg, spacing units)
- [ ] T4: Apply design tokens — update the unavailable state styles to use the
      matching design tokens from the system
- [ ] T5: Test both states — render AI summary in both available (loading,
      ready) and unavailable states; verify visual consistency
- [ ] T-V: Verification — `pnpm typecheck`, `pnpm lint` pass; visual
      spot-check in dev lead form
