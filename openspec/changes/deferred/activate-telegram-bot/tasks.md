# Tasks

## Telegram service implementation

- **TG-T1** Implement `TelegramService` with real Telegram Bot API client
  (grammy or node-telegram-bot-api)
- **TG-T2** Add `TG_BOT_TOKEN` and `FEATURE_TELEGRAM_ENABLED` to
  `.env.example`
- **TG-T3** Wire service into `NotificationDispatcher`; gate behind feature
  flag
- **TG-T4** Add integration test with test bot token or HTTP mock
- **TG-T5** Verify no errors when `TG_BOT_TOKEN` is set; verify
  "Not implemented" is replaced with real send logic
- **TG-T6** Commit: `feat(telegram): activate real Telegram bot adapter
(Phase 55)`

## Verification

```bash
TG_BOT_TOKEN=<test-token> FEATURE_TELEGRAM_ENABLED=true \
pnpm --filter @customreport/api test -- \
  src/modules/telegram/__tests__/telegram.integration.test.ts
```
