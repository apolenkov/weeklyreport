# Exemplary Repo Roadmap

## Why

The 2026-07-28 per-file walk read all 1590 tracked `.ts`/`.tsx` files across
three passes and produced `REPORT.md` (669 lines,
`~/work/customreport-archive/2026-07-28-per-file-walk/`). Its own second
review found real defects in the write-up itself: the first pass ran 137
verifier calls, not the 120 an earlier revision claimed; only 3 files were
never verified in that pass, not 20; the overturn rate where adjudication ran
was 54.7%, not 62.5%; and of the 62 first-pass findings the verifier upheld,
34 carry an explicit downgrade to `minor` in the verifier's own reason text —
not the 25 a later summary stated (this change corrects that count against
the raw journals; see `roadmap.json`'s `severity_note` field).

Nothing durable exists to say what the walk actually found, what "exemplary"
means in machine-checkable terms, or which of the walk's findings are safe to
act on unread. Without this, the report rots into an unlinked archive file
and every reader re-derives the same triage.

This change is a **decision and record change**, not an implementation
change. It defines the mechanical floor, pins three ratchet counters that
must never regress, records the durable cross-file rules the walk surfaced
that no gate enforces today, and records what was declined. The owner reviewed
and accepted the six previously-open decisions on 2026-07-28; their
implementation remains in `implement-exemplary-repo-roadmap`.

DevOps (CI runners, secrets, deploy) is explicitly out of scope; a separate
effort owns it.

## What Changes

- Add capability `exemplary-repo-floor`: the mechanical definition of a file
  "on the floor", the three ratchet counters, and the durable rules the walk
  surfaced (JSDoc placement, comment-archaeology resolution, single-owner
  rules for duplicated logic, docs-must-match-code).
- Record the declined mechanical rules so they are not re-proposed.
- Record the six owner rulings, their measured size, implementation criteria,
  and the distinction between the telemetry product decision and the five
  delegated engineering decisions.
- Publish `roadmap.json` (outside `openspec/`, in the archive) joining the
  catalogue and the walk's per-file verdicts for every tracked file, for a
  rendered roadmap view.

## Non-goals

- No file under `apps/*`, `packages/*`, `prisma/*`, or `scripts/*` is edited.
- No CI, deploy, secrets, or infra requirement is added or changed.
- Implementing the six accepted rulings is out of scope here; this change
  records them durably and the implementation change owns the code and gates.
- The 57 unadjudicated recovery-pass flags and the confirmed-findings list
  in `REPORT.md` are not re-verified by this change; both are recorded as
  not-yet-actionable.

## Verification

`openspec validate exemplary-repo-roadmap --strict` passes. `pnpm lint` was
run before this change and after (no product file touched), 10/10 checks
green both times.
