# Tasks

## 1. OpenSpec change & Specification

- [x] 1.1 Create openspec change `w503-95-fix` with proposal, design, and tasks.
- [x] 1.2 Validate openspec change strictly.

## 2. Test & Implementation

- [x] 2.1 Add RED test in `slide-article-header.test.tsx` verifying `SlideLegend` initials are `aria-hidden` and full name is in `sr-only`.
- [x] 2.2 Update `SlideLegend` in `slide-article-header.tsx` to wrap initials in `aria-hidden="true"` and include `sr-only` author name.
- [x] 2.3 Verify test turns GREEN.

## 3. Verification & Submission

- [x] 3.1 Run six repo gates via `run-checks`.
- [x] 3.2 Commit with Conventional Commits and footer `TASK-503.95`.
- [x] 3.3 Prepare RESULT file `/Users/wrk/work/handoffs/wr-513/s26/b2/fix-503-95-RESULT.md`.
