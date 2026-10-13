# Proposal

## Why

A failed PDF dispatch followed by a failed compensation write returns the database error instead of the original dispatch failure to the request caller. C1143 identifies this exception replacement; the original failure is already logged before persistence, so this change does not claim total diagnostic loss.

## What Changes

- Preserve the original initial-dispatch rejection when marking that generation failed also rejects.
- Report the compensation failure separately with the same job and generation identifiers.
- Protect this behavior through the public `PdfExportService.requestPdfExport` boundary using existing repository fixtures and the real BullMQ enqueue adapter.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `pdf-export-integrity`: specify primary-error preservation during initial dispatch compensation.

## Impact

Only `apps/api/src/modules/pdf-export/pdf-export.service.ts`, its colocated service tests, and this OpenSpec change. The connected caller is `pdfExport.request` through `withDomainErrorMapping`, which preserves the original Error as its cause. Existing generation locks, failed-state CAS, immutable publication authorization, and recovery paths stay intact. Sources: owning service/recovery/repository, PDF contract, and TASK-503 C1143 triage.

## Non-goals

- No changes to retry dispatch, queue adapter, Prisma writes, authorization, transport messages, or dependencies.
- No real Redis/PostgreSQL double-outage claim, renderer/browser proof, or new recovery behavior.
