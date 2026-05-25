---
tags: [holidays, deadline-calculation, period-lifecycle]
aliases: [holiday-calendar]
related: [graceful-coalescing-kurzweil]
---

# Holidays Calendar — full implementation

Organization-wide holiday calendar management to exclude closures from deadline calculations and report period boundaries.

## Scope

- **Holiday table schema**: date, name, country (optional)
- **Seed data**: Russian holidays for 2026
- **API integration**: wire `computeDeadline` in `apps/api/src/lib/business-date.ts` to accept and use holidays parameter (JSDoc already promises this capability)
- **Admin UI**: CRUD form for holidays (Admin Settings → Holidays tab)

## Why Deferred

See `.planning/plans/graceful-coalescing-kurzweil.md` §23.6. Phase 60 (Holidays Coming Soon) is research-only; full implementation is Phase 67 (T-HOL Holidays Coming Soon → Operational).

## Acceptance Criteria

- [ ] Holiday table migrated (Prisma + destructive guard)
- [ ] RU 2026 holidays seeded
- [ ] `computeDeadline(startDate, daysToAdd, holidays)` integrates with business-date logic
- [ ] Admin UI form (create, list, edit, delete)
- [ ] Deadline calculation tests cover holiday skipping
- [ ] TypeScript strict mode passes

## Blockers

- None; this is future work after Phase 60 UI lands.
