ALTER TABLE "AiPromptBundleRevision"
  ADD COLUMN "servingContractVersion" TEXT;

ALTER TABLE "AiPromptEvaluation"
  ADD COLUMN "servingContractVersion" TEXT;

DROP INDEX "AiPromptEvaluation_promptRevisionId_generationCompatibilityIdentity_contentHash_contractVersion_evaluatorVersion_key";

CREATE UNIQUE INDEX "AiPromptEvaluation_promptRevisionId_generationCompatibilityIdentity_contentHash_contractVersion_servingContractVersion_evaluatorVersion_key"
  ON "AiPromptEvaluation"("promptRevisionId", "generationCompatibilityIdentity", "contentHash", "contractVersion", "servingContractVersion", "evaluatorVersion");
