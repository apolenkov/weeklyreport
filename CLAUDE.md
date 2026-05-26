# CustomReport Repo Overlay

This file is intentionally short. The global operating baseline already lives
in `~/.claude/CLAUDE.md`; keep this repo file limited to CustomReport-specific
context, exceptions, and current source-of-truth pointers.

`AGENTS.md` is a symlink to this file, so these instructions are also the
Codex repo overlay.

## Load First

Use current files instead of memory:

- `openspec/changes/` - active backlog (run `openspec list`).
- `openspec/specs/` - 5 durable invariants (destructive-db-guard,
  deferred-feature-pattern, role-coverage-gate, period-dual-state,
  ai-module-facade).
- `openspec/config.yaml` - project context + change-lifecycle rules.
- `.env.example`, `.env.test.example`, `apps/web/.env.example` - runtime
  switches and port assumptions.

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

Active branch for ongoing work is `feat/PRJ-2/stage-refactor`
(rebased on `main`). Run `git status --short --branch` and `openspec list`
to see current state.

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

Planning docs:

```bash
pnpm lint:md
pnpm lint:md:fix
```

Useful local operations:

```bash
pnpm logs
pnpm logs:errors
pnpm observability:up
pnpm db:wipe:manual-uat
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
Concrete failure mode: `stash-uat-v7-2026-05-14` sat for 12 days, drifted 384
commits behind `main` with a +13 278 / −499 diff that no one would ever want
merged — yet the name implied "preserve, maybe merge later" and burned a
session deciding what to do with it.

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
- Prisma migrations are append-only; review destructive migrations against
  `prisma/_destructive-guard.ts`.
- For product/group/report-period behavior, inspect existing tests before
  changing query semantics; this area has had regression-heavy UAT work.
