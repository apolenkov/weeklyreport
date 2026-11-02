# Proposal

## Why

`deploy/postgres/restore.sh` canonicalises `PGDATABASE` to lower case on
purpose: the confirmation string `CONFIRM_RESTORE_TARGET` must name one
unambiguous target, and `restore-guard.test.ts` pins that behaviour. The chart
schema still accepted a database name in mixed case
(`values.schema.json`, `postgres.db`, pattern `^[A-Za-z0-9_]+$`). A release
installed with such a name would be a database `restore.sh` can never reach: it
would restore into the lower-cased name instead (TASK-503 C0072; Backlog
TASK-503.115, consilium Q2 02.11).

## What Changes

- `postgres.db` in `values.schema.json` accepts only `^[a-z0-9_]+$`, so a
  mixed-case name is refused at `helm template/install` with a schema error.
- `helm-production-contract.test.ts` pins the refusal.
- `restore.sh` is unchanged.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `deploy-kubernetes-chart`: the database name accepted by the chart is
  lower case.
