# Lead Surface Audit — Findings and Verdict

**Status:** research memo backing `fix-lead-surface-snapshot-and-fillfrom`.
**Date:** 2026-06-10.
**Method:** 7-agent workflow `lead-surface-audit` (6 parallel read-only
investigators + opus synthesis), 305 tool calls; every claim carries
file:line evidence. Run `wf_329bfee1-bdc`.

## Confirmed bugs (verdict)

### "Back to current" reopens the Add Item modal

- **Effort:** trivial · **Confidence:** high
- **Root cause:** In current-week-section.tsx:171 and next-week-section.tsx:117 the addSignal effect lists `readOnly` in its dep array. Clicking "Back to current" sets viewedSnapshotVersion=null (lead-form.tsx:1631), flipping isReadOnly true→false (lead-form.tsx:1148), which re-runs the effect. currentWeekAddSignal is a monotonic counter, only ever incremented (lead-form.tsx:650/1695), never reset — so after any prior "+ Add Item" click the `addSignal===0` guard passes and the dialog opens. Verified: both effects have the body guard `if (readOnly || !defaultProductId) return` already, so readOnly need not be reactive.
- **Fix:** Remove `readOnly` from both dependency arrays: current-week-section.tsx:171 and next-week-section.tsx:117 become `}, [addSignal, defaultProductId]);`. The in-body guard already covers the read-only case. Optionally reset both add-signal counters to 0 when entering snapshot mode as belt-and-suspenders.

### Show-archived toggle is a no-op for leads with no archived periods

- **Effort:** trivial · **Confidence:** high
- **Root cause:** ArchiveToggle is rendered unconditionally in lead-form.tsx:1562-1572 (no hasArchivedPeriods guard — verified). When hasArchivedPeriods is false the visiblePeriods ternary (lead-form.tsx:1137-1144) short-circuits and returns all periods regardless of the toggle, so clicking it changes nothing visible. Seed data creates archived periods for seeded leads (seed-simple.ts:1777-1790), so the toggle works for those accounts but is dead for fresh users.
- **Fix:** Wrap the archiveToggle slot in lead-form.tsx so it only renders when hasArchivedPeriods is true: `archiveToggle={hasArchivedPeriods ? (<>…</>) : undefined}`. This removes the no-op control entirely when there is nothing to toggle.

### My History Summary mixes draft and submitted populations

- **Effort:** small · **Confidence:** high
- **Root cause:** lead-history-sidebar.tsx computes Submissions from the isCompletedWeek filter (line 45) but Total risks (line 53), Avg items/week (lines 54-57), and traffic-light totals (lines 47-52) reduce over the full `entries` array including the current draft (verified). myHistory returns all sections with no status filter (trpc.router.ts:319) and page.tsx only strips archived, not drafts — so a draft's risks/items silently inflate the aggregates while the Submissions count excludes it.
- **Fix:** In lead-history-sidebar.tsx add `const submittedEntries = entries.filter(isCompletedWeek)` and base totalRisks, avgItems (sum and divisor), and traffic-light totals on it. Keep Submissions as `submittedEntries.length/entries.length`. Purely client-side; no API change. Optional muted "N draft not included" note.

### Fill From dropdown is clipped by the toolbar's overflow-x-auto

- **Effort:** small · **Confidence:** high
- **Root cause:** The dropdown panel is position:absolute top-full (fill-from-button.tsx:142) inside ReportToolbar's outer div which carries `overflow-x-auto` (report-toolbar.tsx:17 — verified). Per CSS spec a non-visible overflow-x forces overflow-y to a clip value, so the downward-opening panel is clipped at the toolbar's bottom edge. Same overflow-clip class fixed earlier in 22790a3d on the inner wrapper; the enclosing toolbar was missed. The confirmation modal already escapes via createPortal (lines 206-246); the dropdown does not.
- **Fix:** Portal the showDropdown panel to document.body via createPortal, positioned from buttonRef.getBoundingClientRect() with a scroll+resize listener — mirror the existing portal at fill-from-button.tsx:206-246 and the stage-chip.tsx:84-98 rect pattern. Optional defensive follow-up: change report-toolbar.tsx:17 overflow-x-auto → overflow-x-clip.

### Fill From: first-row hover gives no feedback

- **Effort:** trivial · **Confidence:** high
- **Root cause:** The first row (idx===0) sets background via an inline `style` prop (fill-from-button.tsx:170-180) while hover is the Tailwind class `hover:bg-[var(--color-surface-hover)]` (line 169). Inline style (specificity 1-0-0) beats the class (0-1-1), so hovering the highlighted top row produces no visual change. Verified.
- **Fix:** Move the first-row highlight to className tokens so hover wins: idx===0 → `bg-[var(--color-success)] border border-[var(--color-starbucks-accent)] hover:brightness-95`; others → `bg-[var(--color-background)] border border-transparent hover:bg-[var(--color-surface-hover)]`. Drop the inline style. Uses existing tokens only.

