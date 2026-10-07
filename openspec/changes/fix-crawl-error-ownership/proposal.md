## Why

Crawler diagnostics lose secret-file errors, CLI failures, login causes and unread logs. Accepted tickets ops-crawl-secret-read-errors, ops-crawl-driver-errors, ops-crawl-login-errors and ops-crawl-log-drain define OCR C4088/C4106/C4107/C4130/C4174/C4175/C4122 and their observed failures.

## What Changes

- Distinguish missing secret files from failed reads.
- Bound CLI bootstrap and preserve original failures on invalid output.
- Retain login and page recovery causes; back off only between attempts.
- Clear only successfully read log sources, reporting read/clear failures.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `ui-crawl`: observable diagnostic ownership and bounded recovery.

## Impact

Crawler config, driver, login, logs and quick/full page recovery; regression tests and ui-crawl contract. No dependencies.

## Non-goals

- Credentials parsing policy, product UI/API/infra, shared database E2E, CI rights, delivery and runtime versions.
