## ADDED Requirements

### Requirement: The lucide-react Icon Dependency MUST Track a Maintained Major

The `packages/ui` and `apps/web` workspaces MUST pin `lucide-react` to the
current maintained major (`^1.17.0` at this change). Every icon imported across
the repository MUST resolve to a real export in that major, and the full
`packages/ui` and `apps/web` Vitest suites plus `pnpm build` MUST pass with no
skipped or quarantined tests and no missing-icon build failure.

#### Scenario: Tests and build pass on the upgraded lucide-react

- **WHEN** `pnpm test` and `pnpm build` run with `lucide-react@1.17.0` resolved
  in the lockfile
- **THEN** every `packages/ui` and `apps/web` test passes and the build succeeds
- **AND** no test is skipped, quarantined, or deleted, and no icon import fails
  to resolve

#### Scenario: Icon renames and removals are migrated, not masked

- **WHEN** an icon used by the repo is renamed or removed in the lucide-react 1.0
  major (including any change to the `*Icon`-suffixed alias convention)
- **THEN** every affected import is updated to the new name, or substituted with
  the closest 1.0 successor that preserves the icon's current meaning
- **AND** the fix addresses the cause rather than hiding a missing icon behind a
  fallback or a skipped test

### Requirement: The Two Declaring Workspaces MUST Stay On The Same lucide-react Version

Both workspaces declaring `lucide-react` MUST carry an identical version string
(`packages/ui/package.json` and `apps/web/package.json`), and the lockfile MUST
resolve a single `lucide-react` copy shared by both workspaces, so tree-shaking
is preserved and a single icon set ships.

#### Scenario: Both workspaces resolve one shared version

- **WHEN** `pnpm install` completes after the bump
- **THEN** `packages/ui/package.json` and `apps/web/package.json` both declare
  `lucide-react@^1.17.0`
- **AND** the lockfile resolves exactly one `lucide-react@1.17.0` copy, with no
  duplicate or divergent version across the two workspaces

### Requirement: The lucide-react Upgrade MUST Remain Isolated

The lucide-react bump MUST change only the `lucide-react` dependency and the
files needed to migrate icon imports; it MUST NOT bundle other dependency
upgrades, so a failed validation can be rejected without affecting unrelated
work. The merge decision is the user's.

#### Scenario: No unrelated dependency moves with the bump

- **WHEN** the change is prepared for review
- **THEN** the diff touches only the `lucide-react` entries in
  `packages/ui/package.json` and `apps/web/package.json`, the lockfile, and the
  source files whose icon imports require migration
- **AND** no other major or minor dependency version is changed in the same change

#### Scenario: All repo gates pass before handing off the merge decision

- **WHEN** the upgrade is complete
- **THEN** `pnpm typecheck`, `pnpm lint`, `pnpm test`, `pnpm build`, and
  `pnpm lint:md` all exit 0
- **AND** the resolved lucide-react version (confirmed identical across both
  workspaces), icon renames/removals encountered and their substitutes, and
  files touched are reported to the user for the merge decision
