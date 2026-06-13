# Design — Refactor Web tRPC Test Harness

## Context

Verified at HEAD (2026-06-10):

- 12 test files inject hand-rolled proxy objects through the
  `TRPCProxyContext` seam (`apps/web/src/lib/trpc-context.ts`) and cast
  with `as never`, in three dialects: nested-array `queryKey` stubs
  (admin tabs), dotted-string keys (lead trio, autosave), and the
  vacuous `{ tag }` `pathFilter` shape (settings-tab, users-tab).
- `jobs-tab.test.tsx` carries two in-file factory copies
  (`makeMockTRPC` :54, `makePendingMockTRPC` :114).
- `periods-tab.test.tsx:109` mocks getSettings as
  `["admin", "settings"]` while `products-tab.test.tsx:107` uses
  `["admin", "getSettings"]` — per-file drift in the same key.
- Production contract: `cache-keys.ts` feeds `pathFilter()` into
  `qc.invalidateQueries()`; `@trpc/tanstack-react-query@11.17.0`
  returns `{ ...filters, queryKey: [splitPath] }` and TanStack's
  `matchQuery` only reads `type/exact/fetchStatus/predicate/queryKey/
stale` — so `{ tag }` matches everything (research memo
  `trpc-testing`, confirmed against installed package sources).
- `createAuthRedirectLink` (`trpc.ts:66`) is module-private; its
  swallow branch (:74-78) returns without `error` or `complete`.

## Goals / Non-Goals

**Goals:** one factory that makes queryKey/pathFilter divergence
structurally impossible; pin the invalidation bug fix; cover the
auth-redirect link's swallow branch at the observable seam.

**Non-Goals:** MSW migration; converting the 19 hook-level
`vi.mock(trpc-context)` files; any production behavior change;
upstream-unsubscribe teardown coverage.

## Decisions

### D1 — Path-descriptor builder with one contained cast

Factory API shape (`apps/web/src/test-utils/mock-trpc.ts`):

```ts
type ProcedureDescriptor = {
  path: string[]; // e.g. ["admin", "jobs", "listFailed"]
  query?: unknown | (() => unknown) | "pending"; // data, fn, or never-resolving
  mutation?: boolean; // register a capturing mutation
};

type CapturedMutation = {
  calls: unknown[]; // mutationFn inputs, in order
  lastOptions: unknown; // caller-passed onSuccess/onError/etc.
  mutationFn: ReturnType<typeof vi.fn>;
};

function createMockTRPC(descriptors: ProcedureDescriptor[]): {
  proxy: TRPCProxy; // the ONE contained `as unknown as TRPCProxy` cast
  captured: Record<string, CapturedMutation>; // keyed by dotted path
};
```

From each descriptor's single `path` the factory derives
`queryOptions()` (queryKey + queryFn), bare `queryKey()` (jobs-tab's
`admin.dlqCount` needs it), `pathFilter() => ({ queryKey: [path] })`,
and `mutationOptions()` — both sides of every invalidation always
agree. `"pending"` yields a never-resolving queryFn. Internals are
typed via `unknown`; query stubs are `() => Promise.resolve(data)` (no
`require-await` disables). The factory is a plain hook-free function,
so React Compiler lint is a non-issue.

**Rejected alternatives:**

- **Full `AppRouter` deep-partial generics** — a deep-partial mapped
  type over `inferRouterOutputs` cannot distinguish a sub-router from
  a procedure returning an object (3-level `admin.jobs.listFailed` vs
  2-level `admin.getOrganization`); days of type wrestling under
  strict mode + `no-explicit-any: error` for stub code (research
  trade-offs).
- **Flat string-keyed map** — loses the single-source path that
  prevents queryKey/pathFilter drift, the exact bug class this change
  kills.
- **MSW** — explicit in-code decision at
  `weekly-report-page.test.tsx:1-7`: "We DO NOT extend MSW handlers —
  these mutations are only exercised at the wire-up level here." The
  network seam remains MSW's job via `vitest.setup.ts`. Also slower
  (HTTP interception in jsdom) and needs url + transformer sync.
- **Real `createTRPCOptionsProxy` over an in-process mock link**
  (research memo's variant) — library-authored key shapes, but pulls
  `AppRouter` inference into every component test and reshapes the
  injection style at the seam; the refined dossier scope
  (authoritative) chose the descriptor builder, which drift-proofs the
  same seam the 12 tests already use.

### D2 — Key shape mirrors the package contract

Nested `[[...splitPath]]` per `getQueryKeyInternal` in
`@trpc/tanstack-react-query@11.17.0` (`pathFilter` type:
`WithRequired<QueryFilters, "queryKey">`). Future-proofs key-content
assertions. The one stringified assertion
(`use-lead-form-autosave.test.tsx:493-496`, `JSON.stringify` +
`includes("leadForm")`) still matches the nested shape — verify during
that conversion.

### D3 — Capture API replaces per-file `Captured` interfaces

`captured` keyed by dotted path exposing
`{ calls, lastOptions, mutationFn }`; supports jobs-tab's pattern of
invoking a captured `onSuccess` directly.

### D4 — Pin the bug fix with non-vacuous assertions

The factory contract test asserts `pathFilter()` carries
`queryKey === [splitPath]` — it fails under the old `{ tag }` shape.
`settings-tab` and `users-tab` each gain one assertion that the
specific `admin.getOrganization` cache entry is invalidated after save
— inexpressible under the old invalidate-all behavior.

### D5 — Auth-redirect link tested at the observable seam

Export keyword + `@internal` JSDoc only. Build
`opLink = createAuthRedirectLink()({})` (`TRPCClientRuntime` is `{}`
in v11); stub upstream with `observable()` from
`@trpc/server/observable` (already a production import in `trpc.ts`).
A swallowed 401 never settles the client-call promise, so the test
must subscribe at the observable level, and the complete-not-called
assertion pins the intended "hangs while redirect navigation is in
flight" semantics.

## Invariants

Preserved untouched: role-coverage-gate (no tRPC procedure change — a
client link export only), period-dual-state (no Report write path),
destructive-db-guard, deferred-feature-pattern. The
`lead-report-controls-integrity` behavioral pins in the lead test trio
are preserved verbatim: a red lead test after conversion is a
conversion bug, never an assertion to relax.

## Risks / Trade-offs

- [Parallel edits] prior parallel mechanical refactor here passed all
  gates yet broke behavior and was reverted → sequential single-writer
  edits only.
- [Key normalization] converting one side of queryOptions/pathFilter
  without the other flips which queries refetch (flaky `waitFor`) →
  the factory derives both from one path; each file converts both
  sides in one commit.
- [Real latent failures] specific keys may change refetch behavior in
  settings-tab/users-tab (e.g. an `integrationsStatus` refetch no
  longer fires) → fix tests truthfully; never restore invalidate-all.
- [Error-channel typing] existing helpers return
  `TRPCClientError<never>` vs the link's `TRPCClientError<AppRouter>`
  channel — if tsc objects, widen the helper generic; never cast.
- [Intentional pin] a future "complete after redirect" refactor will
  fail the new swallow-branch test — read it as a contract change, not
  flake.
