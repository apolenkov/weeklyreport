## 1. Dashboard KPI cards: point at the real model

- [ ] 1.1 `apps/web/src/features/dashboard/ui/kpi-cards.tsx`: change the
      `KpiData` import from `../../../shared/lib/dashboard-mock-data` to
      `../model/dashboard`
- [ ] 1.2 `apps/web/src/features/dashboard/ui/kpi-cards.test.tsx`: change the
      `KpiData` import the same way, so the test fixture type-checks against
      the same model as the component it exercises

## 2. Lead kanban items: close the `pausedReason` gap and drop the cast

- [ ] 2.1 `apps/web/src/features/report-sections/model/lead-form.ts`: add
      `pausedReason?: string | null` to the `LeadKanbanItem` interface,
      documenting that it mirrors `KanbanItem.pausedReason`
      (`model/mock-data.ts`) so `mapLeadItems`'s existing assignment is
      checked against the declared return type
- [ ] 2.2 `apps/web/src/features/report-sections/ui/lead-form-loaded-view-model.ts`:
      remove the `as KanbanItem[]` casts from `ownCurrentWeekItems` and
      `ownNextWeekItems`, keeping the `KanbanItem[]` variable type as an
      explicit annotation (not an assertion) if needed for downstream
      consumers
- [ ] 2.3 Confirm no other call site relied on `LeadKanbanItem` lacking
      `pausedReason` (e.g. an object-literal spread that assumed a narrower
      shape)

## 3. Admin reminders: import from the module's own boundary

- [ ] 3.1 `apps/web/src/features/admin/model/reminders-tab-format.ts`:
      change the `MockReminder`/`MockReminderPolicy` import from
      `../../../shared/lib/admin-mock-data` to `./admin-types`
- [ ] 3.2 `apps/web/src/features/admin/model/reminders-form-state.ts`: change
      the `MockReminderPolicy` import from
      `../../../shared/lib/admin-mock-data` to `./admin-types`
- [ ] 3.3 `apps/web/src/features/admin/model/reminders-tab-mutations.ts`:
      change the `MockReminderPolicy` import from
      `../../../shared/lib/admin-mock-data` to `./admin-types`
- [ ] 3.4 Confirm the three files' corresponding `.test.ts` fixtures (if any
      construct `MockReminder`/`MockReminderPolicy` object literals directly)
      still type-check against `admin-types.ts`'s versions

## 4. Spec delta

- [ ] 4.1 `web-model-type-boundary`: ADD a requirement that web presentation
      modules type themselves against the real domain model or a module's
      own documented self-contained type, not a mock/legacy data module

## 5. Gates and verification

- [ ] 5.1 `pnpm --filter @customreport/api db:generate`
- [ ] 5.2 `pnpm typecheck && pnpm lint && pnpm test`
- [ ] 5.3 Confirm the `as KanbanItem[]` casts removed in 2.2 do not resurface
      as a new type error — if `LeadKanbanItem` and `KanbanItem` diverge on
      another field, fix the divergence rather than reintroducing the cast
- [ ] 5.4 `openspec validate web-type-ssot-drift --strict`
