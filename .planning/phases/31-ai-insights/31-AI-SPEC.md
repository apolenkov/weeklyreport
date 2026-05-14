# Phase 31 — AI-SPEC.md (Design Contract)

**Phase:** 31-ai-insights
**Locked:** 2026-04-30
**Status:** Active design contract for AI-01, AI-02, AI-03
**Owner:** Phase 31 plans (31-02, 31-03, 31-04)

This document is the binding design contract for v6.0 AI features. All
locked decisions in `31-CONTEXT.md` are realised here. Deviations require
re-locking via the discuss-phase workflow.

---

## 1. Framework Selection

### Locked

- **Anthropic SDK direct** (no LangChain, no Vercel AI SDK) — per StackResearch
  and `31-CONTEXT.md`.
- **Package:** `@anthropic-ai/sdk@^0.91.1` (installed via
  `pnpm --filter @customreport/api add @anthropic-ai/sdk`).
- **Zod:** existing `zod@^4.1.0` (project-wide). Zod 4 ships
  `z.toJSONSchema()` natively, used to convert tool input schemas at call
  sites.

### Verified APIs in installed package

- `Anthropic` class (default export) with `client.messages.create({...})`.
- `helpers/beta/zod` exports `betaZodTool({name, inputSchema, description, run})`
  for the toolRunner pattern (auto Zod → JSON Schema conversion).
- `helpers/zod` exports `zodOutputFormat()` for streaming structured output.
- `helpers/json-schema` exports `jsonSchemaOutputFormat()` for raw-JSON-schema
  driven structured output.

### Pattern picked for Phase 31

- AI-01/02/03 use the **standard `messages.create` + `tools` array + forced
  `tool_choice: {type: 'tool', name}`** path, with `input_schema` produced
  by `z.toJSONSchema(zodSchema)` (Zod 4 native).
- Tool-result is parsed back through the same Zod schema so the procedure
  return is 100% type-safe.
- Rationale vs `betaZodTool`: betaZodTool is designed for `toolRunner()`
  multi-turn loops with side effects. Our use is single-shot structured
  output; the standard `tools[]` + Zod parse round-trip is simpler, fits
  cleanly into tRPC procedure handlers, and avoids the beta surface.

### Not used in Phase 31

- Streaming (`messages.stream()`) — deferred per CONTEXT (full-render UI).
- Batch API — out of scope (per-report calls are fast enough).
- `toolRunner()` — not needed for single forced-tool single-turn flows.
- Memory/files API — out of scope.

---

## 2. Model Assignment

### Locked

| Feature                 | Model ID                    | Rationale                                                                                                                                                                                                                  |
| ----------------------- | --------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| AI-01 executive summary | `claude-haiku-4-5-20251001` | User-locked: cheapest. Quality OK for narrative ≤3 sentences with rubric + injected counts.                                                                                                                                |
| AI-02 risk sentiment    | `claude-haiku-4-5-20251001` | User-locked: structured 3-class output is easy for Haiku.                                                                                                                                                                  |
| AI-03 on-track icon     | `claude-haiku-4-5-20251001` | **DEVIATION from ROADMAP** which suggested Sonnet 4.6. User-locked Haiku for cost ($0.001 vs $0.01/render). Quality trade-off mitigated by eval gate (Section 6) — golden-set rubric catches regressions before they ship. |

### Deviation note (AI-03)

ROADMAP success criterion 3 originally suggested Sonnet 4.6 for AI-03. User
explicitly picked Haiku 4.5 across all three features for cost. This spec
formalises the trade-off:

- Cost projection (per Section 7) confirms ≈ $0.0005/report effective,
  vs Sonnet would cost ≈ $0.01/report — 20× difference.
- Quality compensation: eval-gate threshold (≥80% on-track classification
  match against golden-set) blocks regressions; Sonnet escalation is in
  the deferred ideas list (CONTEXT.md `<deferred>`).
- Reviewability: all three features ship structured outputs — head can
  visually inspect the verdict, traffic light remains lead-owned.

