---
phase: 39
phase_name: "performance"
project: "CustomReport"
generated: "2026-05-06T23:43:52+03:00"
counts:
  decisions: 5
  lessons: 4
  patterns: 4
  surprises: 3
missing_artifacts:
  - "39-VERIFICATION.md"
  - "39-UAT.md"
---

# Phase 39 Learnings: Performance

## Decisions

### Route Runtime Database Traffic Through PgBouncer, But Keep Migrations Direct

The production API container uses PgBouncer in transaction mode, while the
migration container connects directly to Postgres because DDL is unsafe through
a transaction-pooled bouncer.

**Rationale:** Runtime tRPC/queue traffic needs connection fan-in; migrations
need direct session semantics.
**Source:** 39-01-PLAN.md, 39-01-SUMMARY.md

---

### Remove The Webpack Dev Pin After The Three Runaway-Loop Triggers Closed

The web dev script moved back to `next dev` so Next.js 16 can use Turbopack by
default.

**Rationale:** The old `--webpack` pin protected against now-closed CLS/env/SAML
stub-mode loop triggers, so keeping it only blocked expected dev speedups.
**Source:** 39-02-PLAN.md, 39-02-SUMMARY.md

---

### Add Indexes Only From Evidence Or Hot Missing-FK Patterns

The phase added 18 B-tree indexes across 9 models and documented the evidence
behind each one.

**Rationale:** The user explicitly asked for mature index work; the plan used
api logs, slow-query entries, and hot render-path FK access instead of generic
indexing.
**Source:** 39-03-PLAN.md, 39-03-SUMMARY.md

---

### Ship A Reproducible k6 Baseline Before Automating CI Load Tests

The phase shipped the calibrated k6 script and methodology, but deferred
recurring execution until a proper target host and k6 installation exist.

**Rationale:** Running 50 VUs on the same dev machine as Postgres/Redis/API/Web
would produce noisy numbers; a dedicated load-test image/host is a v8.1 concern.
**Source:** 39-04-PLAN.md, 39-04-SUMMARY.md

---

### Reverse The Earlier "No FTS In v8.0" Decision Once A Search UI Existed

Full-text search shipped across Item, Risk, Decision, and Project after the user
asked for "mine" and "everywhere" search.

**Rationale:** The earlier PERF-AUDIT rationale was "no consumer"; a concrete UI
consumer invalidated that premise.
**Source:** 39-05-PLAN.md, 39-05-SUMMARY.md

---

## Lessons

### Prisma 7 URL Routing Belongs Outside schema.prisma

Prisma 7 no longer accepts datasource `url` / `directUrl` in `schema.prisma`.
Runtime URL routing is handled through container environment and the PrismaPg
adapter path.

**Context:** This enabled API-to-PgBouncer and migrate-to-Postgres routing
without schema changes.
**Source:** 39-01-SUMMARY.md

---

### Cold-Cache Tail Latency Can Look Like N+1 Until The Procedure Code Is Read

`weeklyReport.get`, `reports.getActive`, and several slow-query samples had
tail spikes, but the summaries record that the procedures already use Prisma
includes correctly.

**Context:** The index audit separated cold-start and missing-index evidence
from actual N+1 behavior.
**Source:** 39-03-SUMMARY.md

---

### Load Tests Need Schema-Accurate Payloads Before They Need Big VU Counts

The review found the k6 baseline would have sent invalid `weeklyReport.get` and
`saveDraft` inputs.

**Context:** A performance test that measures validation failures is worse than
no baseline because it hides the actual bottleneck behind artificial 400s.
**Source:** 39-REVIEW.md

---

### Role-Aware Search Scope Needs UI And Server Agreement

The search service correctly rejects `scope="all"` for non-head/admin roles,
but the reports UI initially exposed that scope to viewers.

**Context:** The backend authorization was sound; the frontend still needed to
avoid rendering an action that is guaranteed to fail.
**Source:** 39-REVIEW.md

---

## Patterns

### Evidence-Backed Performance Change Log

For performance work, pair every index/pool/baseline change with the observed
procedure, query, or usage signal that justified it.

**When to use:** Any future DB or caching change where write amplification,
stale cache windows, or operational complexity can be introduced silently.
**Source:** 39-03-PLAN.md, 39-03-SUMMARY.md

---

### Deferred Verification With Reproducible Recipes

When verification depends on infrastructure not running in the current session,
ship the artifact plus an exact smoke/full-run recipe instead of recording a
one-off local number.

**When to use:** PgBouncer prod validation, k6 load tests, and any future
nightly performance environment.
**Source:** 39-01-SUMMARY.md, 39-04-SUMMARY.md

---

### Prisma-Free Service Boundary For Raw SQL Features

The search module keeps a repository interface at the service boundary and puts
the `$queryRaw` / `Prisma.sql` details in the Prisma repository.

**When to use:** Features that need database-specific SQL while preserving unit
testability and limiting raw SQL blast radius.
**Source:** 39-05-SUMMARY.md

---

### Click-Through Parameters Must Be Consumed By The Landing Surface

Search hits that encode intent in the URL need the destination page to actually
consume that parameter.

**When to use:** Search, notifications, activity feeds, and any future deep-link
surface that claims to focus or highlight a record.
**Source:** 39-REVIEW.md

---

## Surprises

### Search Arrived Inside The Performance Phase

The phase started with connection pooling, indexes, Turbopack, and load-test
baseline work, then added full-text search after the user reversed the earlier
scope decision.

**Impact:** Phase 39 became both performance hardening and a user-facing search
delivery phase.
**Source:** 39-05-PLAN.md, 39-05-SUMMARY.md

---

### Dev-Traffic Logs Already Contained Enough Signal For A Mature Index Pass

The audit had 9,283 tRPC calls and slow-query samples from dev usage, enough to
justify concrete indexes without inventing synthetic hot paths.

**Impact:** The phase could ship 18 indexes with traceable rationale instead of
waiting for production telemetry.
**Source:** 39-03-PLAN.md, 39-03-SUMMARY.md

---

### Documentation And Implementation Drifted Within The Same Phase

The load-test methodology and k6 script described a `patches[]` write shape that
did not match the current `draftSaveSchema`.

**Impact:** Review had to fix the script and the methodology doc together so
future load runs measure real application behavior.
**Source:** 39-REVIEW.md
