## 1. Tooling

- [x] 1.1 Implement a TypeScript tracked-Markdown repository-path validator and pure tests that prove it rejects an unlisted missing path, an owner-set mismatch, and a stale ledger entry; verify the targeted Node test exits 0.
- [x] 1.2 Add the exact classified exception ledger and register the validator once in the repository-test manifest; verify `pnpm lint:repository-tests` passes and reports the new owner exactly once.

## 2. Documentation

- [x] 2.1 Reconcile `directory-architecture-standard`, `dependency-currency`, `head-report-visibility`, `lead-form-loaded-view-model`, and `carry-over-automation` through delta specs, then synchronize them to the durable specs and verify all five capabilities validate strictly.
- [x] 2.2 Add the role-based MVP capability summary and correct current repository/gate facts in `README.md`; verify every claim against `openspec/specs/README.md`, current routes, and root scripts, then run Prettier check on the file.
- [x] 2.3 Update only proven stale ADR statuses and active-change references to their current durable specs and dated archives; verify no edited ADR still claims those implemented changes are pending.
- [x] 2.4 Replace every stale current-source pointer in the scanned durable Markdown set, classify every intentional missing path in the ledger, and verify the live repository-path gate reports zero unclassified or stale entries.

## 3. Planning and verification

- [x] 3.1 Validate this change with `pnpm exec openspec validate repair-product-documentation-drift --strict` and update its task evidence without changing product requirements.
- [x] 3.2 Run `pnpm format:check`, `pnpm lint`, `pnpm typecheck`, `pnpm test`, `pnpm build`, and `pnpm exec openspec validate --all --strict`; require every command to pass on one exact tree before delivery.
- [x] 3.3 Resolve every independent-review finding, synchronize the visibility delta, rerun the full same-tree gates, and require a second fresh read-only review to return PASS.
