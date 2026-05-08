-- Persistent mutation-level user action audit log.
-- The JSON/file audit stream remains canonical for SIEM-style log shipping;
-- this table gives product/admin flows a queryable in-app history keyed by the
-- same correlation id.
CREATE TYPE "UserActionStatus" AS ENUM ('success', 'fail');

CREATE TABLE "UserActionLog" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "role" "Role",
  "procedure" TEXT NOT NULL,
  "targetId" TEXT,
  "status" "UserActionStatus" NOT NULL,
  "reason" TEXT,
  "ip" TEXT,
  "correlationId" TEXT NOT NULL,
  "durationMs" INTEGER NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "UserActionLog_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "UserActionLog_userId_createdAt_idx" ON "UserActionLog"("userId", "createdAt" DESC);
CREATE INDEX "UserActionLog_procedure_createdAt_idx" ON "UserActionLog"("procedure", "createdAt" DESC);
CREATE INDEX "UserActionLog_correlationId_idx" ON "UserActionLog"("correlationId");
CREATE INDEX "UserActionLog_createdAt_idx" ON "UserActionLog"("createdAt" DESC);
