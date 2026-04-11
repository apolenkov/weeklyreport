# Feature Landscape: UI Polish & Analytics (v3.0)

**Domain:** Weekly status report web application (v3.0 milestone)
**Researched:** 2026-04-11
**Existing state:** Fully functional app with raw HTML (zero CSS), 7 basic E2E specs using localStorage injection, PostgreSQL + tRPC + BullMQ infrastructure shipped in v2.0
**Prior milestones:** v1.0 domain logic (8 services, 51 unit tests), v2.0 infrastructure (Prisma, NestJS, Docker Compose, SAML, BullMQ)

---

## Executive Summary

The application is functionally complete but visually unpresentable. Every component renders raw HTML -- browser-default `<select>`, `<button>`, `<input>` with no styling at all. The `packages/ui` package exports a single string constant. The 7 E2E tests bypass real auth via localStorage injection and test against the old localStorage-based data layer, not the tRPC+PostgreSQL backend shipped in v2.0.

This milestone has three goals in strict priority order:
1. **UI Styling** -- Transform all 22 components and 7+ pages from raw HTML to shadcn/ui + Tailwind CSS. This includes the PDF report template that gets delivered to the director.
2. **E2E Testing** -- Rewrite tests to run against the real Docker Compose stack with proper auth fixtures, covering the full user journey.
3. **Analytics** -- Add pgvector embeddings for report history search and a trend dashboard, transitioning from "reporting tool" to "reporting + analytics platform."

---

## Table Stakes

Features users expect. Missing = product feels incomplete and unprofessional.

| Feature | Why Expected | Complexity | Depends On | Notes |
|---------|--------------|------------|------------|-------|
| **Design system foundation** (CSS variables, Tailwind config, design tokens in `packages/ui`) | No styling exists. The app renders browser-default HTML. Users see 1998-era forms. | Med | Nothing | shadcn/ui v4 uses `@theme` directive in CSS with semantic variable pairs (`--primary` / `--primary-foreground`). Define tokens once in `packages/ui/src/styles/globals.css`, import from `apps/web`. [Confidence: HIGH] |
| **shadcn/ui primitives install** (~15 components: Button, Input, Select, Card, Badge, Dialog, Table, Tabs, Form, Alert, Separator, Sheet, Sidebar, DropdownMenu, Tooltip) | `packages/ui` is empty. Every component uses raw `<select>`, `<button>`, `<input>`. | Med | Design tokens | `npx shadcn@latest add` into `packages/ui/src/components/ui/`. Copy-paste model = zero runtime dependency. shadcn v4 is monorepo-aware. [Confidence: HIGH] |
| **Lead report form restyling** (report-section-form.tsx + 6 child components) | The primary user-facing surface. 6 team leads use this every Friday. Currently unstyled raw `<form>`. | High | shadcn primitives | Touches: ProjectStatusGrid (traffic light circles), ItemsEditor (table with inline edit), RisksEditor (card list), DecisionsEditor (card with deadline badge), PrioritiesEditor (numbered inputs), AutosaveIndicator (animated badge). |
| **Head dashboard + assembled report restyling** | Head uses submission-dashboard.tsx and assembled-report-review.tsx to review and publish. Both are raw HTML `<select>` and `<article>` tags. | Med | shadcn primitives | Traffic-light Badge components (green/yellow/red colored circles) are the key visual pattern. Submission dashboard needs progress indicator showing 4/6 leads submitted. |
| **Admin panel restyling** | admin-panel.tsx has CRUD for users, projects, periods, reminders -- all unstyled `<input>` and `<button>` in flat lists. | Med | shadcn primitives | Use shadcn Tabs (Users / Projects / Periods / Reminders), DataTable with TanStack Table for each entity list, Dialog for add/edit forms. |
| **Published report + archive restyling** | published-report.tsx and archive-report-list.tsx are consumed by viewers (director, other departments). The director judges the app by this surface. | Med | shadcn primitives | Published report: Card-based layout per lead section, colored traffic light badges, structured tables for items/risks/decisions. Archive: DataTable with date sorting, status badges. |
| **Navigation shell** (sidebar + header + branding) | app-shell.tsx is `<div><RoleNav/><main>children</main></div>`. No sidebar, no header, no logo. | Med | shadcn Sidebar, Sheet | shadcn/ui v4 has a native Sidebar component with collapsible sections and mobile Sheet fallback. RoleNav becomes Sidebar items. |
| **PDF report styling** (print/page.tsx) | The PDF is the deliverable artifact. The director receives it. Currently renders as unstyled HTML tables and lists. | High | Design tokens | Must use Tailwind `print:` variant for print-specific styles. Traffic light colors must render in Playwright PDF capture. Requires separate print stylesheet that hides nav, adjusts margins, forces `break-inside: avoid` on sections. |
| **Responsive layout** (mobile/tablet support) | Internal app used on laptops and occasionally tablets during meetings. | Low | Tailwind config, Sidebar | Tailwind responsive breakpoints (`md:`, `lg:`). shadcn Sheet for mobile nav. Grid layouts collapse to single column on small screens. |
| **Dark mode** | Team leads are all developers. Dark mode is expected in 2026 dev tools. | Low | Design tokens | shadcn/ui dark mode = single `class="dark"` toggle on `<html>`. CSS variables handle all color swaps automatically when tokens are set up correctly. ThemeProvider component (next-themes). |

