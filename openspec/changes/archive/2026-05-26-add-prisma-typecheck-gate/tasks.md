# Tasks

## TypeScript config + lint script

- [x] PRISMA-T1: Create `tsconfig.prisma.json` extending root config with
      `include: ["prisma/**/*.ts"]`.
- [x] PRISMA-T2: Add `lint:prisma:typecheck` script to `package.json` —
      `tsc --project tsconfig.prisma.json --noEmit`.
- [x] PRISMA-T3: Update `package.json` `lint` script to include
      `lint:prisma:typecheck`.
- [x] PRISMA-T4: Run lint locally; ensure all existing `.ts` files pass.
      Fixed: removed luxon (not in root node_modules) + replaced import.meta.url
      with \_\_dirname (CJS module mode).
- [x] PRISMA-T5: Add CI step to `.github/workflows/ci.yml` (quality job).
- [x] PRISMA-T6: Commit.

## Verification

```bash
pnpm lint:prisma:typecheck
pnpm lint
```
