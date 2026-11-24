# Tasks

- [x] Preserve the existing CI checks and add parallel coverage and supply-chain jobs.
- [x] Add CodeQL and Scorecard workflows with pinned actions and scoped tokens.
- [x] Add GitHub templates and update the contributing and security guides.
- [x] Update the README and docs index with the gate map, diagrams, and CLI captures.
- [x] Validate workflows with `actionlint`, check local links, and inspect the rendered images.
- [x] Run `pnpm format:check`, `pnpm lint`, `pnpm typecheck`, `pnpm spec:check`,
      `pnpm test:cleanliness`, `pnpm lint:cleanliness`, `pnpm test:operations`,
      `pnpm lint:knip`, `pnpm test`, `pnpm build`, `pnpm scan:secrets`, and
      `pnpm audit:dependencies`. Record outcomes and sandbox limits in the handoff.
- [x] Hand off ordered commit groups for GitHub verification.
- [ ] Confirm the first GitHub runs, including service startup, both coverage
      thresholds and report upload, supply-chain checks, and security publishing.
      Require `enabled: true` from
      `GET /repos/apolenkov/weeklyreport/private-vulnerability-reporting`
      before marking this task done.