## Differentiators

Features that set this product apart from the OnlyOffice shared document it replaces. Not expected, but valued.

| Feature | Value Proposition | Complexity | Depends On | Notes |
|---------|-------------------|------------|------------|-------|
| **Traffic light trend sparklines** | Show how each project's status changed over the last 8 weeks. Head sees at a glance which projects are improving/degrading. Impossible with OnlyOffice. | Med | Archive data (exists), charting | Use shadcn/ui Chart component (built on recharts). Pure SQL aggregation: `SELECT project_id, traffic_light, report.period_start FROM project_status JOIN ... ORDER BY period_start`. No embeddings needed. |
| **Submission progress tracker** | Real-time visual showing 4/6 leads submitted, with time-to-deadline countdown. The head's number one pain point is chasing people. | Low | Existing tRPC data | Enhance submission-dashboard.tsx with Progress bar + Avatar badges per lead. Data already available via `review.getSubmissionStatus`. |
| **Project health dashboard** | Aggregate view: all projects with current traffic light, trend arrow (up/down/flat), open risks count, unresolved decisions count. One screen to understand department health. | Med | Trend data query | Pure SQL aggregation over existing data. Dashboard layout with shadcn Cards in a responsive grid. |
| **Report comparison diff** | Compare two reports side-by-side to see what changed week-over-week. | Med | Archive data | Structured data makes this straightforward: diff items arrays, traffic light changes, new/resolved risks. Highlight added/removed/changed with color coding. |
| **Semantic search across reports** | Find reports by meaning, not just exact keywords. "Show me all infrastructure blockers" finds items tagged `infra` + `blocked` AND items with similar semantic meaning even if worded differently. | Med | pgvector setup, embeddings | Hybrid search: PostgreSQL `tsvector` full-text search + pgvector cosine similarity combined via `UNION` or RRF (Reciprocal Rank Fusion). |
| **RAG chatbot over report history** | "What risks did Team Alpha raise in the last month?" Natural language queries over structured report data with LLM-generated answers. | High | pgvector, embeddings API, LLM API | Requires: pgvector extension, embedding model (OpenAI text-embedding-3-small at $0.02/1M tokens or Cohere embed-v4 for better multilingual), LLM for answer generation (GPT-4o-mini at ~$0.01-0.05 per query). Prisma uses `Unsupported("vector")` + `$queryRaw` for vector queries. |
| **Auto-generated executive summary** | LLM generates a 2-3 paragraph summary after report publication highlighting key changes, escalations, and achievements. | Med | LLM API (OpenAI/Anthropic) | BullMQ job triggered after publication. Store summary text in Report model. Cost: ~$0.01-0.05 per summary with GPT-4o-mini. |
| **Email report digest** | Send published report summary via email. Director doesn't need to open the app. | Low | Existing email infra, publication event | Extend email.service.ts with HTML template rendered from report data. BullMQ job triggered after publication alongside PDF export. |
| **Keyboard shortcuts** (Cmd+K navigation, section shortcuts) | Power users (leads filling reports weekly) benefit from keyboard navigation between form sections. | Low | shadcn Command component | shadcn/ui Command component is built on `cmdk`. Cmd+K opens command palette with navigation to sections. |

