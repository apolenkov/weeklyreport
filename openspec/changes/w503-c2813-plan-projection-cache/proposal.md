# Proposal

## Why

A lead can complete, restore or promote a plan while the already-open Overview still shows its previous section data for the query's 30-second freshness interval. TASK-503 / C2813 identifies this gap at the write adapter and the `LeadStatusOverview` consumer.

## What Changes

- Refresh active `leadForm.statusOverview` consumers after successful `resolvePlan`, `restorePlan` and `promotePlan` writes, alongside existing lead-form invalidation.
- Preserve rejected-write behavior and the existing invalidation boundaries of other commands.
- Verify the contract using the production adapter and a warm active QueryObserver with canonical tRPC options.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `lead-form-write-actions`: successful plan writes refresh the lead Overview status projection in the initiating QueryClient.

## Impact

`apps/web/src/features/report-sections/model/lead-form/lead-form-write-port.trpc-adapter.ts`, its colocated test, and `apps/web/src/shared/lib/query/cache-keys.ts`. Evidence and coordinator advice: `~/work/handoffs/task-503/wave-08/{WAVE-INPUT.json,web-facts.json,ADVICE-C2813-C0838-REVIEW.md}`. The current consumer is `apps/web/src/features/report-pages/ui/lead/shell/lead-status-overview.tsx`; the owning contract is `openspec/specs/lead-form-write-actions/spec.md`. No API, schema or dependency changes.

## Non-goals

- C2813's broader dashboard, history, activity, weekly-projection and `openWork` claims remain OPEN for separate proof.
- No expansion of `requestReopen`, `fillFrom`, draft-save or shared `invalidateLeadForm` behavior.
- No browser, database, Redis or E2E work in this package; final gates, independent review and delivery belong to the coordinator.