### Fill From: dead search input in the empty state

- **Effort:** trivial · **Confidence:** high
- **Root cause:** When pastPeriods.length===0 the panel shows "No submitted past reports found" (fill-from-button.tsx:156-159) but the search input at line 143 still renders above it — a searchable empty list with nothing to filter. Verified.
- **Fix:** Guard the search input: `{pastPeriods.length > 0 && (<input … />)}` at fill-from-button.tsx:143 so the empty state shows only the message.

### Fill From: search icon is a hardcoded non-token data-URI

- **Effort:** trivial · **Confidence:** high
- **Root cause:** The search icon is an inline percent-encoded data-URI background with hardcoded `stroke='%23999'` (fill-from-button.tsx:149-153 — verified). The literal #999 ignores --color-muted-foreground and any future theme layer, and violates the tokens-only convention.
- **Fix:** Replace the data-URI background with a sibling <SearchIcon> SVG (same pattern as the file's CopyIcon/ChevronDown), absolutely positioned with `text-[var(--color-muted-foreground)] pointer-events-none`; the input already has pl-8. Remove the three inline style props.

## Design calls (ALL approved by the user 2026-06-10)

### Product-card left stripe vs dashed chip semantic mismatch

The stripe reads DB trafficLight directly (lead-form.ts:391 — verified), recomputed only on chip interaction, so it can show green while an own stage sits empty/dashed. Recommend Option 3: keep trafficLight as the authoritative color but render the stripe DASHED while any own stage is unfilled — compute `hasUnfilledOwnStage = product.stages.some(s => s.ownership==='mine' && s.status==='empty')` in sdlc-pipeline.tsx and add `borderLeftStyle: dashed` to getProductCardStyle. Reuses the existing dashed=plans-not-confirmed idiom, stays frontend-only, no token/palette change, preserves the head/slides signal. Option 2 (make the stripe a live worst-of-own-stages aggregate) is the alternative but ripples into dashboard/slides which also read trafficLight — heavier and riskier.

### Archived-period count badge + combo visual distinction

Optional enhancements beyond the no-op fix: an `archivedCount` badge on ArchiveToggle and an "[Archived]" prefix/optgroup in PeriodNavigator so the user can tell the toggle did something. English UI strings, existing tokens. Defer unless the team wants the polish — the core bug is the no-op toggle, fixed by the render guard. Flag for sign-off only because it adds new visible UI copy.

### Fill From "Previous" badge background matches its row

The badge bg (--color-success) equals the first-row bg (--color-success), so it floats with no separation (fill-from-button.tsx:173 vs 193 — verified). Recommend `bg-[var(--color-starbucks-accent)] text-white` to match the pill vocabulary used elsewhere. Token-only, no red introduced. Minor visual choice — bundle it but get a nod since it changes an existing visual.

## Sweep notes

- report-toolbar.tsx:17 — overflow-x-auto on the toolbar wrapper is the clip container behind the Fill From dropdown bug; switching to overflow-x-clip is a safe defensive follow-up.
- fill-from-button.tsx:142 — only the dropdown panel skips createPortal; the confirmation modal (lines 206-246) already portals correctly — make them consistent.
- No real instances of the other 4 ghost-trigger patterns: form buttons all have type="button" (lead-form.tsx 1460-1835); fixed-position modals have no transform/filter ancestor and aren't trapped by overflow-x; stage-chip/fill-from outside-click checks both refs, no unmount race; the addSignal/showArchivePeriods effects are intentional counter/navigation signals — only the readOnly dep on the add-signal effect is the confirmed bug.
- lead-form.tsx:1577 — FillFromButton receives the full unfiltered `periods` (not visiblePeriods), so Fill From ignores the archive toggle state; low-priority consistency item, separate from the confirmed fixes.
- trpc.router.ts:319 myHistory has no status filter by design — drafts are correctly returned for the Submissions denominator and list cards; the history-summary fix is purely client-side aggregation, no API change.

## Proposed scope (judge)

Name suggestion: fix-lead-surface-snapshot-and-fillfrom. Bundle the seven confirmed, evidence-backed bugs on the lead report surface into one OpenSpec change: (1) drop the `readOnly` dep so \"Back to current\" no longer reopens the Add Item modal; (2) render the archive toggle only when archived periods exist; (3) base the History Summary risk/avg/traffic-light aggregates on submitted-only entries; (4) portal the Fill From dropdown out of the overflow-x-auto toolbar; plus the three small Fill From UX fixes (first-row hover via tokens, empty-state search guard, tokenized search icon). All fixes are frontend-only, use existing CSS tokens, introduce no red, and keep UI strings English — so they need no separate sign-off and ship together. Hold the three design calls (stripe dashed-semantics, archived count badge/combo hints, Previous-badge recolor) for explicit user sign-off and track them as a follow-up change once a direction is chosen, since they alter what a visual signal means or add new visible copy.

## Raw investigator findings

### backToCurrent

**Summary:** The "Back to current" button opens the "Add Item" modal when the user has previously clicked "+ Add Item" at least once in the same session. The bug is in the `useEffect` dependency arrays in `CurrentWeekSection` and `NextWeekSection`.

**Root cause:** Both `CurrentWeekSection` (`apps/web/src/components/lead/current-week-section.tsx`, line 171) and `NextWeekSection` (`apps/web/src/components/lead/next-week-section.tsx`, line 117) have `readOnly` in the dependency array of the `addSignal` effect. When the user clicks "Back to current", `setViewedSnapshotVersion(null)` fires in `lead-form.tsx` line 1631, which causes `isReadOnly` (line 1148: `data.readOnly || isSubmitted || isViewingSnapshot`) to flip from `true` to `false`. This prop change is passed as `readOnly={isReadOnly}` to the section components (lines 1711, 1755). React runs the effect because `readOnly` is listed as a dependency. The effect body checks `if (addSignal === 0) return` — but `currentWeekAddSignal` in `lead-form.tsx` is a monotonic counter (line 650, incremented only at line 1695, never reset). Any prior "+ Add Item" click (even if the dialog was immediately cancelled) leaves the signal at a non-zero value. So when the effect fires due to the `readOnly: true→false` transition, `addSignal > 0` and `readOnly = false` both pass, and `setDialogState({ open: true, mode: "create", ... })` is called, opening the modal. There are no effects in `lead-form.tsx` that react to `viewedSnapshotVersion` changing, no keyboard shortcut handlers involved, no focus-restoration path, and no ghost-click mechanism — the cause is purely the stale `addSignal > 0` combined with `readOnly` being an unnecessary effect dependency.

**Evidence:**

- `apps/web/src/components/lead/current-week-section.tsx` line 162–171: `useEffect` with dependency array `[addSignal, defaultProductId, readOnly]` — `readOnly` is listed as a dep, so flipping it re-runs the effect
- `apps/web/src/components/lead/next-week-section.tsx` line 108–117: identical pattern and identical dependency array `[addSignal, defaultProductId, readOnly]`
- `apps/web/src/components/lead/lead-form.tsx` line 1147–1148: `const isViewingSnapshot = viewedSnapshotVersion !== null; const isReadOnly = data.readOnly || isSubmitted || isViewingSnapshot;` — clicking 'Back to current' sets `viewedSnapshotVersion` to null, which flips `isReadOnly` from true to false
- `apps/web/src/components/lead/lead-form.tsx` line 1631: `onClick={() => setViewedSnapshotVersion(null)}` — the 'Back to current' button
- `apps/web/src/components/lead/lead-form.tsx` line 650 + 1695: `const [currentWeekAddSignal, setCurrentWeekAddSignal] = useState(0)` / `setCurrentWeekAddSignal((value) => value + 1)` — signal is only ever incremented, never reset; `setCurrentWeekAddSignal` has exactly 3 occurrences, none reset to 0
- `apps/web/src/components/lead/lead-form.tsx` line 1690–1706 + 1711: the '+ Add Item' header button is gated by `!isReadOnly` so it is not rendered in snapshot mode, but the signal value it previously set persists in state
- No effects in `lead-form.tsx` react to `viewedSnapshotVersion` directly — all 10 `useEffect` calls react to query errors, URL redirects, document title, or server-data seeding

**Fix plan:**

- **`apps/web/src/components/lead/current-week-section.tsx`, line 171** — remove `readOnly` from the dependency array. Change `}, [addSignal, defaultProductId, readOnly]);` to `}, [addSignal, defaultProductId]);`. The `if (readOnly || !defaultProductId) return;` guard inside the body already prevents the effect from opening the dialog when read-only; it does not need to be a reactive dependency. The effect's sole purpose is to react to `addSignal` increments.
- **`apps/web/src/components/lead/next-week-section.tsx`, line 117** — identical change: remove `readOnly` from `}, [addSignal, defaultProductId, readOnly]);` → `}, [addSignal, defaultProductId]);`. Same reasoning — the guard inside the body is sufficient.
- **Optional hardening (not required for the fix):** in `lead-form.tsx`, reset `currentWeekAddSignal` and `nextWeekAddSignal` to 0 when `viewedSnapshotVersion` becomes non-null (i.e., when entering snapshot mode). This makes the sections behave correctly even if some future refactor adds `readOnly` back to the dep array. It is not required once the dep array is corrected.

**Confidence:** high

### showArchived

**Summary:** The ArchiveToggle wiring in lead-form.tsx is logically correct when archived periods exist, but has two distinct failure modes: (1) the toggle always renders even when hasArchivedPeriods is false — in that case clicking it does nothing visible; (2) even when it works, there is no count badge and no visual distinction for archived entries in the combo, so the user cannot tell anything changed. Seed data DOES create archived periods for all seeded leads, so "broken" and "no data" are both possible depending on which account is used in dev.

**Root cause:** The ArchiveToggle is rendered unconditionally (no hasArchivedPeriods guard). When myHistory returns no archived periods (e.g. fresh dev user not in seeded leads), the visiblePeriods ternary short-circuits via !hasArchivedPeriods and always returns the full periods array — the toggle state is read by the ternary but the result is identical whether checked=true or false. Even when archived data does exist, the combo shows no visual distinction between normal and archived entries, and the toggle shows no count, so the user cannot tell the toggle did anything.

**Evidence:**

- /home/user/work/customreport/apps/web/src/components/lead/lead-form.tsx:710 — showArchivePeriods state starts false
- /home/user/work/customreport/apps/web/src/components/lead/lead-form.tsx:1133-1144 — visiblePeriods ternary: when !hasArchivedPeriods (line 1138), it returns all periods regardless of showArchivePeriods — toggle has zero effect
- /home/user/work/customreport/apps/web/src/components/lead/lead-form.tsx:1562-1572 — ArchiveToggle rendered unconditionally, no hasArchivedPeriods guard
- /home/user/work/customreport/apps/web/src/components/lead/lead-form.tsx:347 — historyQ uses reports.myHistory with NO includeArchive param (myHistory returns everything)
- /home/user/work/customreport/apps/api/src/infrastructure/trpc/trpc.router.ts:319-413 — reports.myHistory has no archived filter; returns ALL sections for the user, including those on archived reports
- /home/user/work/customreport/apps/api/src/infrastructure/trpc/trpc.router.ts:394 — archived field is included in the returned entry shape
- /home/user/work/customreport/apps/web/src/lib/mappers/lead-form.ts:530-543 — mapLeadPeriods maps all history entries, preserves archived: e.archived ?? false
- /home/user/work/customreport/apps/web/src/components/report-shell/archive-toggle.tsx:26 — 'Show archived' text is hidden below xl breakpoint (xl:inline), button looks icon-only on most screens
- /home/user/work/customreport/prisma/seed-simple.ts:1777-1790 — seed DOES create archived sections for all seeded leads (4 published archived reports × N leads)

**Fix plan:**

- MINIMAL BUG FIX — lead-form.tsx lines 1562-1572: wrap the ArchiveToggle slot in a hasArchivedPeriods condition so it only renders (and is only clickable) when archived periods actually exist for this lead. Change: `archiveToggle={hasArchivedPeriods ? (<><Separator ... /><ArchiveToggle checked={showArchivePeriods} onChange={setShowArchivePeriods} /></>) : undefined}`. This prevents the toggle from appearing as a no-op for fresh users.
- COUNT BADGE enhancement — archive-toggle.tsx: add an optional archivedCount prop to ArchiveToggle. When non-zero, render a small count span beside the archive icon (e.g. `3 archived`). Caller (lead-form.tsx) computes archivedCount = periods.filter(p => p.archived).length and passes it in.
- COMBO VISUAL HINT enhancement — period-navigator.tsx: in the periodOptions map, prefix archived entries with a visual cue, e.g. label: p.archived ? `[Archived] ${p.dateRange}` : .... Alternatively add an optgroup element to split the select into 'Active' and 'Archived' groups when both exist.
- PREV/NEXT ARROWS: no extra work needed — arrows already navigate by index within visiblePeriods. When toggle is ON, all periods (including archived) are in visiblePeriods so the arrows traverse them. When toggle is OFF, archived are removed so arrows skip them. This is correct.
- FillFromButton inconsistency (minor, separate): it receives the full unfiltered periods (line 1578) including archived entries even when toggle is OFF. For consistency, pass visiblePeriods instead of periods so the Fill From dropdown respects the toggle state — but this is a separate low-priority change.

**Confidence:** high

### historySummary

**Summary:** The "MY HISTORY SUMMARY" card mixes two incompatible populations: Submissions counts only submitted/published/archived periods, but Total risks and Avg items/week silently include the draft. This makes the numbers internally inconsistent.

**Root cause:** LeadHistorySidebar (lead-history-sidebar.tsx:44–57) computes every metric from the same `entries` array, but applies the isCompletedWeek filter only for the Submissions and On-time rate numerator. The `totalRisks` reduce (line 53) and `avgItems` reduce/divide (lines 55–57) iterate over all entries — including any draft — without filtering. The API query (trpc.router.ts:319) returns ALL ReportSection rows for the user with no status filter, so drafts always come back. The page (reports/page.tsx:108–112) only strips archived entries when the Archive toggle is off; non-archived drafts stay in the array that is passed to the sidebar.

**Evidence:**

- /home/user/work/customreport/apps/api/src/infrastructure/trpc/trpc.router.ts:319-413 — myHistory Prisma query has no `where.status` filter; returns every ReportSection row for the user including drafts.
- /home/user/work/customreport/packages/shared/src/schemas/report-primitives.schema.ts:53 — reportSectionStatusSchema = z.enum(['draft','submitted']); section-level status is only these two values.
- /home/user/work/customreport/apps/web/src/app/(app)/reports/page.tsx:108-112 — `entries` passed to sidebar = allEntries filtered by `!entry.archived` (archive toggle off); non-archived drafts are NOT filtered, so all 3 periods (2 submitted + 1 draft) reach the sidebar.
- /home/user/work/customreport/apps/web/src/components/lead/lead-history-sidebar.tsx:19-26 — COMPLETED_WEEK_STATUSES = {submitted, published, archived}; isCompletedWeek used only for `submitted` count and streak.
- /home/user/work/customreport/apps/web/src/components/lead/lead-history-sidebar.tsx:44-45 — total=entries.length=3; submitted=entries.filter(isCompletedWeek).length=2; draft excluded from numerator only.
- /home/user/work/customreport/apps/web/src/components/lead/lead-history-sidebar.tsx:53 — totalRisks = entries.reduce((acc,e)=>acc+e.riskCount,0); iterates ALL 3 entries; draft's riskCount=2 included.
- /home/user/work/customreport/apps/web/src/components/lead/lead-history-sidebar.tsx:54-57 — avgItems divides sum by `total` (=3, includes draft); draft's itemCount pulled into denominator.
- /home/user/work/customreport/apps/web/src/components/lead/lead-history-sidebar.tsx:109 — footer reads 'across {total} periods' where total=3, consistent with all entries including draft.
- /home/user/work/customreport/apps/api/src/infrastructure/trpc/trpc.router.ts:400-402 — riskCount=s.risks.length; this is a DB count of Risk rows regardless of sectionStatus; draft's 2 risks are counted.

**Fix plan:**

- DEFINE A CONSISTENT POPULATION: add a helper in lead-history-sidebar.tsx above the component — `const submittedEntries = entries.filter(isCompletedWeek)` — and use it as the base for ALL aggregated metrics (totalRisks, avgItems, trafficLight totals, streak). Submissions stays `${submittedEntries.length}/${entries.length}` so the denominator still shows the full scope.
- TOTAL RISKS: change line 53 from `entries.reduce(...)` to `submittedEntries.reduce(...)`. This makes it consistent with the Submissions numerator.
- AVG ITEMS / WEEK: change the reduce and divider (lines 55-57) to use `submittedEntries` for both the sum and the divisor (`submittedEntries.length`). A draft's itemCount is noise before submission.
- TRAFFIC LIGHT TOTALS: change lines 47-52 to iterate `submittedEntries` instead of `entries` for the same reason — the footer's '… across N periods' already uses `total` (all entries) as context.
- DRAFT CALL-OUT (optional but recommended): after the StatGrid, when `entries.length > submittedEntries.length`, render a small muted note — e.g. `{entries.length - submittedEntries.length} draft not included` — so the user sees why the counts exclude that period. This is purely additive HTML in lead-history-sidebar.tsx, no new prop needed.
- ARCHIVE TOGGLE RECOMPUTE: the current setup already recomputes when the toggle changes (page.tsx:108-112 rebuilds `entries`), so no extra wiring is needed — the fix in the sidebar covers both states automatically.
- NO API CHANGE NEEDED: the query correctly returns all sections including drafts (the full set is needed for Submissions denominator and for the list cards). The fix is purely in the client-side aggregation inside lead-history-sidebar.tsx.

**Confidence:** high

### stripeSemantics

**Summary:** The left stripe on each product card reads `product.overallStatus`, which is a direct mapping of the DB `trafficLight` field (set per project per lead-section). Today that field is recomputed to the worst-of-own-stages only on chip interaction (handleProductsChange), but a freshly loaded or never-touched section shows whatever the DB stored — which can be null/green even when own stages are unfilled (empty). A dashed chip means `ownership === "mine"` and `status === "empty"` (not yet set by this lead). The stripe and the dashed chip are therefore telling different stories when any own stage is empty.

**Root cause:** The stripe color derives from `product.overallStatus` (file: `apps/web/src/components/lead/sdlc-pipeline.tsx:186`), which is set at `apps/web/src/lib/mappers/lead-form.ts:391` as `trafficToStageStatus(p.trafficLight)` — a direct read of the DB `trafficLight` column for that project-section row, NOT a live aggregation of stage chips. `trafficLight` is only updated in the draft state when `handleProductsChange` fires (lead-form.tsx:1227: `trafficLight: aggregateTrafficLight(ownedStages)`), which aggregates only `ownership === "mine"` stages. A dashed chip (`stage-chip.tsx:114–116`) is rendered when `stage.status === "empty"` AND `stage.ownership === "mine"`. The stripe and the dashed chip can therefore contradict: the DB can store a previously-set "green" trafficLight while a stage owned by this lead sits unfilled this week.

**Evidence:**

- `apps/web/src/lib/mappers/lead-form.ts:391` — `overallStatus = trafficToStageStatus(p.trafficLight)` reads the DB field directly
- `apps/web/src/components/lead/sdlc-pipeline.tsx:66–80` — `STRIPE_BY_STATUS` maps `StageStatus` to CSS token; `getProductCardStyle(product.overallStatus)` applies it as a 4px `borderLeft`
- `apps/web/src/components/lead/stage-chip.tsx:114–116` — `borderStyle` uses `1.5px dashed var(--color-starbucks-accent)` when `isEmpty` (= `stage.status === 'empty' && isEditable`)
- `apps/web/src/components/lead/lead-form.tsx:1202–1231` — `handleProductsChange` re-aggregates `trafficLight` from own stages only on user interaction; on initial load the mapper assigns `overallStatus` from DB `trafficLight` at mapper time
- `apps/web/src/components/lead/mock-data.ts:354–400` — mock 'AI/ML Platform' has `overallStatus: 'on-track'` (green stripe) but `Testing` stage has `status: 'empty', ownership: 'mine'` — this is the exact contradiction the user is observing
- `apps/web/src/components/lead/sdlc-pipeline.tsx:217–249` — stage `ownership` drives arrow color and chip editability; `ownership === 'mine'` stages belong to the currently-logged-in lead
- `apps/web/src/lib/mappers/lead-form.ts:389–407` — `mapLeadProducts` assigns `overallStatus` from `p.trafficLight`; `buildStageGrid` marks stages as 'mine' only for the section's `ownedStages`
- `apps/web/src/components/lead/lead-form.tsx:271–290` — `aggregateTrafficLight` treats `null` as no contribution (severity stays 0); an empty own-stage therefore does NOT bump the aggregate to any warning signal

**Fix plan:**

- **What the stripe means today:** the DB `trafficLight` for this lead's section on this product — a manual traffic-light that aggregates only own stages and only after a chip interaction. It is NOT a whole-product traffic light (other leads' stages are excluded). It is NOT reactive until the lead touches a chip.
- **What a dashed chip means:** `stage.status === 'empty'` and `stage.ownership === 'mine'` — the lead has not yet set a status for a stage they own. (stage-chip.tsx:106, 114–116)
- **Which stages belong to this lead:** `buildStageGrid` (lead-form.ts:304–371) marks a stage `ownership: 'mine'` only when its `stageName` appears in `p.ownedStages` for the section author. Other leads' stages are `ownership: 'locked'` (enriched via crossAuthorsQ). Truly unassigned ones stay `ownership: 'unassigned'`.
- **Option 1 — keep stripe = manual trafficLight, add badge:** stripe unchanged; add a small `N unfilled` badge (e.g. '2 of my stages unset') inside the product card header. Low friction, no semantic change. Weakness: two competing signals in the same surface — the user still has to reconcile them mentally.
- **Option 2 — stripe = worst-of-own-stages (unfilled counts as no signal):** change `overallStatus` in `mapLeadProducts` to call `aggregateTrafficLight(ownedStages.map(s => ({ status: s.status ?? null })))` at mapper time, never read DB `trafficLight` for the stripe. An unfilled own stage contributes nothing (severity stays 0), so a fully-unfilled product shows the neutral `empty` stripe. This is always live and removes the staleness problem. Weakness: the head has always used `trafficLight` as the authoritative signal in the dashboard/slides; changing what drives the DB field's recompute would need to be traced there too.
- **Option 3 — keep trafficLight COLOR, dashed stripe while any own stage is unfilled:** compute `hasUnfilledOwnStage = product.stages.some(s => s.ownership === 'mine' && s.status === 'empty')` in `SdlcPipeline` (sdlc-pipeline.tsx); change `getProductCardStyle` to accept a `dashed` flag and conditionally emit `border-left-style: dashed` while keeping the color token. This rhymes with the stage-chip dashed idiom already in place.
- **Recommendation: Option 3.** Rationale: (a) it keeps `trafficLight` as the authoritative signal for the head/slides/dashboard — no cross-cutting change needed; (b) it communicates 'I have a plan, I haven't filed all the chips yet' without overriding a deliberate signal the lead may have set; (c) it uses an idiom already established (dashed = plans-not-confirmed) rather than inventing a badge; (d) it respects status-color-semantics spec (colors from tokens, no new literals). It also stays fully frontend — zero backend change.
- **Implementation sketch for Option 3:** In `sdlc-pipeline.tsx`, update `getProductCardStyle` signature to `(status: StageStatus, dashed: boolean): CSSProperties` and add `borderLeftStyle: dashed ? 'dashed' : 'solid'` to the returned object. In the render loop (line 186), compute `const hasDashedStripe = !readOnly && product.stages.some(s => s.ownership === 'mine' && s.status === 'empty')` and pass it to `getProductCardStyle(product.overallStatus, hasDashedStripe)`. No changes needed in `lead-form.ts`, `stage-chip-config.ts`, or any other file.

