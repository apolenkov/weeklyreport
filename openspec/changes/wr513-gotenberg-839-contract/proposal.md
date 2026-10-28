# Proposal

## Why

PDF export relies on a renderer whose documented image version no longer matches the checked-in deployment values. Align the contract and image update so the reviewed release can be adopted without changing the report export behavior.

## What Changes

- Update the existing renderer requirement from `gotenberg/gotenberg:8.37.0-chromium` to the exact `gotenberg/gotenberg:8.39.0-chromium` release, retaining the immutable multi-platform manifest-list digest and all existing isolation and configuration requirements.
- During a later apply, align the Helm, local-development, and reviewed-image test pins to the same freshly verified tag and manifest-list digest.
- Require a coordinated live PDF check, independent review, and the six repository gates before this slice is accepted for delivery.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `pdf-renderer-service`: update the exact image tag in the internal-only, immutably pinned renderer requirement without changing its remaining provisions or scenarios.

## Impact

This change is part of Backlog `TASK-513`. The checked-in contract at `openspec/specs/pdf-renderer-service/spec.md` names 8.37.0, while `deploy/helm/weeklyreport/values.yaml`, `deploy/local-dev/deps.yaml`, and `scripts/gates/operations/deployment-images.test.ts` pin 8.38.1. The affected dependency is the Gotenberg image; report APIs and PDF behavior are unchanged. The 8.39.0 release has security-related URL, WebSocket, certificate, and ExifTool changes described in the [upstream release notes](https://github.com/gotenberg/gotenberg/releases/tag/v8.39.0). This slice starts from the not-yet-delivered lucide candidate `640c1313ce7210a24efe8c73a21b76cd60d53035` and depends on its delivery.

## Non-goals

- Changing the renderer's network policy, request contract, PDF semantics, other dependencies, or database state.
- Publishing an image, deploying the change, or modifying the main specification during planning.
