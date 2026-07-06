## 1. Flip the web slice boundary to enforce all populated slices

- [x] 1.1 Extend `webSlices` in `eslint.config.ts` to all 11 populated slices
      (add `admin`, `organization`, `pdf-export`, `period`, `report-sections`,
      `review`, `telemetry`, `viewer`).
- [x] 1.2 Populate `webSliceGrandfatheredExcept` with exactly the existing
      cross-slice edges (enumerated from actual imports — minimal, no over-grant):
      admin→{organization,period,review}, dashboard→{review,report-sections},
      period→{admin,report-sections}, report-sections→{admin,pdf-export,period,
      review}, review→{admin,report-sections}, viewer→{pdf-export,period,
      report-sections}. Rewrite the rationale comment (this IS the flip now).

## 2. Verify (config-only)

- [x] 2.1 `pnpm typecheck` 5/5 (the `except`-map key type spans all 11 slices).
- [x] 2.2 Full `pnpm lint` clean — the allowlist matches the real graph, so no
      grandfathered edge is missing and none is redundant.
- [x] 2.3 Fail-closed proof: a synthetic `analytics → admin` import errors with
      `import-x/no-restricted-paths`; a grandfathered `viewer → report-sections`
      import passes. Confirms the zone is active, not a silent no-op.
- [x] 2.4 `openspec validate restructure-web-boundaries-enforcement --strict` green.
