# Design — Upgrade lucide-react 0.500 → 1.17

## Context

`lucide-react` provides every icon in the product UI. It is declared in two
workspaces — `packages/ui/package.json:25` (`@customreport/ui`, the shadcn
wrapper library) and `apps/web/package.json:26` (`@customreport/web`, the
Next.js app) — both pinned at `^0.500.0`. The registry latest is `1.17.0`, the
first stable major.

A `0.x → 1.0` boundary is the point at which an icon library is permitted to
break: rename or remove icons, change the export-alias convention (notably the
`*Icon`-suffixed names this repo uses, e.g. `XIcon`, `PanelLeftIcon`,
`ChevronDownIcon`), and adjust prop or tree-shaking behavior. Roughly 30 distinct
icons are imported across 28 files; some are imported under both the base name
and the `*Icon` alias (`Check`/`CheckIcon`, `X`/`XIcon`, `Circle`/`CircleIcon`,
`ChevronDown`/`ChevronDownIcon`, `ChevronUp`/`ChevronUpIcon`).

Unlike a test-only dependency, lucide renders in shipped production UI. The risk
is therefore **not** confined to the Vitest suite: an icon renamed or removed in
1.0 that no test exercises will pass tests and still break at runtime or fail the
build. `pnpm build` and the import audit are first-class acceptance signals.

This change is part of a Wave-3 dependency-currency effort where each major bump
is isolated into its own change so one breaking dependency cannot sink a batch.

## Decision

**Bump lucide-react 0.500 → 1.17 in both workspaces in lockstep as a standalone,
isolated change; audit every icon import against the 1.0 changelog; validate with
the full test suite plus `pnpm build`; leave the merge decision to the user.**

Rationale:

- **Isolation is the right granularity.** lucide is a single dependency with a
  self-contained validation signal (icon audit + build + tests). Bundling it
  with other Wave-3 majors would entangle unrelated failure modes and make a
  clean revert impossible.
- **Both workspaces must move together to the same version.** The dependency is
  declared twice. If the versions diverge, the lockfile can resolve two copies
  of lucide-react — defeating tree-shaking and risking two different icon sets
  shipping in the same app. The two `package.json` entries MUST carry an
  identical version string and the lockfile MUST resolve a single copy.
- **The icon audit is the core of the migration.** The `0.x → 1.0` transition is
  where renames/removals land. Each of the ~30 icons — including whether the
  `*Icon`-suffixed aliases survive — is verified against the 1.0 changelog, which
  is the source of truth. Specific rename guesses are deliberately not baked into
  the spec.
- **Build is a required gate.** Because lucide ships to the browser, a missing
  icon export can fail `next build` even when Vitest is green. `pnpm build` is
  part of the acceptance bar, not optional.
- **Fix the cause.** Removed icons are replaced with the closest 1.0 successor
  that preserves current meaning; failing tests and missing icons are migrated,
  not skipped or masked with fallbacks.

## Alternatives considered

- **Batch with the other Wave-3 majors.** Rejected: violates the locked
  isolation decision and couples unrelated failure modes; a single breaking dep
  would force re-litigating the whole batch.
- **Pin the last `0.x` release instead of crossing into 1.0.** Rejected: it only
  defers the `0.x → 1.0` break, the gap keeps growing, and a future dependency
  could force the jump under worse conditions. Crossing now, isolated, is the
  cheapest point to absorb the rename migration.
- **Bump only one workspace and let the other lag.** Rejected: divergent
  versions risk two resolved copies, broken tree-shaking, and inconsistent icons
  between `@customreport/ui` and `@customreport/web`. The two MUST stay locked to
  the same version.
- **Replace lucide-react with another icon library.** Out of scope: that is an
  iconography/design change, not a dependency-currency bump, and carries its own
  visual-parity risk across every icon in the UI.