### Pricing assumptions (used for §7 cost guard)

- Haiku 4.5 input: ~$0.0008 / 1K tokens (uncached)
- Haiku 4.5 output: ~$0.004 / 1K tokens
- Cache-write: 1.25× input rate, one-time for 5-minute TTL
- Cache-read: 0.10× input rate (≈ 90% reduction on cache hit)

---

## 3. Implementation Patterns

All three features share the same skeleton:

```ts
// apps/api/src/modules/ai/ai-client.ts (sketched — 31-02 implements)
import Anthropic from "@anthropic-ai/sdk";
import type { ZodType } from "zod";
import { z } from "zod";

let _client: Anthropic | null = null;
function getClient(): Anthropic {
  if (!_client) {
    const key = process.env["ANTHROPIC_API_KEY"];
    if (!key) throw new Error("ANTHROPIC_API_KEY missing");
    _client = new Anthropic({ apiKey: key });
  }
  return _client;
}

export type RunStructuredOptions<S extends ZodType> = {
  model: string;
  system: string; // ≥1024 tokens for cache breakpoint
  user: string;
  toolName: string;
  toolDescription: string;
  schema: S;
};

export async function runStructured<S extends ZodType>(
  opts: RunStructuredOptions<S>,
): Promise<{ result: z.infer<S>; usage: AnthropicUsage }> {
  const client = getClient();
  const inputSchema = z.toJSONSchema(opts.schema);
  const response = await client.messages.create({
    model: opts.model,
    max_tokens: 1024,
    system: [
      { type: "text", text: opts.system, cache_control: { type: "ephemeral" } },
    ],
    messages: [{ role: "user", content: opts.user }],
    tools: [
      {
        name: opts.toolName,
        description: opts.toolDescription,
        input_schema: inputSchema,
      },
    ],
    tool_choice: { type: "tool", name: opts.toolName },
  });
  // Extract tool_use block; parse with Zod for runtime safety.
  const block = response.content.find((c) => c.type === "tool_use");
  if (!block || block.type !== "tool_use") throw new Error("no tool_use block");
  const result = opts.schema.parse(block.input);
  return { result, usage: extractUsage(response.usage) };
}
```

### 3.1 AI-01: Executive Summary

**Tool name:** `record_executive_summary`
**Zod schema:**

```ts
const summarySchema = z.object({
  narrative: z.string().min(20).max(500), // 2-3 sentences enforced via rubric, char-bounded
  tone: z.enum(["positive", "neutral", "negative"]),
  highlights: z.array(z.string().min(1).max(120)).max(3), // for accessibility / hover
});
```

**System prompt (≥1024 tokens):** rubric covers

- Role: senior-engineering-manager assistant.
- Output rules: 2-3 sentences, no bullet points, no greetings.
- DO NOT change pre-computed numbers (see §3.4).
- DO NOT paraphrase head's narrative verbatim.
- Tone ladder (positive/neutral/negative) with anchor examples.
- 3 worked examples (input snippet + ideal output) — this padding takes
  the prompt over the 1024-token cache breakpoint.

**User prompt template:**

```
[REPORT METADATA]
Period: {periodLabel}
Number of leads: {sectionCount}
Pre-computed traffic-light counts: {greenCount} green, {yellowCount} yellow, {redCount} red.

[REPORT CONTENT]
{leadSectionsCondensed}
```

**Cache key:** `contentHash = sha256(JSON.stringify({reportId, sections: condensedView}))`
where `condensedView` excludes head-narrative (we don't summarize what
the head wrote — see CONTEXT.md `<deferred>`: "AI changing head's narrative is anti-feature").

**Cost estimate per call:**

- Input: ~5,000 tokens (rubric + condensed report) → $0.004
- Output: ~150 tokens (3-sentence narrative + tone + highlights) → $0.0006
- Per uncached call: ≈ $0.0046
- Per cached call (system prompt cached): ≈ $0.0010
- 90% cache hit rate → effective ≈ $0.0014/report

### 3.2 AI-02: Risk Sentiment Badge

