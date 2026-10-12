## Why

Existing admitted producers expose five current defects: issued history cursors reject supported UUID versions, a single revoke drops router scope before its write, Item status changes retain obsolete reported validation, and reopen feedback/gating measures raw padding while its payload is trimmed, and comment error feedback uses UTF-16 units despite its current code-point counter/schema.

## What Changes

- Match both history cursor decoders to the existing shared UUID admission contract.
- Carry the existing required revoke scope through service/repository/transaction and combine it with unchanged mutation invariants in the atomic predicate; preserve the verdict caller's locked entitlement and expected version.
- Recompute only previously reported status-dependent Item errors from the existing save rules.
- Let the actual reopen consumer supply its trimmed code-point count while retaining its raw draft and existing 500-point limit.
- Classify comment length feedback with the existing schema code-point metric while preserving unsupported-input refusal.
- Remove the application fake's false same-version save idempotency assertion; retain real storage/CAS owners.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `lead-history-summary`: issued cursor identity matches current UUID admission.
- `report-section-write-gates`: single revoke retains scope at its atomic write.
- `lead-dialog-lifecycle`: corrected status updates only reported dependent errors.
- `lead-form-write-actions`: reopen feedback and admission describe its trimmed payload.

- `record-comment-save-coordination`: invalid-draft feedback uses the current code-point budget.

## Impact

Owned API/Web sources and existing tests only. No changes to canonical authorization builders, report lifecycle tuple, schemas, statuses, limits, dependency pins, storage or central error mapping. Native PostgreSQL, browser, AT and aggregate acceptance remain Root-owned and needs-evidence. Broader error-classification and non-continue-null proposals are not admitted.
