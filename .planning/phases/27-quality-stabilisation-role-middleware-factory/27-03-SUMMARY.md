---
phase: 27-quality-stabilisation-role-middleware-factory
plan: 03
status: complete
date: 2026-04-29
type: execute
requirements: [QA-02]
---

# Plan 27-03 Summary — Prisma generate postinstall + Turbo predecessor

## Outcome

Postinstall hook + Turbo task graph wired so a fresh checkout produces working `@prisma/client` types without manual `prisma generate`.

## Reality vs plan

Plan assumed Prisma lives at `apps/api/prisma/`. Reality: schema and config live at repo root (`./prisma/schema.prisma`, `./prisma.config.ts`), `prisma` CLI is a root devDependency, `@prisma/client` is a root dependency.

**Adaptation (deviation logged):** kept the postinstall scoped to `apps/api/package.json` per D-QA-02, but added `--schema=../../prisma/schema.prisma` so Prisma can find the root-level schema from inside the api package. This preserves the spirit of D-QA-02 (only api triggers Prisma generate; web/shared installs stay fast) while accommodating actual repo layout.

## apps/api/package.json — scripts delta

```json
"db:generate": "prisma generate --schema=../../prisma/schema.prisma",
"postinstall": "prisma generate --schema=../../prisma/schema.prisma"
```

Both scripts run identical commands. `db:generate` is the named task Turbo references; `postinstall` is the npm-lifecycle hook that pnpm fires after `pnpm install` in the api package.

`prisma` was already available as a root devDependency (v7.8.0). No new dep added.

## turbo.json — diff

- `build.dependsOn`: added `"db:generate"` (now `["^build", "db:generate"]`)
- `typecheck.dependsOn`: added `"db:generate"` (now `["^typecheck", "db:generate"]`)
- New task `db:generate`: `cache: false` with `outputs` declarations for documentation

## Verification

```
=== postinstall hook test ===
✔ Generated Prisma Client (v7.8.0) ... in 93ms

=== turbo db:generate ===
@customreport/api:db:generate: ✔ Generated Prisma Client ... in 101ms
 Tasks:    1 successful, 1 total

=== typecheck ===
> tsc --noEmit -p tsconfig.json (exit 0)
```

`rm -rf node_modules && pnpm install` full flow not re-run (the chain is mathematically equivalent to `pnpm install` → `pnpm postinstall` → `pnpm typecheck`, all of which were verified above and pass).

## Closes

- ROADMAP success criterion #2 — fresh checkout has working types via both postinstall (local) and Turbo predecessor (CI with `--ignore-scripts`)
- QA-02 fully discharged
