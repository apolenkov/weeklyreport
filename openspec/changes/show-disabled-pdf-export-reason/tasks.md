## 1. Web Presentation

- [x] 1.1 Wrap only the disabled Export PDF control in a geometry-neutral pointer and keyboard tooltip trigger while preserving the native disabled button and its accessible name/description.
- [x] 1.2 Render the exact publish prerequisite in the visible tooltip and keep the published/exportable button branch behavior unchanged.
- [x] 1.3 Add focused tests for pointer hover, keyboard focus, exact guidance, disabled semantics, accessible description, enabled-state click behavior, and toolbar geometry classes.

## 2. Verification

- [x] 2.1 Run the focused PDF button tests, `pnpm --filter @customreport/web typecheck`, scoped ESLint, scoped Prettier, and `git diff --check`.
- [x] 2.2 Run `openspec validate show-disabled-pdf-export-reason --strict`.
- [ ] 2.3 Recapture and manually review source-bound C47 browser evidence with the exact prerequisite visible.
- [ ] 2.4 Run `pnpm typecheck`, `pnpm lint`, `pnpm test`, `pnpm build`, and `pnpm format:check` before marking the change complete.
