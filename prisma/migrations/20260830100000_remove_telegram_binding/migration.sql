-- Telegram integration is not part of the current product surface.
-- The table was created by the initial migration but has no current writer.
-- Keep this migration append-only so existing databases converge safely.
DROP TABLE IF EXISTS "TelegramBinding";
