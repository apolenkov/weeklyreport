# Architecture Patterns: v3.0 UI Polish & Analytics Integration

**Domain:** Weekly status report system (NestJS + Next.js + Prisma monorepo)
**Researched:** 2026-04-11
**Focus:** How shadcn/ui, Playwright E2E tests, and pgvector RAG integrate with the existing v2.0 architecture

## Current Architecture Snapshot (Post-v2.0)

The v2.0 milestone shipped a fully operational full-stack system. All infrastructure is wired and running.

```text
  Current State (v2.0 — shipped)
  ================================

  apps/web (Next.js 15.5)
  ├── 9 pages (layout + 7 route pages + auth error page)
  ├── 22 components — ALL UNSTYLED (raw HTML, no CSS framework)
  │   ├── navigation/: AppShell, RoleNav
  │   ├── report-section/: ReportSectionForm + 6 sub-editors
  │   ├── head/: SubmissionDashboard, AssembledReportReview
  │   ├── report/: PublishedReport, ArchiveReportList
  │   ├── admin/: AdminPanel
  │   ├── common/: QueryError
  │   └── providers/: TRPCProvider
  ├── tRPC client (httpBatchLink + superjson) — calls NestJS API
  ├── middleware.ts — cookie-based auth redirect (bypassed in dev)
  ├── 7 E2E test skeletons in apps/web/e2e/ (Playwright)
  └── No Tailwind, no shadcn/ui, no CSS whatsoever

  apps/api (NestJS 11)
  ├── Full DI container: 8 domain modules wired
  ├── tRPC router: 7 namespaces (reports, review, pdfExport, admin,
  │   archive, reminders, carryOver) — 20+ procedures
  ├── Prisma repositories: 8 *PrismaRepository implementations
  ├── BullMQ: pdf-export + email-reminder queues
  ├── Auth: SAML + JWT + dev mode (AUTH_DEV_MODE=true)
  ├── Infrastructure: health, metrics, correlation-id middleware
  └── PDF: Playwright chromium renders /reports/[id]/print page

  packages/shared
  ├── Zod schemas (report.ts, auth.ts) — types exported via z.infer
  └── tRPC contract (router.ts — typed but routes live in api)

  packages/ui
  ├── Empty shell — only exports package name string
  ├── Has react dependency, JSX in tsconfig
  └── RESERVED for shadcn/ui components

  prisma/
  ├── schema.prisma: 14 models, migrated and seeded
  ├── seed.ts: head + 6 leads + projects + sample report
  └── Prisma 7 + @prisma/adapter-pg

  Docker Compose
  ├── postgres:15-alpine (port 5432)
  ├── redis:7-alpine (port 6379)
  ├── migrate service (prisma migrate deploy)
  ├── api (Playwright base image for PDF, port 3001)
  └── web (Next.js standalone, port 3000)
```

### Key Architectural Properties Carried Forward

1. **All components are `'use client'`** — form state is managed client-side with useState/useEffect
2. **Auth dev mode** — `AUTH_DEV_MODE=true` returns a hardcoded head session for all requests, E2E tests rely on this
3. **tRPC data flow** — Frontend uses `trpc.namespace.procedure.useQuery/useMutation` via react-query
4. **PDF generation** — API's BullMQ worker launches Playwright, navigates to `web:3000/reports/[id]/print`, renders PDF
5. **Monorepo** — Turborepo orchestrates build/lint/test, pnpm workspaces, `@customreport/*` packages
6. **No CSS exists** — Every component outputs bare HTML elements (`<div>`, `<button>`, `<form>`, `<table>`)

---

## Integration Area 1: shadcn/ui + Tailwind CSS in Monorepo

### What Needs to Happen

Transform `packages/ui` from an empty shell into a full shadcn/ui component library consumed by `apps/web`. All 22 existing components need styling. The print page needs a separate PDF-optimized design.

### Architecture: Component Layer Topology

