## 1. Shared primitive

- [x] 1.1 Add `packages/ui/src/components/coming-soon-control.tsx` exporting
      `ComingSoonIconButton` (icon-only) and `ComingSoonControl` (icon + visible
      label + optional `compact`); each wraps `ComingSoonTooltip` around an
      `aria-disabled="true"` `<button type="button">` carrying the shared inert
      classes and a fixed-size (`size={14} strokeWidth={2} aria-hidden`) lucide
      icon slot; props are the lucide icon component, `ariaLabel`, `testId`, and,
      for `ComingSoonIconButton`, a `shape: "toolbar" | "nav"` geometry variant
      (`toolbar` = `--toolbar-control-h` `shrink-0` `rounded-full` square for
      version/PDF-export; `nav` = `h-8 w-10` `px-0` `gap-1.5`
      `rounded-[var(--radius-pill)]` pill for language/theme), and, for
      `ComingSoonControl`, `label` + `compact`. The primitive owns all geometry
      classes per variant; consumers pass NO `className`.
- [x] 1.2 Verify no native `title` is emitted and `aria-disabled` (never
      `disabled`) is used, matching the current controls' inertness.
- [x] 1.3 No package.json or `src/index.ts` change: the file is importable as
      `@customreport/ui/components/coming-soon-control` via the existing
      `./components/*` wildcard export (the same subpath convention `apps/web` uses
      for `@customreport/ui/components/coming-soon-badge`).

## 2. Compose in the five button sites

- [x] 2.1 `report-shell/agent-review-coming-soon.tsx` — compose
      `ComingSoonControl` with `BotMessageSquare`, label "Agent review",
      `aria-label` "Agent review is coming soon", testid `agent-review-coming-soon`,
      and forward the existing `compact` prop.
- [x] 2.2 `lead/version-coming-soon.tsx` — compose `ComingSoonIconButton` with
      `History`, `shape="toolbar"`, `aria-label` "Version history is coming soon",
      testid `version-coming-soon`; keep the `TODO(versions-v2)` marker.
- [x] 2.3 `lead/pdf-export-coming-soon.tsx` — compose `ComingSoonIconButton` with
      `FileDown`, `shape="toolbar"`, `aria-label` "PDF export is coming soon", testid
      `lead-pdf-export-coming-soon`; keep the `TODO(lead-pdf-export)` marker.
- [x] 2.4 `navigation/nav-bar.tsx` — reduce `LanguageComingSoonControl`
      (`Globe2`, `shape="nav"`, "Language selection is coming soon",
      `language-coming-soon`) and `ThemeComingSoonControl` (`Moon`, `shape="nav"`,
      "Theme selection is coming soon", `theme-coming-soon`) to thin wrappers
      composing the primitive; keep their `TODO` markers; remove the inline button
      markup and classes.

## 3. Enforcement relocation

- [x] 3.1 Add the primitive's unit test in `apps/web` (alongside
      `coming-soon-style.test.tsx`, NOT in `packages/ui` — that package's `test`
      script is `tsc --noEmit`, so a test placed there would never execute).
      Assert: the inert chrome + classes for both `shape` variants, the labelled
      variant's `compact` geometry, `aria-disabled="true"` with no `disabled`, no
      native `title="Coming Soon"`, the amber `ComingSoonBadge` opening through the
      Radix portal on focus, and the rendered icon slot.
- [x] 3.2 In `apps/web/src/components/coming-soon-style.test.tsx`, shrink the two
      per-file parity source-scan `describe` blocks ("migrated to the shared Radix
      wrapper (source scan)" and "no stacked native title") to a holidays-only
      scope: drop the five button files from their file lists, keep
      `admin/settings-tab.tsx` scanned (the "migrated" block keeps its holidays
      `ComingSoonTooltip` + sr-only `ComingSoonBadge` accessible-name assertion;
      the "no stacked native title" block keeps `admin/settings-tab.tsx` asserted
      free of `title="Coming Soon"`). Keep the render tests over the three exported
      controls and the repo-wide no-bespoke-pill scan.

## 4. Holidays scope confirmation

- [x] 4.1 Confirm `admin/settings-tab.tsx` `HolidaysComingSoonControl` is left
      unchanged (inert `<span>` in a `TabsTrigger` with its own `ComingSoonTooltip` + sr-only `ComingSoonBadge`); it must NOT adopt the button primitive.

## 5. Gates

- [x] 5.1 Focused checks green: `eslint --max-warnings 0` clean on all 6 changed
      files, `vitest run coming-soon-style.test.tsx` PASS (16). Repo-wide
      `typecheck && lint && test` deferred to the post-batch combined gate
      (parallel batch in flight; UI-only change, no db:generate needed).
- [x] 5.2 `openspec validate "shared-coming-soon-control" --strict` prints valid.
      Markdown untouched except these task ticks.
