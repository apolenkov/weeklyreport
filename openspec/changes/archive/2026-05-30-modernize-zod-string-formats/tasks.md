# Tasks

Gates after every step: `pnpm typecheck && pnpm lint && pnpm test`.

## Migrate

- [x] Replace `z.string().datetime()` → `z.iso.datetime()` (search.ts).
- [x] Replace `z.string().uuid()` → `z.uuid()` across all 11 files (140 sites).
- [x] Replace `z.string().url()` → `z.url()` (env.schema.ts, 7 sites incl.
      `.startsWith("postgresql://")` chains).
- [x] Replace `z.string().email()` → `z.email()` (3 sites).
- [x] Confirm no deprecated method-style string-format call remains
      (`grep -rE "z\.string\(\)\.(uuid|url|email|datetime)\("` → 0).

## Verify behavior preservation

- [x] Empirically confirm top-level === method-style for the inputs in play
      (uuid v4 + non-v4 literals, url + `startsWith` chain, datetime offset/
      naive). All cases MATCH on the installed `zod@4.1.x`.
- [x] `pnpm typecheck` green (exit 0; deprecation diagnostics gone).
- [x] `pnpm test` green: shared 1126, api 941 (incl. integration tests with
      Postgres/Redis up), web 587 — exit 0.
- [x] `pnpm build` green (exit 0).
- [x] Biome check on the changed files clean (exit 0). NOTE: repo-wide
      `pnpm lint` is red on a pre-existing, unrelated `organizeImports` issue in
      `admin.service.ts` / `lead-form.service.ts` / `report.ts` — out of scope
      for this change.

## Gates

- [x] `pnpm typecheck`, `pnpm test`, `pnpm build` exit 0.
- [x] `pnpm lint:md` green.
- [x] `openspec validate modernize-zod-string-formats --strict` passes.
