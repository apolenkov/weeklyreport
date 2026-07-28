# Tasks

## 1. Normative contract

- [ ] Add the `ratcheted-quality-debt` capability with the measured inventory,
      vocabulary, ordering, slice boundary, and completion rules.
- [ ] Link the four independent implementation changes and their dependencies.
- [ ] Store all accepted 2026-07-28 decisions in the design record.

## 2. Resumability

- [ ] Keep `roadmap.json`, `HANDOFF.md`, and the local HTML report synchronized
      after every completed implementation slice.
- [ ] Record exact command, exit status, baseline transition, tests, commit, and
      push state for every checkpoint.

## 3. Verification

- [ ] Run `openspec validate add-quality-debt-roadmap --strict`.
- [ ] Validate the four linked implementation changes with `--strict`.
- [ ] Confirm `openspec list` exposes all five active changes.
