## Why

Wave 2 / P2 from the 2026-07-12 repo-excellence review (docs/reviews/repo-excellence-review-2026-07-12.md).

Three web presentation modules type themselves against mock/legacy modules
instead of the real domain model, and each break compiles only by structural
accident:

- `KpiCards` (`apps/web/src/features/dashboard/ui/kpi-cards.tsx`) imports
  `KpiData` from `shared/lib/dashboard-mock-data.ts` instead of the real
  model's own `KpiData` in `features/dashboard/model/dashboard.ts`. The two
  interfaces are identical today, so nothing fails now, but a real-model
  field change would not error here — the component keeps type-checking
  against a copy nobody updates.
- `mapLeadItems` (`apps/web/src/features/report-sections/model/lead-form.ts`)
  returns `LeadKanbanItem[]`, and `LeadKanbanItem` (declared in the same
  file) omits the `pausedReason` field that its structural twin `KanbanItem`
  (`features/report-sections/model/mock-data.ts`) carries. The mapper
  attaches `pausedReason` to the returned object anyway; because the excess
  property lives inside a `.map()` callback rather than a literal assigned
  directly to `LeadKanbanItem[]`, TypeScript's excess-property check never
  fires. `lead-form-loaded-view-model.ts` then re-types the result with
  `data.currentWeekItems as KanbanItem[]` / `as KanbanItem[]` to recover the
  field for downstream consumers. Deleting the `pausedReason:` line from the
  mapper would still type-check clean — the field's presence is invisible to
  the compiler on the producing side.
- Three admin Reminders-tab model files (`reminders-tab-format.ts`,
  `reminders-form-state.ts`, `reminders-tab-mutations.ts`) import
  `MockReminder`/`MockReminderPolicy` from `shared/lib/admin-mock-data.ts`.
  `admin-types.ts` — the module's own documented boundary — already declares
  self-contained `MockReminder`/`MockReminderPolicy` types specifically so
  downstream consumers do not couple to the mock UI module, and the mock
  module's `MockReminderPolicy.kind`/`.audience` fields re-declare the
  `ReminderPolicyKind`/`ReminderAudience` literal unions inline instead of
  reusing the shared enum types that `admin-types.ts` already imports.

This is the same "cast masks real drift" failure class already tracked for
server-side Prisma payload types (`report-section-prisma-payload` spec) —
here on the web presentation-type boundary instead.

## What Changes

- `apps/web/src/features/dashboard/ui/kpi-cards.tsx` and
  `apps/web/src/features/dashboard/ui/kpi-cards.test.tsx`: import `KpiData`
  from `features/dashboard/model/dashboard.ts` instead of
  `shared/lib/dashboard-mock-data.ts`.
- `apps/web/src/features/report-sections/model/lead-form.ts`: add
  `pausedReason?: string | null` to the `LeadKanbanItem` interface so
  `mapLeadItems`'s existing `pausedReason` assignment is checked against the
  declared return type.
- `apps/web/src/features/report-sections/ui/lead-form-loaded-view-model.ts`:
  remove the `as KanbanItem[]` casts on `ownCurrentWeekItems` /
  `ownNextWeekItems` now that `LeadKanbanItem` is structurally assignable to
  `KanbanItem` without help from an assertion.
- `apps/web/src/features/admin/model/reminders-tab-format.ts`,
  `reminders-form-state.ts`, `reminders-tab-mutations.ts`: import
  `MockReminder`/`MockReminderPolicy` from `./admin-types` (relative to
  `reminders-tab-format.ts`/`reminders-tab-mutations.ts`) or
  `../model/admin-types` (from `reminders-form-state.ts`) instead of
  `shared/lib/admin-mock-data.ts`.

## Impact

- `apps/web/src/features/dashboard/ui/{kpi-cards.tsx,kpi-cards.test.tsx}`
- `apps/web/src/features/report-sections/model/lead-form.ts`
- `apps/web/src/features/report-sections/ui/lead-form-loaded-view-model.ts`
- `apps/web/src/features/admin/model/{reminders-tab-format.ts,reminders-form-state.ts,reminders-tab-mutations.ts}`

Non-goals: `shared/lib/dashboard-mock-data.ts` and `shared/lib/admin-mock-data.ts`
themselves are not deleted or deduplicated — they still back other mock/demo
call sites outside this change's scope; only the three misdirected imports
above are repointed. `admin.ts`'s mapper already imports from `admin-types.ts`
and is untouched.
