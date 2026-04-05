# Architecture Patterns: CustomReport

**Domain:** Team status reporting web application
**Researched:** 2026-04-05
**Confidence:** HIGH (patterns are proven Next.js/NestJS/tRPC monorepo best practices)

---

## Recommended Architecture: Typed Monorepo with Async Jobs

```text
┌─────────────────────────────────────────────────────────────┐
│                    MONOREPO (Turborepo)                      │
│                                                              │
│  ┌──────────────────────────┐    ┌──────────────────────┐  │
│  │     apps/web             │    │     apps/api         │  │
│  │   (Next.js 15 SSR)       │    │  (NestJS 11 + tRPC)  │  │
│  │                          │    │                      │  │
│  │  ├─ app/ (pages/routes)  │    │  ├─ src/            │  │
│  │  ├─ components/          │    │  │   ├─ auth/       │  │
│  │  ├─ hooks/               │    │  │   ├─ reports/    │  │
│  │  ├─ trpc/                │    │  │   ├─ queues/     │  │
│  │  │   └─ client.ts        │───┼──│   ├─ trpc/        │  │
│  │  └─ lib/                 │    │  │   └─ main.ts     │  │
│  └──────────────────────────┘    └──────────────────────┘  │
│         ▲                                  ▲                 │
│         │ tRPC types                      │ Zod schemas    │
│         │                                 │                 │
│  ┌──────────────────────────────────────────────────────┐   │
│  │        packages/shared                               │   │
│  │   (Zod schemas, types, shared utilities)            │   │
│  │                                                      │   │
│  │  ├─ schemas/                                         │   │
│  │  │   ├─ report.ts          (Zod schemas)            │   │
│  │  │   ├─ auth.ts                                     │   │
│  │  │   └─ ...                                          │   │
│  │  ├─ types.ts               (TypeScript interfaces)   │   │
│  │  └─ trpc.ts                (tRPC router definition)  │   │
│  └──────────────────────────────────────────────────────┘   │
│                                                              │
│  ┌──────────────────────────────────────────────────────┐   │
│  │        packages/ui (shadcn/ui components)            │   │
│  │        packages/config (ESLint, TS, Prettier)        │   │
│  └──────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────┘
         ▲
         │ Shared types, zero runtime overhead
         │
    ┌────┴─────────────────────────────┐
    │                                   │
  ┌─┴───────┐                    ┌─────┴──────┐
  │ Frontend │──────────tRPC──────│   Backend  │
  │ Runtime  │   Type-safe RPC    │   Runtime  │
  │          │   (HTTP over)      │            │
  └──────────┘                    └────────────┘
         │                              │
         │                              ▼
         │                         ┌──────────┐
         │                         │Prisma ORM│
         │                         │(TypeScript)
         │                         └────┬─────┘
         │                              │
         │       ┌──────────────────────┼─────────────────────┐
         │       │                      │                     │
         │       ▼                      ▼                     ▼
         │   ┌─────────┐           ┌─────────┐          ┌─────────┐
         │   │PostgreSQL        │Redis         │BullMQ
         │   │(connection via   │(caching)    │(job queue)
         │   │PgBouncer)        │              │
         │   └─────────┘        └─────────┘    └─────────┘
         │
         └─────────────────────── SSR Pages + API
             (No separate API domain)
```

### Key Characteristics

