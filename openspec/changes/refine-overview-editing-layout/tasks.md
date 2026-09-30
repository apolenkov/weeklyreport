## 1. Implementation

- [x] 1.1 Mount the exactly matched linked, independent, create, or
      resolve/restore editor once across the unit timeline while keeping the
      three-week context visible, then restore idle layout on close.
- [x] 1.2 Keep update copy readable and use the complete `Edit` action while
      preserving focus restoration, disclosure, metadata, and read-only semantics.

## 2. Verification

- [x] 2.1 Add component tests for exact editor matching, one mounted form,
      visible three-week context, idle restoration, explicit Edit behavior, and
      direct primary actions.
- [x] 2.2 Run focused Overview editor/focus/create-ack tests, Web typecheck,
      targeted lint/format, strict OpenSpec, patch hygiene, and the Impeccable
      detector.
- [ ] 2.3 Verify the required desktop viewport matrix in the primary browser
      lane; confirm no clipped focus or horizontal overflow. Historical browser
      evidence remains; current 2026-09-16 QE-CLOSE native check was interrupted
      and unaccepted, and QE-04, QE-05, QE-07, and QE-08 remain. Status (2026-09-30): matrix 1024/1279/1280/1728 passed in headless agent-browser Chromium (`/home/user/.local/state/session-review/weeklyreport-20260929/openspec-verify/overview/measure-*.txt`, `/home/user/.local/state/session-review/weeklyreport-20260929/openspec-verify/overview/*-1024.png`, `-1279`, `-1280`, `-1728`); not the owner's primary browser lane. Open: primary browser, and QE-04/05/07/08 have no definition anywhere (owner question), TASK-145.11.03.
