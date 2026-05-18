---
phase: 71
title: Coming Soon Visibility Audit
status: passed
milestone: v8.2
completed: 2026-05-18
---

# Phase 71 — Coming Soon Visibility Audit

## Goal

Standardise "Coming Soon" placeholder UI across the product: one shared component, consistent card style, fact-statement copy, visible to the right roles.

## Deliverables

### `packages/ui` — `ComingSoonBadge` shared component

`packages/ui/src/components/coming-soon-badge.tsx`:

- Amber pill badge (`bg-amber-100 text-amber-700 uppercase tracking-wide`)
- Accepts `HTMLAttributes<HTMLSpanElement>` — works as standalone badge and as tooltip target
- Exported from `packages/ui/src/index.ts`

### settings-tab.tsx — 4 cards standardised

All 4 integration cards (Telegram, CI Integration, Slack, AI Summary) now use:

- Consistent card style: `border-dashed border-border bg-surface-hover p-4 opacity-70`
- `<ComingSoonBadge>` replacing 4 divergent inline spans
- Fact-statement copy (not generic "follow-on phase" filler):
  - Telegram: "Push notifications and quick-reply via Telegram bot — replaces email reminders for mobile-first teams."
  - CI: "Trigger report generation automatically from CI/CD pipelines — no manual deadline tracking needed."
  - Slack: "Daily digest and deadline alerts to a team Slack channel — keeps everyone updated without checking the dashboard."
  - AI Summary: "Auto-summary of statuses and extracted risks — 5-second read instead of reviewing 30 minutes of section data."

### nav-bar.tsx — 2 tooltip targets standardised

`LanguageComingSoonControl` and `ThemeComingSoonControl`: hover tooltip now renders `<ComingSoonBadge>` with positioning classes instead of a duplicate styled `<span>`.

### lead-history-sidebar.tsx — SidebarCard badge standardised

`SidebarCard.comingSoon` now renders `<ComingSoonBadge />` instead of a local amber inline span.

## Verification

```bash
pnpm typecheck          # 0 errors
pnpm lint               # 0 errors
git grep -c "ComingSoonBadge" apps/web/src/   # ≥ 3 files
```

All 6 call-sites use the shared component.

## Status

`passed` — shared `ComingSoonBadge` created, 6 call-sites migrated, card styles consistent, copy improved.
