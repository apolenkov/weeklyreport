BEGIN;

ALTER TABLE "ReviewAcknowledgement" DROP CONSTRAINT "ReviewAcknowledgement_userId_fkey";
ALTER TABLE "SectionReview" DROP CONSTRAINT "SectionReview_reviewerId_fkey";
ALTER TABLE "RecordComment" DROP CONSTRAINT "RecordComment_reviewerId_fkey";

ALTER TABLE "ReviewAcknowledgement" ADD CONSTRAINT "ReviewAcknowledgement_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "SectionReview" ADD CONSTRAINT "SectionReview_reviewerId_fkey" FOREIGN KEY ("reviewerId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "RecordComment" ADD CONSTRAINT "RecordComment_reviewerId_fkey" FOREIGN KEY ("reviewerId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

COMMIT;
