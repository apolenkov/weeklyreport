# CustomReport Codebase Learning — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: use `superpowers:subagent-driven-development` (already in flight for this plan) or `superpowers:executing-plans`. Steps use checkbox (`- [ ]`) syntax. This plan covers a **learn / synthesize** task, not a code-change task, so steps construct knowledge artifacts (markdown summaries, memory entries) instead of code + tests.

**Goal:** Produce a durable mental map of the customreport monorepo (≈630 source files + 751 `.planning/` files + 38 Prisma migrations) so future sessions can act without re-discovering structure.

**Architecture:** Fan-out a fresh subagent per domain partition. Each subagent reads its file list in full and writes a dense markdown summary to `/tmp/customreport-learn-<id>.md`. Main orchestrator reads summaries (not raw files) and synthesizes them into one durable artifact under `.planning/codebase/`, plus 3–5 auto-memory entries for the highest-leverage findings.

**Tech Stack (target codebase, not the plan itself):** Next.js 16 + React 19 + Tailwind v4 + shadcn (web); NestJS 11 + tRPC 11 + Prisma 7 (api); PostgreSQL 15 + Redis 7 + BullMQ + OpenTelemetry/Loki/Grafana/Bugsink (infra); SAML + Keycloak + JWT (auth).

---

## Status Snapshot (2026-05-25 11:5x GMT+3)

```
┌─ partitions ──────────────────────────────────────────────────────────┐
│ A  root configs + CI + husky                           ✓ done (main)  │
│ B  prisma (schema + 38 migrations + seeds)             ✓ done         │
│ C  packages/shared/src                                 ✓ done         │
│ D  packages/ui/src                                     ✓ done         │
│ E  apps/api modules part 1 (auth/admin/period/...)     ✓ done         │
│ F  apps/api modules part 2 (ai/archive/.../telegram)   ✓ done         │
│ G  apps/api/src/infrastructure + lib + test-utils      ✓ done         │
│ J  tests + tools + scripts + deploy + docs             ✓ done         │
│ K  .planning core state                                ← in flight    │
│ L  .planning historical map                            ← in flight    │
│ H  apps/web app/ routes + middleware + next configs    ← T1 dispatch  │
│ I-comp  apps/web/src/components/* (152 files)          ← T1 dispatch  │
│ I-lib   apps/web/src/{hooks,lib,server,styles,test}    ← T1 dispatch  │
│ T2–T6   synthesis + memory + reply                     ← after waves  │
└───────────────────────────────────────────────────────────────────────┘
```

---

## File Structure

| Artifact                                                                        | Owner                | Purpose           |
| ------------------------------------------------------------------------------- | -------------------- | ----------------- |
| `/tmp/customreport-learn-{B,C,D,E,F,G,J,K,L}.md`                                | wave 1/2/4 subagents | DONE / in flight  |
| `/tmp/customreport-learn-H-web-routes.md`                                       | wave 3 subagent      | T1                |
| `/tmp/customreport-learn-I-comp-web.md`                                         | wave 3 subagent      | T1                |
| `/tmp/customreport-learn-I-lib-web.md`                                          | wave 3 subagent      | T1                |
| `.planning/codebase/CODEBASE-MAP-2026-05-25.md`                                 | main orchestrator    | T3 (durable)      |
| `/Users/ap/.claude/projects/-Users-ap-work-customreport/memory/<slug>.md` × 3–5 | main orchestrator    | T4 (auto-memory)  |
| `/Users/ap/.claude/projects/-Users-ap-work-customreport/memory/MEMORY.md`       | main orchestrator    | T5 (index update) |

---

## Tasks

### Task T1 — Dispatch wave 3 (H + I-comp + I-lib)

**Files (created by subagents):**

- Create: `/tmp/customreport-learn-H-web-routes.md`
- Create: `/tmp/customreport-learn-I-comp-web.md`
- Create: `/tmp/customreport-learn-I-lib-web.md`

- [ ] **Step 1: Dispatch all three Sonnet subagents in a SINGLE message (3 parallel Agent calls).**

Each subagent gets a self-contained prompt. The prompt MUST include:

1. Repo context paragraph (Next.js 16 + React 19 + Tailwind v4 + shadcn + tRPC client; consumes `@customreport/shared` and `@customreport/ui`).
2. Exact file list OR explicit instructions to walk a directory.
3. Output schema (sections required) + output file path.
4. "Be terse, ASCII-first, file:line citations, reply with `DONE: wrote /tmp/customreport-learn-<id>.md (N lines). Read X files.`" template.

