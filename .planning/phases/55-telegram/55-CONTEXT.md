# Phase 55: Telegram Integration (SEEDS + TODO)

**Status:** seeds-only (2026-05-11 user decision). Land bot scaffolding +
binding table + queue, but DO NOT activate without real bot token + config.
**User decision (2026-05-11):**

- Bot identity: **один бот для всей PEO** (A — single bot for the whole org)
- Auth binding: defer — leave one-time-token table empty, UI not yet
- Reasoning: «без real config = броски в пустоту, пока просто заделы»
  **Scope reduction for this round:**
- Schema: `TelegramBinding { userId, chatId, linkedAt }` table
- Stub `TelegramQueue` BullMQ worker that logs payload + skips real send
  when `process.env.TG_BOT_TOKEN` is empty
- Adapter interface `TelegramAdapter.send(chatId, msg)` with `MockTelegramAdapter` for dev
- UI Settings tab: «Integrations» with «Telegram (не активно)» status badge
- DO NOT implement /start /summary /ask handlers — those require active bot

**Driver:** «RAG будет в Telegram и summary» (2026-05-10 in-chat capture)

## Scope (idea-level)

Telegram becomes a consumption surface for CustomReport:

- **Weekly summary notifications** — every published Period emits
  a digest to a group / channel
- **Per-lead reminders** — opt-in alternative to email reminders
  (Phase 44 already does email; add Telegram channel)
- **Conversational interface** — `/ask` command queries the RAG
  (Phase 54) and returns answers in-chat
- **Admin alerts** — late submissions, auto-publish events,
  reopen requests, scope-denied audits

## Likely shape

| Plan | Scope                                                                                 |
| ---- | ------------------------------------------------------------------------------------- |
| 55-A | Bot scaffolding (telegraf or grammY library, BullMQ worker)                           |
| 55-B | User binding (link Telegram chat_id to User via /start token)                         |
| 55-C | Outbound channels — reminder/digest delivery via TelegramQueue parallel to EmailQueue |
| 55-D | Inbound commands (/summary, /ask, /late, /help)                                       |
| 55-E | RAG integration (depends on Phase 54)                                                 |
| 55-F | Admin controls in /admin?tab=integrations                                             |

## Dependencies

- Phase 44 (reminder dispatch infrastructure — Telegram is a parallel channel)
- Phase 54 (RAG for /ask responses)
- Phase 53 (Telegram bot needs outbound HTTPS, easier in cloud)

## Open questions for /gsd-discuss-phase

- Bot identity (one bot for whole org, or per-department bots)
- Group/channel/DM strategy
- Authentication binding (one-time token vs SAML federation)
- Privacy: which messages allowed to leak to Telegram (publicly-hosted bot)
- Rate limits / backoff