```text
  packages/ui/                          apps/web/
  ├── src/                              ├── src/
  │   ├── components/                   │   ├── components/
  │   │   ├── button.tsx   (shadcn)     │   │   ├── report-section/
  │   │   ├── card.tsx     (shadcn)     │   │   │   ├── report-section-form.tsx
  │   │   ├── badge.tsx    (shadcn)     │   │   │   │   imports from @workspace/ui
  │   │   ├── dialog.tsx   (shadcn)     │   │   │   └── ...
  │   │   ├── table.tsx    (shadcn)     │   │   ├── head/
  │   │   ├── select.tsx   (shadcn)     │   │   ├── report/
  │   │   ├── input.tsx    (shadcn)     │   │   ├── admin/
  │   │   ├── textarea.tsx (shadcn)     │   │   └── navigation/
  │   │   ├── alert.tsx    (shadcn)     │   ├── app/
  │   │   ├── tabs.tsx     (shadcn)     │   │   ├── layout.tsx
  │   │   ├── tooltip.tsx  (shadcn)     │   │   │   imports globals.css
  │   │   └── ...                       │   │   │   wraps with ThemeProvider
  │   ├── hooks/                        │   │   └── (app)/reports/[id]/print/
  │   │   └── use-theme.ts             │   │       └── page.tsx
  │   ├── lib/                          │   │           uses @media print styles
  │   │   └── utils.ts    (cn helper)  │   └── styles/
  │   └── styles/                       │       └── globals.css
  │       └── globals.css               │           @import "@workspace/ui/styles"
  │           @theme { ... }            │           + app-specific overrides
  │           @layer base { ... }
  ├── components.json
  └── package.json
```

### Integration Points (What Changes)

| File/Area | Change Type | Description |
|-----------|-------------|-------------|
| `packages/ui/package.json` | **MODIFY** | Add tailwindcss, @radix-ui/*, class-variance-authority, clsx, tailwind-merge, lucide-react |
| `packages/ui/src/styles/globals.css` | **NEW** | Tailwind v4 entry: `@import "tailwindcss"`, `@theme { ... }` with design tokens, `@source "../"` |
| `packages/ui/src/lib/utils.ts` | **NEW** | `cn()` helper (clsx + twMerge) |
| `packages/ui/src/components/*.tsx` | **NEW** | ~15-20 shadcn primitives (Button, Card, Badge, Dialog, Table, Input, Select, Textarea, Alert, Tabs, Tooltip, DropdownMenu, Sheet, Separator, ScrollArea) |
| `packages/ui/components.json` | **NEW** | shadcn CLI config: aliases point to `@workspace/ui/*`, Tailwind v4 (empty config path), RSC: true |
| `apps/web/components.json` | **NEW** | shadcn CLI config for app: ui alias to `@workspace/ui/components`, local components to `@/components` |
| `apps/web/src/app/layout.tsx` | **MODIFY** | Import globals.css, add ThemeProvider, add `<html className>` with font |
| `apps/web/src/styles/globals.css` | **NEW** | `@import "@workspace/ui/styles/globals.css"`, app-specific `@source` directives |
| All 22 components in `apps/web/src/components/` | **MODIFY** | Replace bare HTML with shadcn/ui primitives. Major rewrite of every component |
| `apps/web/src/app/(app)/reports/[id]/print/page.tsx` | **MODIFY** | PDF-optimized layout with `@media print` styles, no navigation, compact spacing |

### Data Flow: No Changes

The tRPC data flow is completely untouched. shadcn/ui is purely a presentation layer change. Components still receive data via `trpc.*.useQuery()` and dispatch mutations via `trpc.*.useMutation()`. No API changes required.

```text
  trpc.reports.getActive.useQuery()
       │
       ▼
  ReportSectionForm (same props, same state management)
       │
       ▼
  <Card> + <Input> + <Badge> + <Button>   ← NEW (was <div> + <input> + <p> + <button>)
       │
       ▼
  trpc.reports.saveDraft.useMutation()     ← UNCHANGED
```

### shadcn/ui Monorepo Configuration

**Tailwind v4 key insight**: No `tailwind.config.ts` file needed. Tailwind v4 uses CSS-based configuration:

```css
/* packages/ui/src/styles/globals.css */
@import "tailwindcss";

@source "../";    /* scan packages/ui/src for classes */

