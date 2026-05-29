# Tasks

Gates after every step: `pnpm typecheck && pnpm lint && pnpm test`.

## Pre-flight

- [ ] Read the lucide-react 1.0 release notes / migration guide and changelog up
      to `1.17.0` and record the breaking changes that touch this repo: icon
      renames, icon removals, the `*Icon` alias convention, prop changes, and any
      tree-shaking / export-map changes.
- [ ] Enumerate every lucide-react import across the 28 files and the ~30
      distinct icons currently used (`Archive`, `BotMessageSquare`, `Lock`,
      `Calendar`, `AlertTriangle`, `ArrowRight`, `FileText`, `Target`, `Check`,
      `Circle`, `Maximize2`, `Minimize2`, `FileDown`, `Presentation`,
      `RefreshCw`, `RotateCcw`, `Bell`, `BellRing`, `Users`, `Loader2`,
      `ChevronDown`, `ChevronUp`, `X`, and the `*Icon` aliases `CheckIcon`,
      `XIcon`, `CircleIcon`, `ChevronDownIcon`, `ChevronUpIcon`,
      `ChevronRightIcon`, `PanelLeftIcon`). For each, verify against the 1.0
      changelog whether the name survives, is renamed, or is removed — explicitly
      confirm whether the `*Icon`-suffixed aliases still exist in 1.0.
- [ ] Confirm `lucide-react` is declared only in `packages/ui/package.json:25`
      and `apps/web/package.json:26`, both at `^0.500.0`, so the bump is scoped to
      exactly these two workspaces.

## Bump

- [ ] Change `lucide-react` from `^0.500.0` to `^1.17.0` in
      `packages/ui/package.json` (dependencies).
- [ ] Change `lucide-react` from `^0.500.0` to `^1.17.0` in
      `apps/web/package.json` (dependencies) — identical version string to
      `packages/ui` so the two workspaces stay in lockstep.
- [ ] Run `pnpm install`, refresh `pnpm-lock.yaml`, and verify the lockfile
      resolves a **single** `lucide-react@1.17.0` (no duplicate copies across the
      two workspaces) and no unexpected peer-dep warnings appear.

## Migration

- [ ] Apply the rename/removal codemods from the pre-flight audit to every
      affected import in `packages/ui/src` and `apps/web/src`. For a removed
      icon, substitute the closest 1.0 successor that preserves the current
      meaning. Fix the cause — do not delete or skip a failing test or hide a
      missing icon behind a fallback to make things pass.
- [ ] Resolve any prop or tree-shaking breaking change surfaced by the 1.0
      transition in the shadcn wrappers under `packages/ui/src` (e.g.
      `XIcon`, `PanelLeftIcon`, `ChevronDownIcon`) and `apps/web/src` components.
- [ ] Run the `packages/ui` and `apps/web` Vitest suites and triage failures by
      category (missing icon / renamed export / prop change); re-run until both
      are fully green with no skipped or quarantined tests.

## Gates

- [ ] Run `pnpm typecheck && pnpm lint && pnpm test && pnpm build` — `pnpm build`
      is a required gate here because lucide ships to production UI and a missing
      icon export can fail the build even when tests pass.
- [ ] Run `pnpm lint:md`.
- [ ] `openspec validate upgrade-lucide-react-major --strict` passes.
- [ ] Hand the merge decision to the user with a short note: resolved
      lucide-react version (confirmed identical across both workspaces), icon
      renames/removals hit and their substitutes, files touched, and whether any
      icon swap warrants a visual sanity check.
