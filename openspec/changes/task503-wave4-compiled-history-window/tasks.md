# Tasks

## 1. Shared contract

- [x] 1.1 Add the owning 100-period limit and required truncation boolean; reject absent wire metadata.

## 2. API

- [x] 2.1 Probe one extra scoped period, slice before parsing snapshots, retain archived total and propagate truncation through service.
- [x] 2.2 Record focused RED/GREEN for 100/101, hidden invalid probe, archive-off and DTO propagation; preserve existing scope controls.

## 3. Web

- [x] 3.1 Pass truncation through reports history and Head/Viewer navigation; show the muted latest-100 status only when needed.
- [x] 3.2 Update affected DTO fixtures and record focused UI RED/GREEN; preserve personal history cursor and errors.

## 4. Acceptance

- [x] 4.1 Coordinator records actual PostgreSQL 101-period and browser proof on this source.
- [ ] 4.2 Coordinator runs `pnpm format:check`, `pnpm lint`, `pnpm typecheck`, `pnpm test`, `pnpm build`, `pnpm spec:check`; commits with ordinary hooks and requests independent review.
