# Phase 34, Plan 06 — SUMMARY

**REQ-IDs:** Q-06
**Status:** complete (verified 2026-05-06)

## What shipped

Drove ESLint from ~329 problems (40 errors + 273 warnings, plus 16 api errors) to **0 errors and 0 warnings** across all 4 packages without loosening any rule severity.

Per-package baseline → final:

| Package              | Errors | Warnings | After |
| -------------------- | -----: | -------: | ----: |
| @customreport/shared |     20 |        0 | 0 / 0 |
| @customreport/ui     |      1 |        0 | 0 / 0 |
| @customreport/api    |     16 |      188 | 0 / 0 |
| @customreport/web    |     19 |       85 | 0 / 0 |

## Categories addressed

1. **Destructure-omit pattern** (`const { foo, ...rest } = obj`) — added `ignoreRestSiblings: true` + `varsIgnorePattern: '^_'` to `@typescript-eslint/no-unused-vars` config. Closed 14 shared-package errors with one config change.

2. **`no-explicit-any` in tests** — replaced `as any` with the proper Zod-input type (`SubmitSectionPayload`, `false as unknown as true`, `Role`); for processor-test private-method access, introduced a `ProcessorTestSeam` interface so we cast through `unknown as ProcessorTestSeam`.

3. **`react-compiler/react-compiler` outer-let mutation** in `packages/ui/src/components/ui/sidebar.tsx:86` — moved the `document.cookie` write out of the `setOpen` callback into a sibling `useEffect([open])`, preserving the persistence semantics without writing to a module-scope global inside a render-time callback.

4. **`no-restricted-imports` in `ai-authz.ts`** — added the file to the AI-module Prisma-allowlist; `ai-authz.ts` IS a facade boundary (visibility-join Prisma reads per AI-SPEC §5.2 / M-02). Comment in `eslint.config.ts` documents the carve-out.

5. **`no-dynamic-delete` in `saml.strategy.test.ts`** — refactored `delete env[key]` to `const { [key]: _omitted, ...env } = ...` rest-destructure.

6. **`no-floating-promises` in web** — `void`-marked `qc.invalidateQueries()` calls in cache-keys, reopen-tab, stage-assignment-editor (intentional fire-and-forget cache busters).

7. **`react-compiler/react-compiler` warnings caused by disabled `exhaustive-deps`** — re-enabled the rule on 4 lead-form dialogs (`decision-`, `item-`, `priority-`, `risk-edit-dialog`) by expanding the dep array to all referenced fields. For two genuine snapshot-pattern hooks (`use-lead-form-autosave`, `use-cursor-pagination`) refactored to read `payload`/`factory` via `useRef` so the linter sees only the deep-content hash dep.

8. **`no-non-null-assertion` (273 warnings, the biggest pile)** — split test vs production:
   - **Test files**: introduced `expectDefined<T>(value, message?): T` helper (one per app at `apps/api/src/test-utils/expect-defined.ts` and `apps/web/src/test/expect-defined.ts`). A one-off codemod `/tmp/fix-non-null.mjs` walks each line, finds the rightmost `!` followed by `.` or `[` or end-of-statement, and wraps the preceding value-bearing expression in `expectDefined(…)`. Handles balanced `[…]` / `(…)`, optional chains `?.`, embedded `!` (so `a!.b[0]!` → `expectDefined(expectDefined(a).b[0])`). Handles spread (`...x!` → `...expectDefined(x)`).
   - **Production files** (~22 occurrences): narrowed explicitly. Patterns:
     - `Record<string, V>` with literal-key fallback rewritten as `as const satisfies Record<string, V>` so known keys are provably defined; the runtime lookup keeps a `?? fallback` chain.
     - `array[i]!` rewritten as `const x = array[i]; if (x) …` or `flatMap(item => guard(item) ? [mapped] : [])`.
     - Two paginator helpers (`archive.service.ts`, `reminders.service.ts`) extracted `lastInPage` into a named const + `&&`-guarded ternary.

## Helper signature

```ts
// apps/api/src/test-utils/expect-defined.ts (mirror at apps/web/src/test/)
export function expectDefined<T>(
  value: T | null | undefined,
  message?: string,
): T {
  if (value === null || value === undefined) {
    throw new Error(message ?? "expected defined value");
  }
  return value;
}
```

## eslint.config.ts deltas

```diff
 '@typescript-eslint/no-unused-vars': [
   'error',
-  { argsIgnorePattern: '^_', caughtErrorsIgnorePattern: '^_' },
+  {
+    argsIgnorePattern: '^_',
+    caughtErrorsIgnorePattern: '^_',
+    varsIgnorePattern: '^_',
+    destructuredArrayIgnorePattern: '^_',
+    ignoreRestSiblings: true,
+  },
 ],

 allowDefaultProject: [
   '*.config.ts',
   '*.setup.ts',
   'apps/*/*.config.ts',
   'apps/*/*.setup.ts',
+  'apps/*/*.test.ts',
 ],

 ignores: [
   'apps/api/src/modules/ai/ai-facade.ts',
   'apps/api/src/modules/ai/ai-cache.ts',
+  'apps/api/src/modules/ai/ai-authz.ts',
   'apps/api/src/modules/ai/__tests__/**',
   'apps/api/src/modules/ai/__fixtures__/**',
 ],
```

## Inline disables retained (with justifications)

None. The earlier `// eslint-disable-next-line` directives in `lead-form-dialog` files, `use-lead-form-autosave`, `use-cursor-pagination`, `main.ts` (no-console), and `role-coverage.test.ts` (no-console) were all removed in favour of proper fixes.

## Verification

```bash
cd /home/user/work/customreport
pnpm turbo lint --continue
# Tasks: 4 successful, 4 total

pnpm turbo typecheck
# Tasks: 5 successful, 5 total

(cd apps/api && pnpm test)   # 623 passed
(cd apps/web && pnpm test)   # 237 passed
```

## Files

See `34-06-PLAN.md` `files_modified` (extensive list — 50+ test files + 7 production files + 2 helpers + eslint.config.ts).
