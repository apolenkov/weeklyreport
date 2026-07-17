## Why

The source API cannot start because the `period` facade eagerly exports `PeriodModule` while admin services consume pure period helpers through that same facade, creating an ESM initialization cycle. The failure blocks every source-run browser and integration workflow despite unit and build gates passing.

## What Changes

- Separate the `period` Nest module entry from its domain/application facade so pure cross-module imports do not load the Nest composition graph.
- Allow API bootstrap and infrastructure consumers to use either a module's `index.ts` contract facade or its explicit `module.ts` composition entry; sibling business modules remain limited to `index.ts`.
- Add a regression test that imports `AppModule` through the production TypeScript ESM loader.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `directory-architecture-standard`: distinguish sibling module contract facades from bootstrap-only Nest module entries while preserving machine-enforced boundaries.

## Impact

Touches the period public entries, API composition-root import, ESLint boundary configuration, and an API boot regression test. There are no API, schema, data, or user-visible behavior changes.

## Non-goals

- Refactor period/admin services or Nest providers.
- Relax sibling-module deep-import restrictions.
- Change period lifecycle behavior or persistence.
