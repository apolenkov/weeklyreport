## 1. API and Configuration

- [x] 1.1 Add Groq and Jina fixed origins to checked-in development, test, and example allowlists without relaxing explicit origin validation.
- [x] 1.2 Verify the provider profile policy accepts the Groq-generation/Jina-embedding pair and continues rejecting omitted origins.

## 2. Web Feedback

- [x] 2.1 Add a Provider-card regression test proving a current save error wins over an older failed execution message.
- [x] 2.2 Update Provider-card message selection to prioritize current operation feedback while retaining historical execution feedback as the fallback.

## 3. Planning and Documentation

- [x] 3.1 Update relevant provider setup documentation for the complete checked-in built-in-origin allowlist.
- [x] 3.2 Mark OpenSpec tasks complete with concrete verification evidence.

## 4. Verification

- [x] 4.1 Run focused web/API tests, `pnpm typecheck`, changed-file ESLint with `--max-warnings 0`, `pnpm lint:md`, `pnpm test`, and `pnpm build`.
- [x] 4.2 Reproduce the original save-feedback seam and verify Groq/Jina origin validation succeeds without invoking a capability test.