For H — exact file list (~30 entries): all under `apps/web/src/app/` (the 28 page/layout/route/api files already enumerated upstream) + `apps/web/middleware.ts` + `apps/web/proxy.test.ts` + `apps/web/next.config.ts` + `apps/web/instrumentation.ts` + `apps/web/sentry.{server,client,edge}.config.ts` + `apps/web/playwright.{config,integration.config,regression.config}.ts` + `apps/web/vitest.config.ts` + `apps/web/vitest.setup.ts` + `apps/web/tsconfig.json` + `apps/web/package.json` + `apps/web/README.md` + `apps/web/uat-suite/mutation-audit.md` (read-only — already partially covered in J).

For I-comp — walk `apps/web/src/components/` (152 files across admin/ai/auth/charts/common/dashboard/dev/head/landing/lead/navigation/report-shell/search/slides/ui/weekly-report). Subagent uses Bash `find` + `Read` per file. Output schema groups by subdir.

For I-lib — explicit file list (~58): `apps/web/src/hooks/*.ts` (6) + `apps/web/src/lib/**/*.ts` (45, including `lib/server/`, `lib/mappers/`) + `apps/web/src/server/auth/*.ts` (1) + `apps/web/src/styles/*.css` (2) + `apps/web/src/test/*.{ts,tsx}` (4).

Set `run_in_background: true` on all three. Capture `agentId` and give each a `name` (lc-H-web-routes, lc-I-comp, lc-I-lib).

- [ ] **Step 2: Mark TaskList entries 401, 412, 413 as `in_progress` while waiting.**
- [ ] **Step 3: End the turn. Subagents notify on completion. Do NOT poll.**

**Acceptance:** three completion notifications, three summary files on disk, total lines ≤ ~2000.

---

### Task T2 — Read all 13 summary files

- [ ] **Step 1: Wait for all wave-3 + wave-4 completions.** K, L, H, I-comp, I-lib must all report DONE. Failures: re-dispatch with same prompt + tighter scope. If the same partition fails twice, escalate to user.

- [ ] **Step 2: Read each summary file in full** (these are ~300–700 lines each, total ≈ 5–7k lines / ~50–70k tokens — fits comfortably in main context):

```
Read /tmp/customreport-learn-B-prisma.md
Read /tmp/customreport-learn-C-shared.md
Read /tmp/customreport-learn-D-ui.md
Read /tmp/customreport-learn-E-api-core.md
Read /tmp/customreport-learn-F-api-secondary.md
Read /tmp/customreport-learn-G-api-infra.md
Read /tmp/customreport-learn-H-web-routes.md
Read /tmp/customreport-learn-I-comp-web.md
Read /tmp/customreport-learn-I-lib-web.md
Read /tmp/customreport-learn-J-meta.md
Read /tmp/customreport-learn-K-planning-core.md
Read /tmp/customreport-learn-L-planning-historical.md
```

Files already read in earlier turns can be skipped if still in working memory.

- [ ] **Step 3: Mark TaskList entries 404, 405, 401, 412, 413 as `completed`** as each summary lands.

**Acceptance:** 12 summary files read (A is in main context, not a file).

---

### Task T3 — Synthesize `.planning/codebase/CODEBASE-MAP-2026-05-25.md`

**Files:**

- Create: `/Users/ap/work/customreport/.planning/codebase/CODEBASE-MAP-2026-05-25.md`

- [ ] **Step 1: Write the synthesis using this skeleton** (≤ 800 lines; ASCII-first; cite file:line where useful):

```markdown
# CustomReport — Codebase Mental Map (2026-05-25)

## 0. One-paragraph orientation

[branch, milestone, what the system does in 4 sentences]

## 1. Monorepo layout (tree)

[ASCII tree: apps/{web,api}, packages/{shared,ui}, prisma, tests, tools, scripts, deploy, docs, .planning]

## 2. Domain model (Prisma)

[28 models clustered by aggregate; key invariants; dual state machine on Report; partial unique index quirk]

## 3. Roles + authz

[lead / head / admin (= head guard) / viewer / director (removed) — table of capabilities, role-coverage gate mechanics]

## 4. API surface (tRPC)

[router tree by namespace; head/admin/viewer gates; mutation audit gate; error mapper]

## 5. Frontend routing + role flow

[App Router groups, layouts, redirects, role-based landing pages]

## 6. Cross-cutting infra

[Prisma + pgbouncer, BullMQ queues, OTel/Loki/Tempo, Bugsink, Caddy, SAML+Keycloak vs dev-login, AUTH-fence + env.schema fences]

## 7. AI module (load-bearing)

[Facade boundary, token budget, sanitize layer, cache, mock vs real adapter]

## 8. Reminders engine

[Policy → rule compilation, scheduler, dedupe, DST math]

## 9. Most fragile / surprising patterns

[Pulled directly from each subagent's flagged-findings paragraph]

## 10. Test pyramid

[shared ~587 / api ~921 / web ~500 / e2e auto-generated from UAT-SCENARIO]

## 11. Deploy + observability

[docker-compose layers: base/dev/prod/observability/errors; Grafana dashboards; alert rules]

## 12. .planning/ navigation

[which subdir holds what; recent active threads]

## 13. Gotchas a new agent must know first

[10-item ranked checklist drawn from the subagents' flagged findings]
```

