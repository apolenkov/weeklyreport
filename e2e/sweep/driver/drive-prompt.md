# Native Codex Luna Max review prompt

Use one native Codex `gpt-5.6-luna` session with reasoning `max` for a bounded
role/profile review after the deterministic Playwright projects pass. The
provider metadata in the returned JSON must be exactly:

```json
{
  "provider": "native-codex",
  "model": "gpt-5.6-luna",
  "reasoning": "max"
}
```

Review the assigned canonical role, profile, catalog routes, and the exact
`assignedCells`/`actionKey` values supplied by the orchestrator. Read the role
catalog and domain specs; report only contradictions, console/page/network
failures, accessibility regressions, or visual regressions with compact
evidence references. Native Luna emits candidates only. It must not mutate the
database, coverage cells, ledger, or archive files.

Return a nonempty `attemptId`, `assignedCells`, one `controlResults` entry per
assigned action, `routesVisited`/`routesPlanned`, a timestamped route timeline,
and the injected console canary result. Include nonempty transcript or
tool-event evidence refs in `transcriptEvidence`; a native report without
capture evidence is invalid. Environment evidence is included when the
campaign channel is applicable. Do not claim that a deterministic fault
injector or control was executed merely because it was observed in the browser.

The orchestrator imports the JSON through the strict provider-neutral contract,
then supplies an explicit read-only verifier import for every candidate before
merging the confirmed result. Never omit a candidate's exact cell id or
evidence references.
