# Decisions 4–6: publication, disclosure and recovery

Part of [design.md](../design.md).

## 4. Publication serialization must be strengthened

Manual publication already participates in `lockStatusGraph`; section saves acquire the same lane before Report. For automatic publication, join that same lane **before** reminder-policy or graph reads and use ReadCommitted, matching the manual strategy. Do not acquire a RepeatableRead snapshot in a statement waiting on the advisory lock and assume it refreshes afterwards. Preserve automatic deadline and full lifecycle predicates exactly; do not call the manual helper or require a submitted section on auto-publish. Manual still requires at least one submitted section.

**Implementation note (2026-11-10): automatic publication keeps RepeatableRead.** Since the trace above, every editable-graph writer, the section save included, write-fences the Report row (`lockCurrentEditableReport`). A save that commits after the automatic publisher read the graph therefore makes its lifecycle CAS fail serialization: nothing is published, and the scheduler's next tick publishes from a fresh read. That is the "aborts and retries with a fresh snapshot" branch of the requirement, so the lane switch above was not made; switching isolation would only replace a tested mechanism with another. Proof on a real database: `publication.save-interleaving.integration.test.ts` (save after the graph read aborts the publication, the retry freezes the saved content and its omission totals together; a publisher that won closes the save with nothing written) beside `publication-comment-fence.integration.test.ts`.

Graph lane → reminder policy locks → guarded Report write → fresh graph freeze is the coordinated publication order; saves take graph lane → Report → section CAS. Freeze content, omission buckets, scope projection and search documents inside the winning transaction. Assignment writers already use the graph lane; implementation must test against actual source and detect any writer that bypasses the lane rather than rely on comments. A save before the lane is acquired appears in both content and counts. A publish that wins first closes the subsequent save. Failure/zero CAS produces no publication side effects.

Reopen leaves the previous snapshot representation alone; republish replaces `Report.publishedSnapshot` and its projections. There is no claim that this single column stores all historical publication versions. Already-created PDF jobs retain P1; P2 cannot mutate their content. Retained private rows are current source rows, not an immutable omission revision ledger.

## 5. Disclosure transports follow actual consumers

| Consumer                 | Required implementation seam and exact scope                                                                                                                                                                                                                                                                                                                                                                                                               |
| ------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Live mine/all SQL search | Add completeness predicates before ranking/limits. Preserve its existing live-row corpus and role/group restrictions; do not silently change historical live-search semantics. Return `{hits, omissions}` instead of a bare array and update all clients atomically. Count authorized included kinds before text query/limit. Zero matches still carry a corpus notice.                                                                                    |
| Viewer published search  | Add nullable known risk/decision omission totals to `PublishedSectionScope` (null means legacy unknown). Populate from validated frozen sections in the same replace/restore transaction. Aggregate that scope index joined to the existing published lifecycle predicate, not snapshots or mutable rows. No matching document is necessary. Preserve GIN hit query, ranking and limit.                                                                    |
| Assistant                | Partition before mapping, then authorize selected occurrences and subject buckets with the same own/shared-product lens. Notice scope is selected periods/authors/subjects/stages/kinds before lexical/semantic match and hit truncation; it describes corpus coverage, not matching omissions. Do not use buckets to create entity clarification options. No incomplete text reaches embeddings, prompts or citations; no-results still avoids embedding. |
| Analytics                | Add disclosure to period metadata/each velocity period and comparison side after existing winner, group and requested lead/Product filters. Use frozen buckets only. Zero complete rows may still have period disclosure; absent side remains null. Invalidate/reject old cache response shapes.                                                                                                                                                           |
| PDF                      | Preserve metadata through `scopeSnapshotWithOrgProgress`, stored job payload and `buildPublishedReadModelFromSnapshot`; scope omission counts to sections, not the intentionally org-wide progress metric. Print separate notice. Keep requester, generation, download ownership, render credential and retention rules unchanged.                                                                                                                         |
| Carry/history            | Filter incomplete live-source decisions before planning, retain complete decision dedupe and item precedence. Exclusion is not a carried record; author history/recovery supplies the source notice rather than inventing a manual carry banner. Published history gets frozen counts; private discovery adds current retained counts separately.                                                                                                          |

Ordinary SQL search has no subject filter; its frozen index needs section totals only. Assistant/analytics need subject buckets and already load authorized snapshots. This avoids a new text index or full-snapshot scan in viewer search. Rebuild scope projections from old snapshots without rewriting those snapshots; absence yields null/unknown. Concurrent republish must give search hits and disclosure one coherent publication observation (single statement or shared read transaction), not P1 hits plus P2 counts.

