## Crawler and evidence

- [ ] Add validated quick/full CLI, recursive traversal and representative rows.
- [ ] Add finite-filter pairwise exploration and element/state coverage reports.
- [ ] Add guarded lifecycle fixtures and tester-kit isolation/reset handling.
- [ ] Verify focused behavior, repository gates and real browser acceptance.
- [ ] Align durable specification and tester-kit instructions with measured results.

- [ ] Speed and determinism: admin tabs once, default views deduplicated, event-driven waits in quick mode, `compare.ts`.
- [ ] Procedure coverage by success, reasons registry, synthetic API scenario, one-command start in `full-run.sh`.

## Verification

Required: `pnpm format:check`, `pnpm lint`, `pnpm typecheck`, `pnpm test`,
`pnpm build`, `pnpm spec:check`, then tester-kit full browser run and final reset.
Unavailable runtime dependencies remain explicitly blocked.
