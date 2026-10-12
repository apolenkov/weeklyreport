## Context

Own installed Zod 4.6.5 `checks.ts` measures string `.max` in code points. The current shared prose maximum is 500; the review-comment maximum is 2,000. Combining marks remain separate points. Changing to graphemes, trimming additional fields, adding `maxlength` or truncating pasted text would change the contract.

## Goals / Non-Goals

Goals: consistent displayed counts, overflow state and already-existing save-length guards for the reproduced producers. Keep valid field values and invalid drafts intact.

Non-goals: new caps, Unicode normalization, grapheme counting, new error/privacy policy, pending serialization, parent admission changes, native HTML/padding behavior or AT acceptance.

## Decisions

Use `Array.from(value).length` at each existing metric site; no new test-only export or package contract. Store the rendered character count once per component. Reopen still measures its raw draft before the existing trim-on-confirm. Item next-step/pause still measure the existing trimmed text. Shared validation and required/null branches are unchanged.

The SI01 invisible-text constant replaces only an equal string literal in the owned classifier. No defect RED is claimed for that behavior-preserving reuse. Other classifier `.length` checks run only after schema rejection; they are not Save gates and have no distinct admitted failure in this scope.

## Evidence and Risks

Before source edits, four separate public DOM files reproduce seven failures while 79 controls pass: wrong comment count; invalid generic field/count; blocked reopen Send; blocked Item next-step/pause Save. Existing transport seams do not mock QueryClient mutation state, the components or the schema oracle. This is local producer/DOM proof, not real API/PG, native paste, full page or screen-reader acceptance.

The additional approved RequestChanges public boundary reproduces 500 admitted non-BMP points displaying as 1,000. Its counter now uses the same code-point metric on the existing trimmed value. `RequestChangesDialog` retains its existing native `maxlength` and trimming; its original padding/announcement/retry clauses remain open. Native HTML measures its API value under its own standard; jsdom does not establish native input-cap behavior. No attribute policy is inferred from unit tests.

## Validation

Each approved existing test runs alone through the global WR mutex with timeout60, nice10 and one worker. Record actual RED/GREEN exits and source hashes. Run scoped format/lint, a bounded actual source TypeScript check, strict delta validation and diff/reverse patch checks. Full six, native acceptance and independent review remain Root aggregate work.
