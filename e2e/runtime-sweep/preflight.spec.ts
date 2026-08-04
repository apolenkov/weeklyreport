import * as path from "node:path";

import { expect, type Page, test } from "@playwright/test";

import { prisma } from "../integration/helpers/db.ts";
import { loginByCookie } from "../sweep/helpers/dev-auth.ts";
import type { CampaignMatrixState } from "./campaign-matrix.ts";
import {
  type PreflightRoute,
  runPlaywrightPreflight,
} from "./playwright-preflight.ts";
import { writePreflightArtifact } from "./preflight-artifact.ts";
import { createPrismaRuntimeStateDatabase } from "./prisma-state-database.ts";
import { actorForPermission } from "./runtime-matrix.ts";
import { readSourceArtifact } from "./source-artifact.ts";
import { prepareRuntimeState } from "./state-preparation.ts";

const requiredEnv = (name: string): string => {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`Runtime preflight requires ${name}`);
  return value;
};

const sourcePath = path.resolve(requiredEnv("RUNTIME_SWEEP_SOURCE"));
const preflightPath = path.resolve(requiredEnv("RUNTIME_SWEEP_PREFLIGHT"));
const databaseUrl = requiredEnv("E2E_DATABASE_URL");
const repoRoot = path.resolve(import.meta.dirname, "..", "..");

const loginForState = async (
  page: Page,
  state: CampaignMatrixState,
  route: PreflightRoute,
): Promise<void> => {
  const actor = actorForPermission(state.axes.permission, route.role);
  if (actor.role === null) {
    await page.context().clearCookies();
    return;
  }
  await loginByCookie(page, {
    role: actor.role,
    expectRole: actor.role,
    ...(actor.email === null ? {} : { email: actor.email }),
  });
};

test("preflight prepares and inventories every nominal source segment", async ({
  page,
}) => {
  const source = await readSourceArtifact(sourcePath);
  const database = createPrismaRuntimeStateDatabase(prisma);
  const artifact = await runPlaywrightPreflight({
    source,
    page,
    prepare: async (state, route) => {
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
        },
        database,
      );
      if (!prepared.observation.matches) {
        throw new Error(
          `State oracle mismatch before preflight navigation for ${state.stateId}: ${JSON.stringify(prepared.observation.mismatches)}`,
        );
      }
      await loginForState(page, state, route);
    },
  });
  await writePreflightArtifact(preflightPath, artifact);
  expect(artifact.segments).toHaveLength(source.plan.states.length);
  expect(artifact.sourceDigest).toBe(source.sourceDigest);
});
