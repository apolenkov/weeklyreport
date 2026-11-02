# Tasks

- [x] 1. RED: `helm-production-contract.test.ts` renders the production example with `postgres.db=ReviewDatabase` and expects a schema refusal at `/postgres/db`; it fails against the old pattern.
- [x] 2. GREEN: `values.schema.json` pattern for `postgres.db` is `^[a-z0-9_]+$`.
- [ ] 3. Six repository gates on the final SHA; acceptance review; archive.