@theme {
  --color-background: oklch(1 0 0);
  --color-foreground: oklch(0.141 0.005 285.823);
  --color-primary: oklch(0.21 0.006 285.885);
  /* ... design tokens */
}
```

**apps/web** consumes via CSS import chain:

```css
/* apps/web/src/styles/globals.css */
@import "@workspace/ui/styles/globals.css";
@source "../../";   /* scan apps/web/src for Tailwind classes */
```

### Component Mapping: Existing to shadcn/ui

| Existing Component | Primary shadcn/ui Primitives Needed |
|-------------------|--------------------------------------|
| AppShell | Sheet (sidebar), NavigationMenu |
| RoleNav | NavigationMenu, Badge (role indicator) |
| ReportSectionForm | Card, Form wrapper |
| ProjectStatusGrid | Table, Select (traffic light), Badge (green/yellow/red) |
| ItemsEditor | Card, Input, Badge (tag), Select (status), Checkbox (completed) |
| RisksEditor | Table, Input, Textarea |
| DecisionsEditor | Table, Input, Textarea, Badge (resolved/pending) |
| PrioritiesEditor | Card, Input (ranked 1-2-3) |
| AutosaveIndicator | Badge or custom (small indicator) |
| SubmissionDashboard | Card, Table, Badge (submitted/draft) |
| AssembledReportReview | Card sections, Button (publish) |
| PublishedReport | Card, Badge (traffic lights), Button (export PDF) |
| ArchiveReportList | Table, Button (view) |
| AdminPanel | Tabs (users/projects/periods/reminders), Table, Dialog (add/edit), Input |
| QueryError | Alert (destructive variant) |
| TRPCProvider | No change (no UI) |

### PDF Print Page Architecture

The print page (`/reports/[id]/print`) is the source HTML that Playwright renders to PDF. It needs special treatment:

```text
  PDF Generation Flow (existing, unchanged):
  ───────────────────��───────────────────────
  API: pdfExportService.requestPdfExport(reportId)
       │
       ▼
  BullMQ: pdf-export queue
       │
       ▼
  PdfExportProcessor:
       chromium.launch()
       page.goto("http://web:3000/reports/{id}/print")
       page.pdf({ format: 'A4', printBackground: true })
       │
       ▼
  Writes PDF to /app/data/pdfs/{jobId}.pdf

  Print Page Styling Strategy:
  ────────────────────────────
  - Same shadcn/ui components BUT with @media print overrides
  - Hide navigation, footers, interactive elements
  - Compact spacing, professional typography
  - Traffic light badges render as colored circles in PDF
  - printBackground: true ensures color badges appear in PDF
