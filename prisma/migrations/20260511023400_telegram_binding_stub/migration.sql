-- UFB-056 / Phase 55-1: TelegramBinding — opt-in link between a User and a
-- Telegram `chat_id`. Seeds-only scaffolding for Phase 55: the table is
-- created so a future bot can persist /start handshakes without another
-- migration, but no producer writes to it yet. `active=false` lets a user
-- mute Telegram delivery without losing the binding (mirrors
-- `notificationOptOut` on User for the email channel).
--
-- Indices:
--   - UNIQUE(userId)  — one Telegram identity per CustomReport user
--   - UNIQUE(chatId)  — one CustomReport user per Telegram chat
--   - (active, linkedAt) supports the admin Integrations status query
--     (`count where active=true`) without a sequential scan.
--
-- Additive migration only. No drops, no NOT NULL on existing tables.

-- CreateTable
CREATE TABLE "TelegramBinding" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "chatId" TEXT NOT NULL,
    "linkedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "lastSeenAt" TIMESTAMP(3),

    CONSTRAINT "TelegramBinding_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "TelegramBinding_userId_key" ON "TelegramBinding"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "TelegramBinding_chatId_key" ON "TelegramBinding"("chatId");

-- CreateIndex
CREATE INDEX "TelegramBinding_active_linkedAt_idx" ON "TelegramBinding"("active", "linkedAt");

-- AddForeignKey
ALTER TABLE "TelegramBinding" ADD CONSTRAINT "TelegramBinding_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
