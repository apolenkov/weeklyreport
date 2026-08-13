import type { Page } from "@playwright/test";

import { prisma } from "../../../integration/helpers/db.ts";
import { loginByCookie } from "../../../sweep/helpers/dev-auth.ts";
import type { CampaignMatrixState } from "../../matrix/campaign-matrix.ts";
import type { RuntimeMatrixActor } from "../../matrix/runtime-matrix.ts";
import type { SourceArtifact } from "../../source/source-artifact.ts";
import { awaitRuntimeApiDrain } from "../../support/runtime-api-drain.ts";
import {
  createPreflightPreparation,
  type PreflightRuntimePreparationWithBoundary,
} from "./preflight-runtime-preparation.ts";
import {
  createPreflightSessionCache,
  createProfileSessionCacheRegistry,
} from "./preflight-session.ts";
import { createPrismaRuntimeStateDatabase } from "./prisma-state-database.ts";

export type PreflightRuntimeSetupInput = Readonly<{
  readonly source: SourceArtifact;
  readonly page: Page;
  readonly databaseUrl: string;
  readonly repoRoot: string;
  readonly apiUrl: string;
}>;

const loginForActor = async (
  page: Page,
  actor: RuntimeMatrixActor,
): Promise<void> => {
  if (actor.role === null) return;
  await loginByCookie(page, {
    role: actor.role,
    expectRole: actor.role,
    ...(actor.email === null ? {} : { email: actor.email }),
  });
};

export const createPreflightRuntimePreparation = (
  input: PreflightRuntimeSetupInput,
): PreflightRuntimePreparationWithBoundary => {
  const database = createPrismaRuntimeStateDatabase(prisma);
  const sessionsByProfile = createProfileSessionCacheRegistry<
    CampaignMatrixState["profile"]
  >(() =>
    Promise.resolve(
      createPreflightSessionCache(input.page.context(), (actor) =>
        loginForActor(input.page, actor),
      ),
    ),
  );
  const awaitApiDrain = (): Promise<void> => awaitRuntimeApiDrain(input.apiUrl);
  return createPreflightPreparation({
    setup: input,
    database,
    sessionsByProfile,
    awaitApiDrain,
  });
};

export { preflightPreparationKeyFor } from "./preflight-preparation-key.ts";
export type {
  PreflightRuntimePreparation,
  PreflightRuntimePreparationWithBoundary,
} from "./preflight-runtime-preparation.ts";
