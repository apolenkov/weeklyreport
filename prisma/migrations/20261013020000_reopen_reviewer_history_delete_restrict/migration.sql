ALTER TABLE "ReopenRequest"
    DROP CONSTRAINT "ReopenRequest_reviewedById_fkey",
    ADD CONSTRAINT "ReopenRequest_reviewedById_fkey"
        FOREIGN KEY ("reviewedById") REFERENCES "User"("id")
        ON DELETE RESTRICT ON UPDATE CASCADE;
