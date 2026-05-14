# Phase 61 Plan - Closure: Source And Session Intake

## Goal

Create a canonical ledger of every repo-relevant user request, plan feedback,
agent finding, handoff leftover, and do-not-do constraint from repo markdown,
Claude Code, Codex, OpenCode/Qwen/Augment/Kilo candidates, and Plannotator.

## Scope

- Read all repo markdown inventories.
- Scan Claude main JSONL, subagent JSONL, and tool results.
- Scan Codex memory summaries and raw sessions where needed.
- Scan OpenCode customreport hits.
- Mark Qwen/Augment/Kilo as no customreport data found unless later evidence
  appears.
- Scan Plannotator approved, denied, and annotation plans.

## Tasks

1. Expand `.planning/audits/v8.1-source-manifest-2026-05-14.md` with final
   counts and exact source groups.
2. Expand `.planning/audits/v8.1-session-request-ledger-2026-05-14.md` until
   no source class remains unrepresented.
3. Classify each item as `DONE`, `OPEN`, `PARTIAL`,
   `DEFERRED-BY-USER`, `SUPERSEDED`, `CONFLICT`, or `DROP`.
4. Keep raw private transcripts out of repo.

## Verify

- `rg -n 'Still To Extract|UNKNOWN|TODO_CLASSIFY|UNCLASSIFIED' .planning/audits/v8.1-session-request-ledger-2026-05-14.md` returns no unresolved markers when the phase is complete.
- `pnpm lint:md` passes after edits.

## Exit

Phase exits when every source bucket in the manifest has a corresponding
classification section in the ledger.
