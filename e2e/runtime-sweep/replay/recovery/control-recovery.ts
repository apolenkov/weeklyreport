import { assertNonProdDestructiveTarget } from "../../../../prisma/guards/_destructive-guard.ts";
import { reseedE2eRuntimeState } from "../../../helpers/e2e-runtime-state-setup.js";
import type { SeedProfile } from "../../source/contracts.ts";

export interface ControlActionRecovery {
  readonly databaseUrl: string;
  readonly resetAndReseed: () => Promise<void>;
  readonly assertBaseline: () => Promise<void>;
}

export interface E2eControlRecoveryInput {
  readonly databaseUrl: string;
  readonly profile: SeedProfile;
  readonly repoRoot: string;
  readonly assertBaseline: () => Promise<void>;
}

export class ControlActionPolicyError extends Error {
  override readonly name = "ControlActionPolicyError";
}

export class ControlActionRecoveryError extends Error {
  override readonly name = "ControlActionRecoveryError";
}

const messageFrom = (error: unknown): string =>
  error instanceof Error ? error.message : "Unknown control-action failure";

export function assertDisposableE2eDatabase(
  databaseUrl: string,
  environment: Readonly<{
    readonly DATABASE_URL?: string;
    readonly NODE_ENV?: string;
    readonly ALLOW_PROD_DESTRUCTIVE?: string;
  }> = process.env,
): void {
  if (databaseUrl.trim() === "")
    throw new ControlActionPolicyError("E2E_DATABASE_URL must be set");
  if (databaseUrl === environment.DATABASE_URL)
    throw new ControlActionPolicyError(
      "E2E_DATABASE_URL must differ from DATABASE_URL",
    );
  assertNonProdDestructiveTarget("runtime-sweep-control-action", {
    ...environment,
    DATABASE_URL: databaseUrl,
  });
}

export function createE2eControlRecovery(
  input: E2eControlRecoveryInput,
): ControlActionRecovery {
  assertDisposableE2eDatabase(input.databaseUrl);
  return Object.freeze({
    databaseUrl: input.databaseUrl,
    resetAndReseed: (): Promise<void> =>
      reseedE2eRuntimeState({
        databaseUrl: input.databaseUrl,
        profile: input.profile,
        repoRoot: input.repoRoot,
      }),
    assertBaseline: input.assertBaseline,
  });
}

export async function recoverControlAction(
  recovery: ControlActionRecovery,
): Promise<void> {
  try {
    await recovery.resetAndReseed();
    await recovery.assertBaseline();
  } catch (error: unknown) {
    throw new ControlActionRecoveryError(
      `E2E reset/reseed or baseline oracle failed: ${messageFrom(error)}`,
      { cause: error },
    );
  }
}
