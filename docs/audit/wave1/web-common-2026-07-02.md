# Per-file audit — apps/web/src/components/common (2026-07-02)

Read-only audit, wave 2 web.
1 file reviewed.
Kept 2 findings, killed 0.

## api-readiness-placeholder.tsx (2 findings)

| Lines | Dimension   | Severity | Finding                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        | Suggestion                                                                                                                                                                                                                | Your verdict |
| ----- | ----------- | -------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------ |
| 1-72  | duplication | high     | Zero importers anywhere in the repo (grep for `ApiReadinessPlaceholder` and `api-readiness-placeholder` finds only the file itself and stale .next/tsbuildinfo cache). This is orphaned dead code, not a parked ComingSoon affordance — it renders no ComingSoon primitive, it's a whole standalone placeholder page component that nothing routes to. Its content ('Frontend stub' / 'Hello world' / 'mockups are ahead of the backend') also directly contradicts the current MVP state (backend and full UI are built), suggesting it's a leftover from the pre-'API-first' pivot commit (43646b05) that was never deleted. | Delete the file. If some route is meant to use it, wire it up; otherwise remove it entirely.                                                                                                                              |              |
| 7     | env-config  | medium   | `const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3002";` is an ad-hoc `process.env` read with a silent fallback default, which the repo's config policy explicitly forbids ('no fallback chains for product config; no ad-hoc process.env reads... boot must fail loud on a missing var'). Other files in the same tree (apps/web/src/lib/server/get-server-session.ts) show the same anti-pattern independently (`process.env.API_URL ?? process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3002"`), i.e. the fallback chain is duplicated ad hoc rather than centralized.                        | If the file is kept, read the API base URL through a single validated env accessor (Zod-parsed, required, no default) rather than inlining `??` fallbacks per file. Given the file is dead code, this is moot if deleted. |              |

Already good: n/a — the file itself is the finding; no other content in `apps/web/src/components/common` reviewed here.

## Rollup

**By dimension**

- duplication: 1 (high)
- env-config: 1 (medium)

**By severity**

- high: 1
- medium: 1

**Top-3**

1. `api-readiness-placeholder.tsx` — orphaned dead-code component, zero importers, contradicts current MVP state.
2. `api-readiness-placeholder.tsx` — ad-hoc `process.env` fallback for API base URL, violates no-silent-defaults config policy.
3. (no third finding — only 2 total)

**Findings overlapping a PENDING openspec change** (handle there, not in a style sweep): none. Neither finding maps to any of the 18 pending changes listed — this is isolated dead code and an isolated env-config smell, not touched by any in-flight change.

## Killed by verification

None. Both findings from the verified input survived.
