-- CreateEnum
CREATE TYPE "AiInsightKind" AS ENUM ('summary', 'sentiment', 'on_track');

-- CreateTable
CREATE TABLE "AiInsight" (
    "id" TEXT NOT NULL,
    "kind" "AiInsightKind" NOT NULL,
    "contentHash" TEXT NOT NULL,
    "result" JSONB NOT NULL,
    "modelId" TEXT NOT NULL,
    "inputTokens" INTEGER NOT NULL DEFAULT 0,
    "outputTokens" INTEGER NOT NULL DEFAULT 0,
    "cacheCreationTokens" INTEGER NOT NULL DEFAULT 0,
    "cacheReadTokens" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AiInsight_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "AiInsight_kind_createdAt_idx" ON "AiInsight"("kind", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "AiInsight_kind_contentHash_key" ON "AiInsight"("kind", "contentHash");
