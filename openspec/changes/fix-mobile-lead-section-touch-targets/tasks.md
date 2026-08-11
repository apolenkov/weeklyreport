## 1. Web Section and Completion Geometry

- [x] 1.1 Apply the 44 px mobile minimum to the shared lead-form section collapse/expand control while preserving its desktop geometry and behavior.
- [x] 1.2 Apply the 44 px mobile minimum to every actionable sticky completion control while preserving desktop geometry and submission states.
- [x] 1.3 Add focused component tests for responsive geometry, accessible names, and existing state behavior.

## 2. Product Evidence and Verification

- [ ] 2.1 Re-run the aggregated source-bound iPhone 14 and Pixel 7 assertion and prove that no visible product button remains below 44×44 px.
- [ ] 2.2 Capture and review the repaired lead form with all section and sticky completion controls visible and without root or nested horizontal overflow.
- [ ] 2.3 Run focused tests, `pnpm --filter @customreport/web typecheck`, `pnpm typecheck`, `pnpm lint`, `pnpm test`, `pnpm build`, `pnpm format:check`, and `openspec validate fix-mobile-lead-section-touch-targets --strict`.
