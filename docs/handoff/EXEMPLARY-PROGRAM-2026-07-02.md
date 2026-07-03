# Exemplary Program Map — 2026-07-02

The owner's mandate: bring the whole repo to "senior-level ideal" — instantly
scannable files, terse comments, named non-obvious literals, small functions,
domain-driven placement, disciplined env. His line-level feedback on the auth
module is the calibration ground truth (taste profile below). This doc is the
PROCESS map — durable requirements live in `openspec/specs/`; this file only
routes work. Companion change: `openspec/changes/tighten-comment-policy/`.

## 1. Taste profile (locked from the owner's auth feedback)

- Files instantly scannable; functions ~15–25 lines ideal, ≤50 hard.
- Comments: default none; ≤3-line non-obvious WHY only; no JSDoc on
  app-internal functions; long rationale lives in specs/ADRs (relocation-first
  — see `tighten-comment-policy`).
- Constants — STRICT (owner: "всё должно быть в константах"): every magic
  number and string gets a named, documented constant; cross-file contracts
  live in `packages/shared`. Inline is allowed ONLY for the lint-exempt trivia
  set (0, 1, -1, 2, array indexes) and values that are literally their own
  name. Enforcement: `@typescript-eslint/no-magic-numbers` +
  `sonarjs/no-duplicate-string` as errors via `tighten-code-quality-ratchet`;
  one-off strings via the review gate (no TS-aware lint rule exists).
- Parameters: ≤2 positional when unambiguous; options-object at ≥3, same-typed
  adjacent, or boolean flags.
- Functional/immutable, no config fallbacks, lazy env reads (all already in
  `docs/exemplary-code-standard.md`).

## 2. Dimension → owner map (NO new parallel track; reuse the backlog)

| Dimension                                          | Owner                                                                        | Status                                                                               |
| -------------------------------------------------- | ---------------------------------------------------------------------------- | ------------------------------------------------------------------------------------ |
| Size/complexity thresholds, magic numbers/strings  | `tighten-code-quality-ratchet` (active change)                               | scaffolded, unimplemented                                                            |
| Duplication, dead code, drift-prone parallel logic | `code-health-and-test-cleanup` (active change)                               | scaffolded, unimplemented                                                            |
| Comment policy                                     | `tighten-comment-policy` (NEW, this session)                                 | authored, in review                                                                  |
| God-file decomposition targets                     | `architecture-refactor-backlog` spec                                         | recorded                                                                             |
| Correctness/security/authz                         | Waves A–D of the 2026-06-28 review backlog                                   | partially committed — verify per change via git log (openspec task counts overstate) |
| Per-folder mechanical rollout                      | `.claude/workflows/exemplary-rollout.js` + `docs/exemplary-code-standard.md` | live; gains comment dimension via task 1.2                                           |

## 3. Recon findings needing NEW homes (2026-07-02 sweep)

1. **`apps/web` has NO env validation** — Next reads env with fallback chains
   (`next.config.ts` API_URL → localhost) while `apps/api` fails loud via
   `env.schema.ts`. Violates the no-fallback rule. → candidate change
   `add-web-env-schema` (Zod schema for web-consumed vars, kill the chain).
2. **Redis host/port fallback to localhost** in
   `apps/api/src/infrastructure/bullmq/bullmq-options.ts` — same rule. → fold
   into the same env-discipline change.
3. **Role→route maps duplicated AND diverged**: `DEV_LOGIN_REDIRECT_BY_ROLE`
   (api dev-login) vs web's login-page map — viewer gets
   `/reports?tab=published` vs `/reports/latest`; the api comment even points
   at the wrong file. Real bug, not just style. → single map in
   `packages/shared`; also kills the dev-email duplicate. Candidate: fold into
   `code-health-and-test-cleanup` (its charter) rather than a new change.
4. **Single-file folders** (`components/review/` orphan vs
   `weekly-report/review/`, `components/common/`, `infrastructure/filters/`,
   `web/src/server/auth/`) — placement debt; NOTE: `components/review/` is
   being actively written by a parallel session — do not move until its work
   commits. → handled inside each folder's exemplary sweep, no separate change.
5. **`lib/mappers` flat 25-file pile** — needs domain subfoldering during the
   web sweep.

## 4. Env layering policy (answer to "why is env at different levels?")

Target shape (mostly true today; two gaps above):

```
root .env / .env.example / compose files   = SUPPLY point (per environment)
apps/<app>/…/env.schema.ts (Zod, no defaults) = the ONLY read+validate point
code (requireEnv / typed config object)       = consumes the validated object
```

Root holds values; each app validates what IT consumes at boot; nothing reads
`process.env` ad hoc, nothing defaults. api complies; web does not (gap 3.1).

## 5. Review skills → audit dimensions (owner: "запускай ревью-скиллы")

| Folder class          | Skills to apply in per-file audits                                                          |
| --------------------- | ------------------------------------------------------------------------------------------- |
| `apps/api` modules    | code-review-skill (NestJS/TS), simplify, security-review (auth-adjacent)                    |
| `apps/web` components | vercel-react-best-practices, vercel-composition-patterns, web-design-guidelines (a11y)      |
| `packages/*`          | code-review-skill (API-surface focus)                                                       |
| whole repo            | repo-excellence-review — already ran 2026-06-28; do NOT re-run until its backlog burns down |

## 6. Sequencing rules (shared tree, ~40 open changes)

1. **Audits are read-only** → run any time, any folder, parallel-safe.
2. **Fix sweeps are folder-scoped** and start only when (a) `git status` is
   clean for that folder, and (b) no active change owns the folder — else the
   style fix folds INTO that change's implementation, never a second diff.
3. Correctness waves (A→D) outrank style sweeps on the same folder.
4. Bulk refactor waves go on a branch per folder (revertable); small fixes may
   ride main per MVP rules.
5. Every sweep ends with gates + exemption removal + comment-review pass.

## 7. Pilots (read-only, calibration)

Each report carries an empty "Your verdict" column — the owner's like/dislike
pass is the calibration signal that tunes the taste profile before scaling.

1. **api**: `apps/api/src/modules/period` (9 src files) — DONE, 86 verified
   findings (3 killed by the adversarial pass) →
   `docs/audit/period-pilot-2026-07-02.md`.
2. **web**: `apps/web/src/components/report-shell` (11 src files, untouched by
   the parallel session; adds React/a11y dimensions) — DONE, 66 verified
   findings (2 killed) → `docs/audit/report-shell-pilot-2026-07-02.md`.
   Headline: a card-surface style mega-literal duplicated across 8+ files —
   a shared-idiom extraction candidate for `packages/ui`.

## 8. Next actions

1. Owner veto pass: `tighten-comment-policy` design.md calibration table.
2. Implement `tighten-comment-policy` tasks 1.x (doc + workflow), then the
   auth exemplar sweep when the folder is quiet.
3. Author `add-web-env-schema`; route finding 3.3 into
   `code-health-and-test-cleanup`.
4. Resume the backlog waves; fold style dimensions into each change touched.
5. Scale per-file audits folder-by-folder using the updated workflow; the
   owner's verdict column from each pilot feeds the taste profile.
