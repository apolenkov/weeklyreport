# CustomReport Repo Overlay

This file is intentionally short. The global operating baseline already lives
in `~/.claude/CLAUDE.md`; keep this repo file limited to CustomReport-specific
context, exceptions, and current source-of-truth pointers.

`AGENTS.md` is a symlink to this file, so these instructions are also the
Codex repo overlay.

## Load First

Use current files instead of memory:

- `README.md` - architecture, setup, dev login URLs, verification commands.
- `.planning/STATE.md` - current milestone status and deferred scope.
- `.planning/HANDOFF.json` - paused work, blockers, dirty-file warnings.
- `.planning/codebase/CONVENTIONS.md` - detailed naming and TypeScript rules.
- `.env.example`, `.env.test.example`, `apps/web/.env.example` - runtime
  switches and port assumptions.

Do not paste generated research dumps here. Planning/research sources belong in
`.planning/**`; repo setup belongs in `README.md`.

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
+-- scripts         # repo helpers and push/local verification guards
+-- tools           # UAT extraction and generation tools
+-- .planning       # GSD state, phase evidence, handoffs, research
```

Current default branch of work is `fix/PRJ-2/uat-v7-2026-05-12`. Before
continuing or closing work, check `git status --short --branch`,
`.planning/STATE.md`, and `.planning/HANDOFF.json`.

There are often pre-existing dirty regression evidence files during PRJ-2/UAT
work. Do not stage, revert, or normalize unrelated dirty files unless the task
explicitly owns them.

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
pnpm docker:local:verify
```

Playwright is the regression runner for this repo:

```bash
pnpm test:e2e
pnpm --filter @customreport/web exec playwright test \
  --config=e2e/regression/playwright.regression.config.ts
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
- Loud stub: `throw new Error('Not implemented -- see TODO(<ref>)')`.
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

Relevant current todo:
`.planning/todos/pending/2026-05-14-future-ui-telemetry-coming-soon.md`.

### Director Scope

Do not add a runtime director workflow unless that direction is explicitly
reopened. Director-facing UAT currently goes through the viewer read-only path.

### Planning And Evidence

- For phase/milestone execution, use GSD and keep `.planning` state in sync;
  small explicit repo-doc edits can stay direct when verified.
- Planning edits under `.planning/**` must pass `pnpm lint:md`.
- Preserve historical phase evidence; do not flatten superseded plans unless
  the user asks for consolidation.
- For resume/closeout, prefer `.planning/HANDOFF.json`,
  `.planning/STATE.md`, and recent `.planning/reports/**` over chat memory.

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

## Graphify

This repo has `graphify-out/GRAPH_REPORT.md` and `graphify-out/graph.json`.
For broad architecture questions, read the graph report before raw-file
scanning. If code files are modified and `graphify` is available, run:

```bash
graphify update .
```
