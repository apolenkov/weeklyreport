# Tasks

## 1. API service and owning regression

- [x] 1.1 Obtain design ACK from independent reviewer/coordinator and record it with the D ownership release; verify the exact design/test-patch hashes in the handoff.
- [x] 1.2 Apply the test-only patch in the approved validation window; capture actual RED for the failed-compensation case and GREEN positive control on the unchanged source.
- [x] 1.3 Add only the initial compensation catch and secondary diagnostic; verify the regression, existing PDF service suite, and source diff against the approved design.

## 2. Contract and final delivery

- [x] 2.1 Validate the PDF delta with `openspec validate w503-c1143-preserve-dispatch-error --strict`; verify no existing retry/generation requirement changes.
- [ ] 2.2 Run `pnpm format:check`, `pnpm lint`, `pnpm typecheck`, `pnpm test`, `pnpm build`, and `pnpm spec:check` on the reviewed clean tree in a granted window; record each actual exit and SHA.
- [ ] 2.3 Deliver exact source SHA, RED/GREEN, manifest and scoped limitations for independent review and Root integration; verify the pushed main receipt before task-owned cleanup.

## Workflow follow-up

- Resume C12 rebase and 72 focused tests plus six gates first when TASK513 publication arrives.
- Archive this change only after accepted delivery and preserve evidence outside the repository.
