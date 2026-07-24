# Tasks

## 1. Web — unify slide-readiness status derivation

- [x] 1.1 Update
      `apps/web/src/features/slides/model/section-slide-readiness.ts` so
      `statusCounts` consumes `SectionProductProjection` and counts red/yellow
      real product slides from their derived `status`, never from
      `section.projects[].trafficLight`.
- [x] 1.2 Restrict derived project counts to product ids present in
      `section.projects`, excluding the synthetic cross-product slide, while
      preserving the existing independent blocked/at-risk project-risk counts.
- [x] 1.3 Keep `hasProjectStatuses` on its existing persisted-input
      completeness semantics; do not change warning copy, API schemas, merge
      behavior, or persistence.

## 2. Web — regression coverage

- [x] 2.1 Extend
      `apps/web/src/features/slides/model/section-slide-utils.test.ts` with the
      confirmed scenario: persisted red project traffic light and red owned
      stage, zero risks. Assert the product badge is green, `blockedCount` and
      `atRiskCount` are zero, tone is not blocked, and the Risk story item is
      optional without “Explain the red or yellow signal.”
- [x] 2.2 Add the positive case: a blocked risk covers a real project's stage
      while persisted `project.trafficLight` is not red. Assert the badge is
      red, the derived project and blocked risk independently contribute to
      `blockedCount`, tone is blocked, and Risk story is required.
- [x] 2.3 Add or extend coverage proving a synthetic cross-product slide does
      not contribute a project severity count.

## 3. Planning

- [x] 3.1 Archive the `status-risk-unification` delta after implementation,
      preserving the durable invariant that section-slide readiness consumes
      the unified risk-derived status model and never persisted project
      traffic-light severity.

## 4. Standard gates

- [x] 4.1 `cd apps/web && pnpm exec vitest run src/features/slides/model/section-slide-utils.test.ts`
- [x] 4.2 `pnpm typecheck`
- [x] 4.3 `pnpm lint`
- [x] 4.4 `pnpm test`
- [x] 4.5 `pnpm build` — BLOCKED by pre-existing F19 (web build broken since the dependency upgrade, bisect-verified unrelated to this change); all other gates green
- [x] 4.6 `pnpm lint:md` — script removed from the repo by the dependency-upgrade lane before archive; no markdown linter remains to run
- [x] 4.7 `/opt/homebrew/bin/openspec validate fix-slide-readiness-stale-trafficlight --strict`