## Anti-Features

Features to explicitly NOT build in v3.0.

| Anti-Feature | Why Avoid | What to Do Instead |
|--------------|-----------|-------------------|
| **Real-time collaborative editing** | Each lead works on their own isolated section. Zero conflicts by design. CRDT/OT + WebSocket infra adds massive complexity for zero user value. | Keep per-section isolation. Autosave with 300ms debounce (already built) is sufficient. |
| **Mobile-native app** | 6 leads + 1 head use laptops. Director reads PDFs. React Native adds a second codebase for <10 users. | Responsive web layout handles tablet use cases at meetings. |
| **Jira/GitLab integration** | External API credentials, mapping logic, ongoing maintenance. Manual entry IS the product -- leads add context and judgment that raw ticket data lacks. | Keep manual entry. Consider in v4+ only if users explicitly request. |
| **Custom report templates** | Report format is well-defined and standardized for the department. Configurability adds schema complexity and confuses the one process. | Hardcode the known format. Change via code when format evolves. |
| **Multi-tenant / multi-department** | Scope creep. The app serves one department (~8 users). Multi-tenancy adds auth complexity, data isolation, and admin overhead for zero current benefit. | Single-tenant. Fork or add tenancy in v4+ if other departments adopt. |
| **Standalone vector database** (Pinecone, Weaviate, Qdrant) | pgvector handles <5M vectors at <20ms query with HNSW indexing. The corpus will be ~500-2000 documents over years. Separate vector DB adds infrastructure, cost, and sync complexity. | pgvector in existing PostgreSQL. SQL joins between vectors and relational data are a major advantage at this scale. |
| **Fine-tuned embedding model** | text-embedding-3-small costs $0.02/1M tokens and handles Russian + English adequately. Corpus is tiny (<100K tokens total). Fine-tuning costs more than years of embedding API usage. | Use OpenAI text-embedding-3-small (1536 dims) or Cohere embed-v4 for better multilingual. Pre-built models, no training needed. |
| **Complex RBAC beyond 3 roles** | lead/head/viewer covers all real use cases. Per-project or per-field permissions add complexity nobody asked for. | Keep 3 roles. Leads see their section. Head sees everything. Viewers see published reports. |
| **CI/CD pipeline in this milestone** | Listed in PROJECT.md targets but should be a separate quick phase, not interleaved with styling work. | Add GitHub Actions as a standalone phase after styling is complete -- it's independent work. |

## Feature Dependencies

```
Design tokens (CSS vars, @theme directive, Tailwind config)
  |
  +-> shadcn/ui primitives install (15 components into packages/ui)
  |     |
  |     +-> Lead report form restyling (6 child components)
  |     +-> Head dashboard + assembled report restyling
  |     +-> Admin panel restyling (Tabs + DataTables)
  |     +-> Published report + archive restyling
  |     +-> Navigation shell (Sidebar component)
  |     +-> PDF report styling (print: variant, separate stylesheet)
  |     +-> Dark mode (next-themes ThemeProvider)
  |     +-> Keyboard shortcuts (Command component)
  |
  +-> Traffic light trend sparklines (recharts via shadcn Chart)
  +-> Submission progress tracker (Progress + Avatar)
  +-> Project health dashboard (Cards + Chart)

E2E test infrastructure (Playwright fixtures, POM classes, global setup)
  |
  +-> Auth flow test (storageState pattern with dev bypass)
  |     |
  |     +-> Full user journey test (login -> fill -> submit -> publish -> PDF)
  |           |
  |           +-> PDF visual validation test (screenshot or file-size check)
  |
  +-> 7 existing specs refactored (localStorage -> real backend)

pgvector extension + Prisma raw SQL setup (CREATE EXTENSION, migrations)
  |
  +-> Embedding pipeline (BullMQ job, OpenAI/Cohere API call)
  |     |
  |     +-> Semantic search (hybrid: tsvector + vector cosine)
  |     +-> RAG chatbot (search + LLM answer generation)
  |
  +-> Report comparison diff (pure structured diff, no vectors needed)

Existing archive data + SQL aggregation
  |
  +-> Traffic light trends (GROUP BY project_id, period_start)
  +-> Project health dashboard (aggregation queries)
  +-> Auto-generated executive summary (LLM post-publication)
  +-> Email report digest (HTML template + BullMQ job)
```

