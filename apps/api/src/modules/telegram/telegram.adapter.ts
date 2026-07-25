// Dedicated port: Telegram has its own rate-limit, chat_id identity, and
// failure modes (chat blocked). DI token is a string because Nest cannot
// bind interfaces; chatId stays opaque string to avoid bigint headaches.

export interface TelegramSendResult {
  readonly ok: boolean;
}

export interface TelegramAdapter {
  send(chatId: string, text: string): Promise<TelegramSendResult>;
}

export const TELEGRAM_ADAPTER = "TELEGRAM_ADAPTER" as const;
