import type { Page } from "@playwright/test";

import { reseedE2eDatabase } from "../../helpers/e2e-database-setup.ts";
import { prisma } from "../../integration/helpers/db.ts";
import { loginByCookie } from "../../sweep/helpers/dev-auth.ts";
import type { CampaignMatrixState } from "../matrix/campaign-matrix.ts";
import {
  actorForPermission,
  type RuntimeMatrixActor,
} from "../matrix/runtime-matrix.ts";
import { clearClientStorage } from "../replay/browser-state/client-storage.ts";
import type { SourceArtifact } from "../source/source-artifact.ts";
import { awaitRuntimeApiDrain } from "../support/runtime-api-drain.ts";
import {
  prepareRuntimeState,
  type RuntimeStateResetter,
} from "../support/state-preparation.ts";
import { provePreparedStateNonMutation } from "../support/state-preparation-nonmutation.ts";
import {
  type PreflightRoute,
  routeForState,
} from "./playwright-preflight-support.ts";
import type { RevealPreparation } from "./preflight-reveal-types.ts";
import {
  createPreflightSessionCache,
  createProfileSessionCacheRegistry,
  quiescePreflightStatePage,
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

const actorsForProfile = (
  source: SourceArtifact,
  profile: CampaignMatrixState["profile"],
): readonly RuntimeMatrixActor[] =>
  source.plan.states
    .filter((candidate) => candidate.profile === profile)
    .map(({ axes }) => actorForPermission(axes.permission, axes.role));

const resetProfileSessions = async (input: {
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

const prepareStateForPreflight = async (input: {
  readonly setup: PreflightRuntimeSetupInput;
  readonly state: CampaignMatrixState;
  readonly route: PreflightRoute;
  readonly database: ReturnType<typeof createPrismaRuntimeStateDatabase>;
}): Promise<Awaited<ReturnType<typeof prepareRuntimeState>>> =>
  prepareRuntimeState(
    {
      profile: input.state.profile,
      axes: {
        lifecycle: input.state.axes.lifecycle,
        submission: input.state.axes.submission,
        ownership: input.state.axes.ownershipDensity,
        permission: input.state.axes.permission,
      },
      databaseUrl: input.setup.databaseUrl,
      repoRoot: input.setup.repoRoot,
      routeTarget: input.route.target,
      routeRole: input.route.role,
      routeKey: `${input.route.role}:${input.route.catalogRoute}`,
    },
    input.database,
    (() => undefined) satisfies RuntimeStateResetter,
  );

const assertPreparedStateObservation = (
  state: CampaignMatrixState,
  prepared: Awaited<ReturnType<typeof prepareRuntimeState>>,
): void => {
  if (prepared.observation.matches) return;
  throw new Error(
    `State oracle mismatch before preflight navigation for ${state.stateId}: ${JSON.stringify(prepared.observation.mismatches)}`,
  );
};

/**
 * Creates the state preparation callback shared by full preflight and canary.
 * The callback owns reset, authentication, storage quiescence, and the DB
 * non-mutation proof used by reveal discovery.
 */
export type PreflightRuntimePreparation = (
  state: CampaignMatrixState,
  route: PreflightRoute,
  groupChanged: boolean,
) => Promise<RevealPreparation>;

export type PreflightRuntimePreparationWithBoundary =
  PreflightRuntimePreparation &
    Readonly<{
      readonly recreateDisposableBoundary: () => Promise<void>;
    }>;

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

  const prepare = async (
    state: CampaignMatrixState,
    route: PreflightRoute,
    groupChanged: boolean,
  ): Promise<RevealPreparation> => {
    await quiescePreflightStatePage(
      input.page,
      () => clearClientStorage(input.page),
      awaitApiDrain,
    );
    const profileSessions = await sessionsByProfile.get(state.profile);
    const resetRequired = groupChanged || profileSessions.created;
    const actors = actorsForProfile(input.source, state.profile);
    if (resetRequired) {
      await resetProfileSessions({
        setup: input,
        profile: state.profile,
        actors,
        sessions: profileSessions,
        clearPage: () => clearClientStorage(input.page),
        awaitApiDrain,
      });
    }
    const prepared = await prepareStateForPreflight({
      setup: input,
      state,
      route,
      database,
    });
    assertPreparedStateObservation(state, prepared);
    await profileSessions.cache.use(
      actorForPermission(state.axes.permission, route.role),
    );
    return {
      proveNonMutation: (action: () => Promise<void>) =>
        provePreparedStateNonMutation({
          database,
          prepared,
          settle: awaitApiDrain,
          action,
        }),
    };
  };

  const recreateDisposableBoundary = async (): Promise<void> => {
    const boundaryState = input.source.plan.states.at(0);
    if (boundaryState === undefined)
      throw new Error("Preflight source has no state for boundary recreation");
    await prepare(
      boundaryState,
      routeForState(input.source, boundaryState),
      true,
    );
  };

  return Object.assign(prepare, { recreateDisposableBoundary });
};
