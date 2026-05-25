# Tasks

## TypeScript config + lint script

- **PRISMA-T1** Create `tsconfig.prisma.json` extending root config with
  `include: ["prisma/**/*.ts"]`
- **PRISMA-T2** Add `lint:prisma:typecheck` script to `package.json`:
  `tsc --project tsconfig.prisma.json --noEmit`
- **PRISMA-T3** Update `package.json` `lint` script to include
  `lint:prisma:typecheck`
- **PRISMA-T4** Run lint locally; ensure all existing `.ts` files pass
- **PRISMA-T5** Add CI job in `.github/workflows/lint.yml` to run
  `lint:prisma:typecheck`
- **PRISMA-T6** Commit: `ci: add Prisma typecheck gate to lint pipeline`

## Verification

```bash
pnpm lint:prisma:typecheck
pnpm lint
```
