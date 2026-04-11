# Requirements: CustomReport v3.0

**Defined:** 2026-04-11
**Core Value:** Лиды заполняют свои секции независимо через удобную форму, система автоматически собирает единый отчёт — без конфликтов редактирования, с историей и аналитикой.
**Milestone:** v3.0 UI Polish & Analytics
**Priority:** Стилизация — главный приоритет milestone

## Design System & Styling

- [x] **DS-01**: Tailwind CSS v4 initialized with @theme directive, design tokens (colors, spacing, typography), dark/light mode support
- [x] **DS-02**: shadcn/ui initialized in packages/ui with monorepo-aware CLI, @source directive scanning cross-package components
- [x] **DS-03**: Responsive navigation shell — sidebar with role-based menu, header with user info + logout, mobile hamburger menu
- [ ] **DS-04**: All form inputs styled via shadcn/ui (Input, Select, Textarea, Button, Badge, Checkbox) across all pages
- [ ] **DS-05**: DataTable component for tabular data (submission dashboard, admin tables, archive list) with sorting
- [ ] **DS-06**: Card-based layout for report sections, project statuses, risk/decision items
- [ ] **DS-07**: Dialog/Sheet components for confirmations, admin CRUD forms
- [x] **DS-08**: Toast notifications for mutation feedback (save, submit, publish, error)
- [x] **DS-09**: Loading skeletons for tRPC query states (replace plain "Loading..." text)

## Page Styling

- [x] **PAGE-01**: Lead report form — styled section editor with traffic light selector, item/risk/decision forms, priority ranking
- [x] **PAGE-02**: Head dashboard — styled submission status table with status badges, progress indicators
- [x] **PAGE-03**: Head assembled report — styled read-only report review with section cards, publish action
- [ ] **PAGE-04**: Published report page — styled public view with portfolio overview, section details
- [ ] **PAGE-05**: Archive/history page — styled report list with date ranges, status filters
- [x] **PAGE-06**: Admin panel — styled DataTables for users, projects, periods, reminders with CRUD dialogs
- [x] **PAGE-07**: Auth error page — styled with design system tokens, consistent with app theme
- [x] **PAGE-08**: Landing/navigation page — styled role-based entry point

## PDF Styling

- [x] **PDF-01**: Print-specific CSS for published report — print:hidden nav, page breaks between sections, header/footer
- [x] **PDF-02**: Traffic light colors render correctly in Playwright PDF (no oklch — use hex/rgb fallback)
- [x] **PDF-03**: PDF matches visual fidelity of browser view — tables, badges, cards render cleanly

## Tooling Upgrades

- [x] **TOOL-01**: pnpm 9 → 10 migration with onlyBuiltDependencies for prisma, playwright, esbuild
- [x] **TOOL-02**: Next.js 15 → 16 migration — middleware.ts → proxy.ts rename, React Compiler enabled, Turbopack default
- [x] **TOOL-03**: Vitest 3 → 4 migration — pool option renames, mock behavior updates
- [x] **TOOL-04**: ESLint 10 flat config setup — @typescript-eslint/strict, sonarjs rules, monorepo-aware
- [x] **TOOL-05**: CLAUDE.md updated with actual current versions (Next.js 16, Vitest 4, ESLint 10, pnpm 10, etc.)

## CI/CD

- [ ] **CI-01**: GitHub Actions workflow — lint + typecheck + unit tests on push/PR
- [ ] **CI-02**: E2E test job with Docker services (postgres + redis) and Playwright CLI
- [ ] **CI-03**: Docker build verification (docker compose build succeeds)

## E2E Testing

- [ ] **E2E-01**: Playwright config with dual webServer (Next.js + NestJS), Docker services for DB
- [ ] **E2E-02**: Auth fixtures — per-role storageState (lead, head, viewer) using dev-login endpoint
- [ ] **E2E-03**: Full lead journey test — login → fill section → save draft → submit → verify persistence
- [ ] **E2E-04**: Full head journey test — login → review dashboard → view report → publish → verify published
- [ ] **E2E-05**: PDF export E2E — trigger export → poll status → verify PDF file generated
- [ ] **E2E-06**: Admin CRUD E2E — create/edit/delete user, project, period

## SQL Analytics

