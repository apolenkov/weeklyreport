> **Superseded delta.** Retained for historical traceability only. Current
> WeeklyReport acceptance is defined by
> `replace-runtime-sweep-with-product-acceptance`; this delta MUST NOT be synced
> or executed as current authority.

## MODIFIED Requirements

### Requirement: Native driver import collects post-run environment feedback

Every native driver report import SHALL consume captured transcript JSONL and
collect the five environment channels for the report timeline: browser console,
browser network, the runtime API structured log, Bugsink, and Loki. The runtime
Playwright API SHALL write its structured log below the immutable campaign
archive. Import SHALL correlate environment events to exact driven routes and
cells, append every correlated event as an `env` candidate, and require the
same explicit verifier disposition as any native-review candidate.

#### Scenario: Server-side error during a drive reaches verification

- **GIVEN** a native driver report with a captured timeline and transcript
- **WHEN** the runtime API writes a warning or error during a driven route
- **THEN** import correlates that log entry to the route and coverage cell
- **AND** import rejects the report until an explicit verification record
  dispositions the generated `env` candidate

#### Scenario: Correlation skew cannot claim a prior route event

- **GIVEN** a warning or error whose correlation ID is not present in the
  current cell's browser response ledger
- **WHEN** its timestamp is outside the strict phase interval but inside the
  bounded correlation-skew allowance
- **THEN** the event SHALL NOT be attributed to that cell
- **AND** it SHALL remain in immutable profile-wide canonical API-log evidence
  that blocks campaign acceptance until dispositioned

#### Scenario: Unmatched in-window worker error remains blocking

- **GIVEN** a worker warning or error with no browser response correlation ID
- **WHEN** its timestamp is inside the strict current phase interval
- **THEN** the event SHALL be attributed to that cell and fail its environment
  observation
- **AND** the absence of an HTTP response match SHALL NOT hide it

#### Scenario: Transcript capture is missing

- **WHEN** import receives no transcript JSONL or cannot read a supplied
  transcript
- **THEN** import fails before writing any merged coverage output

#### Scenario: Transcript records are bound to the driven attempt and route

- **GIVEN** a transcript JSONL record with `attemptId`, an ISO timestamp, a
  browser tool name, and an optional route
- **WHEN** import validates the transcript
- **THEN** the attempt ID SHALL equal the report attempt ID
- **AND** the timestamp SHALL be inside the report timeline
- **AND** a supplied route SHALL be known and active at that timestamp
- **AND** malformed, extra-field, foreign-attempt, duplicate, or raw-string
  records SHALL be rejected

#### Scenario: Transcript evidence is an exact immutable snapshot

- **GIVEN** a valid transcript file
- **WHEN** import stages the result
- **THEN** it SHALL copy the exact input bytes into the final archive
- **AND** the report digest SHALL be the SHA-256 of those exact bytes
- **AND** every transcript evidence reference SHALL include the archived path
  and digest

### Requirement: Channel liveness - blind is never clean

Every environment channel SHALL carry a live probe or shipped-stream check. A
missing configuration value, unreachable endpoint, absent stream, incomplete
Loki credential pair, or undetected browser canary SHALL make the channel
blind. Native driver import SHALL reject any blind result before writing output
and SHALL NOT present an empty candidate list as clean evidence.

#### Scenario: Bugsink is unavailable during import

- **GIVEN** the Bugsink endpoint is stopped or either the DSN or API token is
  missing
- **WHEN** native driver import collects environment feedback
- **THEN** import reports the Bugsink channel as blind and fails closed
- **AND** no deterministic coverage cell is updated by that import

#### Scenario: Bugsink liveness proves asynchronous storage in the dedicated project

- **GIVEN** a Bugsink DSN and a 40-character lowercase-hex API token for the
  dedicated `runtime-sweep` project
- **AND** the harness runs sequentially with no other writers using that project
- **WHEN** the probe reads canonical project counters, submits a Sentry event,
  verifies the matching receipt, and polls the same project
- **THEN** the event SHALL include `platform: "javascript"`, logger, message,
  and level fields
- **AND** liveness SHALL require both `digested_event_count` and
  `stored_event_count` to increase after the pre-submit read
- **AND** receipt-only, malformed, rejected, stagnant, wrong-slug, or
  missing-credential outcomes SHALL be blind
- **AND** the DSN and API token SHALL never appear in feedback or error evidence

#### Scenario: Bugsink product SDK path is live

- **GIVEN** the direct Bugsink protocol probe succeeds
- **WHEN** readiness initializes the installed API and browser Sentry SDKs with
  the same canonical runtime DSN, emits one uniquely tagged canary through each
  SDK, flushes, and polls the dedicated project
- **THEN** readiness SHALL require both exact SDK canaries to be stored
- **AND** the web runtime SHALL receive that DSN explicitly through
  `NEXT_PUBLIC_SENTRY_DSN`
- **AND** a DSN parse warning, SDK rejection, failed flush, or absent canary
  SHALL keep the channel blind
- **AND** the direct protocol probe alone SHALL NOT satisfy product telemetry
  liveness

#### Scenario: Every channel is live and clean

- **GIVEN** transcript console and network capture, the runtime API log,
  Bugsink, and Loki all pass their liveness checks
- **WHEN** collection finds no correlated warning or error
- **THEN** import may accept the environment evidence as clean
- **AND** deterministic cells still require their independent Playwright and
  oracle evidence

#### Scenario: API log liveness requires a canonical structured record

- **GIVEN** an API log line in the report window
- **WHEN** import evaluates app-log liveness
- **THEN** the line SHALL contain an ISO timestamp, one of `debug`, `info`,
  `warn`, or `error`, a non-empty `message`, and a non-empty `correlationId`
- **AND** timestamp-only, malformed, or out-of-window JSON SHALL not count as a
  shipped stream
- **AND** warning/error event references SHALL point to the archived API-log
  snapshot and its SHA-256 digest, never to an unverifiable line reference alone

#### Scenario: Import publishes one atomic directory

- **GIVEN** valid reports, transcripts, and environment snapshots
- **WHEN** import writes merged cells
- **THEN** all snapshots, prepared reports, and merged cells SHALL be written
  below one staging directory
- **AND** the final output SHALL appear through one directory rename
- **AND** a failed import SHALL leave no partial output under `<output>`
- **AND** a pre-existing legacy sibling `<output>.reports` SHALL remain
  untouched and SHALL NOT block a new output directory
