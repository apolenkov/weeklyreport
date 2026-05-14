# Stack Research — CustomReport v6.0 Additions

**Domain:** Internal weekly status-report SaaS — adding AI insights, trend analytics, mobile polish, real SAML, and email reminders to an existing v5.0 codebase.
**Researched:** 2026-04-26
**Confidence:** HIGH (Context7-verified for all new deps; existing stack untouched)

> **Scope guard.** This research is **strictly additive**. The v5.0 stack (Next.js 16, NestJS 11, tRPC 11, Prisma 7, PostgreSQL 15, Redis 7, BullMQ 5, Vitest 4, Playwright 1.50, shadcn/ui, Tailwind v4, Zod 4, `@node-saml/passport-saml` 4.x, Keycloak 26, nodemailer) is **not re-evaluated**. Documented in [`CLAUDE.md`](/home/user/my/customreport/CLAUDE.md). This file lists **only what v6.0 features A–G need on top of that**.

## Executive Summary

Of seven feature areas, **only three require new npm packages**:

| Feature area              | New deps?                | What                                                                                                             |
| ------------------------- | ------------------------ | ---------------------------------------------------------------------------------------------------------------- |
| **A — Auth & roles**      | No                       | Custom tRPC middleware on top of existing JWT/SAML; NestJS guards stay at HTTP boundary                          |
| **B — Quality polish**    | No                       | Config + cleanup only                                                                                            |
| **C — AI features**       | **Yes**                  | `@anthropic-ai/sdk` (1 dep, used in `apps/api/src/modules/ai/`)                                                  |
| **D — Trend analytics**   | **Yes**                  | `recharts` + shadcn/ui chart components (1 runtime dep + CLI install, used in `apps/web/src/components/charts/`) |
| **E — Email reminders**   | **Yes (templates only)** | `react-email` + `@react-email/components` (templates rendered to HTML for existing nodemailer pipeline)          |
| **F — Mobile polish**     | No                       | New Playwright project (mobile viewports) using existing `@playwright/test`                                      |
| **G — Release checklist** | No                       | Markdown convention only                                                                                         |

**Net additions: 4 npm packages** (`@anthropic-ai/sdk`, `recharts`, `react-email`, `@react-email/components`). All TypeScript-native, all Tailwind/Zod-native, all keep the monorepo single-language. No Python AI service. No LangChain. No Vercel AI SDK abstraction. No charting heavy-weight (Plotly/D3). No Storybook.

## Recommended Stack — New Additions

### AI (feature area C)

| Technology              | Version                                           | Purpose                              | Why Recommended                                                                                                                                                                                                                     |
| ----------------------- | ------------------------------------------------- | ------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **`@anthropic-ai/sdk`** | `^0.90.0` (latest as of 2026-04-23, verified npm) | Direct Claude API access from NestJS | Official SDK, ships `betaZodTool` + `toolRunner` helpers that consume Zod schemas from `packages/shared` — no JSON Schema duplication. Native streaming, built-in `cache_control` + `tool_choice` + token usage in `message.usage`. |

**Models — assignment by task:**

| Task                                                                                                                         | Model          | API name            | Rationale                                                                                                                                                                       |
| ---------------------------------------------------------------------------------------------------------------------------- | -------------- | ------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Auto-summarization of weekly report (per section + assembled)                                                                | **Haiku 4.5**  | `claude-haiku-4-5`  | Narrow transformation (text → bullet summary), latency-sensitive (BullMQ job, but user waits to read). Cheapest tier sufficient.                                                |
| Sentiment classification on Risks (concerning / neutral / low_risk)                                                          | **Haiku 4.5**  | `claude-haiku-4-5`  | Classification with constrained output (Zod enum via `betaZodTool`), no multi-step reasoning needed.                                                                            |
| Smart "on track" judgement on traffic lights (project status across multiple signals: status + items + risks + carried-over) | **Sonnet 4.6** | `claude-sonnet-4-6` | Multi-signal reasoning, reconciles green/yellow/red with risk text and item completion — Haiku underperforms on contradiction detection.                                        |
| **NOT used for v6.0:** Opus 4.7                                                                                              | —              | `claude-opus-4-7`   | Available (released 2026-04-16) but overkill for these tasks. Sonnet 4.6 sufficient at ~1/5 cost. Document as future option for hypothetical "rewrite my whole report" feature. |