Implementation: the search repository returns `{hits, omissions}` from one RepeatableRead transaction for live and published scopes. Both statements retain the same PostgreSQL snapshot across a concurrent save or republish; the existing indexed hit query, ranking and limits remain unchanged. The service no longer calls separate repository methods for content and counts. The HTTP response already uses this object shape, so this change migrates the internal repository port and its callers only. Excluding both risks and decisions yields known zero even for a legacy publication, because neither record kind belongs to that corpus.

Assistant implementation: resolve entities only from authorized complete read models, then calculate coverage from the resolved author/period/subject/stage/kind coordinates. Candidate filtering and omission filtering share the same pure scope predicate, including readable Activity links. Foreign section scopes retain the current shared Product IDs from the authorization snapshot so that omitted-only Products and legacy unknown can be scoped without inventing catalog entries. A multi-stage bucket is selected once, not summed per stage. Unknown survives only where the selected authorized corpus could contain an omitted risk or decision; excluded kinds and unresolved requests yield known zero. Coverage stays independent of text, severity/timing matching, ranking and truncation, so it never claims that an unfinished record matched the request.

## 6. Private recovery is a narrow own-section read

Add a dedicated retained-drafts query using canonical `leadProcedure`, authenticated actor identity and a report/section pair, never caller-supplied author authority. Query current active entitled user and exact `ReportSection.authorId` together; preserve the builder's established role coverage, with ownership mandatory even for Head/admin. Existing own-section access is not conditional on continuing to own each source Product stage: loss of assignment forbids copying to that context, not reading one's retained text. Group or co-owner scope does not grant private recovery. Invalid current identity/role or no own source returns no content; do not add a new privilege to compensate.

Apply that **same current-role predicate to every private nullable-text and retained-discovery path**, not only the new query: `reports.getActive`/`getActiveSection`, `reports.myHistory`, `leadForm.byPeriod`, `leadForm.statusOverview`, recovery, and Fill From's source notice. Pass actor identity into service reads; a cached `activeReportSectionId` is not authorship proof. Use canonical builders unchanged plus one shared service/query authorization policy based on current database user activity/role and exact section authorship in the protected read's authorization observation. Cached session roles and cached response bodies must not bypass the current check; scope/invalidate server caches and clear private client caches on observed entitlement loss. This cannot retract previously delivered text and does not require a new authorization framework.

Mixed existing routes keep their existing admission for complete content/history: an active demoted author receives only otherwise authorized complete projections, without private retained counts, links, draft IDs, text or discussion. Dedicated recovery denies as inaccessible. Inactive users stay denied by normal authentication; nonauthor Head/admin receive only their existing public scoped content. Public live/frozen omission notices remain governed by report scope, not private retained discovery; they must not be suppressed or mislabeled as retained counts by this rule. Test freshly hydrated demotion, cached pre-demotion session, inactive user, stale foreign section pointer, exact own source, nonauthor leadership and still-entitled author after stage reassignment on every named route. No global conversion of `reports.myHistory` to authoring-only access is permitted.

Client implementation: `SessionProvider` observes the server-hydrated `auth.me` identity and authoring role, using the same shared role list as the server private-owner predicate. On observed authoring loss or identity change it unmounts its children before cleaning queries, dropping mounted recovery content and local editor state. Cancel pending `reports.getActive`, `leadForm.byPeriod`, `leadForm.retainedIncompleteRecords` and `reports.myHistory` requests before removing private payloads, so a late old response cannot repopulate them. For a known same-actor demotion, strip only `retainedDrafts` from ordinary and infinite history pages, preserving complete counts, cursors and public `publishedOmissions`; mark the result stale for authorized refetch. Anonymous, changed-identity and initially observed viewer sessions clear own history because cached entries do not prove their owner. Remount only after cleanup. Same-actor authoring-role/group refresh preserves private cache; unresolved authentication is not proof of entitlement loss. The complete-only status overview remains outside this private cache set. Component tests use the real session provider, query cache and recovery dialog, including a deliberately delayed response; browser acceptance observes a session refresh without reloading the page.

History discovery must include old open, archived-unpublished and published sources. Read-only recovery does not use the latest viewer route or `ensureLeadSection`, and never creates rows. Frozen omission counts and currently retained draft counts are distinct: restored snapshots may have no live source, and reopened sources may have changed. State “source draft unavailable” for a legitimately removed source; no permanent retention promise. When reopened, the normal authoring path controls edits; recovery itself stays read-only.

