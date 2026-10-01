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
- [x] 2.3 Verify the required desktop viewport matrix (1024, 1279, 1280 and
      1728 CSS pixels) in headless agent-browser Chromium; confirm no clipped
      focus or horizontal overflow. Verified 2026-10-01: the editor opens below
      the three-week timeline with the lanes visible, full timeline width,
      no document overflow.
