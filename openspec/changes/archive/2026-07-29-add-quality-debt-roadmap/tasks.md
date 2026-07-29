# Tasks

## 1. Normative contract

- [x] Add the `ratcheted-quality-debt` capability with the measured inventory,
      vocabulary, ordering, slice boundary, and completion rules.
- [x] Link the four independent implementation changes and their dependencies.
- [x] Store all accepted 2026-07-28 decisions in the design record.

## 2. Resumability

- [x] Keep `roadmap.json`, `HANDOFF.md`, and the local HTML report synchronized
      after every completed implementation slice.
- [x] Record exact command, exit status, baseline transition, tests, commit, and
      push state for every checkpoint.

## 3. Verification

- [x] Run `openspec validate add-quality-debt-roadmap --strict`.
- [x] Validate the four linked implementation changes with `--strict`.
- [x] Confirm `openspec list` exposes all five active changes.

Evidence:

- Initial creation commit `0702d251`: five active changes visible, individual
  strict validation 5/5, all-strict 157/157.
- Cycle archive `edbada31`; seed-profile archive `63e60d8b`; suppression
  archive `0128d686`; ESLint-scope implementation `73f27820` and CLI archive
  generated on 2026-07-29.
- Final implementation state: cycles 0; 115/115 suppressions adjudicated with
  72 retained proofs; ESLint scopes 26/26 classified with 32 planted checks;
  named seed ladder complete.
- Every slice is recorded in `roadmap.json`, `HANDOFF.md`, and the local HTML
  report with its commit, push, verification, transition, and next action.
