# Implement Exemplary Repo Roadmap

## Why

The rendered plan "Механический порог эталонности" and the
`exemplary-repo-roadmap` change define a repository-wide campaign, but the
existing roadmap change is deliberately a decision record rather than an
implementation vehicle. Implementing only the 57 formerly unadjudicated
findings leaves the plan's ordered gate work and its six-area backlog
untracked.

This change is the implementation vehicle for the complete roadmap. The PDF
defines the campaign order and backlog; `exemplary-repo-roadmap` defines the
durable invariants and open decisions; `adjudicate-exemplary-findings` owns the
57-record adjudication subset.

## What Changes

- Make the three exemplary-floor counters an enforced ratchet in the main lint
  gate, not a report-only command.
- Track the PDF's ordered rule-adoption work and six-area backlog to completion.
- Consume confirmed per-file findings only after adjudication and direct
  verification.
- Keep decisions explicitly marked as human decisions unresolved until the
  user rules on them.
- Reclassify the A-class `mock-data.ts` product-only fixture into test
  utilities. This intentionally changes `filesOnFloor` from 829 to 828 and
  `productTotal` from 925 to 924 without changing the 89.6% floor ratio; the
  baseline records the exact justified transition.

## Non-goals

- Do not re-run the completed 16M-token per-file walk.
- Do not silently decide `exactOptionalPropertyTypes`, telemetry reopen
  semantics, type-only cycles, or the split-harness convention.
- Do not treat a green gate as proof of a source claim the gate does not test.