1. **Type-safe monorepo** — tRPC eliminates separate API definition, types flow end-to-end
2. **Shared schemas** — Zod schemas defined once, validated on frontend AND backend
3. **Async jobs** — BullMQ handles email, PDF generation, carry-over logic (don't block HTTP)
4. **No separate API domain** — NestJS runs alongside Next.js in Turborepo (optional: separate services in Kubernetes v2)
5. **Stateless backend** — All state in PostgreSQL + Redis, multiple NestJS instances can run

---

## Component Boundaries

| Component | Responsibility | Communicates With |
|-----------|---------------|-------------------|
| **Next.js (web)** | Server-side rendering, form UI, report viewing, PDF download link | NestJS via tRPC |
| **NestJS (api)** | HTTP server, request routing, business logic, Prisma ORM, BullMQ job dispatch | PostgreSQL, Redis, Keycloak, SMTP |
| **Prisma** | Type-safe database access, migrations, schema definition | PostgreSQL |
| **PostgreSQL** | Persistent data store (reports, sections, items, users) | Prisma client |
| **PgBouncer** | Connection pooling (20–30 connections to 1 PostgreSQL) | PostgreSQL |
| **Redis** | Cache (report summaries), BullMQ queue backend, session store | NestJS, BullMQ |
| **BullMQ Workers** | Background jobs (email reminders, PDF generation, carry-over) | PostgreSQL, Redis, SMTP |
| **Keycloak** | Identity provider (SAML SSO, user authentication) | NestJS Guards |
| **Docker Compose** | Local dev + early production orchestration | All services |

---

## Data Flow

### Report Submission Flow (synchronous, happy path)

```
User clicks "Submit" in web form
    ↓
Next.js validates with Zod (frontend)
    ↓
tRPC call to backend (HTTP POST)
    ↓
NestJS middleware: JwtGuard checks token
    ↓
NestJS endpoint validates again with Zod (backend)
    ↓
NestJS: Prisma writes to PostgreSQL
    ↓
Response returns to frontend (tRPC automatically types response)
    ↓
User sees success toast, ReportSection.status = "submitted"
```

### Email Reminder Flow (asynchronous, background job)

```
Scheduled cron: "tomorrow is report deadline"
    ↓
NestJS cron job (via @nestjs/schedule or external trigger)
    ↓
Query PostgreSQL: get all reports with deadline tomorrow
    ↓
For each report, add job to BullMQ queue (sendReminderEmail)
    ↓
BullMQ worker picks up job from Redis queue
    ↓
Worker: Prisma query to get lead email + report name
    ↓
Worker: send SMTP email to lead@company.com
    ↓
Job marked complete in Redis (or retry if SMTP fails)
    ↓
(Leads don't wait, HTTP response is not blocked)
```

### PDF Generation Flow (async job, user waits for link)

```
User clicks "Export as PDF"
    ↓
NestJS endpoint: add job to BullMQ queue (generatePDF)
    ↓
NestJS returns immediately with job ID + polling URL
    ↓
Frontend polls /api/jobs/{jobId} every 2s for status
    ↓
BullMQ worker picks up job
    ↓
Worker: Prisma query to get full report data
    ↓
Worker: render HTML template (tRPC types ensure correct shape)
    ↓
Worker: Playwright renders HTML → PDF (stored on disk or S3)
    ↓
Worker: update job status in Redis (completed: true, pdfUrl: ...)
    ↓
Frontend detects completion, shows download link
    ↓
User downloads PDF (served as static file or from S3)
```

### Carry-over Logic (nightly batch job, not critical path)

```
Scheduled: every Sunday at 11 PM (before next report opens)
    ↓
NestJS trigger: "Prepare next report for next week"
    ↓
Prisma: get previous report (id: N)
    ↓
For each ReportSection:
  ├─ Collect items where type="next" and completed != true
  ├─ Collect decisions where resolvedAt is null
  └─ Create new ReportSection (id: N+1) with carried-over items
    ↓
New report status = "draft", all ReportSections = "draft"
    ↓
Leads see: "This week's items: [item1, item2] (carried over)"
    ↓
Leads can mark: done / blocked / not completed
```

---

## Patterns to Follow

### Pattern 1: Zod Validation (Shared Schemas)

**What:** Single Zod schema defined in `packages/shared/schemas/report.ts`, used by frontend AND backend.

**When:** Every form input, API request, database read.

**Example:**

```typescript
// packages/shared/schemas/report.ts
import { z } from "zod";

export const CreateItemSchema = z.object({
  reportSectionId: z.string().uuid(),
  projectId: z.string().uuid(),
  text: z.string().min(1).max(500),
  tag: z.enum(["feature", "bugfix", "infra", "ops"]),
  itemStatus: z.enum(["done", "in-progress", "blocked"]),
});

export type CreateItem = z.infer<typeof CreateItemSchema>;
```

```typescript
// apps/web/app/report/[id]/page.tsx (Next.js)
"use client";
import { CreateItemSchema } from "@repo/shared/schemas";

export default function ReportForm() {
  const form = useForm({
    resolver: zodResolver(CreateItemSchema), // frontend validation
    defaultValues: { itemStatus: "in-progress" },
  });
  // ...
}
```

```typescript
// apps/api/src/reports/reports.controller.ts (NestJS)
import { CreateItemSchema } from "@repo/shared/schemas";

@Post("items")
async createItem(@Body() body: CreateItemSchema) {
  const validated = CreateItemSchema.parse(body); // backend validation (fail-safe)
  return this.prisma.item.create({ data: validated });
}
```

### Pattern 2: tRPC Router (Type-Safe API)

**What:** Define API endpoints as tRPC procedures, automatically typed for frontend clients.

**When:** Every API operation (CRUD, workflows, aggregations).

**Example:**

```typescript
// packages/shared/trpc.ts (monorepo root)
import { initTRPC } from "@trpc/server";
import { z } from "zod";

const t = initTRPC.create();

export const appRouter = t.router({
  report: t.router({
    list: t.procedure
      .input(z.object({ skip: z.number().default(0), take: z.number().default(10) }))
      .query(async ({ input }) => {
        // Backend implementation in NestJS
      }),

    publish: t.procedure
      .input(z.object({ reportId: z.string().uuid() }))
      .mutation(async ({ input }) => {
        // Backend implementation
      }),
  }),
});

export type AppRouter = typeof appRouter;
```

```typescript
// apps/web/trpc/client.ts
import { createTRPCProxyClient, httpBatchLink } from "@trpc/client";
import type { AppRouter } from "@repo/shared/trpc";

export const trpc = createTRPCProxyClient<AppRouter>({
  links: [
    httpBatchLink({
      url: `${process.env.NEXT_PUBLIC_API_URL}/trpc`,
    }),
  ],
});

// Frontend code (automatically typed)
const reports = await trpc.report.list.query({ take: 20 }); // ✓ knows shape
```

### Pattern 3: NestJS Guard for Authorization

**What:** Guard checks JWT + role before allowing endpoint access.

**When:** Every protected endpoint (must check auth).

**Example:**

```typescript
// apps/api/src/auth/jwt.guard.ts
import { Injectable, CanActivate, ExecutionContext } from "@nestjs/common";

@Injectable()
export class JwtGuard implements CanActivate {
  constructor(private jwtService: JwtService) {}

  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest();
    const token = request.headers.authorization?.split(" ")[1];
    if (!token) throw new UnauthorizedException("Missing token");

    try {
      request.user = this.jwtService.verify(token); // adds user to request
      return true;
    } catch {
      throw new UnauthorizedException("Invalid token");
    }
  }
}

// apps/api/src/reports/reports.controller.ts
@Controller("reports")
export class ReportsController {
  @Get()
  @UseGuards(JwtGuard)
  async list(@Request() req) {
    // Only reached if JWT is valid
    // req.user.id is the authenticated user
  }
}
```

### Pattern 4: BullMQ Job Queue (Async Work)

**What:** Long-running or non-critical work dispatched as background jobs.

**When:** Email, PDF generation, data imports, periodic tasks.

**Example:**

```typescript
// apps/api/src/jobs/email.queue.ts
import { Processor, Process } from "@nestjs/bullmq";
import { Job } from "bullmq";

@Processor("email")
export class EmailProcessor {
  @Process()
  async sendEmail(job: Job<{ to: string; subject: string }>) {
    console.log(`Sending email to ${job.data.to}`);
    await this.mailer.send({
      to: job.data.to,
      subject: job.data.subject,
      html: "<p>Your report reminder</p>",
    });
    return { success: true };
  }
}

// apps/api/src/reports/reports.service.ts
@Injectable()
export class ReportsService {
  constructor(@InjectQueue("email") private emailQueue: Queue) {}

  async scheduleReminders() {
    const reports = await this.prisma.report.findMany({
      where: { deadline: tomorrow },
    });

    for (const report of reports) {
      // Add job to queue, don't wait for it
      await this.emailQueue.add("sendEmail", {
        to: "lead@company.com",
        subject: `Report reminder: ${report.name}`,
      });
    }
  }
}
```

### Pattern 5: Prisma Model + Zod Schema Alignment

**What:** Prisma schema and Zod schema stay in sync for type safety.

**When:** Every new field, new model.

**Example:**

```prisma
// prisma/schema.prisma
model Item {
  id        String   @id @default(cuid())
  reportSectionId String
  reportSection    ReportSection @relation(fields: [reportSectionId])
  projectId String
  text      String
  tag       String   // "feature" | "bugfix" | "infra" | "ops"
  itemStatus String // "done" | "in-progress" | "blocked"
  carriedOver Boolean @default(false)
  completed Boolean? // null = not applicable, true = done, false = failed
  createdAt DateTime @default(now())
}
```

```typescript
// packages/shared/schemas/report.ts
export const ItemSchema = z.object({
  id: z.string().cuid(),
  reportSectionId: z.string().uuid(),
  projectId: z.string().uuid(),
  text: z.string().min(1).max(500),
  tag: z.enum(["feature", "bugfix", "infra", "ops"]),
  itemStatus: z.enum(["done", "in-progress", "blocked"]),
  carriedOver: z.boolean(),
  completed: z.boolean().nullable(),
  createdAt: z.date(),
});

export type Item = z.infer<typeof ItemSchema>;
```

---

## Anti-Patterns to Avoid

### Anti-Pattern 1: State in Memory (will break with multiple instances)

**WRONG:**
```typescript
// DON'T DO THIS
let reportCache = {};

app.get("/report/:id", (req, res) => {
  if (!reportCache[req.params.id]) {
    reportCache[req.params.id] = fetchFromDB();
  }
  res.json(reportCache[req.params.id]);
});
```

**WHY BAD:** If you run 2 NestJS instances, each has separate cache. Instance A updates report → Instance B doesn't see it.

**CORRECT:** Use Redis for shared cache.

```typescript
// DO THIS
@Get("report/:id")
async getReport(@Param("id") id: string) {
  const cached = await this.redis.get(`report:${id}`);
  if (cached) return JSON.parse(cached);

  const report = await this.prisma.report.findUnique({ where: { id } });
  await this.redis.set(`report:${id}`, JSON.stringify(report), "EX", 3600);
  return report;
}
```

### Anti-Pattern 2: Synchronous PDF Generation (blocks user, times out)

**WRONG:**
```typescript
@Post("report/:id/export-pdf")
async exportPDF(@Param("id") id: string) {
  const report = await this.prisma.report.findUnique({ where: { id } });
  const html = renderTemplate(report); // slow!
  const pdf = await playwright.pdf({ html }); // can take 10+ seconds
  res.download(pdf); // user waits...
}
```

**WHY BAD:** PDF generation is slow. User waits 10 seconds for response. If another request comes in, the HTTP thread is blocked.

**CORRECT:** Dispatch async job, return job ID.

```typescript
@Post("report/:id/export-pdf")
async exportPDF(@Param("id") id: string) {
  const job = await this.pdfQueue.add("generatePDF", { reportId: id });
  return { jobId: job.id, pollingUrl: `/api/jobs/${job.id}` }; // returns immediately
}
```

### Anti-Pattern 3: Validation Only on Frontend

**WRONG:**
```typescript
// Frontend validates with Zod, backend trusts input
@Post("items")
async createItem(@Body() body: any) {
  // backend doesn't validate!
  return this.prisma.item.create({ data: body });
}
```

**WHY BAD:** Malicious user bypasses frontend, sends bad data directly to API. Backend crashes or accepts invalid data.

**CORRECT:** Validate on both sides.

```typescript
@Post("items")
async createItem(@Body() body: unknown) {
  const validated = CreateItemSchema.parse(body); // backend validation always!
  return this.prisma.item.create({ data: validated });
}
```

---

## Scalability Considerations

| Concern | At 100 reports | At 10K reports | At 1M reports |
|---------|---|---|---|
| **Frontend deployment** | Single Next.js instance (Vercel) | Multi-region replicas | CDN + edge functions |
| **Backend deployment** | Single NestJS instance | 3–5 replicas (load-balanced) | 10+ replicas, circuit breaker |
| **Database** | Single PostgreSQL (Docker) | PostgreSQL + read replicas | Sharded PostgreSQL |
| **Connection pooling** | PgBouncer (20 connections) | PgBouncer (50 connections) | Per-replica PgBouncer |
| **Cache** | Redis (simple INCR) | Redis cluster (replication) | Redis Cluster (sharding) |
| **Job workers** | Single BullMQ worker | 3–5 workers (parallelism) | Worker pool + priority queue |
| **Monitoring** | Basic logs | Prometheus + Grafana | APM (Datadog, New Relic) |

---

## Sources

- STACK.md (technology choices)
- NestJS documentation (guards, processors, modules)
- tRPC documentation (monorepo patterns)
- Prisma documentation (schema + migrations)
- BullMQ documentation (job patterns)

---

*Last updated: 2026-04-05 (research phase)*
