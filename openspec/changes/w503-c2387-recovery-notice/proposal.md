# Retain PDF recovery notice until replacement acknowledgement

## Why

TASK-503.98 C2387: clicking Export PDF currently removes the quarantine notice before the replacement request succeeds. A network failure leaves the previous unknown export outcome without its recovery message. Root adopted Fable option A: retain the notice until a new job ID is acknowledged.

## What Changes

- Keep the report-scoped recovery notice visible through replacement request pending and error states.
- Clear it when the replacement job ID is acknowledged, alongside the existing fallback reset.
- Exercise pending, failure, retry and successful acknowledgement through ExportPdfButton's existing transport fixture.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `pdf-export-integrity`: specify recovery-notice retention until replacement acknowledgement.

## Impact

Owning hook: `apps/web/src/features/pdf-export/ui/use-pdf-export-job.ts`; consumer test: `export-pdf-button.test.tsx` beside it. Existing requirement: The export UI presents recovery quarantine as a terminal state. Policy evidence: `task-503/ui-residual-98/ROOT-RECOVERY-NOTICE-POLICY.json` and `advisor/fable/ANSWER-2203-ttys002-98.md` in the external handoff archive. No API or dependency change.

## Non-goals

- Worker, request UUID, generation, retry or storage policy changes.
- Changes to report scoping, the old-job fence or the one-shot download ref.
- Markdown, palette or broader TASK-503.98 closure.