- [ ] **Step 2: Verify required sections are present** by grepping the file: `rg -c '^##' .planning/codebase/CODEBASE-MAP-2026-05-25.md` ≥ 13 sections (0–13). If fewer, fill the gap.

- [ ] **Step 3: Mark TaskList synthesis entry as `completed`.**

**Acceptance:** durable file exists, 13 sections present, ≤ 800 lines.

---

### Task T4 — Write 3–5 auto-memory entries

**Files:**

- Create (each ~30 lines):
  - `/Users/ap/.claude/projects/-Users-ap-work-customreport/memory/project_codebase_map_2026_05_25.md`
  - `/Users/ap/.claude/projects/-Users-ap-work-customreport/memory/project_prisma_quirks.md`
  - `/Users/ap/.claude/projects/-Users-ap-work-customreport/memory/project_ai_module_architecture.md`
  - `/Users/ap/.claude/projects/-Users-ap-work-customreport/memory/feedback_role_coverage_gate.md`
  - `/Users/ap/.claude/projects/-Users-ap-work-customreport/memory/project_period_dual_state_invariant.md`

- [ ] **Step 1: For each entry use the standard auto-memory frontmatter:**

```markdown
---
name: <short-kebab-slug>
description: <one-line summary>
metadata:
  type: <user|feedback|project|reference>
---

<body — for feedback/project: rule/fact, **Why:**, **How to apply:**>
[[link-other-memory-slug]] for cross-refs
```

- [ ] **Step 2: Save each file via Write tool.** Pre-existing memory directory is at `/Users/ap/.claude/projects/-Users-ap-work-customreport/memory/` — do NOT mkdir, it already exists per global instructions.

**Acceptance:** 3–5 files saved; each has valid frontmatter.

---

### Task T5 — Update `MEMORY.md` index

**Files:**

- Modify: `/Users/ap/.claude/projects/-Users-ap-work-customreport/memory/MEMORY.md`

- [ ] **Step 1: Read MEMORY.md** to see current entries.

- [ ] **Step 2: Append one line per new memory file** in the established format:

```markdown
- [Title](slug.md) — one-line hook
```

- [ ] **Step 3: Verify MEMORY.md is still under ~200 lines** (lines after 200 are truncated per global instructions).

**Acceptance:** MEMORY.md contains pointers to all new memory files; total ≤ 200 lines.

---

### Task T6 — Final user-facing reply

- [ ] **Step 1: Produce the closing message** with this shape (≤ 30 lines):

```
✓ Я ДЕЛАЮ САМ
─────────────
  ├── read 660+ source files across 13 partitions    ✓ done
  ├── 12 summaries on disk (/tmp/customreport-learn-*.md)
  ├── synthesis at .planning/codebase/CODEBASE-MAP-2026-05-25.md
  └── 3–5 auto-memory entries written

▲ ОТ ТЕБЯ
─────────
  (ничего — если нужна follow-up детализация какого-то слоя, скажи и я подниму нужный summary)
```

Plus 1–2 paragraph highlight of the 3 most surprising findings across the codebase (combine subagent observations from prisma, ai, role-coverage, period dual-state).

**Acceptance:** user reads one screen and knows (a) it's done, (b) where the durable map lives, (c) what to ask next.

---

## Self-Review

**1. Coverage:** Every source directory has a subagent or main-context owner (A in main; B/C/D/E/F/G/H/I-comp/I-lib/J/K/L in subagents). `.playwright-mcp/` is intentionally skipped (auto-generated debug snapshots). `pnpm-lock.yaml` skipped (lock file).

**2. Placeholder scan:** No "TBD" / "fill in later" / "similar to task N" sentinels. Each task lists concrete file paths and content templates.

**3. Type consistency:** Memory filename slugs use `_` not `-` (matches existing pattern). Summary filenames use `-` (matches existing `/tmp/customreport-learn-*.md`).

**4. Quota discipline:** Wave-3 dispatch (3 Sonnet) only after wave-2 (3 Sonnet) drained — verified via completion notifications before firing. Total Sonnet in flight never > 4.

---

## Execution choice

**Already chosen:** `superpowers:subagent-driven-development` (in flight). T1 dispatches happen alongside this plan write.
