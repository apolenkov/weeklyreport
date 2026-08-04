# Model Routes: Latency, Concurrency, Rate Limits, Context Windows, Output Limits, Peak/Off-Peak Pricing — Research (2026-08-02)

Scope: all primary model routes in the current OpenCode configuration
(`~/.config/opencode/opencode.jsonc` + `~/.local/share/opencode/auth.json`).
Primary sources only: official API docs, official status pages, first-party
repos/issues, and measured third-party benchmarks. External web research only;
every claim cites its source with URL and (where known) date.

Config routes inventoried (2026-08-02):

| Route           | Provider (auth.json)         | Base URL                                | Auth                                 |
| --------------- | ---------------------------- | --------------------------------------- | ------------------------------------ |
| `opencode-go/*` | opencode-go (API key)        | https://opencode.ai/zen/go/v1           | API key (OpenCode Go subscription)   |
| `opencode/*`    | opencode (API key)           | https://opencode.ai/zen/v1              | API key (OpenCode Zen pay-as-you-go) |
| `openai/*`      | openai (OAuth, ChatGPT Plus) | chatgpt.com/backend-api/codex/responses | ChatGPT Plus OAuth (plan_type: plus) |

Model catalog in the local config (from `opencode models`, 2026-08-02):
`opencode-go/deepseek-v4-flash` (current default), `opencode-go/deepseek-v4-pro`,
`opencode/deepseek-v4-flash`, `opencode/deepseek-v4-flash-free`,
`opencode/deepseek-v4-pro`, plus the openai/* ChatGPT-Plus-eligible set
(gpt-5.3-codex-spark, gpt-5.4, gpt-5.4-mini, gpt-5.5, gpt-5.6-luna/terra/sol,
and `-fast` variants). Source: local `auth.json` and `opencode models` output.

---

## TL;DR

- **Low price on DeepSeek routes does not mean unlimited throughput.** DeepSeek
  publishes no RPM/TPM at all — only _concurrency_ (v4-flash 2,500; v4-pro 500),
  plus a documented hold-the-connection-open queuing mechanism that can stall a
  request up to 10 minutes before inference starts. Operational cost is latency
  variance + 429/503 handling, not billed price.
- **OpenCode Go's $10/mo is a dollar-capped, rate-shaped subscription, not an
  unlimited pipe.** Hard caps: $12 / 5h, $30 / week, $60 / month of _usage value_
  (≈31,650 requests/5h on DeepSeek V4 Flash; only ≈3,450/5h on V4 Pro).
  Community evidence (July 2026) shows `Provider rate limit exceeded` on
  deepseek-v4-flash _even at 0% rolling usage_, traced to upstream provider
  throttling, and explicit upstream-account rate limits for other models.
- **ChatGPT Plus OAuth route is the most constrained.** No RPM/TPM either; a
  per-5h message budget (GPT-5.6 Sol 10–100, Terra 25–200, Luna 250–2,000;
  GPT-5.4 20–100 per 5h), reasoning-time metering (~2.5% of the 5h window per
  minute of GPT-5.4 reasoning), plus weekly caps and credit-based top-ups.
- **Context windows are not the constraint on these routes** — all primary
  models now offer 1M–1.05M context. Output limits: DeepSeek V4 = 384K max;
  GPT-5.x = 128K max (272K+ prompts reprice at 2x).
- **Peak/off-peak:** DeepSeek's historical 50–75% off-peak discount ended
  2025-09-05 and was NOT revived for V4. DeepSeek announced (2026-06-30) a
  _peak-hour surcharge_ (2x during 09:00–12:00 and 14:00–18:00 Beijing /
  01:00–04:00 and 06:00–10:00 UTC) that was still not active as of 2026-07-25.
  OpenAI has no time-of-day pricing at all.
- **Status risk is real but not catastrophic:** DeepSeek official status shows
  99.90% uptime for both V4 API services (May–Jul 2026) but suffered a ~7h13m
  major outage on 2026-03-29/30 and a 42-min outage on 2026-07-21. OpenAI had
  repeated gpt-5.5/gpt-5.4 incidents May–Jun 2026 plus a "Codex Usage Limits
  Depleting Faster Than Expected" incident on 2026-06-29.

---

## 1. DeepSeek V4 — official limits, pricing, rate limits (route: direct api.deepseek.com and via OpenCode Go/Zen)

### 1.1 Model details (official pricing page, fetched 2026-08-02)

Source: https://api-docs.deepseek.com/quick_start/pricing/

|                                                    | deepseek-v4-flash                              | deepseek-v4-pro            |
| -------------------------------------------------- | ---------------------------------------------- | -------------------------- |
| Model version                                      | DeepSeek-V4-Flash-0731 (public beta, official) | DeepSeek-V4-Pro            |
| Context length                                     | 1M                                             | 1M                         |
| Max output                                         | MAXIMUM: 384K                                  | MAXIMUM: 384K              |
| Input cache-hit / cache-miss / output (per 1M tok) | $0.0028 / $0.14 / $0.28                        | $0.003625 / $0.435 / $0.87 |
| Concurrency limit                                  | 2,500                                          | 500                        |
| Responses API                                      | ✓ (flash only)                                 | ✗ (planned early Aug 2026) |
| Thinking mode                                      | non-thinking + thinking (default)              | same                       |

- V4-Flash-0731 is a re-post-trained checkpoint of the April preview (same
  architecture/size: 284B total / 13B active MoE), with "substantially enhanced
  agentic capabilities" and native Responses API / Codex adaptation.
  Source: https://api-docs.deepseek.com/updates/ and
  https://huggingface.co/deepseek-ai/DeepSeek-V4-Flash-0731/blob/main/README.md
  (last modified 2026-07-31).
- Legacy IDs `deepseek-chat` / `deepseek-reasoner` (V3-era names) were retired
  on 2026-07-24 15:59 UTC; they had been routing to V4-Flash in non-thinking /
  thinking mode respectively. Source: https://deepseekai.guide/api/deepseek-api-pricing/ (checked 2026-04-30) and DeepSeek news.

### 1.2 Rate limits: concurrency only, no RPM/TPM

Source: https://api-docs.deepseek.com/quick_start/rate_limit/

- The **only published ceiling is concurrency**: 2,500 concurrent requests for
  `deepseek-v4-flash`, 500 for `deepseek-v4-pro`, per account (not per key).
- A request counts as one concurrent connection from send until completion.
- Exceeding the limit returns **HTTP 429**; there is no published RPM/TPM table
  and no tiered upgrades — higher concurrency requires an explicit capacity
  expansion request (no additional cost).
- `user_id` isolation: with expanded quotas, per-`user_id` limits are 500 (pro)
  / 2,500 (flash).
- **Keep-alive queuing**: after sending, the server may hold the connection and
  emit empty lines (non-streaming) or `: keep-alive` SSE comments (streaming)
  while waiting for inference. If inference has not started within **10 minutes,
  the server closes the connection**. This is the primary hidden latency
  mechanism: requests queue invisibly instead of failing fast.

### 1.3 Concurrency confirmed by independent sources

- https://chat-deep.ai/docs/api-rate-limits/ (2026-05-02): no public fixed
  RPM/TPM; "dynamic concurrency" based on server load and short-term account
  usage; 429 = too aggressive for current dynamic limit; 503 = server overload.
- https://deepseek.ai/pricing (verified 2026-07-25): "the only documented
  ceiling is concurrency: 500 concurrent for deepseek-v4-pro and 2,500 for
  deepseek-v4-flash. There are no account tiers."

### 1.4 Context caching (economics multiplier)

- DeepSeek disk-based context caching shipped 2024-08-02 and applies to V4
  automatically (prefix hits only). On V4-Flash cache-hit input is $0.0028 vs
  $0.14 cache-miss (~98% cheaper). Cache is opportunistic — hit rate must be
  measured, not assumed. Source: https://deepseek.ai/pricing,
  https://deepseekai.guide/api/deepseek-api-documentation/ (2026-04-24).

### 1.5 Output/context interplay

- 384K output is a _ceiling_, not a default; prompt + completion must fit the
  1M context (remaining_context = 1,000,000 − prompt − margin). Think-max mode
  recommends ≥384K context headroom. No numeric default for `max_tokens` is
  published; set it explicitly. Source: https://chat-deep.ai/docs/deepseek-v4-context-output-limits/ (verified 2026-07-23).

### 1.6 Pricing history — off-peak is DEAD, peak surcharge announced

- **Off-peak discount (historical):** From 2025-02-26, DeepSeek offered 50% off
  V3 and 75% off R1 during 16:30–00:30 UTC ("off-peak").
  Sources: https://www.reuters.com/technology/chinas-deepseek-cuts-off-peak-pricing-by-up-75-2025-02-26/ (2025-02-26).
- **Ended:** V3.1 announcement — new pricing started and off-peak discounts
  ended 2025-09-05 16:00 UTC.
  Source: https://api-docs.deepseek.com/news/news250821/ (2025-08-21).
- **Not revived for V4.** Multiple independent sources confirm no off-peak
  discount in V4: https://deepseek.ai/pricing (2026-07-25),
  https://deepseekai.guide/api/deepseek-api-pricing/.
- **NEW — peak-hour surcharge (2x) announced but NOT active as of 2026-07-25:**
  DeepSeek's official pricing page (fetched 2026-08-02) states: "The DeepSeek
  API service will soon adopt a peak/off-peak pricing policy. During peak
  hours, prices will be 2x the regular prices, applicable to all billing
  items. The effective date will be subject to the official announcement.
  [Peak hours: 9:00–12:00 and 14:00–18:00 (Beijing Time, UTC+8) daily]"
  → i.e., **01:00–04:00 and 06:00–10:00 UTC**. Confirmed by SCMP report
  (2026-06-30): https://www.scmp.com/tech/big-tech/article/3358868/...
  and independent re-check 2026-07-25 (not active).

## 2. OpenCode Go — the actual route used by `opencode-go/deepseek-v4-flash`

### 2.1 Subscription mechanics (official docs, fetched 2026-08-02)

Source: https://opencode.ai/docs/go/

- Price: **$5 first month, then $10/month** flat subscription for hosted open
  models ("we aim to give you 6x that in usage" — i.e., ~$60 of usage value).
- Hard dollar-capped limits (not request-count limits):
  - **$12 of usage per 5 hours**
  - **$30 of usage per week**
  - **$60 of usage per month**
- Estimated request counts (official, "typical Go usage patterns" — cached-heavy
  requests ~68–82K cached tokens each):
  - **DeepSeek V4 Flash: 31,650 / 5h; 79,050 / week; 158,150 / month**
  - DeepSeek V4 Pro: 3,450 / 5h; 8,550 / week; 17,150 / month
  - (Go prices it at $0.435 in / $0.87 out — the _promo_ rate, with only $15
    monthly usage value because it's a new/heavily discounted model)
- Models are billed at Go's discounted per-1M rates: DeepSeek V4 Flash
  $0.14/$0.28/$0.0028; DeepSeek V4 Pro $0.435/$0.87/$0.003625.
- After limits: falls back to free models, or to your Zen balance if the
  "Use balance" console option is enabled.
- One subscription per workspace ("Only one member per workspace can subscribe").
- Endpoint: `https://opencode.ai/zen/go/v1/chat/completions` (OpenAI-compatible
  via `@ai-sdk/openai-compatible`), model IDs like `deepseek-v4-flash`.

### 2.2 Why the $10 price — "6x multiplier" except some models

Official docs: "With Go, you pay $10/month and we aim to give you 6x that in
usage. For most models, we make this work through bulk discounts and reserved
GPU capacity." For models where they "haven't had the opportunity to negotiate
a discount or host them at a lower cost" (new or already-discounted models like
DeepSeek V4 Pro), the multiplier is ~1.5x ($15 usage). So **the flat price is
an arbitrage on reserved capacity + bulk discounts, not a subsidy of unlimited
throughput** — DeepSeek V4 Pro is deliberately lower-usage on Go.

### 2.3 Rate-limit/throttling incident evidence (GitHub, 2026)

- **#34884 — "Go returns 'Provider rate limit exceeded' despite 0% rolling
  usage"** (opened ~2026-07-04): `Error from provider (Console Go): Provider
rate limit exceeded` on DeepSeek V4 Flash specifically; requests not even
  hitting the dashboard; **only the Go tier affected, free Zen models worked.**
  Maintainer comment 2026-07-04: "we are migrating our inference servers .. things
  are already much more stable". Multiple duplicates: #34885 (deepseek-v4-flash
  only), #34886, #34903, #34909, #34910. One commenter: "看起来是触发了并发限制
  429 ... 这个限制来自 DeepSeek" (it's DeepSeek's concurrency limit).
  Source: https://github.com/anomalyco/opencode/issues/34884
- **#29912 — MiMo-V2.5 "Too many requests" (2026-06-13):** pattern traced to
  Go's _pooled upstream provider accounts_ running out of credits / hitting
  upstream rate limits (Xiaomi for MiMo, Moonshot for Kimi, Z.ai for GLM),
  affecting all Go subscribers regardless of individual usage. Related: #24492,
  #24470, #24462, #23887, #23665.
  Source: https://github.com/anomalyco/opencode/issues/29912
- **#22811 — MiniMax upstream "Token Plan is designed for individual,
  interactive developer workflows... Traffic is currently high"** (2026-04-16).
  Source: https://github.com/anomalyco/opencode/issues/22811
- **Quota accounting bugs:** #15128 (CLI not reading Go quotas correctly;
  2026-02-25), #24473 ("Subscription quota exceeded" persisted 3+ days at 0%
  usage; 2026-04-26).
- **Independent analysis (2026-06-05):** "flat-rate plans still ration under the
  hood... $12 holds until you hit the throughput cap nobody lists"; rate shaping
  (progressive slowdown) rather than hard rejection; caps generous at
  "human scale", visible in heavy agentic sessions.
  Source: https://docs.bswen.com/blog/2026-06-05-flat-rate-llm-throughput-limits/

### 2.4 Latency on Go route

No official latency numbers from OpenCode. The route is OpenAI-compatible
chat/completions proxied to DeepSeek's API; latency therefore inherits
DeepSeek's first-party serving characteristics (Section 5) plus a proxy hop.
Independent note (issue #13318 discussion): upstream reliability for some Zen
models was attributed to Fireworks hosting; DeepSeek models route to DeepSeek.

## 3. OpenCode Zen — the pay-as-you-go route (`opencode/*`)

Source: https://opencode.ai/docs/zen/ (fetched 2026-08-02) and local models.dev
cache (`~/.cache/opencode/models.json`).

### 3.1 Pricing (per 1M tokens) for the primary models

| Model                  | Input | Output | Cached Read |
| ---------------------- | ----- | ------ | ----------- |
| DeepSeek V4 Flash      | $0.14 | $0.28  | $0.028      |
| DeepSeek V4 Pro        | $1.74 | $3.48  | $0.145      |
| DeepSeek V4 Flash Free | Free  | Free   | Free        |
| GPT 5.6 Luna (≤272K)   | $0.20 | $1.20  | $0.02       |
| GPT 5.6 Terra (≤272K)  | $2.00 | $12.00 | $0.20       |
| GPT 5.6 Sol (≤272K)    | $5.00 | $30.00 | $0.50       |
| GPT 5.5 (≤272K)        | $5.00 | $30.00 | $0.50       |
| GPT 5.4 (≤272K)        | $2.50 | $15.00 | $0.25       |
| GPT 5.4 Mini           | $0.75 | $4.50  | $0.075      |

- Zen prices DeepSeek V4 Pro at **list** ($1.74/$3.48), not the promo rate —
  the Go route is 4x cheaper for Pro because of Go's negotiated discount.
- Zen cached-read on DeepSeek V4 Flash is $0.028 (10x the DeepSeek direct
  cache-hit rate $0.0028) — Zen does NOT pass through DeepSeek's disk-cache
  hit price on this model; it applies its own cached-read tier.
- Free models: DeepSeek V4 Flash Free (limited time), etc. `deepseek-v4-flash-free`
  has 200K context / 128K output (models.dev), vs 1M/384K on the paid route.
- Billing: pay-as-you-go credits; auto-reload $20 when balance < $5; monthly
  workspace/member limits configurable; credit card fees passed at cost
  (4.4% + $0.30/transaction).

### 3.2 Zen rate-limit evidence (GitHub, 2026)

- **#13318 — "Keep getting rate limited on Zen"** (2026-02-12): rate limited on
  _paid_ Kimi-K2.5 after a few queries; discussion attributes it to upstream
  hosting (Fireworks) reliability; "Rate limit exceeded" errors with Zen
  models across duplicates #11104, #10404, #11242.
  Source: https://github.com/anomalyco/opencode/issues/13318
- **#32846 — "Rate limit hit for no reason even though paid API user"
  (2026-06-18).** Source: https://github.com/anomalyco/opencode/issues/32846

### 3.3 Models.dev limits for the Zen/Go catalog (local cache, fetched 2026-08-02)

From `~/.cache/opencode/models.json` / models.dev API:

- opencode-go/deepseek-v4-flash: context 1,000,000; output 384,000
- opencode-go/deepseek-v4-pro: context 1,000,000; output 384,000
- opencode/deepseek-v4-flash-free: context 200,000; output 128,000
- opencode/gpt-5.6-luna: context 1,050,000; input 922,000; output 128,000
- opencode/gpt-5.4: context 1,050,000; input 922,000; output 128,000
- openai/gpt-5.4: context 1,050,000; input 922,000; output 128,000
- openai/gpt-5.3-codex-spark: context 128,000; input 100,000; output 32,000

## 4. OpenAI — the ChatGPT Plus OAuth route (`openai/*`)

### 4.1 How this route actually works

- The local `auth.json` holds an OpenAI OAuth token with `chatgpt_plan_type:
plus` (JWT claim), NOT an API key. Requests route through ChatGPT's Codex
  backend, not the public API:
  `https://chatgpt.com/backend-api/codex/responses` with a
  `ChatGPT-Account-Id` header. This is documented in opencode's own codebase
  and issues: https://github.com/anomalyco/opencode/issues/30474 (free-tier
  scopes/`insufficient_quota` 429 bug, 2026-06-02) and
  https://github.com/anomalyco/opencode/issues/34765 (V2 routing bug, 2026-07-01).
- Plan is Plus → subject to ChatGPT/Codex plan limits, NOT OpenAI API tier
  limits. The API-key tier tables below apply only if a real API key were used.

### 4.2 ChatGPT Plus usage limits (official, fetched 2026-08-02)

Source: https://learn.chatgpt.com/docs/pricing and /codex/pricing

Local messages per 5-hour window (Plus plan, $20/month):

| Model         | Local messages / 5h |
| ------------- | ------------------- |
| GPT-5.6 Sol   | 10–100              |
| GPT-5.6 Terra | 25–200              |
| GPT-5.6 Luna  | 250–2,000           |
| GPT-5.5       | 15–80               |
| GPT-5.4       | 20–100              |
| GPT-5.4 mini  | 60–350              |

- "The usage limits for local messages and cloud chats share a five-hour
  window. Additional weekly limits may apply."
- Ranges are dynamic (task complexity, context, reasoning, tool use all
  consume the budget); credit-based system: GPT-5.4 = 62.5 credits / 1M input,
  6.25 cached, 375 output; GPT-5.6 family ~5–40 credits/message; GPT-5.6 usage
  averages 5–40 credits per message. Buy more credits to extend.
- Pro 5x / Pro 20x ($100/$200) multiply these ~5x/20x. Business ≈ Plus limits.
- **Reasoning-time metering:** community-measured — on Plus, GPT-5.4 gives
  roughly 40 minutes of reasoning per 5-hour window (~2.5% per minute);
  GPT-5.3 ~60 min. The new request-pricing model landed 2026-04-09 and
  "killed" heavy Codex use on Plus/Business in practice (community thread).
  Source: https://community.openai.com/t/codex-rate-limits-discussion-thread/1378553/239 (2026-04-10+)
- Undocumented quota endpoint used by community tooling:
  `GET https://chatgpt.com/backend-api/wham/usage` returns
  `rate_limit.primary_window` (5h = 18,000 s) and a secondary (weekly) window
  plus credits. Source: https://github.com/guyinwonder168/opencode-codex-quota/wiki/Technical-Reference

### 4.3 OpenAI API rate limits (only relevant if a real API key replaces OAuth)

Source: https://developers.openai.com/api/docs/models/gpt-5.4 (fetched 2026-08-02)

| Tier   | RPM           | TPM        | Batch queue limit |
| ------ | ------------- | ---------- | ----------------- |
| Free   | Not supported |            |                   |
| Tier 1 | 500           | 500,000    | 1,500,000         |
| Tier 2 | 5,000         | 1,000,000  | 3,000,000         |
| Tier 3 | 5,000         | 2,000,000  | 100,000,000       |
| Tier 4 | 10,000        | 4,000,000  | 200,000,000       |
| Tier 5 | 15,000        | 40,000,000 | 15,000,000,000    |

- gpt-5.5 has identical tables; gpt-5.4-pro is far tighter (Tier 1: 500 RPM /
  30,000 TPM). Tiers qualify by cumulative paid spend ($5/$50/$100/$250/$1000).
- Source: https://developers.openai.com/api/docs/guides/rate-limits
  (long-context requests have separate rate limits).

### 4.4 OpenAI API pricing (for comparison; not the current route)

Source: https://developers.openai.com/api/docs/pricing (fetched 2026-08-02)

| Model         | Input | Cached input | Output | >272K input (2x in / 1.5x out) |
| ------------- | ----- | ------------ | ------ | ------------------------------ |
| gpt-5.6-sol   | $5.00 | $0.50        | $30.00 | $10.00 / $45.00                |
| gpt-5.6-terra | $2.00 | $0.20        | $12.00 | $4.00 / $18.00                 |
| gpt-5.6-luna  | $0.20 | $0.02        | $1.20  | $0.40 / $1.80                  |
| gpt-5.5       | $5.00 | $0.50        | $30.00 | $10.00 / $45.00                |
| gpt-5.4       | $2.50 | $0.25        | $15.00 | $5.00 / $22.50                 |
| gpt-5.4-mini  | $0.75 | $0.075       | $4.50  | —                              |
| gpt-5.4-nano  | $0.20 | $0.02        | $1.25  | —                              |

- 2026-07-30 price cut: GPT-5.6 Luna −80%, Terra −20% (openai.com release:
  https://openai.com/index/advancing-the-price-performance-frontier-with-gpt-5-6/).
- **Fast mode** (replaces Priority Processing): per https://openai.com/api-fast-mode/
  — GPT-5.6 Sol $10/$1/$60 (99.9% uptime SLA, 99% > 80 tok/s latency SLA),
  Terra $4/$0.40/$24 (>70 tok/s), Luna $0.40/$0.04/$2.40 (>100 tok/s).

### 4.5 OpenAI status incidents 2026 (relevant to these models)

Source: https://status.openai.com/history (fetched 2026-08-02)

- 2026-05-08: "Increased Error Rate for gpt-5.5 model in the API" (resolved; higher-than-normal latency during recovery)
- 2026-05-11: "Elevated error rates with GPT 5.5"
- 2026-05-17: "GPT5.5 Performance Degradation"
- 2026-05-23: "Increase in users hitting Codex rate limits"
- 2026-05-27: "Elevated Latency and Errors on API" (3 components)
- 2026-06-29: **"Codex Usage Limits Depleting Faster Than Expected"**
- 2026-07-17: "Codex 5.6-sol Experiencing Increased Server-Overload Errors"
- 2026-07-24: "Elevated Errors in Codex Review"

## 5. Latency — measured numbers

### 5.1 DeepSeek first-party (relevant to Go/Zen routes to deepseek-v4-flash)

- **Artificial Analysis** (independent, streaming benchmarks, 10K-token inputs):
  - V4 Flash **non-reasoning** on DeepSeek's own API: TTFT ~1.24 s, output
    speed ~107 tokens/s, total response ~5.91 s (10K-input task).
    Source: https://artificialanalysis.ai/models/deepseek-v4-flash-non-reasoning/providers
  - V4 Flash **reasoning high**: first-answer-token latency ~13.72 s, ~99 t/s.
    Source: https://artificialanalysis.ai/models/deepseek-v4-flash-high/providers
  - V4 Flash **reasoning max**: first-answer-token latency ~50.12 s, ~115 t/s.
    Source: https://artificialanalysis.ai/models/deepseek-v4-flash-0420/providers
  - Provider spread is huge: Makora 0.67 s / 241 t/s vs CoreWeave 3.07 s / 41 t/s.
- **AILatency** (single-location, via OpenRouter): V4 Flash TTFT ~576 ms,
  total ~589 ms (one-token probes; includes gateway overhead).
  Source: https://www.ailatency.com/models/deepseek-deepseek-v4-flash.html
- **Concurrency scaling (Alibaba Cloud benchmark, 2026-05-26)** on hosted
  V4-Flash-class serving: TTFT degrades from ~245 ms (concurrency 1) to
  ~1,850 ms (concurrency 32) on shared Token API, and throughput plateaus
  around 18K TPM; reserved capacity (PTU/MU) holds P99 TTFT <700 ms even at
  concurrency 32. Direct evidence that **shared/cheap serving degrades under
  concurrency** while reserved capacity is stable.
  Source: https://www.alibabacloud.com/blog/deepseek-v4-flash-at-scale-a-benchmark-driven-deployment-guide_603181

### 5.2 DeepSeek "busy"/overload behavior (qualitative)

- "Server is busy" ≈ inference capacity saturated (HTTP 503); spikes around
  releases and Asia-Pacific peak hours; Flash clears queue faster than Pro.
  Source: https://deepseekai.guide/guides/deepseek-troubleshooting/ (2026-04-24)
- 40% of "busy" errors occur in specific peak windows; 9:00 AM Beijing trading
  hours show spikes. Source: https://websites2know.com/deepseek-server-is-busy-error-causes-and-fixes/ (2026-05-02)
- Keep-alive mechanism means **timeouts must be explicit** (60–300 s
  recommended) because the server holds the connection while queued.
  Source: https://deepseekai.guide/guides/deepseek-troubleshooting/ and official rate-limit page.

### 5.3 OpenAI

- API Fast-mode latency SLAs (99%): Sol >80 tok/s, Terra >70 tok/s, Luna
  > 100 tok/s, gpt-5.5 >50 tok/s, gpt-5.4 >50 tok/s. Source: https://openai.com/api-fast-mode/
- ChatGPT Plus route latency is not officially published; community reports of
  reasoning-time metering mean wall-clock time directly consumes the 5h budget.

## 6. DeepSeek status / outage history (official + aggregators)

- Official: https://status.deepseek.com (May 2026–Jul 2026):
  - DeepSeek V4 Pro API: 99.90% uptime
  - DeepSeek V4 Flash API: 99.90% uptime
  - Chat service 99.75%, Instant 99.73%, Expert 99.73%
- Incidents (official status page, via Pingoru/Tickerr aggregators):
  - 2026-03-29/30: **worst outage ever ~7h13m** (major outage, API + web)
    Sources: https://deepseeksguides.com/deepseek-outage/ (2026-05-11), https://techround.co.uk/...
  - 2026-04-22: API abnormal, ~1h03m
  - 2026-05-06: two degraded incidents (6m, 11m)
  - 2026-05-08: web/API unavailable, ~33m
  - 2026-07-02: web/API degraded performance, ~1h09m
  - 2026-07-21: ~42-min outage (downforeveryoneorjustme)
  - 2026-07-24: API degraded performance, ~19m (AIWatch)
- Aggregator uptime estimates differ (methodology): Tickerr 90-day 99.5%;
  Pingoru 90-day ~91.94% (counts degraded minutes); AIWatch 30-day 99.94%,
  2 incidents avg recovery 45 min. Official numbers are the most defensible.

## 7. Operational-risk synthesis (inputs to "Operational economics")

1. **Low price ≠ low latency risk on DeepSeek routes.** DeepSeek's model is
   _queue instead of fail fast_ (10-min keep-alive), so cost is cheap but
   tail latency and 429/503 handling must be engineered for. Agent workloads
   need explicit timeouts, bounded concurrency (well under 2,500/500), backoff
   with jitter, and circuit breakers. (Official rate-limit page; chat-deep.ai)
2. **OpenCode Go's $10/mo is capped and pooled, not unlimited.**
   - Dollar caps: $12/5h / $30/wk / $60/mo (≈31,650 req/5h on V4 Flash).
   - Documented July 2026 incident: deepseek-v4-flash rate-limited on Go even
     at 0% usage (#34884) due to upstream/DeepSeek-side concurrency; same
     class of failure for MiMo/Kimi/MiniMax via pooled upstream accounts
     (#29912, #22811).
   - DeepSeek V4 Pro on Go deliberately has only ~$15/mo usage value (1.5x
     multiplier) — "cheap Pro" is the least generous route.
   - Quota accounting has had bugs (#15128, #24473) that can block use at 0%
     usage; weekly window is the binding constraint for sustained work.
3. **ChatGPT Plus route is budget-by-message/reasoning, not token-priced.**
   Hardest hard constraint for agent loops: 20–100 messages/5h on gpt-5.4,
   10–100 on gpt-5.6-sol, plus weekly caps; reasoning time is the metering
   unit (≈2.5%/min of reasoning on gpt-5.4). Incidents show usage depleting
   "faster than expected" (2026-06-29). Cheap per-seat, but wall-clock
   constrained; long thinking directly consumes budget.
4. **Context/output are commoditized on all routes** (1M ctx; 384K out on
   DeepSeek, 128K out on GPT-5.x). Watch the >272K reprice on GPT-5.x (2x in,
   1.5x out) and DeepSeek 384K-vs-context interplay; think-max needs headroom.
5. **Peak/off-peak:** Do NOT model DeepSeek off-peak discounts (dead since
   2025-09-05). DO model the announced 2x peak surcharge (01:00–04:00 and
   06:00–10:00 UTC) as a pending policy risk — announced 2026-06-30, official
   page says "will soon adopt," not active as of 2026-07-25. OpenAI has no
   time-of-day pricing; OpenAI's only "cheap lane" is Batch/flex processing.
6. **Observation candidates (to validate in production):**
   - Per-request: TTFT, tokens/s, keep-alive duration, HTTP 429/503 rate,
     `Retry-After` header, `X-RateLimit-*` headers (OpenAI API only).
   - Go: watch `console` usage vs dashboard; rolling 5h % vs weekly %;
     track "Provider rate limit exceeded" even at 0% usage (upstream signal).
   - DeepSeek: monitor `usage.prompt_cache_hit_tokens` / miss split (cache
     economics), connection open time before first token (queueing signal).
   - Plus route: `GET /backend-api/wham/usage` for primary (5h) + secondary
     (weekly) windows and credit balance.

## Sources index

- DeepSeek Models & Pricing: https://api-docs.deepseek.com/quick_start/pricing/
- DeepSeek Rate Limit & Isolation: https://api-docs.deepseek.com/quick_start/rate_limit/
- DeepSeek Change Log (V4-Flash-0731): https://api-docs.deepseek.com/updates/
- DeepSeek V3.1 off-peak end: https://api-docs.deepseek.com/news/news250821/
- DeepSeek HF card: https://huggingface.co/deepseek-ai/DeepSeek-V4-Flash-0731
- DeepSeek status: https://status.deepseek.com/
- OpenCode Go docs: https://opencode.ai/docs/go/
- OpenCode Zen docs: https://opencode.ai/docs/zen/
- models.dev: https://models.dev/api.json (local cache `~/.cache/opencode/models.json`)
- OpenAI rate limits: https://developers.openai.com/api/docs/guides/rate-limits
- OpenAI pricing: https://developers.openai.com/api/docs/pricing
- OpenAI Fast mode: https://openai.com/api-fast-mode/
- ChatGPT/Codex pricing (Plus limits): https://learn.chatgpt.com/docs/pricing
- OpenAI status: https://status.openai.com/history
- OpenAI GPT-5.6 launch: https://openai.com/index/gpt-5-6/
- GPT-5.6 price cut: https://openai.com/index/advancing-the-price-performance-frontier-with-gpt-5-6/
- Reuters off-peak (2025): https://www.reuters.com/technology/chinas-deepseek-cuts-off-peak-pricing-by-up-75-2025-02-26/
- SCMP peak surcharge (2026-06-30): https://www.scmp.com/tech/big-tech/article/3358868/
- Artificial Analysis (DeepSeek V4 Flash providers): https://artificialanalysis.ai/models/deepseek-v4-flash-non-reasoning/providers
- AILatency: https://www.ailatency.com/models/deepseek-deepseek-v4-flash.html
- Alibaba Cloud V4-Flash scale benchmark: https://www.alibabacloud.com/blog/deepseek-v4-flash-at-scale-a-benchmark-driven-deployment-guide_603181
- OpenCode issues: #34884 https://github.com/anomalyco/opencode/issues/34884 ·
  #29912 · #22811 · #15128 · #24473 · #13318 · #32846 · #30474 · #34765
- Chat-deep.ai rate limits: https://chat-deep.ai/docs/api-rate-limits/
- deepseek.ai pricing (independent): https://deepseek.ai/pricing
- deepseekai.guide docs: https://deepseekai.guide/api/deepseek-api-pricing/ and /guides/deepseek-character-limits/
- Community Codex limits thread: https://community.openai.com/t/codex-rate-limits-discussion-thread/1378553/239

## EXPAND

Follow-up research candidates (not covered above, would sharpen the
operational-economics model):

1. **OpenCode Go's actual serving backend** — which upstream provider(s) serve
   `deepseek-v4-flash` on Go vs Zen (DeepSeek direct? third-party?); look for
   internal provider configs in anomalyco/opencode repo and any Go-specific
   status page (opencode.ai status / Discord announcements). Would confirm
   whether Go throttling is DeepSeek-side or OpenCode-side.
2. **DeepSeek V4 Pro GA date** — official page says Responses API "early
   August 2026"; V4-Pro full release "will follow soon." If Pro GA ships with
   the peak-hour surcharge, re-price both routes.
3. **OpenAI ChatGPT Plus "fast" variants** (`gpt-5.4-fast`, `gpt-5.6-luna-fast`)
   in the local catalog — verify they map to Fast mode pricing
   (https://openai.com/api-fast-mode/) and whether the Plus plan exposes them
   with the same 5h message budget or a separate one.
4. **Weekly-limit magnitudes for ChatGPT Plus** — official docs only say
   "additional weekly limits may apply"; the community wham/usage endpoint
   exposes the secondary window; quantify for gpt-5.4/5.6 on Plus.
5. **Zen vs Go routing differences for DeepSeek** — Zen cached-read $0.028 vs
   DeepSeek direct $0.0028 suggests Zen does not pass through DeepSeek disk
   cache on this model; verify against billing and whether Go passes it through
   (Go docs show $0.0028).
6. **DeepSeek keep-alive behavior measurement** — instrument actual
   open-to-first-token time under load on api.deepseek.com vs the Go proxy to
   quantify queueing tail (p95/p99) across UTC day; correlates with the
   announced peak windows.
7. **OpenAI Batch/Flex processing pricing** as the actual "off-peak" analog
   (50% batch discount, flex tier) if heavy non-interactive workloads are ever
   routed off the Plus OAuth path.
8. **Regional latency** — DeepSeek is served primarily from China; measure
   RTT from the deployment region (this machine is Europe/Moscow) to
   api.deepseek.com and chatgpt.com to bound proxy overhead on both routes.

## CLAIMS

1. **DeepSeek publishes no RPM/TPM — only concurrency (flash 2,500 / pro 500).**
   Evidence: official Rate Limit & Isolation page (https://api-docs.deepseek.com/quick_start/rate_limit/), fetched 2026-08-02.
2. **DeepSeek V4 context/output: 1M context, 384K max output, both models.**
   Evidence: official Models & Pricing page, fetched 2026-08-02.
3. **DeepSeek V4 prices: flash $0.0028/$0.14/$0.28; pro $0.003625/$0.435/$0.87
   (cache-hit/miss/output).** Evidence: official pricing page, fetched 2026-08-02.
4. **DeepSeek holds requests open (keep-alive) up to 10 minutes before closing
   if inference hasn't started — hidden latency mechanism.**
   Evidence: official rate-limit page; corroborated by chat-deep.ai (2026-05-02).
5. **DeepSeek's off-peak discount (50–75%, 16:30–00:30 UTC) ended 2025-09-05
   and was not revived for V4.** Evidence: api-docs.deepseek.com/news/news250821/; deepseek.ai/pricing (verified 2026-07-25).
6. **DeepSeek announced a 2x peak-hour surcharge (09:00–12:00 & 14:00–18:00
   Beijing = 01:00–04:00 & 06:00–10:00 UTC) on 2026-06-30; NOT active as of
   2026-07-25; official pricing page says "will soon adopt."**
   Evidence: official pricing page footnote (fetched 2026-08-02); SCMP 2026-06-30.
7. **OpenCode Go costs $5 first month / $10/mo with hard caps $12/5h, $30/week,
   $60/month of usage value.** Evidence: https://opencode.ai/docs/go/, fetched 2026-08-02.
8. **On Go, DeepSeek V4 Flash ≈31,650 requests/5h; V4 Pro ≈3,450 requests/5h
   (and Pro is capped to ~$15/mo usage value).** Evidence: official Go docs table.
9. **Go throttling is real and documented: deepseek-v4-flash returned
   "Provider rate limit exceeded" at 0% usage in July 2026 (#34884); other Go
   models hit pooled-upstream rate limits (#29912, #22811).**
   Evidence: anomalyco/opencode issues, July 2026.
10. **Zen prices DeepSeek V4 Pro at list ($1.74/$3.48) and DeepSeek V4 Flash
    cached-read at $0.028 (not $0.0028).** Evidence: https://opencode.ai/docs/zen/, fetched 2026-08-02.
11. **ChatGPT Plus OAuth route has no RPM/TPM; it is capped by a per-5h
    message budget (GPT-5.4 20–100; GPT-5.6 Sol 10–100; Luna 250–2,000) plus
    weekly limits and reasoning-time metering.** Evidence: https://learn.chatgpt.com/docs/pricing, fetched 2026-08-02; community thread 2026-04-10.
12. **OpenAI API (if used) tier-1 caps gpt-5.4/5.5 at 500 RPM / 500K TPM,
    scaling to 15,000 RPM / 40M TPM at Tier 5.** Evidence: https://developers.openai.com/api/docs/models/gpt-5.4.
13. **OpenAI API gpt-5.6 prices: Sol $5/$30, Terra $2/$12 (cut −20%
    2026-07-30), Luna $0.20/$1.20 (cut −80% 2026-07-30); >272K prompts reprice
    at 2x in / 1.5x out.** Evidence: https://developers.openai.com/api/docs/pricing; openai.com release 2026-07-30.
14. **DeepSeek official status: 99.90% uptime for V4 Pro and V4 Flash APIs
    (May–Jul 2026), but 2026-03-29/30 major outage ~7h13m and 2026-07-21
    ~42-min outage.** Evidence: https://status.deepseek.com/; aggregators (Pingoru, Tickerr, downforeveryoneorjustme).
15. **OpenAI had repeated gpt-5.5/5.4 incidents (May 8, 11, 17, 27 2026), a
    "Codex Usage Limits Depleting Faster Than Expected" incident (2026-06-29),
    and Codex 5.6-sol server-overload errors (2026-07-17).**
    Evidence: https://status.openai.com/history, fetched 2026-08-02.
16. **Measured DeepSeek V4 Flash first-party latency: ~1.24 s TTFT / ~107 t/s
    non-reasoning; ~13.7 s first-answer in high reasoning; ~50 s in max
    reasoning.** Evidence: Artificial Analysis provider pages (2026).
17. **Shared/cheap serving degrades with concurrency: V4-Flash-class TTFT
    degrades ~7.5x from concurrency 1→32 on shared Token API; reserved
    capacity keeps P99 <700 ms.** Evidence: Alibaba Cloud benchmark (2026-05-26).
18. **Models.dev catalog (used by OpenCode): opencode-go deepseek-v4-flash
    context 1,000,000 / output 384,000; gpt-5.6-luna context 1,050,000 /
    output 128,000; deepseek-v4-flash-free 200K/128K.**
    Evidence: local cache `~/.cache/opencode/models.json` (models.dev API), fetched 2026-08-02.
