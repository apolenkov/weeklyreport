# Proposal

## Why

Known personal-data fields inside structured log context can reach application log sinks unchanged. C0592's native AppLogger diagnostic demonstrated the gap with synthetic markers in objects, arrays and child context; the existing `error-trace-correlation` privacy contract requires central redaction before every sink.

## What Changes

- Apply the existing known-key redaction vocabulary to nested context objects and arrays at the central logger boundary.
- Preserve caller-owned values, ordinary context, reserved event fields and existing circular/serialization-error behavior.
- Verify the canonical logger boundary with real file output, stdout/stderr capture and a configured SDK exporter.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `error-trace-correlation`: clarify structured-context redaction depth and preservation requirements.

## Impact

`apps/api/src/lib/logger.ts` and its canonical `logger.test.ts`; no dependencies or public logging API changes. Evidence belongs to the external D37-V05 handoff, linked to OCR C0592; tracker linkage is assigned by Root.

## Non-goals

- Free-text, stack, raw Error-cause or new sensitive-key detection.
- File backpressure, rotation, recovery, durability or never-throw policy changes.
- Claiming an identified live nested-PII producer from the admitted logger API diagnostic.