## MVP Recommendation

### Priority 1: UI Styling (highest business value -- the deliverable is a PDF the director sees)

Suggested phase ordering for styling work:

1. **Design tokens + shadcn primitives** -- unlocks all component work, zero user-visible change yet
2. **Navigation shell (Sidebar + header)** -- every page uses it, do once, visible improvement
3. **Lead report form + autosave indicator** -- primary weekly-use surface (6 leads)
4. **Head dashboard + assembled report review** -- second most-used surface
5. **Published report + archive** -- the outward-facing deliverable
6. **Admin panel** -- lowest traffic but needs DataTable styling
7. **PDF report styling** -- the final deliverable artifact, must match web styling
8. **Dark mode** -- trivial bolt-on after tokens are correct

### Priority 2: E2E Testing (regression safety net)

1. **Test infrastructure** (Playwright fixtures, auth setup via dev bypass storageState, Page Object Model classes)
2. **Full user journey test** (login -> fill -> submit -> publish -> PDF download -- the critical path)
3. **7 existing specs refactored** (replace localStorage injection with auth fixtures, point at real tRPC backend)
4. **PDF visual validation** (Playwright page.pdf() screenshot comparison or artifact download check)

### Priority 3: Analytics (differentiator, builds on existing data)

Start with pure SQL analytics (no ML, no external APIs), then add RAG:

1. **Traffic light trends** -- pure SQL aggregation, high visual impact, uses shadcn Chart
2. **Submission progress tracker** -- trivial UI enhancement with existing data
3. **Project health dashboard** -- pure SQL, Card-based layout
4. **pgvector + embedding pipeline setup** -- infrastructure for RAG (migration, BullMQ embedding job, API key config)
5. **Semantic search** -- simpler than chatbot, first user-facing RAG feature
6. **RAG chatbot** -- most complex, defer if time-constrained

### Defer to v4+

| Feature | Reason to Defer |
|---------|----------------|
| Report comparison diff | Useful but not urgent; pure structured diff can be added anytime |
| Auto-generated executive summary | Nice-to-have; dependent on LLM API setup already done for RAG |
| Email report digest | Nice-to-have; trivial once email templates exist |
| Keyboard shortcuts | Polish feature; add after core styling is stable |
| CI/CD pipeline | Independent work; add as a quick standalone phase |

## Complexity Budget

| Feature Group | Estimated Phases | Risk Level | Key Risk |
|---------------|-----------------|------------|----------|
| Design system + all component restyling | 4-5 phases | **Low** | Well-understood work. shadcn/ui copy-paste model is predictable. Main risk: PDF print styling is fiddly (Playwright renders CSS differently from browsers in edge cases). |
| E2E test rewrite + new tests | 1-2 phases | **Medium** | Need Playwright running against real Docker Compose stack. Auth fixture for SAML uses dev bypass mode (already built). Risk: flaky tests from async operations (BullMQ PDF job). |
| SQL-based analytics (trends, dashboard, progress) | 1-2 phases | **Low** | Pure queries over existing data. No new infrastructure. Chart rendering is well-documented in shadcn/ui. |
| pgvector + RAG infrastructure | 2-3 phases | **High** | Prisma pgvector uses raw SQL (`$queryRaw`), losing type safety. Embedding pipeline needs external API key (OpenAI or Cohere). LLM response quality for Russian-language report text is unpredictable -- needs evaluation. Cohere embed-v4 reportedly handles 100+ languages well but costs more. |

## Existing Code Inventory (v3.0 Touch Points)

### Components to Restyle (22 files)

