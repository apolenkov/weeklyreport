// Phase 55 (UFB-056): TelegramAdapter — pluggable provider seam for the
// future Telegram bot. Seeds-only scaffolding: only the MockTelegramAdapter
// is implemented in this phase. The real provider (telegraf / grammY-backed
// adapter built on `TG_BOT_TOKEN`) is deferred to a follow-on phase that
// explicitly activates the bot.
//
// The shape follows the same single-method async adapter pattern used
// elsewhere in this codebase:
//   - one method, async, returns a small typed result
//   - selection via env at module-construction time
//   - DI token is a string literal because Nest cannot bind interfaces
//
// Why a separate seam (instead of folding into EmailService): Telegram has
// its own rate-limit, identity (chat_id), and failure mode (chat blocked,
// not muted). Keeping a dedicated port keeps the future real client small
// and lets us test the enqueue path against the mock without touching SMTP.

/**
 * Result of {@link TelegramAdapter.send}. Plain `{ ok }` flag for v1; the
 * future real adapter will widen this to carry rate-limit and message-id
 * fields once the org wires a real bot. Keeping the shape minimal here so
 * the mock and the eventual real implementation share the same surface.
 */
export interface TelegramSendResult {
  readonly ok: boolean;
}

/**
 * TelegramAdapter — the port every future Telegram provider must satisfy.
 *
 * @param chatId — Telegram chat id; canonical string form (Telegram returns
 *                 a numeric id but the column type is `TEXT` so we treat it
 *                 as opaque to avoid `bigint` headaches later).
 * @param text   — message body. Markdown / HTML parse mode is the adapter's
 *                 responsibility; the queue producer ships plain prose.
 */
export interface TelegramAdapter {
  send(chatId: string, text: string): Promise<TelegramSendResult>;
}

/**
 * Injection token for the TelegramAdapter port. Mirrors the `AI_ADAPTER`
 * pattern in `ai.adapter.ts` (Phase 54): consumers `@Inject(TELEGRAM_ADAPTER)`
 * to receive the concrete implementation selected by `TelegramModule`.
 */
export const TELEGRAM_ADAPTER = "TELEGRAM_ADAPTER" as const;
