import * as path from "node:path";

import { expect, type Page, test } from "@playwright/test";

import { reseedE2eDatabase } from "../../helpers/e2e-database-setup.ts";
import { prisma } from "../../integration/helpers/db.ts";
import { loginByCookie } from "../../sweep/helpers/dev-auth.ts";
import type { CampaignMatrixState } from "../matrix/campaign-matrix.ts";
import {
  actorForPermission,
  type RuntimeMatrixActor,
} from "../matrix/runtime-matrix.ts";
import { clearClientStorage } from "../replay/browser-state/client-storage.ts";
import { readSourceArtifact } from "../source/source-artifact.ts";
import {
  prepareRuntimeState,
  type RuntimeStateResetter,
} from "../support/state-preparation.ts";
import { runPlaywrightPreflight } from "./playwright-preflight.ts";
import { writePreflightArtifact } from "./preflight-artifact.ts";
import {
  createPreflightSessionCache,
  createProfileSessionCacheRegistry,
  preflightGroupNeedsReset,
  preflightStateGroupKey,
  quiescePreflightPage,
} from "./preflight-session.ts";
import { createPrismaRuntimeStateDatabase } from "./prisma-state-database.ts";

const requiredEnv = (name: string): string => {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`Runtime preflight requires ${name}`);
  return value;
};

const sourcePath = path.resolve(requiredEnv("RUNTIME_SWEEP_SOURCE"));
const preflightPath = path.resolve(requiredEnv("RUNTIME_SWEEP_PREFLIGHT"));
const databaseUrl = requiredEnv("E2E_DATABASE_URL");
const repoRoot = path.resolve(import.meta.dirname, "..", "..", "..");

const loginForActor = async (
  page: Page,
  actor: RuntimeMatrixActor,
): Promise<void> => {
  if (actor.role === null) {
    return;
  }
  await loginByCookie(page, {
    role: actor.role,
    expectRole: actor.role,
    ...(actor.email === null ? {} : { email: actor.email }),
  });
};

const actorsForProfile = (
  source: Awaited<ReturnType<typeof readSourceArtifact>>,
  profile: CampaignMatrixState["profile"],
): readonly RuntimeMatrixActor[] =>
  source.plan.states
    .filter((candidate) => candidate.profile === profile)
    .map(({ axes }) => actorForPermission(axes.permission, axes.role));

test("preflight prepares and inventories every nominal source segment", async ({
  page,
}) => {
  const source = await readSourceArtifact(sourcePath);
  const database = createPrismaRuntimeStateDatabase(prisma);
  let preparedGroup: string | undefined;
  const sessionsByProfile = createProfileSessionCacheRegistry<
    CampaignMatrixState["profile"]
  >(() =>
    Promise.resolve(
      createPreflightSessionCache(page.context(), (actor) =>
        loginForActor(page, actor),
      ),
    ),
  );
  const artifact = await runPlaywrightPreflight({
    source,
    page,
    prepare: async (state, route) => {
      const group = preflightStateGroupKey(state, route);
      const profileSessions = await sessionsByProfile.get(state.profile);
      const resetRequired = preflightGroupNeedsReset(
        preparedGroup,
        group,
        profileSessions.created,
      );
      const actors = actorsForProfile(source, state.profile);
      if (resetRequired) {
        await quiescePreflightPage(page);
        reseedE2eDatabase({
          databaseUrl,
          profile: state.profile,
          repoRoot,
        });
        preparedGroup = group;
        if (profileSessions.created) {
          await profileSessions.cache.authenticate(actors);
        } else {
          await profileSessions.cache.reauthenticate(actors);
        }
      }
      const prepared = await prepareRuntimeState(
        {
          profile: state.profile,
          axes: {
            lifecycle: state.axes.lifecycle,
            submission: state.axes.submission,
            ownership: state.axes.ownershipDensity,
            permission: state.axes.permission,
          },
          databaseUrl,
          repoRoot,
          routeTarget: route.target,
          routeRole: route.role,
          routeKey: `${route.role}:${route.catalogRoute}`,
        },
        database,
        (() => undefined) satisfies RuntimeStateResetter,
      );
      if (!prepared.observation.matches) {
        throw new Error(
          `State oracle mismatch before preflight navigation for ${state.stateId}: ${JSON.stringify(prepared.observation.mismatches)}`,
        );
      }
      await profileSessions.cache.use(
        actorForPermission(state.axes.permission, route.role),
      );
      await clearClientStorage(page);
    },
  });
  await writePreflightArtifact(preflightPath, artifact);
  expect(artifact.segments).toHaveLength(source.plan.states.length);
  expect(artifact.sourceDigest).toBe(source.sourceDigest);
});
