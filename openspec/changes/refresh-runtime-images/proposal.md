## Why

Several external runtime images still use old digests or floating readable tags.
The digest keeps execution immutable, but a floating tag obscures the reviewed
release and stale patch lines leave fixes outside the current MVP stack.

## What Changes

- Refresh supported external service images to reviewed stable releases and
  immutable platform digests.
- Replace floating readable tags with explicit release tags.
- Re-prove database, pooler, edge configuration, mail, telemetry readiness,
  metrics, and error-tracker persistence against disposable MVP state.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `deploy-config-integrity`: require a versioned readable tag alongside every
  immutable external Compose image digest.
- `operations-local-readiness`: use Bugsink's reviewed single-user setting and
  persist SQLite state at the data path owned by the reviewed runtime image.

## Impact

Compose definitions, CI service images, the backup base image, operations
configuration gates, and local runtime acceptance are affected. Application
interfaces and persistent production data migrations are out of scope because
WeeklyReport is still a disposable seeded MVP.
