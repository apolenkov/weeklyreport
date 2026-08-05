# Native Codex Luna AI-driver contract

The deterministic Playwright projects are the authoritative exhaustive sweep:
`runtime-prerequisites -> runtime-baseline -> runtime-matrix ->
runtime-live-controls`. A native Codex Luna Max review is a bounded evidence
producer layered after those projects; it does not execute the matrix, mutate
the database, or write the ledger.

## Provider and report contract

Every imported report is JSON with these exact metadata values:

```json
{
  "provider": "native-codex",
  "model": "gpt-5.6-luna",
  "reasoning": "max"
}
```

The remaining fields are `attemptId`, `transcriptEvidence`, `roleDriven`,
`profile`, `sourceSha`, `assignedCells`, `routesVisited`, `routesPlanned`,
`canary`, `timeline`, `controlResults`, and `candidates` as defined by
`e2e/runtime-sweep/driver-results-contract.ts`. The importer rejects stale
source/profile/role values, missing or extra assigned cells, missing control
results, stale routes/actions, malformed evidence, and a missing canary.
The report may add candidates, but native Luna never edits a coverage cell or
ledger directly.

`transcriptEvidence` is `{ "status": "captured", "evidenceRefs":
["transcript-or-tool-event-ref"] }`. The nonempty `attemptId` binds the report
to one native run; a native report without capture evidence is rejected.

The native report must be captured from the same canonical role/profile route
batch and reference exact cell ids. It complements deterministic evidence; it
does not duplicate every deterministic action. Browser-console canary and any
app/network/environment evidence required by the campaign remain mandatory
when that channel is in scope.

## Fail-closed import

No external process is invoked by the repository. Supply one or more native
reports, the exact frozen cell JSON files, and an output directory explicitly:

```bash
pnpm test:runtime-driver -- \
  --report /archive/native-codex/lead.json \
  --cells /archive/cells/minimal/lead \
  --output /archive/imported/minimal-lead \
  --source-sha "$(git rev-parse HEAD)" \
  --profile minimal \
  --role lead
```

When a report contains candidates, pass an explicit verifier import. It must be
a JSON array of `CandidateVerification` records and every candidate must have
one matching record:

```bash
pnpm test:runtime-driver -- \
  --report /archive/native-codex/lead.json \
  --cells /archive/cells/minimal/lead \
  --output /archive/imported/minimal-lead \
  --verification /archive/native-codex/lead.verification.json \
  --source-sha "$(git rev-parse HEAD)" \
  --profile minimal \
  --role lead
```

Missing `--verification` for a candidate-bearing report is an error. The
importer writes merged cell projections only after schema, SHA, profile, role,
assigned-cell, canary, and explicit-verifier checks pass. It never defaults to
an AI process, silently accepts a partial report, or changes the canonical
ledger.
