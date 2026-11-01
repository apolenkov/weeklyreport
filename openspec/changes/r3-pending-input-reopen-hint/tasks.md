# Tasks

- [x] 1. Read commit `c7f02a897` (code and tests) and map the open-update
      header behaviour to `report-toolbar-layout`.
- [x] 2. Confirm the locked-badge precedence rule is already specified in
      `report-toolbar-layout` and the sticky Retry rule in
      `lead-status-overview-actions`; do not duplicate either.
- [x] 3. Write the delta spec for `report-toolbar-layout` with the
      pending-input requirement and three scenarios.
- [x] 4. Run `openspec validate r3-pending-input-reopen-hint --strict`
      and `prettier --check openspec/changes/r3-pending-input-reopen-hint`
      through the local `node_modules/.bin` binaries (no pnpm calls).
