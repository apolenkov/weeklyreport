# Tasks

## 1. Shared UI (packages/ui)

- [x] 1.1 Added a self-contained `ComingSoonTooltip` in
      `packages/ui/src/components/ui/tooltip.tsx`: an EMBEDDED `TooltipProvider`
      (delayDuration 0) → `Tooltip` → `TooltipTrigger asChild` → a CHROMELESS
      `TooltipContent` (`border-0 bg-transparent p-0 shadow-none`) rendering the
      amber `ComingSoonBadge`, with a new `hideArrow` prop on `TooltipContent`
      (the Arrow was rendered unconditionally with `fill-foreground`). One shared
      `side="bottom"`/`align="center"`/`sideOffset={6}` positions all six controls
      identically. The shared dark `TooltipContent` is UNTOUCHED (restyle deferred,
      design Decision 2). Importable from `@customreport/ui/components/ui/tooltip`
      (existing subpath export; no barrel change needed).
- [x] 1.2 Made the badge DECORATIVE for assistive tech: `ComingSoonTooltip`'s
      `TooltipContent` now carries a whitespace `aria-label=" "`, which blanks the
      sr-only description Radix renders (`ariaLabel || children`) and wires as the
      trigger's `aria-describedby`. The control's own persistent `aria-label`
      ("… is coming soon") stays the SINGLE coming-soon source — removing the
      focus-time double-announce without shortening the label (which would lose
      the browse-mode signal). Empirically confirmed: accessible description "",
      visible amber badge still renders.

## 2. Web — migrate the six controls (apps/web)

- [x] 2.1 Migrated `report-shell/agent-review-coming-soon.tsx` to
      `ComingSoonTooltip` (kept `aria-disabled`, `aria-label`, `data-testid`,
      `compact`).
- [x] 2.3 Migrated `lead/version-coming-soon.tsx` and
      `lead/pdf-export-coming-soon.tsx`.
- [x] 2.4 Migrated nav `LanguageComingSoonControl` + `ThemeComingSoonControl` in
      `navigation/nav-bar.tsx`.
- [x] 2.5 Migrated the admin Holidays control in `admin/settings-tab.tsx` —
      `TooltipTrigger asChild` on the inert `<span>`, no nested button, no
      `aria-label`. ADDED a PERSISTENT visually-hidden `<ComingSoonBadge
className="sr-only" />` inside the span: the Radix tooltip badge is portaled
      (hover-only), so the sr-only badge keeps "Coming Soon" in the holidays tab's
      computed accessible name (the spec's "descendant ComingSoonBadge text"),
      using the primitive (no bespoke literal).
- [x] 2.6 Deleted `coming-soon-tooltip-anchor.ts` (`COMING_SOON_TOOLTIP_ANCHOR`)
      and the `group relative` wrappers; no control references them.

## 3. Tests (apps/web)

- [x] 3.1 Reworked `coming-soon-style.test.tsx`: dropped the CSS-anchor token
      assertions + the `COMING_SOON_TOOLTIP_ANCHOR` source scan; now asserts each
      control opens the amber badge through the Radix portal and the source uses
      `ComingSoonTooltip` (no anchor). Kept the no-native-title + no-bespoke-pill
      guards.
- [x] 3.2 Added Radix jsdom tests (per `radix-tooltip-jsdom-test-recipe`): open
      via `fireEvent.focus`, assert `findByRole("tooltip")` shows the amber badge
      with the canonical tokens and NOT the dark `bg-foreground` surface
      (coming-soon-style + version + pdf-export tests).
- [x] 3.3 The Holidays tab's computed accessible name still contains
      "Coming Soon" — proven by the EXISTING `settings-tab.test.tsx` accname tests
      (still green with the persistent sr-only badge).
- [x] 3.4a Holidays hover-only contract documented (the inert span is not
      keyboard-focusable inside the TabsTrigger). AT coverage is the tab accname
      (3.3); the visual hover-open is a live-verify item.
- [x] 3.4 Updated `version-coming-soon.test.tsx`, `pdf-export-coming-soon.test.tsx`
      (sync `getByRole("tooltip")` → async focus + `findByRole`); `lead-form.test.tsx`
      still green (no change needed — it asserts toolbar/dialog, not the tooltip).
- [x] 3.5 Added the decorative-badge guard (task 1.2): each of the three
      render-testable controls asserts the persistent accessible NAME matches
      `/coming soon/i` AND the accessible DESCRIPTION is `""` (no double-announce).
      The visible-badge queries moved from the sr-only `role="tooltip"` node to
      the Radix content (`[data-slot="tooltip-content"]`), since the description
      node is now blanked. `version-coming-soon.test.tsx` reveal query updated the
      same way.

## 4. Docs & specs

- [x] 4.1 `deferred-feature-pattern` delta — REMOVED the CSS-anchor requirement +
      ADDED the Radix-portal requirement.
- [x] 4.2 `CONTEXT.md` — the "Tooltip / hover affordance" glossary entry naming
      the three systems (already added this session; verified).
- [x] 4.3 `admin-settings-ui` delta (F2) — the Holidays coming-soon scenario
      reflects the shared Radix tooltip (hover) + inert/no-nested-interactive +
      coming-soon state in the tab accessible name.

## 5. Verification

- [x] 5.1 `pnpm typecheck && pnpm lint && pnpm test && pnpm build` green
      (combined gate across all five changes — see the implementation branch).
- [x] 5.2 Live (2026-06-22, lead1 on :3000): the Agent-review control on
      `/lead/report` opens the amber `ComingSoonBadge` (computed bg = amber-100,
      text = amber-700) PORTALED into `document.body`, OUTSIDE the
      `overflow-x-auto` toolbar ancestor (`!toolbar.contains(badge)` = true) — so
      it is no longer clipped. Decorative-badge a11y confirmed in the live DOM:
      the trigger's `aria-describedby` resolves to a blank (" ") node while its
      `aria-label` ("Agent review is coming soon") is intact — no double-announce.
      Holidays on `/admin` is a trivial remaining manual check (same wrapper).
- [x] 5.3 `openspec validate fix-coming-soon-tooltip-clipping --strict`.
