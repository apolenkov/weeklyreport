# Exemplary Code Standard — rollout plan (START HERE for the UltraCode session)

Status: PREP (branch `chore/exemplary-code-standard`). Nothing here is enforced
on `main` yet — `main` stays demo-stable. The overhaul runs folder-by-folder on
its own branches so the demo is never disrupted and any step is revertable.

Author this session (2026-06-30) from the principles the user locked while
finishing the `auth` module. The intent: a future UltraCode session reads this
doc, runs the rollout workflow, and brings the WHOLE repo to the standard below —
"максимально строгий линт, правильная архитектура, без костылей".

---

## 0. Operating constraints (read first)

- **Demo tomorrow; intern onboarding in a couple of days.** `main` must stay
  green and runnable for the demo. ALL standard/refactor work happens on
  branches (one per workstream, e.g. `refactor/<module>-exemplary`), so the user
  can show `main` and roll back any branch that misbehaves.
- **Each branch is independently revertable.** Never fold a risky ratchet into a
  commit that also carries a demo-visible feature.
- **Verify every folder before moving on**: `pnpm typecheck && pnpm lint &&
pnpm test && pnpm build` green, plus a live boot from source where a boot path
  changed (recipe: memory `api-live-verify-from-source`).

## 1. Principles (the WHY — these decide ambiguous cases)

1. **Explicit over implicit. No fallbacks, no silent defaults.** A `?? "localhost"`
   in code or a `.default()` in a config schema HIDES whether a value is
   mandatory and lets a misconfigured deploy boot with a wrong value. Product
   config is REQUIRED, read via `requireEnv`, and supplied explicitly per
   environment (`.env`, every `docker-compose*.yml`, the e2e env). Boot fails
   loud on a missing var. (Done for `apps/api` env in commit `cd4346bb`; apply
   the same everywhere, including remaining `${VAR:-default}` shell fallbacks in
   dev/base compose.)
2. **No crutches (костыли), no non-obvious magic.** Every literal a reader can't
   explain at a glance is a smell: name it with a documented constant or remove
   it. Example flagged by the user: `standardHeaders: "draft-7"` — either a named
   constant with a one-line rationale, or gone. Simple and clear beats clever.
3. **Comment hygiene — no archaeology.** A comment must explain the non-obvious
   WHY of the CURRENT code. Delete change-log / ticket / phase archaeology:
   `Phase 35-08`, `FIX-02`, `UFB-036`, `AUTH-08`, `R3a-4`, `CC-1`, `TD-06`,
   `NOTIF-01`, `36-03`, "Extracted verbatim in Wave 3", etc. — git history holds
   that; the code does not need it. (Scale, `apps/api/src` only: ~364 `Phase N`
   lines across 124 files + ~338 `UFB-/AUTH-/FIX-` refs across 119 files.) KEEP
   load-bearing rationale (e.g. the `ipKeyGenerator`/IPv6-/64 note in
   `rate-limit.middleware.ts` is real — it explains WHY), but rewrite it without
   the ticket prefix and without narrating what the code already says. Default:
   if removing the comment loses nothing a competent reader couldn't see, remove it.
4. **Functional and immutable.** `const` only; no `let`, no reassignment, no
   in-place mutation, no parameter mutation. Build new values with
   `map`/`filter`/`reduce`/spread. Pure functions; side effects isolated.
5. **Small, single-purpose units** (see thresholds below).
6. **Exemplary WITHOUT exemption — zero exemptions, zero warnings, zero errors.**
   "Lint-green" means `eslint` runs with `--max-warnings 0` (warnings ARE
   failures) AND there is NO entry for the file in any `eslint.config.ts`
   exempt/override list. Removing the exemption is the done-signal, not silencing
   the rule; a surviving warning is not "green".
7. **Correct architecture.** A module owns only its domain; cross-domain logic is
   delegated via injection (composition root wires it). dev and prod are split by
   explicit env files and dev-only modules, not by in-code branches with
   fallbacks.

## 2. Hard thresholds (the WHAT — ESLint, `src` only)

Tighten the existing ratchet (`eslint.config.ts`). Current → target:

| Rule                                       | Current | Target                                                                                                                                                     |
| ------------------------------------------ | ------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `max-lines` (skipBlankLines, skipComments) | 300     | **250**                                                                                                                                                    |
| `max-lines-per-function`                   | (none)  | **50**                                                                                                                                                     |
| `sonarjs/cognitive-complexity`             | 15      | **10**                                                                                                                                                     |
| `complexity` (cyclomatic)                  | 20      | **10**                                                                                                                                                     |
| Immutability                               | partial | `prefer-const`, `no-param-reassign`, no `let`/reassignment/mutation (eslint-plugin-functional or equivalent), `no-restricted-syntax` for in-place mutation |
| Per-folder/per-file exempt lists in `src`  | several | **none** (each removed as its folder is brought to standard)                                                                                               |

Adopt the strict, widely-vetted presets and reconcile with Prettier:
**airbnb-typescript**, **Google TS (`gts`)**, **Vercel/Next** rule sets. Where
they conflict, prefer the stricter rule; document any deliberate opt-out inline
with a one-line why (no blanket disables).

Tests keep their size/complexity exemption (long arrange/act/assert is fine), but
NOT the type-aware safety rules.

## 3. Rollout method (per folder — the proven sequence)

From memory `exemplary-module-refactor-playbook` (validated on `auth`):

1. **Recon** — read every file + its `openspec/specs/**`. Find what the module
   wrongly OWNS (cross-domain logic/persistence).
2. **Delegate out via injection** — move it home; receive a narrow injected fn
   wired in the composition root. The other module stops importing this one.
3. **Split god-files** into single-purpose files until each is < 250 lines.
4. **Extract functions** until each is ≤ 50 lines and cognitive complexity < 10.
5. **Kill fallbacks/magic, enforce immutability** per §1.
6. **Remove the folder's exemptions** from `eslint.config.ts`; confirm green
   without them. THIS is the done-signal.
7. **Dedup** — lift shared helpers to `lib/`; use canonical sources (e.g. a Zod
   schema, never a hand-maintained list).
8. **Verify (layered)** → **archive** any OpenSpec change.

## 4. Folder order (suggested; adjust on recon)

1. `apps/api/src/modules/*` (one module per branch — period, reminders,
   pdf-export, admin, report-sections, organization, …)
2. `apps/api/src/infrastructure/*`
3. `apps/web/src/*` (components, then app routes)
4. `packages/shared`, `packages/ui`

Do the global ESLint threshold tightening LAST as a single ratchet commit, after
every folder is already compliant — otherwise the tree goes red everywhere at
once. Until then, tighten per-folder via local overrides that you then delete.

## 5. OpenSpec backlog (≈34 active changes)

`openspec list` shows a large backlog. For the UltraCode session:

1. Triage: for each change, `openspec show <name>` → state = (proposal only |
   specced | partially implemented | ready). Group by risk.
2. Implement ready/low-risk ones first (each on its own branch), gate, archive.
3. High-stakes ones (auth/schema/concurrency/migrations) → run `/grill-me-codex`
   or `/codex-review` on the plan first, then implement, then `/code-review`.
4. Some may be obsolete post-overhaul — close with a note, don't implement blind.

## 6. How to launch (new UltraCode session)

1. `git checkout main && git pull` then branch per workstream.
2. Read this doc + memory `exemplary-module-refactor-playbook`.
3. Run the rollout workflow: `.claude/workflows/exemplary-rollout.js`
   (Workflow tool / "ultracode"). It fans out recon → fix → verify → review per
   target folder. Start with ONE module to calibrate, then scale.
4. After each folder: gates green, exemption removed, commit on the branch.
5. Keep `main` untouched until the user merges a verified branch.

## 7. Done definition (whole repo)

- Every `src` file < 250 lines; every function ≤ 50 lines, cognitive complexity
  < 10; zero `let`/mutation; zero `eslint.config.ts` exempt entries for `src`.
- `pnpm lint` runs clean with `--max-warnings 0` — **zero errors AND zero
  warnings** across the repo (a warning is a failure, not an acceptable state).
- Zero config fallbacks/defaults for product-critical values; boot fails loud.
- Airbnb/Google/Vercel strict rule sets active, Prettier-reconciled.
- The OpenSpec backlog triaged: implemented+archived or explicitly closed.
- `main` was demo-stable throughout; every overhaul step landed via a revertable
  branch.
