---
name: idealist-excellence
description: >
  Operate the CustomReport idealist 1000/1000 excellence stack — which skill,
  workflow, and gate to use for style, architecture, security, comments, React,
  a11y, and whole-repo grading. Use when the user wants maximum code quality,
  "1000/1000", whole-repo review, which skill to run, or how to illuminate the
  codebase with the available review tools.
---

# Idealist excellence stack (CustomReport)

Goal: every production file could teach a junior **and** survive a hostile staff+security review. Target bar: **avg ≥950 / 1000** on `idealist-review`, zero confirmed Critical gaps, lint `--max-warnings 0` with **no** eslint exempt entry.

Do **not** invent a softer bar. Prefer evidence over vibes; adversarial-verify major claims.

## Mechanical floor first (ESLint — strict, zero tag overhead)

Do **not** re-litigate in LLM review what eslint already owns:

| Layer                                                | Enforced by                                                                                      | Notes                                                  |
| ---------------------------------------------------- | ------------------------------------------------------------------------------------------------ | ------------------------------------------------------ |
| size / complexity / immutability / import boundaries | `eslint.config.ts` + `pnpm lint` (`--max-warnings 0`)                                            | No exemptions on new code                              |
| archaeology (ticket/phase slugs)                     | `scripts/find-archaeology.mjs` (lint-staged)                                                     | Comments **and** string literals                       |
| **public JSDoc presence**                            | `jsdoc/require-jsdoc` **error** on `packages/shared` + `packages/ui` exports only (`publicOnly`) | Short `/** contract */` required                       |
| **JSDoc tag overhead**                               | `require-param` / `require-returns` / types **off**                                              | TypeScript carries params/returns — no `@param` walls  |
| JSDoc correctness when tags exist                    | `check-param-names`, `check-tag-names` **error**                                                 | If you write a tag, it must be valid                   |
| app-internal JSDoc                                   | **not** eslint (by design)                                                                       | `comment-hygiene` / review remove noise under `apps/*` |

Order: **gates → eslint clean → then** LLM workflows for judgment (architecture elegance, security reachability, dead surface taste).

## What already lives in THIS repo

| Tool                            | Path / invoke                                 | Illuminates                                               |
| ------------------------------- | --------------------------------------------- | --------------------------------------------------------- |
| **exemplary standard**          | `docs/exemplary-code-standard.md`             | The hard bar (size, immutability, comments, no fallbacks) |
| **OpenSpec**                    | `openspec/specs/`, `/openspec-*` skills       | Behavioral truth; relocate over-budget WHY here           |
| **gates**                       | `.claude/skills/gates`                        | typecheck + lint + unit — mechanical floor                |
| **comment-hygiene**             | `.grok/workflows/comment-hygiene.rhai`        | Comments, JSDoc public-only, TODO/FIXME                   |
| **idealist-review**             | `.grok/workflows/idealist-review.rhai`        | Per-file **0–1000** score, 18 dimensions                  |
| **excellence-stack**            | `.grok/workflows/excellence-stack.rhai`       | Multi-lens fan-out (this skill’s orchestration)           |
| **mass-review**                 | `.claude/skills/mass-review`                  | Whole-repo per-file verdict + artifact (Opus)             |
| **repo-excellence-review**      | `.claude/workflows/repo-excellence-review.js` | Cross-cutting prod readiness + multi-model council        |
| **vercel-react-best-practices** | `.claude/skills/vercel-react-best-practices`  | React/Next perf & patterns                                |
| **vercel-composition-patterns** | `.claude/skills/vercel-composition-patterns`  | Component API / composition                               |
| **web-design-guidelines**       | `.claude/skills/web-design-guidelines`        | UI a11y / interface guidelines                            |
| **ai-ui-driver**                | `.claude/skills/ai-ui-driver`                 | Live browser behavioral bugs                              |
| **SonarQube skills**            | plugin `sonar-*`                              | Static quality, SCA, duplication, coverage                |

## User-global skills (usually installed; use when present)

| Skill                           | Use for                                       |
| ------------------------------- | --------------------------------------------- |
| `codebase-design`               | Vocabulary: deep modules, seams, locality     |
| `improve-codebase-architecture` | Find shallow modules → HTML deepening report  |
| `code-review`                   | Diff review: **Standards** + **Spec** axes    |
| `tdd` / `diagnosing-bugs`       | Fix waves after gaps are confirmed            |
| `grilling`                      | Stress-test a proposed fix plan before coding |
| `domain-modeling`               | Naming / ubiquitous language drift            |

