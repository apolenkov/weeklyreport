# CustomReport Repo Overlay

This file is intentionally short. The global operating baseline already lives
in `~/.claude/CLAUDE.md`; keep this repo file limited to CustomReport-specific
context, exceptions, and current source-of-truth pointers.

`AGENTS.md` is a symlink to this file, so these instructions are also the
Codex repo overlay.

## Load First

Use current files instead of memory:

- `openspec/changes/` - active backlog (run `openspec list`).
- `openspec/specs/` - durable specs; inspect the dir or run
  `openspec list --specs` (`openspec list` alone lists active changes).
- `openspec/config.yaml` - project context + change-lifecycle rules.
- `.env.example`, `.env.test.example` - runtime switches and port assumptions.

Do not paste generated research dumps here. Active work lives in `openspec/`;
historical context is recoverable via `git log`.

## Project Snapshot

CustomReport automates weekly status reports for the CoreDev department.
Leads fill structured report sections independently; the head reviews,
publishes, and exports a unified report.

```text
customreport
+-- apps/web        # Next.js 16 / React 19 frontend
+-- apps/api        # NestJS 11 / tRPC / Prisma backend
+-- packages/shared # Zod schemas, types, shared contracts
+-- packages/ui     # shadcn/ui and Tailwind tokens
+-- prisma          # schema, migrations, seeds, destructive guards
+-- openspec        # active backlog (changes/) + durable contracts (specs/)
```

Run `git status --short --branch` and `openspec list` to see current state.

## Commands

Use `pnpm` from the repo root. Avoid `npm`/Yarn.

```bash
pnpm install
cp .env.example .env
pnpm dev:watch
```

Primary gates:

```bash
pnpm typecheck
pnpm lint
pnpm test
pnpm build
```

Lint stack: ESLint + Prettier + stylelint. `pnpm lint` =
`eslint . && stylelint "**/*.css" --allow-empty-input && pnpm lint:prisma:typecheck`.

- **ESLint** (`eslint.config.ts`) owns the logic lint surface for
  `*.{ts,tsx,js,jsx,mjs}`. Repo severity overrides: `no-explicit-any: error`,
  `no-non-null-assertion: warn`, unused vars `error` (via
  `unused-imports/no-unused-vars`), `no-floating-promises: error`.
- **Prettier** (`.prettierrc.json`) formats the whole surface — TS/JS/JSON/CSS
  **and** YAML/Markdown. `pnpm format` / `pnpm format:check`. Markdown is
  formatted, NOT linted — markdownlint stays removed (no `lint:md`, no CI job).
- **stylelint** (`.stylelintrc.json`) owns CSS lint; only the two parity rules
  `no-descending-specificity` and `declaration-no-important` run at `warning`.

Useful local operations:

```bash
pnpm logs
pnpm logs:errors
pnpm observability:up
pnpm db:fresh:manual-uat
```

## Runtime Notes

- Local web: `http://localhost:3000`.
- Local API: `http://localhost:3002`.
- Mailpit UI: `http://localhost:8025`; Compose service name is still
  `mailhog` for backward-compatible env wiring.
- Dev auth uses `AUTH_DEV_MODE=true` and `/auth/dev-login`; production must
  use Keycloak SAML and rejects dev-auth flags.
- `NEXT_PUBLIC_DEV_ROLE_SWITCHER=true` enables the dev-only role switcher.
- `.env.test.example` defines the destructive integration-test database.

## Repo Rules

### Deferred Features

When a feature is deliberately deferred, leave physical traces in code:

- `TODO(<ref>)` near the activation point.
- For deferred **user-facing** features (settings, admin tabs, nav items),
  prefer a `ComingSoonBadge` tooltip on an inert control over a hidden
  feature flag. Reference pattern:
  `apps/web/src/components/navigation/nav-bar.tsx`
  `LanguageComingSoonControl` / `ThemeComingSoonControl`. Shows the user the
  feature is acknowledged and roadmapped without exposing half-working UI.
- For deferred **backend / non-UI** paths use a loud stub instead:
  `throw new Error('Not implemented -- see TODO(<ref>)')`.
- Metric name declared up front when the future path affects observability.

This is mandatory for seeds-only or mock-only paths such as Phase 54 AI/RAG and
Phase 55 Telegram activation.

### UI Strings

Static production UI strings stay English until a real i18n phase exists.
Russian is allowed as data from DB/seeds/fixtures, comments, and tests; it is
not allowed as hardcoded JSX/toast/aria-label/placeholder/button copy in
`apps/web/src/**/*.tsx`.

Quick check for changed production UI files:

```bash
grep -nE '[а-яА-Я]' <changed-file>
```

Every match must be data, a comment/JSDoc, or a test/fixture string.

### MVP Phase: Database Is Disposable

No production deployment yet — local/dev/test/UAT databases are disposable.
Resetting, wiping, and rebuilding from scratch is expected and safe, with no
fresh approval needed each time.

- **Reshape the schema directly; do not author incremental alter-table
  migrations.** Edit `prisma/schema.prisma` and rebuild. There is a single
  init migration — keep it in sync with the schema (hand-edit its SQL when
  Prisma can't express a construct, e.g. the FTS `GENERATED STORED` columns
  and CHECK constraints) and `prisma migrate reset` to re-apply it.
