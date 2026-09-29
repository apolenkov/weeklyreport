## 1. Contract and storage

- [x] 1.1 Add the nullable `comment` column to `SectionReview` (schema plus forward-only migration). Applied to `customreport_e2e` through the guarded `migrate-deploy` operation.
- [x] 1.2 Extend `reviewVerdictInputSchema` and `sectionReviewViewSchema` with tests for required, empty, over-length and approved-with-comment cases.

## 2. API

- [x] 2.1 Persist the comment in `upsertVerdict` (null for approved) and map it in `toReviewViews`, test-first, including an integration case in the guarded disposable database.

## 3. Web

- [x] 3.1 Add `RequestChangesDialog` (modal reason dialog) and wire it into `SectionVerdictControl` and the dashboard `RequestChangesButton`; update their tests.
- [x] 3.2 Show the current comment in `LeadReviewFeedback` on the returned section.

## 4. Verification

- [ ] 4.1 Run affected package tests, typecheck, lint, format:check, spec:check and the Cyrillic grep on changed tsx.
