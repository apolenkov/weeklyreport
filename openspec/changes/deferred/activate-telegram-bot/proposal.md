# Activate Telegram bot

## Problem

Telegram notification adapter exists as a stub. When `TG_BOT_TOKEN` is set in
env, the module currently throws "Not implemented". Phase 55 roadmap includes
Telegram as a notification channel for report publication and period events.

## Solution

1. Wire real Telegram bot adapter when `TG_BOT_TOKEN` is present.
2. Implement `TelegramService.sendMessage(chatId, text)` with actual bot API
   calls.
3. Add integration test with a test bot token (or mock HTTP).
4. Gate feature behind `FEATURE_TELEGRAM_ENABLED` flag for safe rollout.

## Activation trigger

**Phase 55 milestone** — Telegram notification channel is a Phase 55 scope
item. Activate only when Phase 55 is unlocked.

## Non-goals

- Change tRPC notificationChannel enum or user settings surface.
- Implement Telegram group management or admin commands.

## Status

Deferred — TODO(Phase-55-activation) in `apps/api/src/modules/telegram/telegram.module.ts:28`.
