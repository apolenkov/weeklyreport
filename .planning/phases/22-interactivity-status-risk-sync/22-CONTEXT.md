# Phase 22: Interactivity & Status-Risk Sync - Context

**Gathered:** 2026-04-25
**Status:** Ready for planning
**Mode:** Auto-generated for autonomous flow

<domain>
## Phase Boundary

All onClick handlers and form mutations call the real API. Stage status changes auto-create risk entries (additive direction). Form autosave persists drafts. This is the largest phase — 14 requirements, ~72 buttons, ~10 TODO(Phase 22) markers from Phase 21.

**Key deliverables:**
1. Submit, Publish & Lock, Revoke, Fill From, Version Restore mutations wired
2. Autosave drafts with debounced mutation (3-5 sec)
3. Dirty state tracking + browser warning on navigation
4. Real cursor pagination (archive list, version history)
5. Period Navigator URL-driven via useQuery
6. Admin CRUD (users, products, stages, periods, settings) — full mutations
7. Status→Risk auto-add empty risk row when stage set to At Risk/Blocked
8. Risk→Stage update suggestion (with user confirmation, NOT automatic)
9. SyncSource flag prevents infinite loops

</domain>

<decisions>
## Implementation Decisions

### Mutation Wiring Pattern
- Use `useMutation(trpc.xxx.xxx.mutationOptions({ onSuccess, onError }))`
- onSuccess → call cache invalidation helper from cache-keys.ts (Phase 21 framework)
- onError → toast.error(error.message)
- Optimistic updates only for autosave (lower risk of conflicts); destructive mutations (publish, revoke) wait for server

### Autosave
- Debounce 3000ms via `useDebouncedCallback` (sonner already includes lodash.debounce)
- Trigger on every form field change
- Use `leadForm.upsertSection` mutation (or specific item/risk/decision mutations if separate)
- Show "Saved at HH:MM" indicator after successful save
- Show "Saving..." during request

### Status→Risk Sync (additive direction — SAFE)
- Component-level state ref: `syncSourceRef = useRef<'user' | 'auto-sync'>('user')`
- onClick stage chip → set status → if At Risk/Blocked: append empty risk row with required fields highlighted
- Empty risk row CANNOT be saved without filling required fields (form validation)
- Toast hint: "Please describe the risk before saving"

### Risk→Stage Sync (with confirmation — research recommends manual)
- onChange of risk severity → show modal/toast: "Update stage to At Risk?" [Confirm/Skip]
- User must explicitly confirm
- syncSource='auto-sync' during the update to skip the inverse trigger

### Pagination
- Use TanStack Query `useInfiniteQuery` with cursor-based pagination
- "Load more" button at bottom of list
- API already supports cursor pagination per Phase 21 research

### Dirty State / Navigation Warning
- Track via React state (form values vs initial values)
- Use Next.js `useRouter` + `beforeunload` event listener
- Browser native confirm dialog

### Claude's Discretion
- Exact debounce timing (3-5s, default to 3s)
- Toast variant choices (success/info/warning)
- Loading indicator placement

</decisions>

<code_context>
## Existing Code Insights

### From Phase 21 — Framework Ready
- TRPCProvider mounted, useTRPC() hook works in any component
- Cache-keys helpers: invalidateDashboard, invalidateLeadForm, invalidateAdmin, invalidateLeadHistory
- Error boundary catches runtime errors → toast
- Sonner Toaster mounted

### TODO(Phase 22) Markers from Phase 21 — 10 placeholders
- lead-form.tsx (8): submit, publish, revoke, fill-from, save draft, restore version, item add/edit/delete, risk add/edit/delete
- weekly-report-page.tsx (2): publish & lock, reopen

### Available tRPC Mutations (from API)
- reports.create / .update / .delete
- leadForm.upsertSection / .submitSection / .revokeSubmission / .fillFrom / .restoreVersion
- period.publish / .reopen
- review.markReady (if exists)
- admin.* (CRUD for users, products, stages, periods, reminders, settings)
- weeklyReport.publish

### Established Patterns
- Mappers Zod ↔ presentation in apps/web/src/lib/mappers/
- Container pattern: useQuery → mapper → mock-shaped props down

### Integration Points
- Lead Form (largest): 8 mutation buttons + autosave
- Admin Panel tabs (5): each has CRUD mutations
- Dashboard: KPIs auto-refresh via cache invalidation
- Weekly Report: Publish & Lock, Reopen

</code_context>

<specifics>
## Specific Ideas

- Use `toast.promise(mutation.mutateAsync(...))` for instant feedback on mutation start
- Optimistic update pattern for autosave: queryClient.setQueryData(...) before mutation, rollback on error
- Status→Risk: when chip becomes At Risk, scroll Risks section into view + focus first empty risk field

</specifics>

<deferred>
## Deferred Ideas

- Real-time collaboration / conflict detection → out of scope (PROJECT.md)
- PDF export trigger (the actual PDF job) → Phase 23
- Auth guards on mutations → Phase 24 (server already validates)
- Logging on mutations → Phase 25
- Real API E2E tests → Phase 26

</deferred>
