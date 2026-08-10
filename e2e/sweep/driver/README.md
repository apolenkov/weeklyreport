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
`e2e/runtime-sweep/driver/driver-results-contract.ts`. The importer rejects stale
source/profile/role values, missing or extra assigned cells, missing control
results, stale routes/actions, malformed evidence, and a missing canary.
The report may add candidates, but native Luna never edits a coverage cell or
ledger directly.

`transcriptEvidence` is `{ "status": "captured", "evidenceRefs":
["transcript-or-tool-event-ref"], "digest": "<sha256>" }`. The nonempty
`attemptId` binds the report to one native run; a native report without capture
evidence is rejected.

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
  --transcript /archive/native-codex/lead.transcript.jsonl \
  --source-sha "$(git rev-parse HEAD)" \
  --profile minimal \
  --role lead
```

Supply exactly one `--transcript` JSONL path per `--report`; missing or
unreadable transcripts and blind environment channels fail before output. When
a report contains candidates, pass an explicit verifier import. It must be
a JSON array of `CandidateVerification` records and every candidate must have
one matching record:

```bash
pnpm test:runtime-driver -- \
  --report /archive/native-codex/lead.json \
  --cells /archive/cells/minimal/lead \
  --output /archive/imported/minimal-lead \
  --transcript /archive/native-codex/lead.transcript.jsonl \
  --verification /archive/native-codex/lead.verification.json \
  --source-sha "$(git rev-parse HEAD)" \
  --profile minimal \
  --role lead
```

Missing `--verification` for any original or environment-generated candidate is
an error. Prepared reports, including observed environment candidates, are
written to the fresh `<output>/reports/` artifact directory before merged cell
projections reference their content digests. The importer writes projections
only after schema, SHA, profile, role, assigned-cell, canary, environment, and
explicit-verifier checks pass. It never defaults to an AI process, silently
accepts a partial report, or changes the canonical ledger.

The observer also requires `RUNTIME_SWEEP_BUGSINK_DSN` and
`RUNTIME_SWEEP_BUGSINK_API_TOKEN` in the shell. The token is exactly 40
lowercase hexadecimal characters. Liveness uses the dedicated `runtime-sweep`
project and a sequential harness with no competing writers; missing or
malformed credentials make the import blind.