**Confidence:** high

### triggerSweep

**Summary:** One real sibling bug confirmed (Pattern 1). Four additional ghost-trigger patterns examined; none others confirmed as real bugs in the current code.

**Root cause:** FillFromButton's absolute-positioned dropdown div (fill-from-button.tsx:142) renders inside ReportToolbar (report-toolbar.tsx:17), which carries `overflow-x-auto`. When `overflow-x` is set to any value other than `visible`, browsers coerce `overflow-y` to `auto`/`clip` as well, so the dropdown that opens downward (`top-full`) is clipped at the toolbar's bottom edge. This is the same overflow-containing-block bug class that was fixed in commit 22790a3d for the immediate parent wrapper — but the fix only removed `overflow-hidden` from the inner `wrapRef` div; the outer `overflow-x-auto` toolbar that also encloses the button was not addressed.

**Evidence:**

- apps/web/src/components/report-shell/report-toolbar.tsx:17 — `overflow-x-auto` on the toolbar wrapper div. CSS spec: when overflow-x is non-visible, overflow-y is forced to non-visible too, creating a clip container for absolutely-positioned descendants.
- apps/web/src/components/lead/fill-from-button.tsx:142 — `<div className="absolute right-0 top-full z-50 mt-1 w-[340px]…">` — the dropdown is positioned absolutely relative to `wrapRef` (line 113: `relative inline-flex`), which sits inside the ReportToolbar.
- apps/web/src/components/lead/fill-from-button.tsx:109-111 — Comment documents the inner fix: 'No overflow-hidden here: the dropdown renders inside this wrapper, and clipping it made the chevron look dead (bug 2026-06-10).' The outer toolbar clip was not addressed.
- apps/web/src/components/lead/lead-form.tsx:1560+1576 — ReportToolbar is rendered at line 1560; FillFromButton is passed as part of `trailingExtras` at line 1576, placing it inside the overflow-x-auto container.
- apps/web/src/components/lead/fill-from-button.tsx:204-246 — The confirmation modal correctly uses createPortal to document.body (escapes clip), but the showDropdown div at line 141 does NOT use a portal.
- Pattern 2 (buttons without type in forms): All buttons inside lead-form.tsx <form> (lines 1460-1835) have explicit type="button". periods-tab-dialog wraps inputs in <div>, not <form>. No real instances.
- Pattern 3 (modals without portal in transform ancestors): ConfirmationDialog, version-history-nav modal, and all admin tab modals use position:fixed. No CSS transform/filter ancestors found in their render chains — overflow-x-auto does NOT trap fixed-positioned elements, only absolutely-positioned ones.
- Pattern 4 (mousedown racing unmount): stage-chip.tsx:69-80 — both dropdownRef and portalRef are checked; portalRef.current is set before the mousedown listener attaches (showPopover-gated useEffect runs after React commits the portal ref). fill-from-button.tsx:72-75 — dropdown items are inside wrapRef, so contains() returns true. No real race.
- Pattern 5 (useEffect opening dialogs on prop): lead-form.tsx:716-721 setShowArchivePeriods on selectedHistoryPeriod.archived — intentional navigation feedback. addSignal pattern in current-week-section, next-week-section, risks-section, decisions-section — explicit counter signal, not a spurious prop transition.

