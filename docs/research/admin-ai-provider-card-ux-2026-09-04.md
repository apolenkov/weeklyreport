# Admin AI Provider cards: decision-ready UX research

Дата: 2026-09-04
Скоуп: WeeklyReport `/admin?tab=ai` (фактический route сейчас использует admin tab `settings`/AI panel), текущие shared/API contracts, OpenSpec и официальные API-документы провайдеров.

## Короткий вывод

Экран уже имеет реальный lifecycle и набор серверных команд; проблема в основном в представлении: сейчас пользователь должен собирать смысл из формы, нескольких сообщений и раскрываемого `Diagnostics`. Рекомендуется сделать верхний summary-card с одним очевидным состоянием и одной primary action, затем два configuration-card (`Generation`, `Embeddings`), затем отдельный lifecycle strip (`Save draft → Test → Activate`) и history card. Не добавлять действия, которых нет в API.

## Что действительно существует в коде

### Сущности

- `AiProviderControlRead`: `enabled`, `availability`, `activeRevisionId`, `profileCapabilities`, `active`, `revisions`.
- `AiProviderConfigurationRead`: revision `id`, lifecycle, generation connection/models/reasoning/credential metadata, embeddings connection/model, test result, latest async execution, preparation progress, timestamps, activation timestamp.
- Generation roles: planner model + answer model. Embeddings: либо reuse generation connection, либо отдельный provider/model.
- Built-in profiles: `mistral`, `openrouter`, `openai`, `groq`, `jina`, плюс `custom-openai-compatible`. Capabilities в коде: Mistral/OpenRouter/OpenAI/custom — generation и embeddings; Groq — generation; Jina — embeddings.
- Built-in endpoints выбираются сервером. Custom endpoint обязан быть HTTP(S), без credentials/query/fragment и должен проходить server-side origin allowlist.

Источники: [`ai-provider-configuration.base.ts`](../../packages/shared/src/schemas/ai-provider-configuration.base.ts), [`provider-profile.ts`](../../apps/api/src/modules/ai-provider/domain/provider-profile.ts), [`ai-provider-configuration.read.ts`](../../packages/shared/src/schemas/ai-provider-configuration.read.ts).

### Статусы и переходы

Контракт lifecycle: `draft`, `validated`, `preparing`, `active`, `failed`, `superseded`.

- `draft`: конфигурация сохранена, но не проверена/не активирована.
- `validated`: capability test прошёл; доступна активация.
- `preparing`: активация запущена, идёт embedding preparation; доступно `Resume activation`.
- `active`: текущая рабочая конфигурация.
- `failed`: неуспешная попытка; её можно discard.
- `superseded`: старая сохранённая revision; её можно restore.

Доступные admin tRPC commands: `get`, `save`, `test`, `activate`, `disable`, `restore`, `discard`, `progress`. Это означает, что кнопки `Edit`, `Delete`, `Status update` в отдельном общем смысле не существуют: редактирование — это изменение формы и `Save draft`; удаление — только `Discard` неактивной draft/failed revision; статус меняется серверными lifecycle-командами.

Источники: [`ai-provider.procedures.ts`](../../apps/api/src/infrastructure/trpc/routers/admin/ai-provider.procedures.ts), [`ai-provider-form-actions.tsx`](../../apps/web/src/features/organization/ui/ai-provider-form-actions.tsx), [`ai-provider-retained-revisions.tsx`](../../apps/web/src/features/organization/ui/ai-provider-retained-revisions.tsx).

## Рекомендуемая card-структура

1. **AI Provider / current state card** — badge `Not configured`, `Draft`, `Ready to activate`, `Preparing`, `Active`, `Failed`; provider/profile; credential configured/not configured; last test result; one sentence explaining what happens next.
2. **Generation card** — provider, endpoint only for custom, planner model, answer model, reasoning, credential input. Label the credential as “Replace credential” when one is already configured; never imply that the masked suffix is editable plaintext.
3. **Embeddings card** — “Use generation connection” or “Separate connection”, model, and conditional separate provider/endpoint/credential. Explain that embeddings power semantic search.
4. **Lifecycle card** — visible 3-step stepper: `1 Save draft`, `2 Test capabilities`, `3 Activate`. Disable impossible actions but explain why inline, not only via `title`.
5. **History card** — retained revisions with lifecycle badge, created/updated time, model summary, `Restore` for `superseded`, `Discard` for `draft`/`failed`; destructive confirmation remains required.
6. **Diagnostics** — retain as collapsed secondary disclosure for endpoint identity, dimensions, semantic version and retained revision details. OpenSpec requires disclosure controls to expose correct `aria-controls`/`aria-labelledby`, and mounted collapsed admin regions to report hidden state.

This preserves the existing domain model and makes the primary question (“will AI work now?”) answerable in the first card. It also avoids inventing “delete active provider”: the real command is `Disable`, which retains configuration.

## Lifecycle copy and states

Use direct copy tied to actual commands:

| Actual state                   | Primary message                                       | Main action                 | Secondary action |
| ------------------------------ | ----------------------------------------------------- | --------------------------- | ---------------- |
| no revision / `not_configured` | “No AI provider is configured.”                       | `Save draft`                | —                |
| `draft`                        | “Draft saved. Test it before activation.”             | `Test capabilities`         | `Save draft`     |
| execution `queued`/`running`   | “Provider test queued/running.”                       | disabled `Test`             | —                |
| `validated`                    | “All required capability checks passed.”              | `Activate`                  | `Test again`     |
| `preparing`                    | “Embedding preparation is in progress: X/Y complete.” | `Resume activation`         | —                |
| `active`                       | “AI is active for users.”                             | `Edit configuration` (form) | `Disable`        |
| `failed` / configuration error | “Provider rejected the credential or configuration.”  | `Save new draft`            | `Discard`        |
| `superseded`                   | “Retained previous configuration.”                    | `Restore`                   | —                |

Do not use “Delete” for `Discard`; discard is scoped to an unsuccessful/non-active attempt and the server explicitly says its credential cannot be restored. Do not use “Update status” as a free-form control: status is a consequence of tested commands.

## Loading, empty, error and async behavior

- Loading: skeleton card with stable headings and disabled controls; avoid a lone “Loading AI configuration…” line for a dense admin surface.
- Query error: keep `Failed to load AI configuration` + `Retry`, and preserve the surrounding page chrome.
- Empty: show configuration form with a clear `Not configured` badge and an explanation that saving creates a draft only; do not show history/diagnostics when no revision exists.
- Async test: poll while latest execution is `queued` or `running`; show state and disable duplicate test. On completion show lane-level `Generation` and `Embeddings` result.
- Preparation: show completed/total, failed and elapsed values; make `Resume activation` the only meaningful next action.
- Operation error: preserve server message in an alert region, but add actionable recovery text based on failure class (replace credential, review endpoint/model, retry temporary provider failure).

Source: [`ai-provider-mutations.ts`](../../apps/web/src/features/organization/ui/ai-provider-mutations.ts), [`ai-provider-card-feedback.tsx`](../../apps/web/src/features/organization/ui/ai-provider-card-feedback.tsx), [`ai-provider-card.tsx`](../../apps/web/src/features/organization/ui/ai-provider-card.tsx).

## Provider docs: what the UI must not imply

The configured providers expose an OpenAI-compatible shape only in selected cases; model capability is not universal.

- **OpenAI:** official docs show server-side API-key/Bearer authentication and explicitly say keys must not be exposed in browser/client code. The docs also recommend request IDs for production troubleshooting and pinned model versions/evals for consistency. Therefore show only configured/masked metadata and server-side test outcome; never reveal or echo a key. [OpenAI API authentication/debugging](https://platform.openai.com/docs/api-reference/debugging-requests?lang=curl), [OpenAI quickstart](https://platform.openai.com/docs/quickstart/make-your-first-api-request).
- **Mistral:** official Chat Completion is `POST /v1/chat/completions`; embeddings is `POST /v1/embeddings`, with model IDs and input(s) required. Mistral’s own quickstart says a newly generated key is shown only once. Therefore “credential configured” is the honest state; a masked suffix is diagnostic metadata, not a recoverable secret. [Mistral Chat API](https://docs.mistral.ai/api/endpoint/chat), [Mistral Embeddings API](https://docs.mistral.ai/api/endpoint/embeddings), [Mistral first API request](https://docs.mistral.ai/getting-started/quickstarts/developer/first-api-request).
- **OpenRouter:** official docs describe OpenAI-compatible `/completions` and `/chat/completions`, Bearer API keys, model-specific `supported_parameters`, and a `/api/v1/models` endpoint. A generic “reasoning supported” badge would be misleading because support is model-specific. [OpenRouter FAQ](https://openrouter.ai/docs/faq), [OpenRouter models](https://openrouter.ai/docs/guides/overview/models).
- **Groq:** official docs provide base URL `https://api.groq.com/openai/v1`, but list unsupported OpenAI features and model-specific reasoning parameters. Groq also exposes `/models`. Therefore the test card should report protocol/capability checks, not simply “OpenAI-compatible = all features work.” [Groq OpenAI compatibility](https://console.groq.com/docs/openai), [Groq API reference](https://console.groq.com/docs/api-reference), [Groq models](https://console.groq.com/docs/models).
- **Jina:** official Embedding API is `https://api.jina.ai/v1/embeddings`; rate limits are measured by RPM/TPM and vary by key/tier. Jina is an embeddings profile in this product, not a generation provider. Do not expose a generation model field when Jina is selected for embeddings. [Jina Embedding API](https://jina.ai/embeddings/).

## Product decisions adopted for this implementation

1. An active revision opens in read mode with an explicit `Edit configuration` action. Draft, failed, and unconfigured states open directly in edit mode.
2. Built-in endpoint URLs stay implicit; custom endpoint identity and masked credential metadata remain in Diagnostics rather than the primary summary.
3. Retained history is a compact secondary recovery region. Diagnostics remains closed by default.
4. A validated revision is described as having passed the required capability checks; the UI does not claim universal provider compatibility.
5. Model IDs remain the current free-text fields. Provider model discovery is outside this change because it requires new server contracts and caching semantics.
6. The UI uses the normalized failures already present in the read contract. Provider request IDs are not added in this presentation-only change.

## Scope boundary

This research recommends a card-based presentation and copy/state treatment using current contracts. It does not authorize changing API semantics, adding provider discovery, exposing secrets, changing the provider allowlist, or introducing a new provider.
