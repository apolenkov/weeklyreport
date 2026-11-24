# Tasks part 1: progress notes

Part of [tasks.md](../tasks.md). Notes from 2026-11-09, kept for the history of packages 2 to 9.

## Status 2026-11-09

- Done: inline item form and shell integration; failed draft writes are classified as ambiguous (transport/5xx) or restricted (4xx) at the tRPC adapter; Save after an ambiguous failure re-sends the identical immutable request (`retrySameAttempt`), later typing stays in the editor for its own Save; Cancel after possible dispatch retries the original first and only then sends the compensating restoration at the settled state; a conflict answer freezes the original, reads the authoritative section and keeps the submitted input in the recovery region.
- Done (package 9, code and focused regression): after an autosave 409 the Lead's changed item text (against the failed save's base revision) is laid over the first newer authoritative section in either arrival order; unrelated server edits stay; the held draft reports an error and does not autosave until the Lead edits or saves.
- Done (package 5, projection): a derived Next shares its record's comments; a read-only presentation takes comments from the authoritative source, never the dirty editor.
- Done (package 5, MVP): the Overview comments view offers a reply composer on the Lead's own persisted items through `review.leadItemComment`; a 4xx keeps the text with an error, an uncertain result asks for a discussion refresh instead of resending; a confirmed reply re-reads the Overview and section. Browser-checked at 1280/375 on dev data. The discussion is read by the dedicated own-Lead `review.leadItemDiscussion` query (one repeatable-read snapshot, uniform unavailable denial, `no-store`), mounted only while the comments are open; a confirmed reply re-reads only that query, never the editor. Not built: the shared alias owner and read-invalidation ticket for two simultaneously open aliases.
- Done (package 5, discussion owner): one page-scoped store keyed by section and stable lineage holds the reply draft, its edit sequence and the single delivery attempt, shared by Current and derived Next and kept while the comments are closed; an acknowledgement clears only the unchanged draft; an unavailable result or FORBIDDEN/UNAUTHORIZED read hides messages and drops the draft, a transient read failure keeps the list with a note; an uncertain delivery survives reads, blocks Send and resends only through "Send again (may duplicate)" after a check; a resolved own item keeps its comments control. Covered by hook, store and view tests; not yet browser-checked.
- Done (package 9, browser): the autosave conflict recovery was reproduced on the dev stand and autosave resumes after the Lead dismisses the conflict.
- Open: discussion remainder (session/user teardown of the store, reply notice for a removed card, focus rules, SPA-navigation retention); incomplete-record dependency work (package 4); E2E; final independent review.

## Contextual record presentation

- The nullable contract and preparation boundary are reviewed and committed.
- Risk and decision forms focus primary text on mount, keep additional details
  behind an accessible disclosure, accept missing details, and retain controlled
  input when details close. Errors reveal the affected optional fields and keep
  them open after correction until the Lead explicitly collapses them.
- Product stages, explicit risk severity, authoritative author and stale-context
  errors remain visible; pending writes disable duplicate submission while Cancel
  still emits intent for the host to reconcile. Component checks cover these
  states. Record host integration, persistence receipts, cancellation recovery
  and complete browser journeys remain in packages 2 and 7.

The existing stored-draft ledger captures deletion intent by expected section
version and kept record identities. A later authorized read cannot add or remove
that intent from an uncertain retry, including when the initial read was absent.
Adapter tests compare the full outgoing request across both read changes and
verify that a new-version write derives its own intent. This is the transport
part of package 2; contextual host cancellation and guarded end-to-end acceptance
remain open.

## Contextual record host

The Overview now places the record form under its Product or Activity, without
an item week lane. The existing input provider retains the composer; the existing
draft engine applies identity-scoped creation, replacement and compensation.
Only a matching scoped receipt confirms the submitted record. Later typing stays
for a separate save; uncertain retries keep the original request and cancellation
waits for the original outcome before removing or restoring the unchanged lineage.
The existing stage memory observes these scoped patches only after persistence.

Own-save echoes reconcile against current state even when the render preceding
the read was clean, so a child applying a later edit or cancellation on the save
receipt cannot have that change replaced by the same-version read. Negative
receipt checks cover token, activation, version, exact lineage and absence in
both the dispatched payload and persisted response. Full acceptance remains in
packages 7 and 8; component and in-memory checks do not replace the guarded
browser and database journeys.
