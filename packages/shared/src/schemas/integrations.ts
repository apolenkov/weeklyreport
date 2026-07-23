import { z } from "zod";

/**
 * Payload shape for `admin.integrationsStatus`.
 *
 * The Integrations sub-tab in /admin?tab=settings reads this to render a
 * status badge for every external integration. The payload covers only
 * Telegram (the one integration with a real backend); the AI card on the
 * sub-tab is UI-only Coming-Soon and reads no field here. A future
 * integration with real status would extend the same envelope with a sibling
 * key so the UI never has to branch on missing sections.
 *
 * Field semantics for the Telegram surface:
 *
 *   configured — `process.env.TG_BOT_TOKEN` is set on the API process.
 *                The web tier never sees the token itself; only the
 *                derived boolean leaves the API. A real activation will
 *                also flip this to true.
 *   bindings   — count of \`TelegramBinding\` rows with active=true.
 *                Drives the «Подключён / Не активно» badge in tandem
 *                with `configured` (badge is green only when both are
 *                truthy and bindings > 0).
 */
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

/**
 * Input schema for the admin smoke-test endpoint `admin.testTelegramSend`.
 *
 * The procedure exists only to prove the queue wiring (TelegramModule →
 * BullMQ → MockTelegramAdapter) end-to-end without an active bot. We
 * intentionally do NOT validate chatId as a numeric — Telegram chat ids
 * are large 64-bit integers, and the Prisma column type is TEXT, so we
 * pass through any non-empty trimmed string. `text` is capped at 4096
 * because that's the Telegram Bot API message-length cap.
 */
const MAX_TELEGRAM_CHAT_ID_LENGTH = 64;
const MAX_TELEGRAM_MESSAGE_LENGTH = 4096;

export const adminTestTelegramSendSchema = z.object({
  chatId: z.string().trim().min(1).max(MAX_TELEGRAM_CHAT_ID_LENGTH),
  text: z.string().trim().min(1).max(MAX_TELEGRAM_MESSAGE_LENGTH),
});

export type AdminTestTelegramSendInput = z.infer<
  typeof adminTestTelegramSendSchema
>;
