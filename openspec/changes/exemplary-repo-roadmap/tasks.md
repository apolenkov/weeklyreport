# Tasks — Exemplary Repo Roadmap

## Planning + docs

- [x] Read `REPORT.md` (669 lines) in full and cross-check its own
      arithmetic against the raw journals
      (`wf_c2137728-432/journal.jsonl`, `wf_21308837-321/journal.jsonl`)
      rather than trusting the prose summary.
- [x] Regenerate `catalogue.json` (`pnpm catalogue`) after discovering the
      checked-in copy predated three same-day classifier fix commits; record
      the corrected counters.
- [x] Write `openspec/changes/exemplary-repo-roadmap/proposal.md` stating
      the decision-change scope and non-goals (DevOps excluded).
- [x] Write `openspec/changes/exemplary-repo-roadmap/specs/exemplary-repo-floor/spec.md`
      with the mechanical floor definition, the three ratchet counters, the
      durable cross-file rules, the declined-rules record, and the
      open-decisions record.
- [x] Join `catalogue.json` with both journals' shard verdicts and verifier
      adjudications into
      `~/work/customreport-archive/2026-07-28-per-file-walk/roadmap.json`
      (1590 file rows, 6 roadmap areas), keyed by normalized file path, with
      the verifier severity-downgrade flag computed directly from the raw
      data rather than copied from the report's prose count.
- [ ] `openspec archive exemplary-repo-roadmap` once the head has reviewed
      the recorded open decisions (not part of this change; a human ruling
      is the trigger).

## Verification

- `openspec validate exemplary-repo-roadmap --strict` — exit 0.
- `pnpm lint` — 10/10 checks, exit 0 (run before and after; no product file
  was touched by this change).
- Ad hoc: `python3` join script cross-checked its output counts against
  `REPORT.md`'s own stated totals (984+588 raw rows, 137+16 verifier
  records, 57 unadjudicated) — all matched except the severity-downgrade
  count, which the raw data puts at 34, not the 25 stated in `REPORT.md`;
  this change uses the measured 34.