**Tool name:** `record_risk_sentiment`
**Zod schema:**

```ts
const sentimentSchema = z.object({
  level: z.enum(["low", "medium", "high"]),
  rationale: z.string().min(5).max(120),
});
```

**System prompt (≥1024 tokens):** rubric covers

- Role: risk-classification assistant.
- 3-class definition with examples (low: "supplier has 1d delay risk", high: "client may cancel contract").
- DO NOT escalate based on speculation; rate visible severity only.
- Anchor examples (≥6) for each class — pads to ≥1024 tokens.

**User prompt template:**

```
Risk: {risk}
Impact: {impact}
Mitigation: {mitigation}
```

**Cache key:** `contentHash = sha256(JSON.stringify({risk, impact, mitigation}))`
— per-risk granularity (not per-report). Same risk text → same cached row.

**Cost estimate per call:**

- Input: ~1,500 tokens (rubric + 1 risk row) → $0.0012
- Output: ~50 tokens → $0.0002
- Per uncached call: ≈ $0.0014
- Cached: ≈ $0.0003
- ~10 risks/report × 90% cache hit → ≈ $0.003/report total

### 3.3 AI-03: On-Track Advisory Icon

**Tool name:** `record_on_track_verdict`
**Zod schema:**

```ts
const onTrackSchema = z.object({
  verdict: z.enum(["on-track", "attention", "off-track"]), // ✓ ⚠ ✗
  confidence: z.enum(["low", "medium", "high"]),
  rationale: z.string().min(5).max(120),
});
```

**System prompt (≥1024 tokens):** rubric covers

- Role: project-health classifier.
- DEFINITIVE rule: verdict reflects MODEL OPINION, NOT lead's chosen colour.
  Lead owns the traffic-light colour; this verdict is advisory.
- Pre-computed counts injection (see §3.4) — DO NOT change these numbers.
- 3-class definition with anchors covering edge cases (all green but
  velocity dropping → 'attention'; one red but unblocked → 'on-track').
- Worked examples (≥4) — pads to ≥1024 tokens.

**User prompt template:**

```
[CELL CONTEXT]
Lead: {leadName}
Project: {projectName}
Lead's chosen traffic light: {leadColour}

[PRE-COMPUTED COUNTS — DO NOT CHANGE THESE NUMBERS]
This cell has {currentItemCount} current-week items, of which {completedCount} are completed and {blockedCount} are blocked.
Risks attached to this cell: {riskCount}.
Decisions attached to this cell: {decisionCount}.

[NARRATIVE]
{currentWeekText}
{nextWeekText}
{riskHighlights}
```