Optional install (not vendored here):

```bash
npx skills add obra/superpowers@requesting-code-review -g -y
npx skills add obra/superpowers@receiving-code-review -g -y
npx skills add obra/superpowers@verification-before-completion -g -y
npx skills add wshobson/agents@code-review-excellence -g -y
```

## How to illuminate — pick the right lamp

```
Question                          → Tool
─────────────────────────────────────────────────────────
"Is main even green?"             → gates
"Comments / JSDoc / TODOs?"       → comment-hygiene (audit→fix)
"Score this folder 0–1000"        → idealist-review
"Multi-lens on one root"          → excellence-stack
"Every file in the monorepo"      → mass-review (clean tree!)
"CI/authz/obs/supply-chain?"      → repo-excellence-review
"Is this module deep or shallow?" → improve-codebase-architecture
+ codebase-design vocabulary
"React perf / composition?"       → vercel-* skills (web only)
"UI a11y / guidelines?"           → web-design-guidelines
"Does the live app break?"        → ai-ui-driver
"This PR/diff vs standards+spec?" → code-review
"Static smells / SCA?"            → Sonar skills
"Did we break typecheck?"         → gates again
```

**Never** use a LLM review to re-check formatting/import order — eslint/prettier own that.

## Canonical campaign order (idealist full pass)

Work **one root at a time** (budget + reviewability). Suggested roots:

1. `packages/shared/src`
2. `packages/ui/src`
3. `apps/api/src/modules/<hot>`
4. `apps/web/src/features/<hot>`
5. Remaining modules by risk (auth, period, review, pdf)

Per root:

1. **Floor** — `gates` (or shared/ui package typecheck if mid-edit).
2. **Hygiene** — `comment-hygiene` audit → fix (doc-only).
3. **Score** — `idealist-review` → note avg / min / confirmed gaps.
4. **Lenses** — `excellence-stack` on the same root (architecture, security, elegance, web if applicable).
5. **Depth** — if architecture gaps dominate: `improve-codebase-architecture` on that subsystem.
6. **Behavior** — for web surfaces: `ai-ui-driver` on the role that hits those routes.
7. **Fix wave** — OpenSpec change if behavior changes; else doc/refactor with tests. Prefer TDD for logic.
8. **Re-score** — `idealist-review` until avg ≥950 and no Critical confirmed gaps.
9. **Archive** — results under `~/work/customreport-archive/<date>-idealist/<root>/` (not `docs/`).

Whole-repo snapshot (periodic, not every day):

1. Clean git tree.
2. `mass-review` skill procedure → artifact.
3. Optionally `repo-excellence-review` for cross-cutting P0–P3.
4. Diff against previous archive; only re-score dirty roots next time.

## Idealist 1000 dimensions (must match workflow)

See `.grok/workflows/idealist-review.rhai` RUBRIC. Eighteen subscores sum to 1000; Critical security/correctness caps total at 599.

## Agent rules when executing this skill

1. Read the **real files** (read_file/grep). No memory-only grades.
2. Fail-closed on verification: missing evidence ≠ confirmed gap.
3. Security-sensitive paths (auth, JWT, cookies, redirects, rate-limit, CSRF, secrets, authz): never strip load-bearing comments without relocate.
4. Stage **only** paths you own when committing; worktree is often dirty with parallel campaigns.
5. UI product strings stay **English**; Russian only in data/tests/comments.
6. After fixes: run the smallest honest gate (package typecheck + relevant unit tests). Full monorepo typecheck when committing if pre-push is green enough; else document residual.

## Quick commands

```bash
# Grok workflows (from agent or /workflow)
# comment hygiene
# /workflow comment-hygiene {"root":"packages/ui/src","mode":"audit"}
# /workflow comment-hygiene {"root":"packages/ui/src","mode":"fix"}

# idealist score
# /workflow idealist-review {"root":"packages/ui/src","max_files":36}

# multi-lens stack
# /workflow excellence-stack {"root":"apps/web/src/features/period","max_files":24}
```

## Done means

For a root:

- [ ] `comment-hygiene` confirmed gaps applied (or residual written)
- [ ] `idealist-review` avg ≥950 (or residual with plan)
- [ ] `excellence-stack` no unfixed Critical/High confirmed
- [ ] Package typecheck + relevant tests green
- [ ] Archive note updated outside git
