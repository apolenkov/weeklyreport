-- AlterTable: add pinned flag to VersionSnapshot
-- Default false so existing rows are treated as unpinned.
ALTER TABLE "VersionSnapshot" ADD COLUMN "pinned" BOOLEAN NOT NULL DEFAULT false;