```

### Build Order for shadcn/ui

```text
  1. packages/ui foundation
     ├── Install deps (tailwindcss, @radix-ui/*, cva, clsx, tw-merge, lucide-react)
     ├── Create globals.css with Tailwind v4 @theme tokens
     ├── Create lib/utils.ts (cn helper)
     ├── Create components.json for shadcn CLI
     └── Add 5 core primitives: Button, Card, Input, Badge, Table

  2. apps/web Tailwind wiring
     ├── Create components.json for web app
     ├── Create globals.css importing from @workspace/ui
     ├── Modify layout.tsx: import CSS, add font, ThemeProvider
     └── Verify one component renders with styles

  3. Component migration (batch by page)
     ├── Batch 1: Navigation (AppShell, RoleNav) — needed by all pages
     ├── Batch 2: Lead report form (ReportSectionForm + 6 sub-editors)
     ├── Batch 3: Head views (SubmissionDashboard, AssembledReportReview)
     ├── Batch 4: Reports (PublishedReport, ArchiveReportList, print page)
     └── Batch 5: Admin (AdminPanel — heaviest, uses Tabs + Dialog + Table)

  4. PDF print page styling
     ├── Add @media print CSS rules
     ├── Verify Playwright PDF renders correctly with background colors
     └── Test in Docker Compose (api container → web container)
```

---

## Integration Area 2: Playwright E2E Tests

### What Needs to Happen

The 7 E2E test files in `apps/web/e2e/` exist but are skeleton-level. They need to become comprehensive tests covering the full user journey. Additionally, the test infrastructure needs improvements for reliability.

### Current E2E Test State

```text
  apps/web/e2e/
  ├── admin-panel.spec.ts            (skeleton)
  ├── archive-history.spec.ts        (skeleton)
  ├── carry-over.spec.ts             (skeleton)
  ├── head-dashboard.spec.ts         (skeleton)
  ├── head-publication.spec.ts       (1 test — uses localStorage seeding)
  ├── lead-report-entry.spec.ts      (1 test — basic autosave + submit)
  └── published-report.spec.ts       (skeleton)

  playwright.config.ts (root)
  ├── testDir: apps/web/e2e
  ├── baseURL: http://127.0.0.1:3100
  └── webServer: next dev -p 3100 (web only, no API!)
```

### Architecture: E2E Test Infrastructure

**Problem with current config**: The Playwright config starts only the Next.js dev server, NOT the NestJS API. Since v2.0 wired real tRPC calls, E2E tests now require both servers running.

```text
  Current (broken for full-stack tests):
  ────────────��─────────────────────────
  playwright.config.ts
  └── webServer: next dev -p 3100     ← only frontend
      tRPC calls go to localhost:3001  ← nothing is listening!

  Required (full-stack E2E):
  ────────────────────────────────────��─
  playwright.config.ts
  ├── webServer[0]: apps/api dev       ← NestJS on port 3101
  │   depends_on: postgres + redis     ← need Docker services
  └── webServer[1]: apps/web dev       ← Next.js on port 3100
      NEXT_PUBLIC_API_URL=http://127.0.0.1:3101
```

### Test Infrastructure Design

```text
  E2E Test Stack
  ═══════════════

  Playwright Test Runner
       │
       ├── Global Setup (new)
       │   ├── Start Docker Compose (postgres + redis)
       │   ├── Run prisma migrate + seed
       │   ├── Verify API health endpoint
       │   └── Create auth storage states
       │
       ├── projects (Playwright config)
       │   ├── "setup" project → global-setup.ts
       │   ├── "lead" project → lead-*.spec.ts (lead session)
       │   ├── "head" project → head-*.spec.ts (head session)
       │   └── "viewer" project → viewer-*.spec.ts (viewer session)
       │
       ├── webServer (Playwright config, multiple servers)
       │   ├── API: pnpm --filter @customreport/api dev (port 3101)
       │   └── Web: pnpm --filter @customreport/web dev (port 3100)
       │
       └── Global Teardown (new)
           └── Stop Docker Compose (or leave running for speed)
```

### Authentication Strategy for E2E

The system has `AUTH_DEV_MODE=true` which returns a hardcoded head session. For E2E tests with multiple roles, two approaches:

**Option A: Dev mode role switching (recommended for v3.0)**

The API's `trpc.context.ts` already has `DEV_SESSION` that returns when `AUTH_DEV_MODE=true`. Extend this to support role switching via a query parameter or header in dev mode only:

```text
  Dev Mode Auth Flow:
  ───────────────────
  1. AUTH_DEV_MODE=true (set in test env)
  2. API reads X-Dev-Role header (only in dev mode!)
  3. Returns corresponding seed user session
  4. Each Playwright project sets the header in extraHTTPHeaders

  Playwright Config:
  ──────────────────
  projects: [
    { name: "lead",   use: { extraHTTPHeaders: { "X-Dev-Role": "lead" } } },
    { name: "head",   use: { extraHTTPHeaders: { "X-Dev-Role": "head" } } },
    { name: "viewer", use: { extraHTTPHeaders: { "X-Dev-Role": "viewer" } } },
  ]
```

**Option B: Real JWT storage state** (for later milestones)

Use Playwright's `storageState` with real JWT cookies obtained from the SAML flow. More realistic but requires Keycloak in the test environment.

### Integration Points (What Changes)

| File/Area | Change Type | Description |
|-----------|-------------|-------------|
| `playwright.config.ts` | **MODIFY** | Add dual webServer (api + web), projects per role, globalSetup/Teardown |
| `apps/web/e2e/global-setup.ts` | **NEW** | Docker Compose up, migrate, seed, health check |
| `apps/web/e2e/global-teardown.ts` | **NEW** | Optional Docker Compose down |
| `apps/web/e2e/fixtures.ts` | **NEW** | Custom test fixtures: authenticated page, seed data references |
| `apps/api/src/infrastructure/trpc/trpc.context.ts` | **MODIFY** | Add X-Dev-Role header reading in dev mode for role switching |
| `prisma/seed.ts` | **MODIFY** | Ensure deterministic UUIDs for E2E assertions |
| `docker-compose.test.yml` | **NEW** | Test-specific compose: postgres + redis only (no api/web — Playwright starts those) |
| All 7 E2E spec files | **MODIFY** | Expand from skeletons to full user journey tests |

### E2E Test Coverage Plan

```text
  Full User Journey (Linear E2E Flow):
  ─────────────────────────────────────
  1. Lead logs in → sees report form
  2. Lead fills section (traffic lights, items, risks, decisions, priorities)
  3. Lead autosave fires → data persists
  4. Lead submits section → section becomes read-only
  5. Head opens dashboard → sees submission status
  6. Head reviews assembled report → all sections visible
  7. Head publishes report → status changes
  8. Published report visible to viewers
  9. Head exports PDF → job queued → PDF generated
  10. Archive shows report in history

  Cross-Cutting Tests:
  ────────────────────
  - Role access control (viewer cannot publish, lead cannot admin)
  - Carry-over execution (decisions + next-week items)
  - Admin CRUD (users, projects, periods, reminders)
  - Error states (network failure, validation errors)
```

### Build Order for E2E Tests

```text
  1. Test infrastructure
     ├── docker-compose.test.yml (postgres + redis)
     ├── Update playwright.config.ts (dual webServer, projects)
     ├── global-setup.ts (Docker, migrate, seed)
     ├── fixtures.ts (custom test, seed data constants)
     └── Extend trpc.context.ts for dev-mode role switching

  2. Core journey tests (depends on shadcn/ui for selectors)
     ├── lead-report-entry.spec.ts — full form fill + submit
     ├── head-dashboard.spec.ts — view submissions
     ├── head-publication.spec.ts — review + publish
     └── published-report.spec.ts — view + PDF export

  3. Supporting tests
     ├── archive-history.spec.ts — browse past reports
     ├── carry-over.spec.ts — decision/item carry-over
     └── admin-panel.spec.ts — CRUD operations

  4. CI integration
     ├── GitHub Actions workflow (setup postgres + redis services)
     └── Playwright report upload as artifact
```

**Critical dependency**: E2E tests for styled components depend on shadcn/ui being integrated first. Test selectors use `getByRole`, `getByLabel`, `getByText` which remain stable across styling changes, but the page structure and interactive elements will change. Run E2E test updates AFTER each shadcn/ui component batch.

---

## Integration Area 3: pgvector RAG Analytics

### What Needs to Happen

Add vector embeddings to published reports for semantic search, trend analysis, and a chatbot that answers questions about report history. This is the most architecturally invasive change because it adds a new data pipeline (embedding generation) and a new query path (vector similarity search).

### Architecture: RAG Pipeline

```text
  Embedding Generation Pipeline
  ══════════════════════════════

  Report Published (existing event)
       │
       ▼
  PublicationService.publishReport()
       │
       ├── existing: update report status
       │
       └── NEW: enqueue embedding-generation job
            │
            ▼
       BullMQ: embedding-generation queue
            │
            ▼
       EmbeddingProcessor (NEW)
            │
            ├── Fetch assembled report data
            ├── Chunk report into sections:
            │   - Per-lead summary (traffic lights + items)
            │   - Risks aggregate
            │   - Decisions aggregate
            │   - Portfolio overview
            ├── Call OpenAI text-embedding-3-small API
            │   (or alternative embedding provider)
            ├── Store vectors in ReportEmbedding table
            └── Mark embedding job as completed


  RAG Query Pipeline
  ══════════════════

  User asks question in chat UI
       │
       ▼
  tRPC: analytics.chat.mutate({ question })
       │
       ▼
  AnalyticsService (NEW)
       │
       ├── Generate embedding for user question
       │   (same model: text-embedding-3-small)
       │
       ├── Vector similarity search via pgvector
       │   SELECT * FROM "ReportEmbedding"
       │   ORDER BY embedding <=> $queryVector
       │   LIMIT 5
       │
       ├── Assemble context from top-K chunks
       │
       ├── Call LLM with context + question
       │   (OpenAI GPT-4o-mini or similar)
       │
       └── Return answer + source references
            │
            ▼
       Frontend: chat UI displays answer
       with links to source reports
```

### Database Schema Changes

```text
  Prisma Schema Additions
  ═══════════════════════

  NEW: ReportEmbedding model
  ──────────────────────���───
  model ReportEmbedding {
    id          String   @id @default(uuid())
    reportId    String
    chunkType   String              // "lead_summary", "risks", "decisions", "overview"
    chunkIndex  Int
    content     String              // The text that was embedded
    metadata    Json?               // { leadId, projectIds, period }
    embedding   Unsupported("vector(1536)")   // pgvector column
    report      Report   @relation(fields: [reportId], references: [id])
    createdAt   DateTime @default(now())

    @@index([reportId])
  }

  NEW: EmbeddingJob model
  ───────────────────────
  model EmbeddingJob {
    id          String   @id @default(uuid())
    reportId    String
    status      String   @default("pending")  // pending, processing, completed, failed
    error       String?
    createdAt   DateTime @default(now())
    updatedAt   DateTime @updatedAt
  }

  MODIFY: Report model
  ────────────────────
  model Report {
    ...existing fields...
    embeddings  ReportEmbedding[]    // NEW relation
  }
```

**pgvector + Prisma 7 constraint**: Prisma 7 does not natively support the `vector` column type. The `embedding` column must be defined as `Unsupported("vector(1536)")` in the schema, and all vector operations (insert, similarity search) must use `$queryRawUnsafe()` or `$executeRawUnsafe()`. The migration must be created with `--create-only` and manually edited to add:

```sql
CREATE EXTENSION IF NOT EXISTS vector;
ALTER TABLE "ReportEmbedding" ADD COLUMN "embedding" vector(1536);
CREATE INDEX ON "ReportEmbedding" USING hnsw (embedding vector_cosine_ops);
```

### New Backend Modules

```text
  apps/api/src/modules/analytics/
  ├── analytics.module.ts           ← NestJS module
  ├── analytics.service.ts          ← Core logic: embed, search, chat
  ├── analytics.service.test.ts     ← Unit tests
  ├── analytics.router.ts           ← tRPC procedures
  ├── analytics.prisma-repository.ts ← Raw SQL for pgvector ops
  └── analytics.integration.test.ts ← Integration tests

  apps/api/src/infrastructure/
  ├── bullmq/
  │   └── embedding.processor.ts    ← BullMQ worker: generates embeddings
  └── embedding/
      └── embedding.client.ts       ← OpenAI API wrapper (or pluggable)
```

### New Frontend Components

```text
  apps/web/src/components/analytics/
  ├── report-chat.tsx               ← Chat UI: input + message history
  ├── trend-dashboard.tsx           ← Traffic light trends over time
  ├── search-results.tsx            ← Semantic search results list
  └── source-reference.tsx          ← Link back to source report/section
```

### tRPC Router Extension

```text
  Existing router (unchanged):
  ────────────────────────────
  reports, review, pdfExport, admin, archive, reminders, carryOver

  NEW namespace:
  ──────────────
  analytics: router({
    search:    protectedProcedure  // Semantic search across reports
                .input(z.object({ query: z.string(), limit: z.number().default(10) }))
                .query(...)

    chat:      protectedProcedure  // RAG chat: question → answer + sources
                .input(z.object({ question: z.string() }))
                .mutation(...)

    trends:    protectedProcedure  // Traffic light trends for a project
                .input(z.object({ projectId: z.string().uuid(), periods: z.number().default(12) }))
                .query(...)

    embedding: headProcedure       // Trigger re-embedding for a report
                .input(z.object({ reportId: z.string().uuid() }))
                .mutation(...)
  })
```

### Integration Points (What Changes)

| File/Area | Change Type | Description |
|-----------|-------------|-------------|
| `prisma/schema.prisma` | **MODIFY** | Add ReportEmbedding + EmbeddingJob models, add `postgresqlExtensions` preview feature |
| `prisma/migrations/XXXX_add_pgvector/` | **NEW** | Manual migration: CREATE EXTENSION vector, ADD COLUMN, CREATE INDEX hnsw |
| `docker-compose.yml` (postgres) | **MODIFY** | Nothing needed — pgvector extension is available in postgres:15-alpine |
| `docker-compose.dev.yml` | No change | pgvector auto-available |
| `apps/api/src/modules/analytics/` | **NEW** | Entire new module (6 files) |
| `apps/api/src/infrastructure/embedding/` | **NEW** | OpenAI embedding client |
| `apps/api/src/infrastructure/bullmq/embedding.processor.ts` | **NEW** | BullMQ worker for async embedding generation |
| `apps/api/src/infrastructure/bullmq/bullmq.module.ts` | **MODIFY** | Register embedding-generation queue |
| `apps/api/src/app.module.ts` | **MODIFY** | Import AnalyticsModule + EmbeddingProcessor |
| `apps/api/src/infrastructure/trpc/trpc.router.ts` | **MODIFY** | Add analytics namespace (4 new procedures) |
| `apps/api/src/infrastructure/config/env.schema.ts` | **MODIFY** | Add OPENAI_API_KEY, EMBEDDING_MODEL env vars |
| `packages/shared/src/schemas/report.ts` | **MODIFY** | Add analytics-related Zod schemas (search result, chat message) |
| `apps/web/src/components/analytics/` | **NEW** | 4 new components (chat, trends, search, source) |
| `apps/web/src/app/(app)/analytics/page.tsx` | **NEW** | Analytics page |
| `apps/web/src/app/(app)/analytics/chat/page.tsx` | **NEW** | Chat page |

### Docker: pgvector Availability

PostgreSQL 15 Alpine image (`postgres:15-alpine`) includes pgvector support. The extension just needs to be enabled via the migration SQL:

```sql
CREATE EXTENSION IF NOT EXISTS vector;
```

No Dockerfile changes required. The `docker-compose.yml` postgres service works as-is.

### Environment Variables Added

| Variable | Purpose | Default |
|----------|---------|---------|
| `OPENAI_API_KEY` | Embedding + LLM API calls | Required for analytics |
| `EMBEDDING_MODEL` | Model name | `text-embedding-3-small` |
| `EMBEDDING_DIMENSIONS` | Vector size | `1536` |
| `LLM_MODEL` | Chat completion model | `gpt-4o-mini` |
| `ANALYTICS_ENABLED` | Feature flag | `false` |

### Build Order for RAG Analytics

```text
  1. Database foundation
     ├── Enable postgresqlExtensions in Prisma schema
     ├── Add ReportEmbedding + EmbeddingJob models
     ├── Create migration (--create-only, manual SQL for vector column + index)
     └── Verify: prisma migrate dev works, vector extension active

  2. Embedding pipeline (backend)
     ├── EmbeddingClient (OpenAI wrapper, pluggable interface)
     ├── EmbeddingProcessor (BullMQ worker)
     ├── AnalyticsService (core logic)
     ├── AnalyticsPrismaRepository (raw SQL for pgvector queries)
     ├── Unit tests with mocked embedding client
     └── Wire into app.module.ts + trpc.router.ts

  3. Publication hook
     ├── Modify PublicationService to enqueue embedding job on publish
     └── Integration test: publish → embedding job created

  4. Analytics frontend (depends on shadcn/ui)
     ├── Analytics page with search
     ├── Chat page with RAG interface
     ├── Trend dashboard
     └── Source references linking back to reports

  5. Feature flag
     ├── ANALYTICS_ENABLED=false by default
     ├── Hide analytics UI when disabled
     └── Skip embedding generation when disabled
```

---

## Cross-Cutting: Component Boundaries Summary

```text
  packages/ui (NEW content)
  ═════════════════════════
  Responsibility: shadcn/ui primitives, design tokens, cn() utility
  Communicates with: Nothing (pure UI, no data fetching)
  Consumed by: apps/web

  apps/web (MODIFIED)
  ═══════════════════
  Responsibility: Pages, business components, tRPC client, routing
  New additions:
    ├── Analytics pages + components
    ├── All existing components restyled with shadcn/ui
    └── E2E tests (apps/web/e2e/)
  Communicates with: apps/api via tRPC

  apps/api (MODIFIED)
  ═══════════════════
  Responsibility: Business logic, data access, job processing
  New additions:
    ├── AnalyticsModule (service, repository, router)
    ├── EmbeddingProcessor (BullMQ)
    ├── EmbeddingClient (OpenAI wrapper)
    └── Dev-mode role switching in trpc.context.ts
  Communicates with: PostgreSQL, Redis, OpenAI API

  packages/shared (MODIFIED)
  ══════════════════════════
  Responsibility: Zod schemas, TypeScript types
  New additions:
    └── Analytics schemas (SearchResult, ChatMessage, Trend)
  Communicates with: Nothing (pure types)

  External Services (NEW)
  ═══════════════════════
  ├── OpenAI API (embeddings + chat completions)
  └── pgvector (PostgreSQL extension, not a separate service)
```

---

## Data Flow: Before and After

### Before (v2.0)

```text
  User ──► Next.js ──tRPC──► NestJS ──Prisma──► PostgreSQL
                                   ──BullMQ──► Redis
                                   ──Playwright──► PDF file
                                   ──nodemailer──► SMTP
```

### After (v3.0)

```text
  User ──► Next.js ──tRPC──► NestJS ──Prisma──► PostgreSQL
       │                          │               ├── pgvector (NEW)
       │                          │               └── ReportEmbedding table (NEW)
       │                          ├──BullMQ──► Redis
       │                          │             ├── pdf-export queue (existing)
       │                          │             ├── email-reminder queue (existing)
       │                          │             └── embedding-generation queue (NEW)
       │                          ├──Playwright──► PDF file
       │                          ├──nodemailer──► SMTP
       │                          └──OpenAI API──► Embeddings + Chat (NEW)
       │
       └── shadcn/ui components (presentation only, no new data flow)
```

---

## Build Order: Cross-Feature Dependencies

The three features have specific dependency relationships:

```text
  Phase ordering rationale:
  ═════════════════════════

  1. shadcn/ui FIRST
     │  Why: All other features need styled UI to test against.
     │  E2E tests need stable selectors from styled components.
     │  Analytics frontend needs shadcn/ui primitives.
     │
     ├── 1a. packages/ui foundation (deps, tokens, cn, 5 primitives)
     ├── 1b. apps/web wiring (CSS import, layout, verify)
     ├── 1c. Navigation components (AppShell, RoleNav)
     ├── 1d. Lead form components (biggest batch: 7 files)
     ├── 1e. Head + report view components
     ├── 1f. Admin panel
     └── 1g. PDF print page styling

  2. E2E Tests SECOND
     │  Why: Needs styled components (from step 1) for meaningful selectors.
     │  Needs running API + DB (infrastructure already exists from v2.0).
     │  Does NOT need analytics (can be added later).
     │
     ├── 2a. Test infrastructure (config, global setup, fixtures)
     ├── 2b. Core journey tests (lead fill → head publish → PDF)
     ├── 2c. Supporting tests (archive, carry-over, admin)
     └── 2d. CI pipeline (GitHub Actions)

  3. RAG Analytics THIRD
     │  Why: Depends on published reports existing (v2.0 data).
     │  Independent of UI styling but needs shadcn/ui for its own pages.
     │  Feature-flagged, so it can ship disabled initially.
     │
     ├── 3a. Database (pgvector extension, models, migration)
     ├── 3b. Embedding pipeline (client, processor, service)
     ├── 3c. Publication hook (trigger on publish)
     ├── 3d. tRPC analytics router
     ├── 3e. Analytics frontend (search, chat, trends)
     └── 3f. E2E tests for analytics flows
```

---

## Scalability Considerations

| Concern | At 50 reports | At 500 reports | At 5000 reports |
|---------|---------------|----------------|-----------------|
| Embedding storage | ~200 vectors (4 chunks/report) | ~2000 vectors | ~20000 vectors |
| pgvector index | IVFFlat sufficient | HNSW recommended | HNSW + partitioning |
| Embedding generation | Synchronous OK | BullMQ queue (existing) | BullMQ + rate limiter |
| Vector search latency | <10ms | <50ms with HNSW | <100ms with HNSW |
| OpenAI API cost | ~$0.01/report embed | ~$0.10/month | ~$1/month |
| Chat query cost | ~$0.005/query | Same | Same |

At the scale of this system (6 leads, weekly reports), pgvector in PostgreSQL is massively overprovisioned. No separate vector database needed.

---

## Anti-Patterns to Avoid

### Anti-Pattern 1: Styling in packages/shared
**What:** Putting Tailwind classes or UI logic in packages/shared
**Why bad:** packages/shared is for types and schemas. Adding UI concerns creates circular deps.
**Instead:** UI primitives in packages/ui, business components in apps/web.

### Anti-Pattern 2: Embedding generation in request path
**What:** Generating embeddings synchronously when a report is published
**Why bad:** OpenAI API calls take 500ms-2s. Blocks the publish response.
**Instead:** Always use BullMQ queue for async embedding generation.

### Anti-Pattern 3: Prisma Client for vector operations
**What:** Trying to use `prisma.reportEmbedding.create()` for vector columns
**Why bad:** Prisma 7 treats `Unsupported("vector")` as opaque. Create/query will fail.
**Instead:** Use `$queryRawUnsafe()` for all vector insert/search operations. Use Prisma for non-vector columns on the same table.

### Anti-Pattern 4: E2E tests depending on specific CSS classes
**What:** Using `page.locator('.bg-green-500')` for traffic light assertions
**Why bad:** Fragile — any Tailwind class refactor breaks tests.
**Instead:** Use semantic selectors: `getByRole`, `getByLabel`, `getByTestId` for traffic lights.

### Anti-Pattern 5: Shared globals.css with all tokens
**What:** Putting all Tailwind tokens in apps/web/globals.css
**Why bad:** The tokens are not reusable if you add another app later.
**Instead:** Design tokens live in packages/ui/styles/globals.css. Apps import and extend.

### Anti-Pattern 6: Full report text as single embedding
**What:** Embedding an entire report (all sections) as one vector
**Why bad:** Diluted semantic signal. A search for "Project X risks" matches poorly against a full report embedding.
**Instead:** Chunk by section type (lead summary, risks, decisions, overview). 4-6 chunks per report.

---

## Sources

- [shadcn/ui Monorepo Documentation](https://ui.shadcn.com/docs/monorepo) -- official setup guide for monorepo with Turborepo (HIGH confidence)
- [Turborepo shadcn/ui Guide](https://turborepo.dev/docs/guides/tools/shadcn-ui) -- official Turborepo integration guide (HIGH confidence)
- [shadcn/ui Tailwind v4](https://ui.shadcn.com/docs/tailwind-v4) -- Tailwind v4 configuration for shadcn/ui (HIGH confidence)
- [Playwright Authentication Docs](https://playwright.dev/docs/auth) -- storageState and global setup patterns (HIGH confidence)
- [Prisma PostgreSQL Extensions](https://www.prisma.io/docs/postgres/database/postgres-extensions) -- pgvector with Prisma: Unsupported type, raw queries (HIGH confidence)
- [Prisma 7 pgvector migration issue](https://github.com/prisma/prisma/issues/28867) -- known regression with Unsupported("vector") in Prisma 7 migrate (MEDIUM confidence)
- [pgvector RAG with PostgreSQL](https://encore.dev/blog/you-probably-dont-need-a-vector-database) -- architectural patterns for RAG without separate vector DB (MEDIUM confidence)
- [PostgreSQL Vector Search Complete Guide 2026](https://calmops.com/database/postgresql/postgresql-vector-search-pgvector-complete-guide-2026/) -- HNSW indexing, cosine distance operators (MEDIUM confidence)