- [ ] **ANAL-01**: Project health trends API — traffic light history per project over time (SQL aggregation)
- [ ] **ANAL-02**: Submission timeliness API — when leads submit relative to deadline (SQL aggregation)
- [ ] **ANAL-03**: Analytics dashboard page — charts (recharts) for project trends, submission stats
- [ ] **ANAL-04**: Dashboard accessible to head and viewer roles

## Search & RAG

- [ ] **SEARCH-01**: PostgreSQL full-text search — tsvector + GIN indexes on report items, risks, decisions text fields
- [ ] **SEARCH-02**: Search API endpoint — keyword search across report history with Russian morphology (to_tsvector('russian', ...))
- [ ] **SEARCH-03**: pgvector extension enabled in PostgreSQL, Prisma schema with Unsupported("vector") columns
- [ ] **SEARCH-04**: Embedding pipeline — BullMQ job to generate embeddings (OpenAI text-embedding-3-small) on report publish
- [ ] **SEARCH-05**: Semantic search API — cosine similarity over embeddings for "find similar reports/items"
- [ ] **SEARCH-06**: Hybrid search — combine tsvector keyword results + pgvector semantic results with RRF ranking
- [ ] **SEARCH-07**: Search UI — search bar in navigation, results page with highlighted matches
- [ ] **SEARCH-08**: RAG chatbot backend — question → hybrid search → LLM answer with source citations
- [ ] **SEARCH-09**: Chatbot UI — conversational chat element embedded in app, accessible to head/viewer roles

## Out of Scope

- Mobile native app — web responsive is sufficient
- Elasticsearch/Meilisearch — PostgreSQL handles both full-text and vector search
- Real-time collaboration (WebSocket) — one lead per section, no conflicts
- Custom themes / white-labeling — single department app
- Kubernetes — Docker Compose is sufficient for 10 users
- PgBouncer — unnecessary for this scale (descoped in v2.0)
- Grafana/Prometheus monitoring stack — health endpoints sufficient
- Multi-language support — Russian only

## Traceability

| Requirement | Phase | Status |
|-------------|-------|--------|
| TOOL-01 | Phase 8 | Complete |
| TOOL-02 | Phase 8 | Complete |
| TOOL-03 | Phase 8 | Complete |
| TOOL-04 | Phase 8 | Complete |
| TOOL-05 | Phase 8 | Complete |
| DS-01 | Phase 9 | Complete |
| DS-02 | Phase 9 | Complete |
| DS-03 | Phase 9 | Complete |
| DS-04 | Phase 9 | Pending |
| DS-05 | Phase 9 | Pending |
| DS-06 | Phase 9 | Pending |
| DS-07 | Phase 9 | Pending |
| DS-08 | Phase 9 | Complete |
| DS-09 | Phase 9 | Complete |
| PAGE-01 | Phase 10 | Complete |
| PAGE-02 | Phase 10 | Complete |
| PAGE-03 | Phase 10 | Complete |
| PAGE-04 | Phase 10 | Pending |
| PAGE-05 | Phase 10 | Pending |
| PAGE-06 | Phase 10 | Complete |
| PAGE-07 | Phase 10 | Complete |
| PAGE-08 | Phase 10 | Complete |
| PDF-01 | Phase 11 | Complete |
| PDF-02 | Phase 11 | Complete |
| PDF-03 | Phase 11 | Complete |
| E2E-01 | Phase 12 | Pending |
| E2E-02 | Phase 12 | Pending |
| E2E-03 | Phase 12 | Pending |
| E2E-04 | Phase 12 | Pending |
| E2E-05 | Phase 12 | Pending |
| E2E-06 | Phase 12 | Pending |
| CI-01 | Phase 12 | Pending |
| CI-02 | Phase 12 | Pending |
| CI-03 | Phase 12 | Pending |
| ANAL-01 | Phase 13 | Pending |
| ANAL-02 | Phase 13 | Pending |
| ANAL-03 | Phase 13 | Pending |
| ANAL-04 | Phase 13 | Pending |
| SEARCH-01 | Phase 14 | Pending |
| SEARCH-02 | Phase 14 | Pending |
| SEARCH-03 | Phase 14 | Pending |
| SEARCH-04 | Phase 14 | Pending |
| SEARCH-05 | Phase 14 | Pending |
| SEARCH-06 | Phase 14 | Pending |
| SEARCH-07 | Phase 14 | Pending |
| SEARCH-08 | Phase 14 | Pending |
| SEARCH-09 | Phase 14 | Pending |

---

*Created: 2026-04-11 for milestone v3.0*
