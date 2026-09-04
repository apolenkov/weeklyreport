# Lead status overview research

Date: 2026-09-03. Source denominator: the three status-related SitePing rows
named in `proposal.md`, their saved screenshots, the owner-provided desktop
reference, current source and durable OpenSpec contracts.

## Findings

- The current lead report renders Product Status, Project Activities, Current
  Week, and Next Week as four separate vertical surfaces. The feedback asks for
  one temporal comparison plane, not four independent cosmetic adjustments.
- The existing `AppSettings.unifiedActivityView` is a workflow-state projection
  governed by ADR 0011. Reusing it for a temporal overview would silently
  change an accepted contract.
- Product and Project Activity are the two current reporting-unit types.
  `Project` is the persisted Product model; inventing Product -> Project ->
  Activity hierarchy would require a separate domain change and migration.
- `Item.carriedOver` is provenance for a subset of current work. It cannot
  represent every item that was planned in the prior week.
- The authoritative `Previously planned` source is `type=next` from the
  immediate prior period's immutable published snapshot. If no snapshot exists,
  only a submitted section is an acceptable fallback; draft data is not an
  agreed plan.
- Existing status derivations remain authoritative: Product health is
  risk-floored from owned stages; Activity status is independent and never
  changes linked Product health.

## Decision

Add a read-first Overview mode while retaining Edit and Slides. Each reporting
unit appears once. Desktop shows three aligned columns; compact viewports use a
contained sequential layout. Collapsed units expose a bounded preview and
expand inline, never in a modal. Historical or no-longer-assigned parents stay
visible under their stored labels so source rows are not lost.

The reference screenshot defines information architecture only. Acceptance is
based on source-count equality, status semantics, access scope, containment,
and keyboard behavior rather than hard-coded fixture counts or pixel copying.

## Inline editing follow-up (2026-09-03)

### Source-bound findings

- `LeadStatusOverview` currently calls only the protected
  `leadForm.statusOverview` query and renders the projected model; it has no
  draft, write port, autosave, or submit state (`apps/web/src/features/report-pages/ui/lead/shell/lead-status-overview.tsx:44-61,111-136`).
- The canonical editor already exposes the complete write seam: one
  `LeadFormWritePort`, generation-bound `draft.apply`, `draft.save`, `draft.submit`,
  version, autosave, readiness, and write actions
  (`apps/web/src/features/report-pages/ui/lead/shell/use-lead-form-editor.ts:82-170`).
- `draft.apply` is guarded by the loaded section generation, while autosave is
  enabled only when the section is not submitted/read-only
  (`apps/web/src/features/report-sections/model/lead-form/use-lead-form-draft-core.ts:84-135`).
  This is the client-side protection that an Overview-specific local form must
  not reimplement.
- The production write adapter owns the tRPC mutations and invalidates the
  canonical lead-form caches after save/submit and lifecycle writes
  (`apps/web/src/features/report-sections/model/lead-form/lead-form-write-port.trpc-adapter.ts:27-107`).
- Server `reports.saveDraft` authorizes the authenticated actor, checks period
  editability, rejects submitted sections, preserves ownership/record
  invariants, and saves with the client-loaded optimistic-lock version
  (`apps/api/src/modules/report-sections/application/report-sections.service.ts:171-211`).
- The Overview query is deliberately read-only and protected; the router passes
  the authenticated identity and role to the service
  (`apps/api/src/infrastructure/trpc/routers/lead-form.router.ts:99-118`).

### Recommendation

Support editing for the **Current** and **Next** columns. Keep Previous as frozen
context. Do not add a second Overview mutation or a second draft store. Refactor
the route shell so Overview and Edit consume one shared editor/controller seam:
the current section is loaded once, compact controls emit the existing
`DraftPatch` variants through `draft.apply`, and the existing autosave, Save,
Submit, conflict reload, readiness, ACL, and lifecycle actions remain the only
write path. The Overview projection may continue to supply historical context,
but it must be joined to the same current draft rather than copied into a new
editable model.

The smallest safe interaction is an `Edit` affordance on each Current or Next
item that opens the existing item editor on the same page (with explicit Edit
navigation for the complete authoring surface) and exposes the same
autosave/read-only states. A separate server
`statusOverview` write endpoint, direct field mutation, or Overview-local
autosave would bypass the checks above and create divergent version/lifecycle
behavior. Add tests proving: Current and Next edits call the canonical
`DraftPatch` seam; Previous never emits writes; submitted/read-only sections
stay inert; and a stale version follows the existing conflict-reload path.
