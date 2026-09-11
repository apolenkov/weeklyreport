## 1. Implementation

- [x] 1.1 Expand only the exactly matched linked, independent, create, or
      resolve/restore editor across the unit timeline and restore idle layout on
      close.
- [x] 1.2 Separate preview text from the visible `Edit` action while preserving
      focus restoration, disclosure, metadata, and read-only semantics.
- [x] 1.3 Add visible source labels for independent Current and Next lists
      without pairing or aligning unrelated items.

## 2. Verification

- [x] 2.1 Add component tests for exact editor matching, one mounted form,
      unit-local sibling hiding, idle restoration, explicit Edit behavior, and
      independent-list labels.
- [x] 2.2 Run focused Overview editor/focus/create-ack tests, Web typecheck,
      targeted lint/format, strict OpenSpec, patch hygiene, and the Impeccable
      detector.
- [ ] 2.3 Verify the native viewport and 200% zoom matrix in the primary browser
      lane; confirm no clipped focus or horizontal overflow.
