# Design

## Context

See proposal.md. Coordinator wrk-42 approved this bounded design on 2026-10-13; lanes B and C agreed that lane E owns `batch.ts` and its native regression for this package.

## Goals / Non-Goals

**Goal:** Attribute each completed XHR request once to its method and URL, with balanced request accounting across reuse and ordinary event handlers.

**Non-goals:** Change native request results or product lifecycle behavior.

## Decisions

Store each request's method, URL and active flag in a WeakMap keyed by the native XHR object. Install one capture listener pair on first use, before calling native open. Set candidate metadata before delegation because native open synchronously dispatches OPENED and ordinary handlers may send or perform a nested open.

Loadstart activates the current record once. Capture readystatechange(DONE) marks that record inactive, finishes accounting and records its status and metadata before ordinary completion handlers can reuse the object. Loadend does not decrement: a completion handler may already have sent the next request by then.

A successful native open retires the saved previous record by identity. It marks the record inactive before changing the count and does not overwrite metadata on return, so a nested open/send keeps its own record. A throwing open restores prior metadata only if the candidate is still current. An initial failed open leaves a null map value, preserving listener ownership without attributing a request.

Before: open → another listener pair → duplicate rows with stale URLs.
After: one listener pair → one record per request → one completion row and balanced accounting.

The report lifecycle tuple, canonical authorization chains and destructive database guard are unchanged. No migration or application rollout setting is required.

## Risks / Trade-offs

Native open can terminate an active fetch without loadend. Explicitly retiring the previous record handles that path, while native DONE handles completion, explicit abort and errors. Tests cover sequential reuse, explicit abort, active replacement, throwing open, ordinary onload reuse and OPENED-handler send/nested open. No synthetic events or manual abort simulate active replacement.

Observers cannot run ahead of a foreign capture listener registered earlier on the same object. Synchronous XHR does not dispatch loadstart and is outside this observation contract: its completion has no active record and does not produce a network row. Neither boundary has an admitted current product caller; expand coverage only after a concrete caller and bounded native control are established. Their risk is not accepted by these tests. WeakMap storage follows native object lifetime and does not keep requests alive.

Astra supplied advisory diagnosis for this bounded design. That advice is not independent acceptance of the frozen implementation.
