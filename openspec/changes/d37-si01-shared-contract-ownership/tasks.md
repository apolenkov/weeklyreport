# Tasks

## 1. Shared schema ownership

- [x] 1.1 Remove duplicate per-type status lists/refinement and both caller imports/calls atomically, remove only obsolete facade assertions, and verify no remaining references plus existing record-write/outcome/facade focused tests.
- [x] 1.2 Observe the existing assembled-report 1999 issue-message assertion fail for its baseline wording, correct only the message, and verify the same owner passes while its 2000 control remains valid.
- [x] 1.3 Export INVISIBLE_TEXT_MESSAGE with unchanged bytes, use it in safeText, reexport it from the shared facade, and verify existing invisible/safe-text boundary owners.

## 2. Checkpoint delivery

- [x] 2.1 Run changed-file formatting, scoped git diff --check and openspec validate d37-si01-shared-contract-ownership --strict; record exact focused commands, source hashes, patch and all 31 original ticket clauses in the external handoff.

## Workflow follow-up

- Root integrates this source checkpoint with normal hooks; the assigned web leaf replaces its classifier literal with the new shared token.
- Root runs the final aggregate format:check, lint, typecheck, test, build and spec:check commands and independent review before final acceptance; native limits of other tickets remain separately tracked.
