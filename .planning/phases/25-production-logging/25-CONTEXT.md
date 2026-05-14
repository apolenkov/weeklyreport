# Phase 25: Production Logging - Context

**Gathered:** 2026-04-25
**Status:** Ready for planning
**Mode:** Auto-generated for autonomous flow

<domain>
## Phase Boundary

Production-grade structured logging with correlation IDs propagated via AsyncLocalStorage, file-based output with rotation/archiving, every tRPC request/response logged.

**Key deliverables:**

1. nestjs-cls integration for AsyncLocalStorage correlation ID propagation
2. Logger enhancement: existing AppLoggerImpl gets correlation ID from CLS
3. Request/response logging on every tRPC procedure (procedure name, userId, duration, correlationId)
4. File rotation (size or time-based) with archiving
5. Structured JSON format with timestamp, level, correlationId, module

</domain>

<decisions>
## Implementation Decisions

### Correlation IDs (research D-01)

- Install `nestjs-cls` (~6.2.0)
- ClsModule.forRoot with middleware pulling x-request-id from CorrelationIdMiddleware (already exists)
- Inject ClsService into AppLoggerImpl — every log call reads correlationId from CLS context
- Fallback: 'no-context' when called outside HTTP scope

### Don't Replace Logger

- Per research SUMMARY.md: enhance existing apps/api/src/lib/logger.ts (AppLoggerImpl), DO NOT replace with pino
- Existing logger already does JSON format + file output + rotation

### Request/Response Logging

- New tRPC middleware: log entry on .next() call, log exit with duration
- Format: `{ phase: 'trpc.request', procedure, userId, correlationId, duration, status: 'success'|'error', error? }`

### File Rotation

- Existing logger uses appendFileSync (synchronous — research warning)
- Migrate to async append + size-based rotation:
  - Active log: apps/api/logs/app.log
  - Rotate when > 50MB → app.log.YYYY-MM-DD-HHmmss.gz
  - Keep 30 days, delete older

### Claude's Discretion

- Rotation size threshold (default 50MB)
- Retention period (default 30 days)
- Whether to use Bull MQ for log archiving (overkill for v5.0 — defer)

</decisions>

<code_context>

## Existing Code Insights

### Existing Logger (157 lines)

- apps/api/src/lib/logger.ts — AppLoggerImpl with JSON format + appendFileSync rotation
- Already injected into NestJS via Logger module
- CorrelationIdMiddleware exists (apps/api/src/middleware/correlation-id.middleware.ts) — sets x-request-id header but doesn't propagate to logger

### Established Patterns

- Logger interface: AppLogger with log/info/warn/error methods
- Log destination: console + apps/api/logs/\*.log
- Existing rotation by date prefix in filename

### Integration Points

- Create: apps/api/src/cls/cls.module.ts (or extend logger module)
- Modify: apps/api/src/lib/logger.ts — async file write + correlation ID injection
- Modify: apps/api/src/middleware/correlation-id.middleware.ts — store in CLS context
- New: apps/api/src/infrastructure/trpc/trpc-logger.middleware.ts — request/response logging

</code_context>

<specifics>
## Specific Ideas

- Async file append via worker queue or fs.promises.appendFile
- Compression on rotation: gzip via zlib
- Log level config from env: LOG_LEVEL=info|debug|warn|error

</specifics>

<deferred>
## Deferred Ideas

- Centralized log aggregation (ELK/Datadog) → v6.0+
- Frontend log forwarding to backend → v6.0+
- Sampled logging for high-traffic endpoints → v6.0+

</deferred>