**Structured output pattern — forced tool use with Zod:**

```typescript
// apps/api/src/modules/ai/tools/sentiment.tool.ts
import { betaZodTool } from "@anthropic-ai/sdk/helpers/beta/zod";
import { z } from "zod";

export const sentimentTool = betaZodTool({
  name: "classify_sentiment",
  description: "Classify the sentiment of a risk statement.",
  inputSchema: z.object({
    sentiment: z.enum(["concerning", "neutral", "low_risk"]),
    rationale: z.string().max(200),
    confidence: z.number().min(0).max(1),
  }),
  run: async (input) => JSON.stringify(input), // pass-through; we read input directly
});

// Force the model to call the tool — guarantees structured output
const response = await client.messages.create({
  model: "claude-haiku-4-5",
  max_tokens: 256,
  tool_choice: { type: "tool", name: "classify_sentiment" },
  tools: [sentimentTool],
  messages: [
    /* ... */
  ],
});
```

> **Why forced tool use over plain JSON-mode prompting:** Anthropic's canonical pattern, fails closed (model cannot return free text), Zod schema is the single source of truth, errors are caught at the SDK boundary not after parsing.

**Prompt caching — cost optimization for repeated rubrics:**

The system prompt that contains the report rubric (project list, traffic-light criteria, "what counts as on-track") is identical across all 6 leads each week. Mark it with `cache_control` to pay once and read 5× cheaper:

```typescript
const response = await client.messages.create({
  model: "claude-sonnet-4-6",
  system: [
    { type: "text", text: REPORT_RUBRIC, cache_control: { type: "ephemeral" } },
  ],
  // ...
});
```

- **Default TTL: 5 minutes.** Sufficient if all 6 lead sections are summarized within the same job batch.
- **1-hour TTL** (`cache_control: { type: 'ephemeral', ttl: '1h' }`) costs 2× write but is only worth it if jobs span >5 min.
- **Hard constraint:** Cache breakpoint requires **≥1,024 tokens** in the cached segment, otherwise silently ignored. The rubric must be that big — flag this for AI-SPEC validation.
- Pricing reference: 5m write = 1.25× input price, 1h write = 2× input price, cache read = 0.1× input price.

**Cost & token tracking — required Prisma model:**

```prisma
// add to apps/api/prisma/schema.prisma in v6.0
model AiInsight {
  id                    String   @id @default(cuid())
  reportId              String
  type                  String   // 'summary' | 'sentiment' | 'on_track_judgement'
  model                 String   // 'claude-haiku-4-5' | 'claude-sonnet-4-6'
  inputTokens           Int
  outputTokens          Int
  cacheCreationTokens   Int      @default(0)
  cacheReadTokens       Int      @default(0)
  costUsd               Decimal  @db.Decimal(10, 6)
  latencyMs             Int
  createdAt             DateTime @default(now())
  // ... payload fields by type (jsonb)
  @@index([reportId])
  @@index([createdAt])
}
```

Read `message.usage.input_tokens / output_tokens / cache_creation_input_tokens / cache_read_input_tokens` after every call and persist. **Without this model, cost auditability is lost** — flag as roadmap requirement, not optional.

**Integration points (named, for the roadmapper):**

- New module: `apps/api/src/modules/ai/`
  - `ai.service.ts` — single `AnthropicClient` instance, `summarize() / classifySentiment() / judgeStatus()` methods
  - `ai.router.ts` — tRPC procedures `ai.summary.get`, `ai.sentiment.list`, `ai.judgement.get`; **all invoked from existing tRPC layer**, never directly from frontend
  - `prompts/` — markdown files with rubric content, imported as strings (so prompt diffs show in git)
  - `processors/ai-summary.processor.ts` — BullMQ processor for slow async summarization (5–30 s); sentiment + judgement run sync within tRPC request budget (<2 s for Haiku)
  - `tools/{sentiment,judgement}.tool.ts` — Zod-typed `betaZodTool` definitions
