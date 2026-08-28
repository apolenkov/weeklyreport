## Context

See `proposal.md` for motivation and the two delta specs for the behavioral
contract. The original `mutationAuditMiddleware` read transport input through
`getRawInput()` after the resolver and passed it to `recordMutationAudit`.
Because tRPC's route-specific `.input(...)` parser runs later in the middleware
chain, an unknown nested `id` could be stripped before the resolver yet still
be discovered by the recursive audit target extractor. The same middleware
also passed the thrown message; that message was merely whitespace-collapsed,
email-redacted, and length-bounded before both the AppLogger event and
`UserActionLog` write.
The list repository selects the whole Prisma row, the service spreads it into
the tRPC response, and the web row type silently drops `ip` and `durationMs`.
The UI filters loaded rows but omits timestamp and displayed labels from its
search corpus. The Prisma model already has every required durable field and
has no raw-payload column.

Current flow:

```text
decoded mutation input --------------------+
                                            v
result.error.message -> partial sanitizer -> mutation audit envelope
                                            +-> UserActionLog (whole row)
                                                    |
                                              findMany + spread
                                                    |
                                             tRPC inferred output
                                                    |
                                      UI drops ip/duration; no detail view
```

## Goals / Non-Goals

**Goals:**

- Make the data boundary fail closed at write, repository, service, tRPC, and
  UI-copy boundaries.
- Preserve enough safe metadata for support correlation while ensuring raw
  user and transport values never become Action Log content.
- Make the existing metadata inspectable and searchable without adding another
  endpoint, route, dependency, or persistence model.
- Produce deterministic multi-page browser evidence for the corrected catalog
  intent.

**Non-Goals:**

- Preserve arbitrary historical failure messages in the admin UI.
- Add full-history/server-side search, log export, retention controls, or a
  separate SIEM interface.
- Change the general AppLogger event taxonomy outside mutation-failure reason
  classification.

## Decisions

### D1 - Target extraction receives only post-validation input

Keep the canonical outer mutation-audit middleware in every protected role
chain, but give it a request-local input state. Every parsed mutation attaches
one shared capture middleware immediately after its final `.input(...)`. That
capture point receives tRPC's decoded output after validation, transforms, and
unknown-key stripping. The outer middleware reads only that state; input-parser
failures and mutations without input produce no target rather than falling back
to transport data.

The role-coverage inventory admits the shared capture middleware as tRPC
plumbing and independently rejects every non-auth/non-AI parsed mutation that
lacks it or places it before its final parser. This preserves the eight
canonical base-chain identities while making the privacy boundary fail closed
for new routes.

Alternative rejected: continue walking `getRawInput()` and redact sensitive
keys. Unknown properties are not part of the procedure contract, and an
arbitrary key named `id` can look exactly like a legitimate target.

Alternative rejected: re-run each route's parser from the audit middleware.
Parser functions may transform values or carry effects; tRPC already provides
the authoritative decoded value at the post-input middleware point.

### D2 - Failure `reason` becomes a classification, never an error message

The middleware will pass `result.error.code`, not `result.error.message`, into
the mutation audit recorder. Success writes `reason: null`; failure writes one
of the fixed tRPC code literals. Both the AppLogger mutation event and durable
row receive the same classification. The list service will normalize existing
rows: a success always returns null, a failed row with a recognized code keeps
it, and every other historical value returns `LEGACY_FAILURE`.

This removes the incomplete message sanitizer instead of growing a brittle
denylist for emails, report text, comments, Prisma dumps, Telegram content, and
future input fields. Correlation id remains the bridge to safe structured
request/error logs, which already record error code and safe cause identity
without raw values.

Alternative rejected: recursively redact selected keys or substrings from the
message. Error text is unstructured and can echo a sensitive value without its
field name; a denylist cannot prove absence.

Alternative rejected: migrate or delete historical `reason` values. The API
normalization closes exposure immediately without a destructive operation or
schema-history change, while rollback remains possible.

### D3 - One shared strict DTO defines the complete public allowlist

Add strict shared schemas for one admin action-log event and its cursor page.
The event schema enumerates exactly the existing Prisma fields and the fixed
failure classifications. The repository uses an explicit Prisma `select`, the
service maps every field explicitly and normalizes `reason`, and the tRPC list
procedure declares the page as its output schema. No layer spreads a Prisma
record into a public object.

The web client consumes the inferred shared event type. This prevents its
current hand-written row interface from omitting `ip`/`durationMs` and prevents
a future Prisma column from silently reaching the browser.

Alternative rejected: keep the inferred router output alone. Compile-time
inference does not reject an extra runtime field and cannot serve as a
security allowlist.

### D4 - Disclosure is a second table row owned by one semantic button

