import type { Page } from "@playwright/test";

import { prisma } from "../integration/helpers/db.ts";
import { loginByCookie } from "../sweep/helpers/dev-auth.ts";
import { sha256Hex } from "./ids.ts";
import type { MatrixExecutableCase } from "./matrix-finalizer.ts";
import { createPrismaRuntimeStateDatabase } from "./prisma-state-database.ts";
import {
  actorForPermission,
  routeForState,
  type RuntimeMatrixSource,
} from "./runtime-matrix.ts";
import {
  type PreparedRuntimeState,
  prepareRuntimeState,
  type RuntimeStateResetter,
  type StatePreparationRequest,
} from "./state-preparation.ts";

export interface FrozenCaseLiveRuntime {
  readonly archiveRoot: string;
  readonly baseURL: string;
  readonly databaseUrl: string;
  readonly repoRoot: string;
}

export type MatrixState = RuntimeMatrixSource["plan"]["states"][number];

export const stateForCase = (matrixCase: MatrixExecutableCase): MatrixState => {
  const axes = {
    role: matrixCase.role,
    route: `${matrixCase.role}:${matrixCase.catalogRoute}`,
    ...matrixCase.state,
  };
  return {
    stateId: matrixCase.stateId,
    profile: matrixCase.profile,
    axes,
    pairwiseDigest: sha256Hex(axes),
  };
};

export const loginForCase = async (
  page: Page,
  matrixCase: MatrixExecutableCase,
): Promise<void> => {
  const actor = actorForPermission(
    matrixCase.state.permission,
    matrixCase.role,
  );
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

export const prepareCase = async (
  source: RuntimeMatrixSource,
  matrixCase: MatrixExecutableCase,
  runtime: FrozenCaseLiveRuntime,
  resetAndSeed?: RuntimeStateResetter,
): Promise<
  Readonly<{ state: MatrixState; prepared: PreparedRuntimeState }>
> => {
  const state = stateForCase(matrixCase);
  const route = routeForState(source, state);
  const request: StatePreparationRequest = {
    profile: matrixCase.profile,
    axes: {
      lifecycle: matrixCase.state.lifecycle,
      submission: matrixCase.state.submission,
      ownership: matrixCase.state.ownershipDensity,
      permission: matrixCase.state.permission,
    },
    databaseUrl: runtime.databaseUrl,
    repoRoot: runtime.repoRoot,
    routeTarget: route.target,
    routeRole: route.role,
    routeKey: state.axes.route,
  };
  const prepared = await prepareRuntimeState(
    request,
    createPrismaRuntimeStateDatabase(prisma),
    resetAndSeed,
  );
  if (!prepared.observation.matches)
    throw new Error(
      `State oracle mismatch before ${matrixCase.caseId}: ${JSON.stringify(prepared.observation.mismatches)}`,
    );
  return { state, prepared };
};
