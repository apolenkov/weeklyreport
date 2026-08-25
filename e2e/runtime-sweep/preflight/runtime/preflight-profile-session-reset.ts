import { reseedE2eDatabase } from "../../../helpers/e2e-database-setup.ts";
import type { CampaignMatrixState } from "../../matrix/campaign-matrix.ts";
import {
  actorForPermission,
  type RuntimeMatrixActor,
} from "../../matrix/runtime-matrix.ts";
import type { SourceArtifact } from "../../source/source-artifact.ts";
import type { PreflightRuntimeSetupInput } from "./preflight-runtime-setup.ts";
import {
  createProfileSessionCacheRegistry,
  quiescePreflightStatePage,
} from "./preflight-session.ts";

export const actorsForProfile = (
  source: SourceArtifact,
  profile: CampaignMatrixState["profile"],
): readonly RuntimeMatrixActor[] =>
  source.plan.states
    .filter((candidate) => candidate.profile === profile)
    .map(({ axes }) => actorForPermission(axes.permission, axes.role));

export const resetProfileSessions = async (input: {
  readonly setup: PreflightRuntimeSetupInput;
  readonly profile: CampaignMatrixState["profile"];
  readonly actors: readonly RuntimeMatrixActor[];
  readonly sessions: Awaited<
    ReturnType<
      ReturnType<
        typeof createProfileSessionCacheRegistry<CampaignMatrixState["profile"]>
      >["get"]
    >
  >;
  readonly clearPage: () => Promise<void>;
  readonly awaitApiDrain: () => Promise<void>;
}): Promise<void> => {
  reseedE2eDatabase({
    databaseUrl: input.setup.databaseUrl,
    profile: input.profile,
    repoRoot: input.setup.repoRoot,
  });
  if (input.sessions.created) {
    await input.sessions.cache.authenticate(input.actors);
  } else {
    await input.sessions.cache.reauthenticate(input.actors);
  }
  await quiescePreflightStatePage(
    input.setup.page,
    input.clearPage,
    input.awaitApiDrain,
  );
};