**Fix plan:**

- apps/web/src/components/lead/fill-from-button.tsx — Portal the showDropdown div to document.body, exactly as the showConfirm dialog already does (lines 206-246). Compute position via buttonRef.getBoundingClientRect() (same pattern as stage-chip.tsx:84-98) and store it in state. Replace the inline `{showDropdown && <div className="absolute right-0 top-full…">}` block with a createPortal call that renders a fixed-positioned div using the stored coordinates. Attach a scroll+resize listener (same as stage-chip) to keep the dropdown anchored if the toolbar scrolls.
- apps/web/src/components/lead/fill-from-button.tsx — Update the comment at lines 109-111 to document that the remaining clip risk is the ReportToolbar overflow-x-auto, now resolved by the portal.
- apps/web/src/components/report-shell/report-toolbar.tsx:17 — Optional defensive change: replace `overflow-x-auto` with `overflow-x-clip` to preserve the horizontal scroll containment while being explicit that it does not create a scroll container. This is a safe follow-up but not required once the dropdown is portaled.

**Confidence:** high

### fillUx

**Summary:** Four concrete UX defects found in fill-from-button.tsx. The most critical is a clipping hazard from the parent toolbar's overflow-x-auto. Three additional issues: the empty-state renders the search field uselessly; first-row hover state is broken by inline style conflict; and the search icon is a hardcoded data-URI that resists theming.

