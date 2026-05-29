# Upgrade lucide-react 0.500 → 1.17 (packages/ui + apps/web)

## Why

`lucide-react` is pinned at `^0.500.0` in **two** workspaces —
`packages/ui/package.json:25` (`@customreport/ui`) and
`apps/web/package.json:26` (`@customreport/web`). The registry latest is
`1.17.0`: the first stable major. A `0.x → 1.0` boundary is exactly where an
icon library is allowed to rename or remove icons, change export aliasing
conventions, and alter prop/tree-shaking behavior — none of which a pre-1.0
version was obligated to keep stable.

Unlike a test-only dependency, lucide ships to the browser: every icon import
renders in production UI. An icon renamed or removed in 1.0 that no test happens
to exercise will pass the suite and still break at runtime (missing icon, build
failure, or wrong glyph). The audit surface is the ~30 distinct icons imported
across 28 files.

This is a Wave-3, deliberately **isolated** major upgrade: bumping one
production dependency on its own keeps a single breaking change from sinking a
multi-dep batch, and lets it be validated (or rejected) cleanly. The merge
decision stays with the user.

## What Changes

- Bump `lucide-react` from `^0.500.0` to `^1.17.0` in **both**
  `packages/ui/package.json` and `apps/web/package.json`, keeping the two
  workspaces on the **same** version so the lockfile resolves a single copy.
- Refresh the lockfile (`pnpm-lock.yaml`) and verify one resolved
  `lucide-react@1.17.0` — not two duplicate copies, which would defeat
  tree-shaking and risk shipping divergent icon sets.
- Audit every lucide-react import across the 28 files (~30 distinct icons),
  verify each name against the lucide-react 1.0 migration guide / changelog for
  renames and removals, and apply the required codemods — explicitly including
  whether the `*Icon`-suffixed aliases (`CheckIcon`, `XIcon`, `CircleIcon`,
  `ChevronDownIcon`, `ChevronUpIcon`, `ChevronRightIcon`, `PanelLeftIcon`)
  survive in 1.0.
- Resolve any prop or tree-shaking breaking change the 1.0 transition requires,
  then run the full repo gates including `pnpm build`.

## Impact

- **Packages:** `packages/ui` (`@customreport/ui`) and `apps/web`
  (`@customreport/web`) — the two workspaces that declare the dependency.
- **Files:** `packages/ui/package.json`, `apps/web/package.json`, the lockfile
  (`pnpm-lock.yaml`), and any of the 28 source files that import a renamed or
  removed icon. Affected source spans `packages/ui/src` shadcn wrappers (e.g.
  `XIcon`, `PanelLeftIcon`, `ChevronDownIcon`) and `apps/web/src` feature
  components.
- **Surface:** production runtime. lucide renders in shipped UI, so the risk is
  not confined to the test suite — `pnpm build` and the icon-import audit are
  primary acceptance signals alongside Vitest.
- **Risk:** Medium. A `0.x → 1.0` boundary can rename/remove icons and change
  aliasing; an uncovered icon can break at runtime while tests stay green. Scope
  is contained to a single dependency in two workspaces, so a failed validation
  is rejected without touching other work.

## Non-goals

- **No other dependency bumps.** The other Wave-3 majors (`@types/node`,
  `@vitejs/plugin-react`, `typescript`, `jsdom`, `@bull-board/*`) are separate
  isolated changes; this one touches only `lucide-react`.
- **No icon redesign or new iconography.** This is a version bump plus rename
  migration, not a visual/icon-set change. Swapping a removed icon for the
  closest 1.0 successor to preserve current meaning is in scope; introducing new
  icons or restyling is not.
- **No theme/dark-mode work.** Per repo rules, visual theming stays
  research-only; this change does not touch tokens or styling.
