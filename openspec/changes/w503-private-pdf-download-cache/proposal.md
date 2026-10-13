# Proposal

## Why

Authorized PDF downloads currently omit an explicit cache policy. TASK-503 C1126's original claim and `pdf-export.download-handler.ts` identify the missing `Cache-Control` response header on the raw `/pdfs/:file` route; this package establishes the private no-storage response contract without claiming an observed browser/proxy leak.

## What Changes

- Send `Cache-Control: private, no-store` before streaming an authorized PDF.
- Extend the existing successful-download test to assert that response header alongside the actual artifact bytes.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `pdf-export-integrity`: successful artifact downloads declare a private no-storage cache policy.

## Impact

The PDF download handler, its existing colocated test, and this change's artifacts. No caller signature, dependencies, configuration, or artifact format changes.

## Non-goals

- Proving or reproducing browser/proxy persistence or unauthorized cached access.
- Adding filename/audit policy or changing global Helmet nosniff handling.
- Changing authentication, frozen requester ownership, artifact generation selection, or error handling.
