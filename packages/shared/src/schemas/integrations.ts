import { z } from "zod";

// Telegram status only; token never leaves the API — only the derived boolean.
export const telegramIntegrationStatusSchema = z.object({
  configured: z.boolean(),
  bindings: z.number().int().nonnegative(),
});

export const integrationsStatusSchema = z.object({
  telegram: telegramIntegrationStatusSchema,
});

export type TelegramIntegrationStatus = z.infer<
  typeof telegramIntegrationStatusSchema
>;
export type IntegrationsStatus = z.infer<typeof integrationsStatusSchema>;

// chatId stays TEXT: a Telegram chat id is either a signed 64-bit integer (at
// most 20 characters) or an `@username` (at most 32); 64 is the round headroom
// cap above both, not a Telegram-defined limit.
const MAX_TELEGRAM_CHAT_ID_LENGTH = 64;
// Bot API `sendMessage` rejects text longer than this.
const MAX_TELEGRAM_MESSAGE_LENGTH = 4096;

export const adminTestTelegramSendSchema = z.object({
  chatId: z.string().trim().min(1).max(MAX_TELEGRAM_CHAT_ID_LENGTH),
  text: z.string().trim().min(1).max(MAX_TELEGRAM_MESSAGE_LENGTH),
});

export type AdminTestTelegramSendInput = z.infer<
  typeof adminTestTelegramSendSchema
>;
