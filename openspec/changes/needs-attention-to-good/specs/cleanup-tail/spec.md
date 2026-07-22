## ADDED Requirements

### Requirement: The 2026-07-22 Needs-Attention Minor Tail Is Cleared To Good, Not Tolerated

The cleanup backlog MUST record that the 2026-07-22 mass review graded 125
files **needs-attention**, that the 38 confirmed **major** findings on those
files are owned by the seven sibling `fix-*` / `harden-*` changes committed
that day, and that the residual **215 minor findings across 112 files** (the
13 majors-only files carry no minor) are cleared to **good** by the
`needs-attention-to-good` campaign — each minor either fixed or explicitly
re-graded as a non-issue against live code, never left standing. The
authoritative per-file, per-finding backlog is
`files-seed.json` in that change; findings are dated 2026-07-22 and each
`line` is re-resolved against current code before action.

#### Scenario: A listed needs-attention file still reads needs-attention on a minor this campaign owns

- **WHEN** the final control re-grade re-reviews one of the 112 files and a
  minor finding recorded in `files-seed.json` still reproduces against live
  code
- **THEN** that file is not considered cleared — the minor MUST be fixed, or
  a written justification recorded re-grading it as a non-issue — a minor
  from this frozen set may not be silently left as needs-attention

#### Scenario: A finding no longer reproduces because a sibling fix rewrote the line

- **WHEN** a minor's review-SHA line was rewritten by one of the seven
  `fix-*` / `harden-*` changes (or by another slice of this campaign) so the
  finding no longer holds
- **THEN** the finding is closed as a **stale re-grade** with that reason
  recorded, not counted as a fix and not reopened as new work
