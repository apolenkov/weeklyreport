-- AlterTable
ALTER TABLE "ReminderPolicy" ADD COLUMN     "validFrom" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN     "validUntil" TIMESTAMP(3);

-- CreateIndex
CREATE INDEX "ReminderPolicy_validFrom_validUntil_idx" ON "ReminderPolicy"("validFrom", "validUntil");