| Component | File | Current State | Restyling Scope |
|-----------|------|---------------|-----------------|
| RootLayout | `app/layout.tsx` | Bare `<html><body>` with no CSS | Add Tailwind globals, font import, ThemeProvider wrapper |
| AppShell | `navigation/app-shell.tsx` | `<div>` wrapper around `<RoleNav>` + `<main>` | Replace with Sidebar layout + collapsible header |
| RoleNav | `navigation/role-nav.tsx` | Flat `<nav>` with text links | Sidebar navigation items with icons and active state |
| ReportSectionForm | `report-section/report-section-form.tsx` | Raw `<form>` with `<h1>`, `<p>`, `<ul>`, `<button>` | Card layout, form field groups with labels, styled dialog |
| ProjectStatusGrid | `report-section/project-status-grid.tsx` | Raw `<select>` dropdowns | Traffic light Badge components (colored circles with Select) |
| ItemsEditor | `report-section/items-editor.tsx` | Raw HTML | Table with inline text editing, tag badges |
| RisksEditor | `report-section/risks-editor.tsx` | Unstyled list | Card-based risk entries with impact badges |
| DecisionsEditor | `report-section/decisions-editor.tsx` | Unstyled list | Card with owner and deadline badges, resolved state |
| PrioritiesEditor | `report-section/priorities-editor.tsx` | Unstyled list | Numbered priority inputs with rank indicators |
| AutosaveIndicator | `report-section/autosave-indicator.tsx` | Plain text "Saved" | Animated subtle Badge with check icon |
| SubmissionDashboard | `head/submission-dashboard.tsx` | Raw list of lead statuses | Progress bar + Avatar cards per lead |
| AssembledReportReview | `head/assembled-report-review.tsx` | Raw `<article>` sections | Accordion per lead section, inline edit controls |
| PublishedReport | `report/published-report.tsx` | Raw `<section>` with `<article>` per lead | Professional report layout with Cards, Badges, Tables |
| ArchiveReportList | `report/archive-report-list.tsx` | Raw list | DataTable with date sorting, status Badge filters |
| AdminPanel | `admin/admin-panel.tsx` | Raw `<input>`, `<select>`, `<button>`, `<ul>` | Tabs interface, DataTables per entity, Dialog forms |
| QueryError | `common/query-error.tsx` | Unknown state | Alert component with retry action |
| PrintReportPage | `reports/[reportId]/print/page.tsx` | Raw HTML tables and lists | Print-optimized layout with `@media print` styles |
| 5 page wrappers | `(app)/lead/report`, `head/dashboard`, `head/report`, `admin`, `reports/history` | Minimal page shells | Layout spacing, page titles, breadcrumbs |

### E2E Tests to Refactor (7 specs)

| Test | File | Current Auth Pattern | Needed Change |
|------|------|---------------------|---------------|
| Lead report entry | `lead-report-entry.spec.ts` | No auth setup | Add auth fixture with lead role |
| Head dashboard | `head-dashboard.spec.ts` | localStorage session injection | Auth fixture, test against real API |
| Head publication | `head-publication.spec.ts` | localStorage session injection | Auth fixture, test publish flow against real API |
| Published report | `published-report.spec.ts` | Unknown | Auth fixture with viewer role |
| Admin panel | `admin-panel.spec.ts` | localStorage session injection | Auth fixture with head role, test CRUD against real API |
| Carry-over | `carry-over.spec.ts` | Unknown | Auth fixture, test carry-over against real DB state |
| Archive history | `archive-history.spec.ts` | Unknown | Auth fixture with viewer role |

### Database Changes Needed (Analytics/RAG)

| Change | SQL | Complexity | Notes |
|--------|-----|-----------|-------|
| Enable pgvector extension | `CREATE EXTENSION IF NOT EXISTS vector;` | Trivial | Single migration, one line |
| Add embedding columns | `ALTER TABLE "Item" ADD COLUMN embedding vector(1536);` (same for Risk, Decision) | Low | 3 ALTER TABLE statements |
| Add HNSW indexes | `CREATE INDEX ON "Item" USING hnsw (embedding vector_cosine_ops);` | Low | Index creation is fast at <10K rows |
| Prisma schema update | `embedding Unsupported("vector(1536)")?` on Item, Risk, Decision models | Medium | All vector queries must use `$queryRaw` -- no type-safe Prisma client access. Prisma native pgvector support is "coming soon" but not shipped yet. |
| Full-text search columns | `ALTER TABLE "Item" ADD COLUMN tsv tsvector GENERATED ALWAYS AS (to_tsvector('russian', text)) STORED;` | Low | PostgreSQL built-in, index with GIN |

