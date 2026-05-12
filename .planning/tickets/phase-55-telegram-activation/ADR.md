# ADR: Phase 55 — Telegram Bot Activation

**Status:** OPEN  
**Created:** 2026-05-12  
**Ref:** TODO(Phase-55-activation) markers in codebase

---

## Context

Phase 55 landed Telegram bot infrastructure in seeds-only / stub mode. The
bot skeleton (`TelegramBotService`) is wired, `TELEGRAM_BOT_TOKEN` env var
is read but not validated in production. Notification triggers (draft
reminder, submission confirmation, head approval) are behind
`TODO(Phase-55-activation)` guards.

See `apps/api/src/modules/notifications/telegram/` and
`TODO(Phase-55-activation)` markers.

---

## Decision Required

**What triggers should be activated first?**

| Trigger                         | Priority | Notes                       |
| ------------------------------- | -------- | --------------------------- |
| Draft reminder (Mon 09:00)      | High     | Replaces manual Slack pings |
| Submission confirmation to lead | Medium   | UX nicety                   |
| Head approval/rejection to lead | Medium   | Closes the feedback loop    |
| Weekly summary to Director      | Low      | Read-only digest            |

Recommended activation order: Draft reminder first (highest user value,
safest — one-way notification to lead, no destructive action).

---

## Activation Checklist (when ready)

- [ ] Create Telegram bot via @BotFather, get `TELEGRAM_BOT_TOKEN`
- [ ] Map each lead's Telegram `chat_id` in the `User` table
      (either via `/start` command flow or admin CSV import)
- [ ] Set `TELEGRAM_BOT_TOKEN` in `.env.production`
- [ ] Set `TELEGRAM_NOTIFICATIONS_ENABLED=true`
- [ ] Remove stub guard at `TODO(Phase-55-activation)` markers
- [ ] Smoke test: trigger draft reminder for one user
- [ ] Verify `customreport_telegram_notification_sent_total` metric fires
- [ ] Monitor: check delivery receipt (Telegram API `getUpdates`)

---

## Open Questions

1. How do leads register their Telegram account? (Self-service `/start` vs admin CSV)
2. Corporate proxy required? (Telegram may be blocked on corporate network)
3. Fallback if Telegram unavailable — fall back to email?

---

## Links

- Phase directory: `.planning/phases/55-telegram-bot/`
- TODO markers: `grep -rn "TODO(Phase-55" apps/api/src/`
- Metric: `customreport_telegram_notification_sent_total`