Each summary row owns a button with `aria-expanded` and `aria-controls`. When
open, an adjacent full-width table row contains a labelled detail region and a
definition list of untruncated values. A deterministic serializer constructs a
new object in the contract's fixed key order before `JSON.stringify`; Copy
never receives the raw query object. A small `aria-live="polite"` result next to
the action announces copy success/failure. Collapse returns to the same button
because the control is never unmounted.

Alternative rejected: make the entire `<tr>` clickable. A table row is not a
button, gives poor keyboard semantics, and conflicts with the existing
correlation-copy action.

Alternative rejected: show JSON from `JSON.stringify(row)`. That would couple
the clipboard boundary to whatever fields the query object happens to acquire.

### D5 - Search uses one pure representation builder over loaded rows

Move the predicate into a tested model helper. Its corpus contains raw and
displayed values for procedure and status, both ISO and formatted timestamp,
and the currently searchable actor/target/reason/correlation fields. The UI
continues to state `Search covers loaded rows only`; loading a page extends the
input set and reapplies the same predicate. `ip` and duration remain detail
fields, not search dimensions, because the route contract does not promise
them as search keys.

The existing status formatter will map the real Prisma value `fail` to
`Error`; current aliases may remain for historical fixtures.

Alternative rejected: add server-side search in this change. It would require
a separate query contract, database indexes and full-history semantics, none of
which the owner or catalog requested.

### D6 - Multi-page proof uses deterministic non-production seed data

The full disposable fixture will own at least 21 non-proof Action Log events
with stable ids and timestamps. Repository integration tests retain the
equal-timestamp/no-gap coverage. Frontend tests cover disclosure, clipboard,
timestamp/humanized search, and load-more composition; the DS24 browser row
executes expansion, safe copy, timestamp search, and the 20-to-next-page
transition.

No production seed or runtime mutation is part of implementation verification.
Any later live recapture must use the exact disposable database guard and be
bound to one source patch digest.

### D7 - Catalog correction is specific and review-backed

`admin-actions-view` will replace `raw payload` with `whitelisted event
details` and enumerate the observable loaded-row search/pagination behavior.
A focused catalog regression check will reject the old phrase and require the
new Action Log boundary. The generator/review guidance will also state that a
generated field or control needs live-source or accepted-OpenSpec support;
semantic grounding remains a human review obligation because a generic parser
cannot infer product meaning.

### D8 - Load-bearing invariants remain unchanged

- **Role-coverage gate:** preserved; `admin.actionLog.list` remains on the
  existing `adminProcedure`. The shared post-input capture is recognized only
  as exact-identity plumbing after one of the eight canonical base chains.
- **Period dual-state:** untouched; no report or period writer changes.
- **Destructive DB guard:** untouched; no migration or destructive command.
- **Deferred-feature pattern:** untouched; this is an implemented admin surface,
  not a deferred path.
- **Scenario Catalog:** tightened by the delta requirement; it remains a route
  intent contract and does not become a second BDD runner.

## After data flow

```text
decoded mutation input -> target-id extractor only
result.error.code ------> fixed failure classification
                              |
                   explicit AppLogger envelope
                              +-> explicit UserActionLog write (same schema)
                                         |
                                  explicit Prisma select
                                         |
                              normalize legacy reason + strict DTO
                                         |
                                  tRPC output validation
                                         |
                  summary row + allowlisted disclosure/copy/search
```

## Risks / Trade-offs

- [Historical failure detail becomes `LEGACY_FAILURE`] -> Preserve correlation
  id and timestamp so privileged operators can use the structured operational
  logs; do not expose unclassified stored text.
- [Full IP is personal/security-relevant data] -> Keep the existing admin-only
  authorization, render it only inside the explicit disclosure, include it in
  the strict allowlist, and add non-admin negative tests. This change does not
  widen the API audience.
- [A strict output schema can turn legacy malformed data into a failed page] ->
  Normalize reason before parsing and test nullable/legacy fields; fail closed
  rather than silently leaking a future column.
- [Twenty-one seed rows can obscure more useful examples] -> Use compact,
  deterministic metadata and keep the first rows representative; assert exact
  profile-owned ids so unrelated residue cannot satisfy the proof.
- [Catalog semantic checks cannot be fully automated] -> Add a deterministic
  regression for this known hallucination and keep source/OpenSpec review as an
  explicit catalog-review step.

## Migration Plan

1. Land the shared DTO and safe classification mapping first, then update the
   API writer/reader and tests. There is no database migration.
2. Land the web disclosure/search against that validated contract.
3. Correct the catalog and deterministic fixture, then run focused unit,
   integration, catalog, accessibility, and browser checks.
4. Recapture DS24 and update the external desktop evidence only after all
   repository gates pass on one unchanged patch digest.

Rollback reverts the code and catalog change. The database remains compatible:
new fixed-code reasons are ordinary strings in the existing nullable column,
and no historical row is rewritten.