- **`migrate reset` on the non-prod databases is routine, not a last resort.**
  Use it freely to apply schema changes. The Prisma 7 "invoked by Claude Code"
  consent guard still fires per run — this rule is the standing authorization
  to clear it (pass `PRISMA_USER_CONSENT_FOR_DANGEROUS_AI_ACTION`); it is not a
  license to touch production.
- The `_uat`/`_dev`/`_test` suffix rules and `prisma/_destructive-guard.ts`
  still apply — they protect prod, not your freedom in dev. Production stays
  gated by `ALLOW_PROD_DESTRUCTIVE`; never reset the prod DB.

This freedom ends when the first real production point exists — revisit then.

### MVP Phase: Commit to Main + Prune Freely

Same MVP rationale as the disposable database: there is no production point yet,
so `main` is not sacred and the repo is allowed to shed weight. This OVERRIDES
the global "branch first on the default branch / commit only when asked" caution
for this repo — until the first production point.

- **Commit and push directly to `main` is pre-authorized.** No feature branch,
  no per-action confirmation. Still: never push a red/broken tree, and on a
  shared worktree stage only your own paths (a parallel session may hold
  unrelated changes).
- **Prune obsolete files freely.** Removing genuinely no-longer-needed cruft
  (stale build/screenshot artifacts, dead code, leftover scratch, superseded
  docs) is pre-authorized — no fresh approval each time.
- **But still prove "unused" before deleting.** Confirm with evidence
  (codegraph / grep all references + imports + build config), per Surgical
  Changes; if you cannot confirm, ask or leave a note. Never delete another
  session's untracked work.

This freedom ends when the first real production point exists — revisit then.

### Docker Databases

Non-production `POSTGRES_DB` names and the database name inside
`DATABASE_URL` must include `_uat`, `_dev`, or `_test` when the host is
not truly local. Keep `DIRECT_URL` on the same suffixed database when it is
present. `prisma/_destructive-guard.ts` parses `DATABASE_URL` and refuses
destructive operations without a non-prod suffix.

Name environments by purpose, not by accident: local dev, automated tests,
manual UAT/staging, and production must have distinct database names that match
their real use. Keep compose files, env examples, docs, and destructive guards
aligned on the same target variable.

Do not rename the production DB in `docker-compose.prod.yml`; production
destructive paths are gated separately by `ALLOW_PROD_DESTRUCTIVE`.

### Visual And Theme Work

Dark mode, background changes, rebrand, and theme switching are research-only
unless the user explicitly chooses a concrete direction. Screenshots and
research memos are allowed; CSS token/theme/background implementation is not.

### Director Scope

Do not add a runtime director workflow unless that direction is explicitly
reopened. Director-facing UAT currently goes through the viewer read-only path.

### Branch Hygiene

No long-lived `stash-*` / `backup-*` / `preserve-*` / `wip-*` branches. They
are sticky by name — easy to create, easy to forget, dangerous to merge later.
(A `stash-uat-v7` branch once drifted 384 commits behind `main` and burned a
session before being dropped.)

If WIP needs to survive a session boundary, use one of:

- `git stash push -u -m "<reason>"` — real stash, 30-day reflog window.
- draft PR — visible on GitHub, has CI, easy to close without merge.
- normal commit on the active feature branch — rebase-friendly, no separate
  branch lifecycle to remember.

Auto-flag stale branches at the start of any session that involves `git push`,
`git merge`, or other branch ops. Run `git branch -vv` and surface any branch
where the name matches `^(stash|backup|preserve|wip)-` OR `committerdate` is
older than 7 days AND it is behind `origin/main` by more than 50 commits. Ask
the user whether to drop or push-then-drop before continuing. Recovery via
`git reflog` covers any "oops" within 30 days, so the default is delete.

Worktrees follow the same rule. If a worktree's branch has been merged or is
obsolete, remove the worktree with `git worktree remove <path>` and delete the
branch in the same session.

## Code Patterns

- TypeScript strict mode is enforced across packages.
- Frontend data access goes through the tRPC client and shared contracts.
- API domain boundaries are Nest modules plus Prisma repositories.
- Shared schemas and enums live in `packages/shared`; update them before
  duplicating types in app code.
- Migrations: during MVP reshape directly (see **MVP Phase: Database Is
  Disposable**); they become append-only after the first production point.
  Review destructive ones against `prisma/_destructive-guard.ts`.
- For product/group/report-period behavior, inspect existing tests before
  changing query semantics; this area has had regression-heavy UAT work.

## Agent skills

### Issue tracker

Issues live in GitHub Issues for `apolenkov/yourpulse` (via the `gh` CLI).
See `docs/agents/issue-tracker.md`.

### Triage labels

Canonical vocabulary (`needs-triage`, `needs-info`, `ready-for-agent`,
`ready-for-human`, `wontfix`); only `wontfix` exists today, the rest are
created on first use. See `docs/agents/triage-labels.md`.

### Domain docs

Single-context: one `CONTEXT.md` + `docs/adr/` at the repo root.
See `docs/agents/domain.md`.
