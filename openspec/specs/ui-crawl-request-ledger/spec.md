# ui-crawl-request-ledger Specification

## Purpose

Defines how the tester-kit crawler keeps reused XHR observations and its shared request ledger honest, so corrupt history and lock failures fail closed.

## Requirements

### Requirement: Reused XHR observations retain request identity

The tester-kit crawler's press evidence MUST report each completed XMLHttpRequest once with that request's current method and URL, including when the page reuses the same native request object. Reusing a request MUST NOT accumulate lifecycle listeners or leave completed requests counted as in flight.

This observation contract covers asynchronous native requests with string methods and URLs, including ordinary event handlers that reuse or send the object. It does not cover synchronous XHR or guarantee ordering before a capture listener registered earlier on the same object.

#### Scenario: Two requests reuse one native object

- **WHEN** a page sends two sequential GET requests with different URLs through one XMLHttpRequest
- **THEN** crawler evidence contains exactly two network rows with the respective URLs
- **AND** the in-flight count returns to zero

#### Scenario: Reusing an aborted request

- **WHEN** a page aborts an XMLHttpRequest and then uses it for another request
- **THEN** the aborted request finishes accounting under its original metadata
- **AND** the next request is reported once under its new metadata

#### Scenario: Replacing an active request with native open

- **WHEN** native open replaces an active request without an explicit abort
- **THEN** the previous request stops contributing to the in-flight count
- **AND** completing the next request returns the count to zero and reports its URL once

#### Scenario: Native open rejects an invalid method

- **WHEN** native open throws for an invalid method
- **THEN** its native error propagates and any existing active request retains its metadata and count
- **AND** a later valid request does not install another listener pair

#### Scenario: An ordinary completion handler reuses the object

- **WHEN** an ordinary onload handler opens and sends another request on the same object
- **THEN** each completed request is reported once under its own metadata
- **AND** the final in-flight count is zero

#### Scenario: An ordinary OPENED handler sends a request

- **WHEN** an ordinary OPENED handler sends the request or performs a nested open followed by send
- **THEN** the in-flight count becomes one and returns to zero on completion
- **AND** the completed request is reported once under the URL that was actually sent

### Requirement: Shared request ledger rejects corrupt history

The crawler request reservation boundary MUST reject a persisted ledger row
unless it has exactly two integer fields: a nonnegative safe timestamp and a
signed safe request count. It MUST surface corruption before admitting a
request, preserve the original ledger bytes, and release its lock. An empty or
absent ledger MUST remain valid first-run history.

#### Scenario: Non-finite or malformed persisted row

- **WHEN** the crawler reserves a request using history with a non-finite field,
  missing or extra field, or malformed integer
- **THEN** reservation fails with an explicit ledger integrity error
- **AND** no request is admitted and the history is neither reset nor compacted

#### Scenario: Valid signed correction

- **WHEN** a completed action consumed fewer requests than it reserved
- **THEN** its signed correction remains part of the original minute's budget
- **AND** another reservation uses the corrected total

#### Scenario: First reservation

- **WHEN** the persisted ledger is empty or absent
- **THEN** reservation initializes history normally

### Requirement: Existing crawler request history fails closed

The crawler MUST treat only an absent request ledger as empty history. Other read failures MUST preserve their cause and prevent another reservation from being appended. Valid signed corrections MUST retain the existing request-budget semantics.

#### Scenario: Existing history is writable but unreadable

- **WHEN** the crawler cannot read existing rate history although appending would succeed
- **THEN** it reports the original filesystem error and adds no reservation

#### Scenario: First request has no ledger

- **WHEN** the request ledger is absent
- **THEN** the crawler can reserve within the existing budget and create its history

#### Scenario: A reservation consumed fewer requests

- **WHEN** a measured request count is less than its reservation
- **THEN** its negative correction retains the existing budget refund

### Requirement: Crawler ledger lock failures fail closed

The crawler MUST retry request-ledger lock acquisition only while an existing
lock blocks it. Every other acquisition failure MUST surface with its original
cause instead of retrying forever. Stale-lock cleanup MUST hide only the
released-meanwhile race and MUST surface other filesystem failures. When a
ledger action and its lock release both fail, the action failure MUST remain
primary with the release failure retained as secondary evidence; a standalone
release failure MUST still fail the operation.

#### Scenario: Permanent acquisition failure

- **WHEN** the lock directory cannot be created for a reason other than an existing lock
- **THEN** the operation reports the original filesystem error without waiting for the lock

#### Scenario: Stale lock cannot be removed

- **WHEN** removing an expired lock fails for a reason other than its release
- **THEN** the operation reports that removal failure instead of hiding it

#### Scenario: Action and release both fail

- **WHEN** a locked ledger action fails and releasing the lock also fails
- **THEN** the action failure remains the primary cause and the release failure remains observable

### Requirement: Handled request failures remain observable

The crawler MUST record one bounded page-error diagnostic for a fetch
transport failure even when page code handles the rejection. The diagnostic
MUST name the method and the query- and fragment-free URL, and MUST NOT record
the rejection payload or credentials. The same rejection MUST NOT be reported
again by the global unhandled-rejection listener. The original rejection MUST
reach its caller unchanged, and an ordinary `AbortError` cancellation MUST NOT
be reported as a failure.

#### Scenario: Page code catches a refused request

- **WHEN** a fetch initiated during a press rejects and the page catches it
- **THEN** one page-error entry names the method and stripped URL
- **AND** the caller receives the original rejection and no second report appears

#### Scenario: Intentional cancellation

- **WHEN** a fetch is aborted intentionally
- **THEN** no fetch failure evidence is produced