Explicit copy prefills primary and available detail text into a currently editable, own eligible target. Revalidate parent and stages, let the author choose changed context, retain explicit severity and derive owner from target author. Save creates a new stableId; its retry uses that same new ID. Source identity, comments, dates representing resolution and historical status are not silently cloned; normal create date rules apply. No target write or source deletion until the user saves; no automatic carry or reopen.

## Legacy unknown is silent on screen (2026-11-10)

Responses keep `unknown` for a snapshot frozen without omission metadata; no surface turns it into a warning or an "at least" bound. Storage accepted incomplete risks and decisions only together with the freeze that counts them, so every such snapshot left nothing out, and a warning across the whole archive would be false and would wear out the real notice. Report page, print template, History search, assistant and analytics name only counted omissions. If a snapshot could ever be frozen uncounted after incomplete writes exist, restore the warning for that case.

### Author card persistence evidence (5.1)

The loaded form projects the existing autosave snapshot and recovery state into
presentation-only risk/decision save states. It owns no timer, write, retry or
second receipt ledger. A row can say saved only when it survives the canonical
draft payload builder and the current payload equals the save owner's confirmed
baseline, with no pending transport or recovery. The baseline already belongs
to the active section generation. A newer edit removes that proof immediately;
an old response cannot restore it. While the section has unconfirmed changes,
cards conservatively show the section save state rather than infer per-row
success. A standalone card with no evidence only says unfinished.

Extend `conflict-retained-edits`, the existing conflict owner, to retain new
unfinished risks/decisions and changed fields of an existing unfinished row.
Compare the latest current payload with the failed write's base revision, then
overlay only those changed fields on the newer authoritative row. Keep server
physical identity, comments and unrelated fields. If the row is absent, keep
the local record under the same stable identity as unsaved input; it is not
automatically persisted. The existing held-key barrier requires explicit
reconciliation. Section activation boundaries continue to invalidate old work.
Eligibility also includes an unfinished identity in the failed request, so
completing its details before a conflict response cannot discard the latest
input. Parent IDs and stage names form one context: changing any of them retains
the entire local context together, while text-only edits preserve a newer
server context. Retain records over the last known base while the refetch is
pending too: a newer revision can carry the same payload, which only refreshes
metadata and would otherwise leave the author's record missing. Confirmed save
responses enter the same bounded revision history as query deliveries; a lagging
query cannot erase the base of an already acknowledged write. While the newer
authoritative revision is pending, update the retained fields as the author
types and keep the autosave hold. Editing against that old base is not yet
reconciliation.

Capture input before observing the new revision: React may batch typing and a
query delivery into the same commit. Marking the read settled first would drop
the updated retention before the reseed can apply it.

An ambiguous ordinary write invalidates the existing save owner's baseline
confirmation, even if undo returns to the previous payload. Keep that uncertainty
until a confirmed write or a newer authoritative read re-establishes the baseline;
manual Save remains possible. Uncertainty alone does not trigger a retry of an
undo; the existing explicit-edit and queued-edit retry behavior remains intact.
When only the revision changes, prime the confirmed baseline without cancelling
an already armed edit debounce. A late failure from an older CAS request cannot
invalidate an already confirmed newer baseline or block outcome commands again.
Until an overlaid conflict is explicitly reconciled, uncertain-write retention
continues tracking later input across metadata-only reads. A newer read whose
payload exactly matches the current draft clears retention, so later remote
changes are not overwritten by input that is already confirmed.
A matching read must also be at least the version already accepted by the draft
owner; a late older query cannot release the hold. Ignoring an obsolete write
failure ends that transport's saving status while preserving a newer edit's
pending status and debounce.
The existing conflict owner also observes uncertain ordinary writes. Its retained
field set includes changes from both the confirmed base and the dispatched
payload, so undo remains authored input. Preserve those field names across a
later conflicting attempt, refresh their values from current input, and clear
the retention on a confirmed save. This covers a newer read both directly after
the lost response and after a subsequent Save conflict without replaying stale
unrelated fields or creating a second write coordinator.

Verify through the real editor and cards with controlled write responses:
pending before ACK, accepted nullable rows, newer input during an old response,
failed writes, lost ACK with exact retry, conflict/refetch ordering and activation
cancellation. Keep transport deletion-intent/retained-row checks in the existing
write adapter and slides save path. Task 5.1 stays open until those paths pass.