- New env: `ANTHROPIC_API_KEY` (required), `ANTHROPIC_MODEL_FAST` (default `claude-haiku-4-5`), `ANTHROPIC_MODEL_REASONING` (default `claude-sonnet-4-6`) — make swappable for cost experiments without code change
- Existing tRPC `protectedProcedure` is reused; AI procedures gated behind `head` role (lead-facing AI summaries are an open product question for AI-SPEC)

### Charts (feature area D)

| Technology          | Version                                                       | Purpose                                 | Why Recommended                                                                                                                                                                                                                                                                                                     |
| ------------------- | ------------------------------------------------------------- | --------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **`recharts`**      | `^3.3.0` (verified Context7)                                  | React + D3 charting library             | Composable React components, native SVG (no canvas), built-in responsive container, `isAnimationActive={false}` for SSR. **Used as the engine; we don't write Recharts directly.**                                                                                                                                  |
| **`react-is`**      | aligned with React 19                                         | Recharts peer dep                       | Required by `recharts`                                                                                                                                                                                                                                                                                              |
| **shadcn/ui Chart** | latest (CLI: `pnpm --filter web dlx shadcn@latest add chart`) | shadcn wrapper components over Recharts | **This is the actual surface we use.** Reads chart colors from Tailwind v4 CSS variables (`--chart-1`...`--chart-5`), so traffic-light history graphs automatically match the existing Starbucks design system. Zero theme wiring. Composable: drop into `<ChartContainer>` and Recharts pieces become theme-aware. |

**Why shadcn/ui Chart, not raw Recharts:**