**Cache key:** `contentHash = sha256(JSON.stringify({sectionId, projectId, cellSnapshot}))`
where `cellSnapshot` is the relevant subset (items, risks, decisions for
this lead-project cell). The lead's chosen colour is included in the hash
so a colour change recomputes (it's a signal to the model, not output).

**Cost estimate per call:**

- Input: ~1,200 tokens (rubric + cell snapshot) → $0.001
- Output: ~80 tokens → $0.0003
- Per uncached call: ≈ $0.0013
- Cached: ≈ $0.0002
- ~12 cells/report × 90% cache hit → ≈ $0.0023/report total

### 3.4 Pre-computed Counts Injection (PITFALLS C-2)

For both AI-01 and AI-03, the system prompt MUST end with a
`DO NOT change these numbers` directive followed by exact counts derived
server-side from Prisma. AI-01: traffic-light counts. AI-03: items,
risks, decisions, blocked counts for the cell.

The eval test (Section 6) asserts the output `narrative` (AI-01) or
`rationale` (AI-03) does not contain digit-strings that would shadow the
pre-computed counts. Implementation: extract digit substrings, compare
against the injected count strings; if a digit string in output is
absent from inputs, fail the eval.

---

## 4. AiInsight Prisma Model

```prisma
enum AiInsightKind {
  summary       // AI-01
  sentiment     // AI-02
  on_track      // AI-03
}

model AiInsight {
  id                  String        @id @default(uuid())
  kind                AiInsightKind
  contentHash         String        // sha256 hex — cache key
  result              Json          // schema-shaped output (per §3.1/3.2/3.3)
  modelId             String        // 'claude-haiku-4-5-20251001'
  inputTokens         Int           @default(0)
  outputTokens        Int           @default(0)
  cacheCreationTokens Int           @default(0)
  cacheReadTokens     Int           @default(0)
  createdAt           DateTime      @default(now())

  @@unique([kind, contentHash])     // upsert key — one row per (kind, hash)
  @@index([kind, createdAt])        // analytics + monitoring
}
```

**Migration name:** `add_ai_insight`
**Atomicity:** must commit alongside 31-02 feature code (per orchestrator
constraint: AnthropicClient + migration + summary procedure + RSC card all
in one feature commit).

**Why `@@unique([kind, contentHash])`:** the read-through cache pattern
upserts on (kind, contentHash). Without the constraint, concurrent calls
on the same hash would race-create duplicate rows and the cache would
never warm correctly.

---

## 5. Module Isolation (Success Criterion 4)

### 5.1 Filesystem layout (locked by CONTEXT.md)

```
apps/api/src/modules/ai/
├── ai.module.ts                    # NestJS module (registers service + facade)
├── ai.service.ts                   # tRPC-callable surface (sync)
├── ai-client.ts                    # Anthropic SDK wrapper (lazy init)
├── ai-cache.ts                     # contentHash compute + AiInsight upsert
├── ai-facade.ts                    # narrow Prisma surface — AI module's only DB seam
├── ai.router.ts                    # tRPC router slice (mounted under `ai.*`)
├── prompts/
│   ├── summary.ts                  # AI-01 system + user templates
│   ├── sentiment.ts                # AI-02
│   └── on-track.ts                 # AI-03
├── __fixtures__/
│   └── golden-set/                 # 31-04 ships 8-12 reports
└── __tests__/
    ├── ai-client.test.ts           # mocked SDK
    ├── ai-cache.test.ts
    └── golden-set.eval.test.ts     # 31-04 — runs only via test:ai-eval
```

### 5.2 ESLint rules (added in 31-04)

Append to root `eslint.config.ts`:

```ts
{
  files: ['apps/api/src/modules/ai/**/*.ts'],
  rules: {
    'no-restricted-imports': ['error', {
      paths: [
        {
          name: '@prisma/client',
          message: 'AI module must access DB only via ai-facade.ts (CC-3 / module isolation).',
        },
      ],
      patterns: [
        // future-proof: any deep import into Prisma generated client
        '@prisma/client/*',
      ],
    }],
    'no-restricted-syntax': ['error', {
      // PITFALLS C-3: ban logging of prompt/messages/response.content
      selector: "CallExpression[callee.object.name='logger'] :matches(Identifier[name=/^(prompt|messages|response)$/])",
      message: 'AI module: never log prompts, messages, or model response content (PII risk).',
    }],
  },
},
```

`ai-facade.ts` is the single approved entry to Prisma for the AI module.
It re-exports only the narrow methods needed (e.g.
`getReportForSummary(reportId)`, `upsertAiInsight(...)`).

### 5.3 Logging middleware exclusion

`loggingMiddleware` in `apps/api/src/infrastructure/trpc/trpc.middleware.ts`
gets a path-prefix early-return at the top:

```ts
if (path.startsWith("ai.")) {
  // PITFALLS C-3: AI prompts and responses must never reach the
  // structured log stream. The procedure-level metrics (tokens,
  // duration) are recorded in AiInsight rows instead.
  return next();
}
```

This is preferred over creating new `aiHeadProcedure` helpers because:

- One change point keeps the rule in one place.
- `ai.*` is a namespace prefix, easy to grep/audit.
- New AI procedures inherit the exclusion automatically.

---

## 6. Eval Strategy (AI-03 CI Gate)

### 6.1 Golden-set fixtures

- Path: `apps/api/src/modules/ai/__fixtures__/golden-set/`
- 8-12 fixture reports as JSON, each shape:
  ```json
  {
    "id": "fx-001",
    "description": "all-green stable team",
    "report": {
      /* assembledReport-shaped */
    },
    "expected": {
      "summary": { "tone": "positive", "narrativeContains": ["7", "stable"] },
      "sentiment": [{ "riskId": "...", "level": "low" }],
      "onTrack": [
        { "sectionId": "...", "projectId": "...", "verdict": "on-track" }
      ]
    }
  }
  ```
- **Status:** `draft, awaiting head sign-off` (CONTEXT.md C-5). Initial
  threshold is loose (≥80%); after head review, threshold can tighten.

### 6.2 Eval test

- Path: `apps/api/src/modules/ai/__tests__/golden-set.eval.test.ts`
- Skipped by default (`describe.skipIf(!process.env['ANTHROPIC_API_KEY'])`).
- Runs via `pnpm test:ai-eval` (alias to
  `pnpm --filter @customreport/api exec vitest run src/modules/ai/__tests__/golden-set.eval.test.ts`).
- For each fixture:
  - Run AI-01, AI-02 (per risk), AI-03 (per cell) through real Haiku.
  - Tally: tone match, sentiment-class match, on-track-class match.
  - Hallucinated-count check: extract digit-strings from
    `summary.narrative` and `onTrack.rationale`; assert each appears in
    the pre-computed input or is absent from output.
- Pass threshold:
  - **≥80% sentiment-classification match** across all golden risks.
  - **≥80% on-track-classification match** across all golden cells.
  - **0 hallucinated counts** (zero tolerance).
  - **Summary length ≤3 sentences** (regex: `^[^.!?]*[.!?][^.!?]*[.!?]?[^.!?]*[.!?]?$`).

### 6.3 Package.json wiring (31-04)

```json
"scripts": {
  "test:ai-eval": "ANTHROPIC_API_KEY=$ANTHROPIC_API_KEY pnpm --filter @customreport/api exec vitest run src/modules/ai/__tests__/golden-set.eval.test.ts --reporter=verbose"
}
```

### 6.4 CI gate

- Triggered only on PRs touching `apps/api/src/modules/ai/**` or
  `apps/api/src/modules/ai/__fixtures__/**` (path-filter in workflow).
- Fails the PR if any threshold above is breached.
- Run cost projection: 10 fixtures × ~$0.005/fixture = ~$0.05/run.
- Skip on docs-only PRs.

### 6.5 Unit-test boundary

**Unit tests** (`ai-client.test.ts`, `ai-cache.test.ts`,
`ai.service.test.ts`): mock `@anthropic-ai/sdk` via
`vi.mock('@anthropic-ai/sdk', ...)`. NEVER call live API.
Assertions verify:

- Tool name and `input_schema` matches Zod schema.
- System prompt contains pre-computed counts string.
- Output is parsed through Zod (rejects malformed tool results).
- AiInsight row is upserted with correct usage counts.

---

## 7. Failure Modes & Guardrails

| Failure                       | Detection                                          | Mitigation                                                                                                                                                          | Test                                                                               |
| ----------------------------- | -------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------- |
| **API outage** (5xx, network) | SDK throws after retries                           | tRPC procedure returns `{available: false, reason: 'unavailable'}` sentinel; UI renders "AI unavailable" placeholder.                                               | Unit test: SDK throws → procedure returns sentinel, no exception bubbles.          |
| **ANTHROPIC_API_KEY missing** | Lazy-init `getClient()` throws on first call       | Procedure catches and returns the same sentinel (treats as outage).                                                                                                 | Unit test: env unset → procedure returns sentinel.                                 |
| **Rate limit (429)**          | SDK throws `RateLimitError`                        | SDK auto-retries with exponential backoff. After max retries, return sentinel; head can hit Regenerate later.                                                       | Unit test: mocked SDK throws RateLimitError → procedure catches, returns sentinel. |
| **Hallucinated count**        | Eval test (digit-string check, §6.2)               | Eval gate blocks PR. Runtime defense: pre-computed counts in system prompt (§3.4).                                                                                  | Eval test asserts no foreign digits.                                               |
| **Cost runaway**              | Per-call usage logged in AiInsight rows            | Per-report budget guard: AI-01 procedure aborts (returns sentinel) if cumulative `inputTokens + outputTokens` for this `reportId` in last 1h exceeds 50K (≈ $0.05). | Unit test: stub usage 60K → procedure aborts.                                      |
| **Cache miss flood**          | AiInsight rows show `cacheReadTokens=0` repeatedly | Production monitor (§8): alert if cache-read rate < 50% over 1h.                                                                                                    | n/a (production observation).                                                      |
| **Malformed tool output**     | Zod parse fails                                    | Procedure catches, returns sentinel, logs WARN with `{kind, hashPrefix, model}` (no content).                                                                       | Unit test: stubbed bad tool input → Zod rejects → sentinel returned.               |
| **PII in logs**               | Lint rule + middleware exclusion (§5)              | Both layers must pass; CI fails if lint rule trips.                                                                                                                 | Lint rule fires on test fixture trying to log a `prompt` variable.                 |

### Sentinel shape (locked)

```ts
type AiInsightResult<R> =
  | { available: true; result: R; cached: boolean }
  | {
      available: false;
      reason: "unavailable" | "rate_limit" | "budget_exceeded";
    };
```

All three procedures return this discriminated union.

---

## 8. Production Monitoring

### 8.1 Cache-hit telemetry

- Each call upserts an AiInsight row; on cache hit, no new row is written
  (the read returns the existing row's result).
- Daily metric: count(AiInsight rows created in last 24h) ÷ count(ai.\*
  procedure invocations in last 24h) = cache-creation rate.
- Threshold: cache-creation rate > 50% for 1h triggers an alert (cache
  is not warming). 31-04 ships the SQL aggregation; PagerDuty wiring
  is deferred to operator runbook (out of phase scope).

### 8.2 Token usage report

- Daily roll-up via SQL on AiInsight:
  ```sql
  SELECT date_trunc('day', "createdAt") AS day,
         "kind",
         SUM("inputTokens") AS in_tokens,
         SUM("outputTokens") AS out_tokens,
         SUM("cacheReadTokens") AS cache_reads
  FROM "AiInsight"
  GROUP BY 1, 2
  ORDER BY 1 DESC;
  ```
- Used to validate cost projections in §3 against reality.
- Owner runs ad-hoc; no automated dashboard in v6.0.

### 8.3 Anthropic data-retention

- Workspace-level setting: **data retention OFF** (verified manually by
  owner before phase exit; documented in Section 1 of CONTEXT.md as
  success criterion 4).
- API key scoped to one workspace; rotated every 90d via runbook.

---

## 9. Open Items (deferred)

Per CONTEXT.md `<deferred>`:

- Head sign-off on golden-set rubric (C-5 in v6.0 STATE.md). Eval gate
  ships with loose thresholds; head-tightened thresholds land in v6.1.
- Multi-language summaries (RU + EN) — v6.0 EN-only.
- Streaming summary UI — v6.0 ships fully-rendered card.
- Sentiment override by head — v6.0 read-only.
- Sonnet 4.6 escalation for AI-03 borderline cases — v7.0+ knob.

---

## 10. Sources

- `.planning/phases/31-ai-insights/31-CONTEXT.md` (locked decisions)
- `.planning/REQUIREMENTS.md` AI-01, AI-02, AI-03
- `.planning/research/ARCHITECTURE.md` Feature C
- `.planning/research/PITFALLS.md` C-1, C-2, C-3, C-5, C-6
- `node_modules/@anthropic-ai/sdk@0.91.1/helpers/{zod,beta/zod,json-schema}.d.ts`
- `prisma/schema.prisma` (existing model definitions)
- `apps/api/src/infrastructure/trpc/trpc.middleware.ts` (loggingMiddleware shape)
- Anthropic prompt-caching docs (≥1024 tokens for cache breakpoint, 5-min TTL).
