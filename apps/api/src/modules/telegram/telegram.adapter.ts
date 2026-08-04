// Dedicated port: Telegram has its own rate-limit, chat_id identity, and
// failure modes (chat blocked). The DI token is a Symbol so Nest binds the
// interface through a value token, never a colliding string; chatId stays an
// opaque string to avoid bigint headaches.

export interface TelegramSendResult {
  readonly ok: boolean;
}

export interface TelegramAdapter {
  send(chatId: string, text: string): Promise<TelegramSendResult>;
}

export const TELEGRAM_ADAPTER = Symbol("TelegramAdapter");