---

## Sources

- [shadcn/ui Theming](https://ui.shadcn.com/docs/theming) -- CSS variable system, background/foreground pairs
- [shadcn/ui Tailwind v4](https://ui.shadcn.com/docs/tailwind-v4) -- `@theme` directive, `data-slot` attributes
- [shadcn/ui Data Table](https://ui.shadcn.com/docs/components/radix/data-table) -- TanStack Table integration for admin panel
- [Shadcn UI Best Practices 2026](https://medium.com/write-a-catalyst/shadcn-ui-best-practices-for-2026-444efd204f44) -- Versioning, layering, composition patterns
- [Building a Scalable Design System with shadcn/ui](https://shadisbaih.medium.com/building-a-scalable-design-system-with-shadcn-ui-tailwind-css-and-design-tokens-031474b03690) -- Design token architecture
- [PDFx: shadcn/ui for PDFs](https://allshadcn.com/components/pdfx/) -- React-pdf renderer with shadcn styling (alternative to Playwright capture)
- [shadcn/ui Dashboard Tutorial](https://designrevision.com/blog/shadcn-dashboard-tutorial) -- Production dashboard patterns
- [Playwright Authentication](https://playwright.dev/docs/auth) -- `storageState` pattern, global setup file
- [Playwright Best Practices](https://playwright.dev/docs/best-practices) -- Locator strategy (`getByRole`), test isolation, parallel workers
- [Playwright E2E with POM](https://earezki.com/ai-news/2026-03-15-end-to-end-testing-with-playwright-complete-guide-with-page-object-model/) -- Page Object Model pattern, fixtures, monorepo organization
- [Next.js Playwright Auth + CI](https://dev.to/whoffagents/playwright-e2e-testing-for-nextjs-auth-setup-stripe-checkout-and-ci-integration-4ndg) -- Auth flow testing, production build testing
- [Next.js Playwright Guide](https://www.getautonoma.com/blog/nextjs-playwright-testing-guide) -- Production build testing, auth patterns
- [pgvector 2026 Guide](https://www.instaclustr.com/education/vector-database/pgvector-key-features-tutorial-and-pros-and-cons-2026-guide/) -- HNSW indexing, similarity metrics, production tuning
- [pgvector RAG in PostgreSQL](https://encore.dev/blog/you-probably-dont-need-a-vector-database) -- Why pgvector beats standalone vector DBs at small scale
- [Prisma pgvector Integration](https://www.prisma.io/docs/postgres/database/postgres-extensions) -- `Unsupported` type, `$queryRaw`, custom migrations
- [Prisma Native pgvector Support Roadmap](https://www.prisma.io/blog/the-next-evolution-of-prisma-orm) -- First-class pgvector support coming
- [Best Embedding Models 2026](https://blog.premai.io/best-embedding-models-for-rag-2026-ranked-by-mteb-score-cost-and-self-hosting/) -- Model comparison: text-embedding-3-small vs Voyage 4 vs Cohere embed-v4
- [OpenAI Embeddings Pricing](https://costgoat.com/pricing/openai-embeddings) -- $0.02/1M tokens for text-embedding-3-small
- [Vector DB Comparison 2026](https://www.cloudmagazin.com/en/2026/04/02/vector-databases-rag-pinecone-weaviate-qdrant-pgvector-comparison/) -- pgvector vs dedicated vector DBs
- [Status Reporting Software 2026](https://gitnux.org/best/status-reporting-software/) -- Market context, competitor features
- [Weekly Status Reports Best Practices](https://reclaim.ai/blog/weekly-status-reports) -- Structured async updates, report formatting

---

*Researched: 2026-04-11 (v3.0 UI Polish & Analytics milestone)*
