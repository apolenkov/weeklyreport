# Proposal

## Why

C3623: `action.requested` carries every annotation of a session with its full
thread. Each annotation is bounded by the ingress schemas, but the number of
annotations per session is not, so one event can grow without limit. The SSE
stream writes each event whole to every subscriber, and nothing checks its size.

## What Changes

- `POST /sessions/:id/action` measures the serialized `action.requested`
  payload before persisting it. Above 1 MiB (UTF-8 JSON bytes) it refuses the
  action with the existing feedback limit error (HTTP 409) and writes no event,
  so no subscriber ever receives a partial or oversized event.
- Below the limit nothing changes: the event still carries every annotation,
  keeping upstream parity.
- The SSE send path, the event envelope and the annotation count per session
  are unchanged. C1268 (snapshot size) and C3628 (legacy inbox threads) stay
  open.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `authenticated-product-feedback`: maximum `action.requested` event size.
