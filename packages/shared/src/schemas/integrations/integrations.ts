import { z } from "zod";

/** Public Telegram readiness summary; credentials never cross the API boundary. */
export const telegramIntegrationStatusSchema = z
  .object({
    configured: z.boolean(),
    bindings: z.number().int().nonnegative(),
  })
  .readonly();

/** Validates the public status of every supported integration. */
export const integrationsStatusSchema = z
  .object({
    telegram: telegramIntegrationStatusSchema,
  })
  .readonly();

/** Public Telegram readiness summary without credentials. */
export type TelegramIntegrationStatus = z.infer<
  typeof telegramIntegrationStatusSchema
>;
/** Public readiness summary for supported integrations. */
export type IntegrationsStatus = z.infer<typeof integrationsStatusSchema>;

// chatId stays TEXT: a Telegram chat id is either a signed 64-bit integer (at
// most 19 digits) or an `@username` (5-32 chars); anything else is rejected so
// invalid ids never reach the Bot API as apparently valid admin input.
const MAX_TELEGRAM_MESSAGE_LENGTH = 4096;
// Signed 64-bit integer: `-?` then up to 19 digits (9_223_372_036_854_775_807).
const TELEGRAM_INTEGER_CHAT_ID = /^-?\d{1,19}$/;
// `@` + 4-31 chars matches Telegram's 5-32 char username rule.
const TELEGRAM_USERNAME_CHAT_ID = /^@\w{4,31}$/;

/** Validates a bounded admin-only Telegram smoke-test request. */
export const adminTestTelegramSendSchema = z
  .object({
    chatId: z
      .string()
      .trim()
      .refine(
        (value) =>
          TELEGRAM_INTEGER_CHAT_ID.test(value) ||
          TELEGRAM_USERNAME_CHAT_ID.test(value),
        { message: "chatId must be a signed 64-bit integer or an @username" },
      ),
    text: z.string().trim().min(1).max(MAX_TELEGRAM_MESSAGE_LENGTH),
  })
  .readonly();

/** Bounded destination and message accepted by the admin Telegram probe. */
export type AdminTestTelegramSendInput = z.infer<
  typeof adminTestTelegramSendSchema
>;