**Root cause:** The dropdown panel (position: absolute, z-50) lives inside ReportToolbar's outer div which has `overflow-x-auto` (report-toolbar.tsx:17). Any overflow value other than `visible` clips absolutely positioned descendants that extend outside the container's bounds — the 340px panel overflows downward past the toolbar box and gets clipped on browsers that enforce the spec strictly. The `right-0` anchor places the panel flush with the right edge of the split-button wrapper, which is itself near the right end of the toolbar; on viewports narrower than ~400px the panel can also overflow the right edge of the page.

**Evidence:**

- /home/user/work/customreport/apps/web/src/components/report-shell/report-toolbar.tsx:17 — outer div carries `overflow-x-auto`; this clips any absolutely-positioned child whose bottom edge extends past the container's scroll boundary
- /home/user/work/customreport/apps/web/src/components/lead/fill-from-button.tsx:142 — dropdown panel: `absolute right-0 top-full z-50 mt-1 w-[340px]`; z-50 is sufficient in isolation but overflow-x-auto on the ancestor creates a scroll container that clips the panel before z-index is evaluated
- /home/user/work/customreport/apps/web/src/components/lead/fill-from-button.tsx:156-163 — empty states: `pastPeriods.length === 0` branch shows 'No submitted past reports found' correctly, but the search input at :143 still renders above it, so the user sees a searchable empty list — the input adds noise with nothing to filter
- /home/user/work/customreport/apps/web/src/components/lead/fill-from-button.tsx:165-198 — first row (idx === 0) gets `style={{ background: 'var(--color-success)', border: '1.5px solid var(--color-starbucks-accent)' }}` via inline style, plus Tailwind `hover:bg-[var(--color-surface-hover)]` via className; Tailwind's hover rule (specificity 0-1-1) cannot override the inline style (specificity 1-0-0), so hovering the top row produces no visual feedback
- /home/user/work/customreport/apps/web/src/components/lead/fill-from-button.tsx:149-153 — search icon embedded as a percent-encoded data URI (`stroke='%23999'`); the hardcoded #999 ignores CSS tokens and will not adapt to `--color-muted-foreground` (rgba(0,0,0,0.54)) or any future dark-mode layer
- /home/user/work/customreport/apps/web/src/app/(app)/lead/report/page.tsx:27-39 — page container: `min-h-screen`, no overflow restriction; the clipping ancestor is exclusively the toolbar div at report-toolbar.tsx:17
- globals.css:38 — `--color-success: #d8ece4` (pale teal); the Previous badge at fill-from-button.tsx:193 sets both bg AND text to --color-success / --color-primary (#006241) — badge bg matches card bg exactly so badge appears to float with no background separation

**Fix plan:**

- DEFECT 1 — clipping (critical). File: /home/user/work/customreport/apps/web/src/components/report-shell/report-toolbar.tsx:17. Change `overflow-x-auto` to `overflow-x-auto overflow-y-visible`. In CSS an element cannot have both overflow-x non-visible and overflow-y visible simultaneously (the spec forces both axes to the same non-visible value if one is auto/scroll/hidden and the other is set to visible). The correct fix is to move the panel out of the scroll container by rendering it via a React portal (createPortal to document.body), identical to how the confirmation dialog already handles this at fill-from-button.tsx:207-246. Compute the button's bounding rect in a useEffect or onClick handler (`wrapRef.current.getBoundingClientRect()`), then position the portal div with `position: fixed; top: <rect.bottom + 4>px; right: <window.innerWidth - rect.right>px`. This also solves the narrow-viewport edge-overflow for free.
- DEFECT 2 — empty state search input noise. File: /home/user/work/customreport/apps/web/src/components/lead/fill-from-button.tsx:143. Wrap the search `<input>` in `{pastPeriods.length > 0 && (...)}` so it only renders when there is something to search. When `pastPeriods.length === 0` the panel can show just the empty message without the dead search box.
- DEFECT 3 — hover feedback broken on first row. File: fill-from-button.tsx:169-179. Replace the inline `style` prop with Tailwind classes so hover specificity wins. Use `className` conditionally: for idx === 0 use `bg-[var(--color-success)] border border-[var(--color-starbucks-accent)] hover:brightness-95`; for others use `bg-[var(--color-background)] border border-transparent hover:bg-[var(--color-surface-hover)]`. `hover:brightness-95` is a filter that works even without changing the background token, keeping the green tint on hover of the highlighted row.
- DEFECT 4 — hardcoded search icon. File: fill-from-button.tsx:149-153. Replace the inline data-URI `backgroundImage` style with a `<SearchIcon>` SVG sibling element (same pattern as `CopyIcon` / `ChevronDown` already defined in the file). Wrap the input in a `relative` div, render the SVG with `absolute left-2.5 top-1/2 -translate-y-1/2 text-[var(--color-muted-foreground)] pointer-events-none`, and adjust the input's left padding (`pl-8` already present). Remove the three `style` props entirely.
- MINOR — Previous badge background. File: fill-from-button.tsx:193. The badge sets `bg-[var(--color-success)]` which is the same pale teal as the row background. Replace with `bg-[var(--color-starbucks-accent)] text-white` to match the pill token language used elsewhere in lead-form.tsx (e.g. the Submitted badge at :1478 uses --color-success bg + --color-starbucks-accent text). A small visual-only change, consistent with existing pill vocabulary.

**Confidence:** high