1. **Tailwind v4 theme integration** — colors come from CSS variables we already define for the cream/teal/gold palette. Switching dark mode "just works."
2. **Same composition pattern** as the existing 30+ shadcn components in the codebase. No new mental model.
3. **No abstraction lock-in** — when Recharts ships v4, we follow Recharts' upgrade path directly. shadcn copy-paste means we own the wrapper code.
4. **AI-friendly** (the project's stated reason for shadcn elsewhere) — Claude Code can generate chart shapes by example.

**Charts needed for D:**

- Traffic-light history per project: **stacked bar chart** (week on X, count of green/yellow/red on Y) → `BarChart` + `Bar` (stackId)
- Velocity per lead: **line chart** (week on X, items-completed on Y, one line per lead) → `LineChart` + multiple `Line`
- Period-over-period comparison: **dual-axis or paired bar** (current week vs prior week) → `ComposedChart`

All three shapes are first-class shadcn/ui chart variants — no exotic chart customization needed.

**SSR caveat (must flag for roadmapper):**

- `<ResponsiveContainer>` measures DOM, requires `'use client'` boundary
- Convention: `apps/web/src/components/charts/*.tsx` are all client components; pages stay RSC and lazy-import the chart wrappers
- Disable animations on initial render (`isAnimationActive={false}`) to avoid hydration jitter under React 19 + Turbopack

**Integration points:**

- New folder: `apps/web/src/components/charts/`
  - `traffic-light-history.chart.tsx`, `lead-velocity.chart.tsx`, `period-comparison.chart.tsx`
- New tRPC procedures: `analytics.trafficLightHistory`, `analytics.leadVelocity`, `analytics.periodComparison` (all aggregate queries on existing Report/ProjectStatus/Item models)
- New page: `apps/web/src/app/(head)/analytics/page.tsx` — head/admin only

**Fallback:** if a future chart shape is not in shadcn's catalog (unlikely for these three), drop one level down and use Recharts directly. Both libs are already in `package.json` after the v6.0 install.

### Email Templates (feature area E)

| Technology                    | Version                                   | Purpose                                                                          | Why Recommended                                                                                                                                                                                              |
| ----------------------------- | ----------------------------------------- | -------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| **`react-email`**             | `^3.x` (latest stable, Context7-verified) | CLI + dev preview server for `.tsx` email templates                              | Live preview at `localhost` during dev, no manual HTML reload loop                                                                                                                                           |
| **`@react-email/components`** | `^0.x` (latest stable)                    | Pre-built email-safe React components (Html, Body, Section, Tailwind, Button, …) | Handles the Outlook/Gmail/Apple Mail rendering quirks we don't want to handcraft. Inline styles auto-generated from Tailwind classes via `<Tailwind>` wrapper — same utility classes as the rest of the app. |

**Why react-email and not MJML or raw HTML:**

- **React/TypeScript native.** Type-checked props, importable from `packages/shared`, lives in the monorepo with everything else.
- **Tailwind classes work in emails.** `<Tailwind>` component compiles classes to inline styles at render time — no separate CSS pipeline, brand colors stay consistent with the web UI.
- **MJML rejected:** XML DSL, separate build step, no React, weaker type safety.
- **Raw HTML strings rejected:** maintenance nightmare, cannot review safely, no compiler help.

**Existing infra is enough — confirmed:**

- BullMQ already wired (`apps/api/src/modules/queues/`, used by pdf-export in v5.0)
- nodemailer already wired (used in v2.0 reminders)
- v6.0 only adds: (a) react-email templates, (b) a new BullMQ queue/processor for weekly-deadline + escalation, (c) a render-and-send helper

**Pattern (matches existing pdf-export structure):**

```typescript
// apps/api/src/modules/email/email.service.ts
import { render } from '@react-email/components';
import { ReminderEmail } from './templates/reminder.email';

const html = await render(<ReminderEmail leadName={…} deadline={…} />);
const text = await render(<ReminderEmail leadName={…} deadline={…} />, { plainText: true });
await this.transporter.sendMail({ from, to, subject, html, text });
```

> Always send both `html` and `text` (corporate spam filters score multipart higher; `react-email` renders both from the same component).

**Integration points:**

- New folder: `apps/api/src/modules/email/templates/*.email.tsx` — one component per email type (`reminder.email.tsx`, `escalation.email.tsx`, future: `report-published.email.tsx`)
- New BullMQ queue: `email-reminders` with cron-like delayed jobs (BullMQ supports this natively via `repeat` options)
- Reuse existing `MAIL_FROM`, `SMTP_*` env vars
- Dev preview: add `pnpm --filter api email:dev` script that runs `react-email dev` against `templates/` — opens local UI for visual review

### RBAC (feature area A)

**No new dependencies.** RBAC layered as tRPC middleware on top of the existing JWT-authenticated tRPC `protectedProcedure`.

| Component                  | Where                                         | What                                                                                                                                                                 |
| -------------------------- | --------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| HTTP boundary              | NestJS guards (existing)                      | `JwtAuthGuard` validates the SAML-issued JWT, populates `req.user = { id, role, … }`                                                                                 |
| tRPC context               | `createContext()` (existing)                  | Reads `req.user`, exposes as `ctx.user`                                                                                                                              |
| **NEW: Role middleware**   | `packages/shared/src/trpc/middleware/role.ts` | Factory `requireRole(['head', 'admin'])` returns a middleware that throws `TRPCError({ code: 'FORBIDDEN' })` if `ctx.user.role` is missing or not in the allowed set |
| **NEW: Procedure helpers** | `packages/shared/src/trpc/builders.ts`        | `headProcedure = protectedProcedure.use(requireRole(['head', 'admin']))`, `adminProcedure`, `leadProcedure`, `viewerProcedure` (read-only)                           |

**Why no `trpc-shield` and no other RBAC library:**

- Only 4 roles, simple role-list check — DSL adds complexity, not safety
- One file of middleware (~30 LOC) vs. another dep with weaker maintenance signal
- Type inference stays clean — `headProcedure.query(…)` is fully typed end-to-end

**Why custom middleware and not hand-coded `if (ctx.user.role !== 'head')` in every procedure:**

- Centralized: one file decides what FORBIDDEN looks like
- Composable with input validation (`requireRole().input(…).query(…)`)
- Auditable: every restricted procedure has a visible role declaration in its definition

**Cookie injection in BullMQ pdf-export (carried v5.0 debt):** the existing `TODO(Phase 24)` seam in `pdf-export.processor.ts` is closed by passing the JWT (not the cookie) to Playwright as a header — `page.setExtraHTTPHeaders({ Authorization: 'Bearer …' })`. **No new package.** This is a plan/integration concern, not a stack concern.

### Mobile Polish (feature area F)

**No new dependencies.** Use Playwright (already installed at 1.50+) with a new project for mobile viewports.

```typescript
// apps/web/playwright.config.ts (extend existing)
import { devices } from "@playwright/test";

export default defineConfig({
  projects: [
    { name: "desktop", use: { ...devices["Desktop Chrome"] } },
    // NEW for v6.0:
    { name: "mobile-ios", use: { ...devices["iPhone 14"] } },
    { name: "mobile-android", use: { ...devices["Pixel 7"] } },
  ],
});
```

**Why no Storybook:**

- 7 existing pages, finite scope — running an entire dev environment alongside Next.js to view them at different breakpoints is overkill
- Playwright viewport tests double as regression guards: snapshot mobile screens, fail CI on layout regression
- Tailwind v4 responsive utilities (`sm:`, `md:`, `lg:`) plus `<ResponsiveContainer>` for charts cover the visual work

**Integration points:**

- New test file: `apps/web/tests/mobile/breakpoints.spec.ts` — visits each of the 7 pages at iPhone 14 + Pixel 7, asserts no horizontal scroll (`page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)`), captures screenshots
- Run in CI as `pnpm playwright test --project=mobile-ios --project=mobile-android`

### Release Checklist (feature area G)

**No new dependencies.** Pure markdown convention.

- File: `CHECKLIST.md` at repo root
- Optional: pre-commit hook (existing Husky) blocks commits to `main` that touch `CHECKLIST.md` placeholders → forces conscious update on each release

### Quality Polish (feature area B)

**No new dependencies.** Pure config + cleanup:

- `prisma generate` in root `package.json` `postinstall` script (so fresh `pnpm install` produces a working `@prisma/client`)
- Delete `apps/web/src/proxy.ts` (dead — Next.js 16 reads `proxy.ts` from app root, not nested under `src`)
- Fix the 5 integration test failures (single tRPC POST timeout root cause, per the milestone brief)
- Fix `period.contract.test.ts:65` `_userId` rename

## Installation

```bash
# AI features (apps/api)
pnpm --filter api add @anthropic-ai/sdk

# Charts (apps/web)
pnpm --filter web add recharts react-is
pnpm --filter web dlx shadcn@latest add chart   # generates wrapper components

# Email templates (apps/api)
pnpm --filter api add react-email @react-email/components
pnpm --filter api add -D react-email   # for `email:dev` preview server

# Optional dev script — add to apps/api/package.json:
#   "email:dev": "email dev --dir src/modules/email/templates"

# No installs needed for: A (RBAC), B (quality), F (mobile), G (checklist)
```

## Alternatives Considered

| Recommended                   | Alternative                                    | When Alternative Would Be Better                                                                                                                                           |
| ----------------------------- | ---------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `@anthropic-ai/sdk` direct    | **LangChain.js**                               | If you need to swap providers frequently or build agent chains. We don't — committed to Anthropic, narrow tasks.                                                           |
| `@anthropic-ai/sdk` direct    | **Vercel AI SDK (`ai` + `@ai-sdk/anthropic`)** | If you need streaming UI primitives bundled or planning multi-provider abstraction. We don't — backend tRPC consumes results, no streaming UI required for these features. |
| Sonnet 4.6 for judgement      | **Opus 4.7**                                   | If quality plateau on Sonnet becomes a blocker. Default no — 5× cost, marginal gain on classification-style tasks.                                                         |
| Haiku 4.5 for sentiment       | **Sonnet 4.6**                                 | If false-positive rate on "concerning" classification exceeds product tolerance. Defer until measured.                                                                     |
| shadcn/ui Chart over Recharts | **Tremor**                                     | Tremor is Vercel-acquired, also wraps Recharts — adds a redundant abstraction over what shadcn already provides. Skip.                                                     |
| shadcn/ui Chart over Recharts | **Apache ECharts / Plotly**                    | Only if 3D / map / Sankey visualizations needed. Not for traffic-light history.                                                                                            |
| react-email                   | **MJML**                                       | If team is already invested in MJML elsewhere. Not the case here.                                                                                                          |
| react-email                   | **Hand-rolled HTML strings**                   | Never. Email-client compatibility surface is too large.                                                                                                                    |
| Custom tRPC RBAC middleware   | **`trpc-shield`**                              | If RBAC rules become a complex graph (e.g., per-resource permissions, ABAC). 4 flat roles do not justify it.                                                               |
| Playwright mobile project     | **Storybook + viewport addon**                 | If component-library work begins (cross-team UI library, design-system docs). Not the case for v6.0.                                                                       |
| Playwright mobile project     | **Chromatic / Percy**                          | When multiple PRs/week need design review. Currently solo dev — overkill.                                                                                                  |

## What NOT to Add

The user might be tempted to reach for these. Don't.

| Avoid                                                               | Why                                                                                                                                                                       | Use Instead                                             |
| ------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------- |
| **LangChain / LangChain.js**                                        | Hides Anthropic SDK behind unnecessary abstraction; agent/chain primitives unused for narrow text-transformation tasks; outsized maintenance / breaking-change cadence    | `@anthropic-ai/sdk` direct                              |
| **Vercel AI SDK (`ai` package)**                                    | Multi-provider abstraction; pointless when committed to one provider; UI streaming primitives unused for our backend tRPC tasks                                           | `@anthropic-ai/sdk` direct                              |
| **A separate Python AI service** (FastAPI + `anthropic` Python SDK) | Doubles deployment surface, requires inter-service auth, breaks shared-types story, slower CI; offers nothing TypeScript SDK lacks                                        | Same monorepo, NestJS module `apps/api/src/modules/ai/` |
| **Tremor**                                                          | Wraps Recharts (same engine as shadcn/ui Chart); adds an extra abstraction layer with weaker theming integration; redundant                                               | shadcn/ui Chart                                         |
| **Plotly / vis.js / D3 directly**                                   | Heavyweight (Plotly bundle ~3 MB), imperative APIs awkward in React 19 + Turbopack; overkill for traffic-light history + line + bar                                       | Recharts via shadcn/ui Chart                            |
| **Tailwind-only SVG charts**                                        | Would require hand-coding axes, tooltips, scales, hit-targets — all of which Recharts solves. False economy.                                                              | Recharts via shadcn/ui Chart                            |
| **`trpc-shield`**                                                   | Custom middleware does the job in ~30 LOC; trpc-shield's DSL is for graph-of-rules complexity we don't have                                                               | Custom `requireRole()` middleware in `packages/shared`  |
| **Storybook**                                                       | Build/maintenance overhead disproportionate to "polish 7 existing pages"; no shared component library to document                                                         | Playwright mobile project                               |
| **MJML**                                                            | Not React-native, separate build step, weaker type safety                                                                                                                 | `react-email`                                           |
| **`pdfkit` / `jsPDF` / `puppeteer`**                                | PDF stays on Playwright (v5.0 decision). Don't reopen.                                                                                                                    | Existing Playwright PDF processor                       |
| **`cron` / `node-cron` for reminders**                              | BullMQ has native `repeat` (cron-syntax) job options; adding cron creates two scheduling systems                                                                          | BullMQ `repeat: { pattern: '0 9 * * 5' }`               |
| **`zod-to-json-schema`**                                            | `betaZodTool` from the SDK does this internally for Anthropic tool definitions; manual conversion only needed if integrating non-Anthropic JSON-Schema-consuming services | Anthropic SDK helper                                    |

## Stack Patterns by Variant

**If AI cost ever exceeds budget:**

- First lever: extend cache TTL to `1h` for the rubric system prompt (2× write cost, 0.1× read — net win if jobs span >5 min)
- Second lever: downgrade Sonnet 4.6 → Haiku 4.5 for judgement task; retire the upgrade if judgement quality drops below product threshold
- Third lever: batch summarization via Anthropic Batch API (50% discount, async result polling) — but this is a v7+ optimization, not v6

**If chart performance becomes a problem (>1k data points per series):**

- First lever: pre-aggregate on the server (PostgreSQL `date_trunc('week', …) GROUP BY`) — never ship 1000 raw points to the browser
- Second lever: Recharts `<Brush>` zoom + windowed rendering
- Third lever (unlikely needed): swap to ECharts via the same shadcn-style copy-paste wrapper

**If email templates need previewing in production-like SMTP for QA:**

- Add MailHog or Mailpit to local Docker Compose (zero-cost, dev-only) — dev script already exists; no Compose changes for v6 unless the team asks

## Version Compatibility

| Package A                 | Compatible With             | Notes                                                                                                              |
| ------------------------- | --------------------------- | ------------------------------------------------------------------------------------------------------------------ |
| `@anthropic-ai/sdk@^0.90` | Node 20+, NestJS 11         | SDK is `0.x` — minor versions can break. Pin exact version once chosen and bump deliberately.                      |
| `recharts@^3.3`           | React 19, Next.js 16        | v3.x dropped older React; React 19 supported. Peer dep `react-is` must match React 19.                             |
| `react-email@^3`          | React 19                    | `<Tailwind>` compatible with Tailwind v4 utility classes (compiles to inline styles at render time, not at build). |
| `@react-email/components` | React 19                    | Same. Use named import for `render`.                                                                               |
| `betaZodTool`             | Zod 4.x (already installed) | Beta API — surfaces under `@anthropic-ai/sdk/helpers/beta/zod`. Watch for stabilization in `1.0`.                  |

## Confidence Assessment

| Area                                                    | Level      | Reason                                                                                                                                                  |
| ------------------------------------------------------- | ---------- | ------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `@anthropic-ai/sdk` choice + model assignment           | **HIGH**   | Anthropic-published SDK, current version verified npm; model lineup verified Anthropic release notes (Apr 2026); cost/quality tradeoff well-documented. |
| Prompt-caching pattern (1024-token min)                 | **HIGH**   | Anthropic docs explicit; multiple secondary sources confirm.                                                                                            |
| `recharts` + shadcn/ui Chart                            | **HIGH**   | Both are first-class in shadcn ecosystem (already used elsewhere in the app); Context7 confirms v3.3.0 current.                                         |
| `react-email` + nodemailer integration                  | **HIGH**   | Official Resend (react-email) docs cover nodemailer transport; pattern is one render call.                                                              |
| RBAC custom middleware (no new dep)                     | **HIGH**   | tRPC middleware composition is documented core API; pattern in countless production apps.                                                               |
| Playwright mobile project                               | **HIGH**   | `devices` exports come from `@playwright/test`; pattern is standard.                                                                                    |
| **Risk areas:**                                         |            |                                                                                                                                                         |
| Sonnet 4.6 sufficiency for "on track" judgement         | **MEDIUM** | Empirical — depends on prompt quality and edge cases in real lead data. AI-SPEC phase should benchmark against 10–20 real reports before locking in.    |
| Cache breakpoint hit rate (need ≥1024 tokens in rubric) | **MEDIUM** | Constraint is real; mitigation is to write a sufficiently rich rubric (achievable). Worth explicit verification post-implementation.                    |

## Sources

- Context7 `/anthropics/anthropic-sdk-typescript` — messages API, `betaZodTool`, `toolRunner`, `count_tokens`, prompt caching shape
- Context7 `/recharts/recharts` v3.3.0 — `LineChart`, `BarChart`, `ResponsiveContainer`, animation/SSR
- Context7 `/resend/react-email` — nodemailer integration, Tailwind component, `render` API
- npm `@anthropic-ai/sdk` v0.90.0 (verified WebSearch, 2026-04-23) — current stable
- Anthropic release notes — model lineup: Haiku 4.5 (2025-10-15), Sonnet 4.6 (2026-02-17), Opus 4.7 (2026-04-16)
- Anthropic prompt caching docs — `cache_control: { type: 'ephemeral', ttl: '1h' | default 5m }`, 1024-token minimum, 1.25× / 2× write multipliers, 0.1× read
- shadcn/ui charts page — Recharts wrapper, Tailwind v4 CSS variable theming
- Playwright docs — `devices` export, project configuration

---

_Stack research for: CustomReport v6.0 — Roles, Quality, AI & Analytics_
_Researched: 2026-04-26_
_Existing v5.0 stack untouched; this file documents only additions._
