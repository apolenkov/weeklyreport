-- AlterTable: Item.stageName String? → stageNames String[]
ALTER TABLE "Item" DROP COLUMN IF EXISTS "stageName";
ALTER TABLE "Item" ADD COLUMN "stageNames" TEXT[] NOT NULL DEFAULT '{}';
DROP INDEX IF EXISTS "Item_stageName_idx";

-- AlterTable: Risk.stageName String? → stageNames String[]
ALTER TABLE "Risk" DROP COLUMN IF EXISTS "stageName";
ALTER TABLE "Risk" ADD COLUMN "stageNames" TEXT[] NOT NULL DEFAULT '{}';
DROP INDEX IF EXISTS "Risk_stageName_idx";

-- AlterTable: Decision.stageName String? → stageNames String[]
ALTER TABLE "Decision" DROP COLUMN IF EXISTS "stageName";
ALTER TABLE "Decision" ADD COLUMN "stageNames" TEXT[] NOT NULL DEFAULT '{}';
DROP INDEX IF EXISTS "Decision_stageName_idx";
