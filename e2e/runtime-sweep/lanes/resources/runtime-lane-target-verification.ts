import { z } from "zod";

import {
  assertStrictNonProdDatabaseTarget,
  e2eDatabaseIdentity,
  sameE2eDatabaseTarget,
} from "../../../helpers/e2e-database-target.ts";
import { e2eRedisResetTarget } from "../../../helpers/e2e-redis-target.ts";
import { runtimeLaneDatabaseUrl } from "./runtime-lane-database-url.ts";
import {
  MAX_RUNTIME_LANE_COUNT,
  MIN_RUNTIME_LANE_COUNT,
  RUNTIME_LANE_IDS,
  runtimeLaneResources,
} from "./runtime-lane-resources.ts";

const laneIdSchema = z.enum(RUNTIME_LANE_IDS);
const laneCountSchema = z
  .number()
  .int()
  .min(MIN_RUNTIME_LANE_COUNT)
  .max(MAX_RUNTIME_LANE_COUNT);
const databaseTargetSchema = z
  .object({
    database: z.string().regex(/^customreport_e2e_lane_[a-o]_test$/u),
    host: z.literal("loopback"),
    laneId: laneIdSchema,
    port: z.number().int().positive(),
  })
  .strict();
const redisTargetSchema = z
  .object({
    host: z.literal("127.0.0.1"),
    laneId: laneIdSchema,
    port: z.number().int().positive(),
  })
  .strict();
const exactRuntimeLanePlan = <T>(
  laneCount: number,
  targets: readonly T[],
  resources: readonly ReturnType<typeof runtimeLaneResources>[number][],
  expected: (resource: ReturnType<typeof runtimeLaneResources>[number]) => T,
  matches: (target: T, expectedTarget: T) => boolean,
): boolean =>
  targets.length === laneCount &&
  resources.length === laneCount &&
  targets.every((target, index) => {
    const resource = resources[index];
    return resource !== undefined && matches(target, expected(resource));
  });

const databasePlanMatchesResources = (value: {
  readonly laneCount: number;
  readonly targets: readonly DatabaseTarget[];
}): boolean => {
  const verifiedPort = value.targets[0]?.port;
  if (verifiedPort === undefined) return false;
  return exactRuntimeLanePlan(
    value.laneCount,
    value.targets,
    runtimeLaneResources(value.laneCount),
    (resource) => ({
      laneId: resource.laneId,
      database: resource.databaseName,
      host: "loopback",
      port: verifiedPort,
    }),
    (target, expectedTarget) =>
      target.laneId === expectedTarget.laneId &&
      target.database === expectedTarget.database &&
      target.host === expectedTarget.host &&
      target.port === expectedTarget.port,
  );
};

const redisPlanMatchesResources = (value: {
  readonly laneCount: number;
  readonly targets: readonly z.infer<typeof redisTargetSchema>[];
}): boolean =>
  exactRuntimeLanePlan(
    value.laneCount,
    value.targets,
    runtimeLaneResources(value.laneCount),
    (resource) => ({
      laneId: resource.laneId,
      host: "127.0.0.1",
      port: resource.redisPort,
    }),
    (target, expectedTarget) =>
      target.laneId === expectedTarget.laneId &&
      target.host === expectedTarget.host &&
      target.port === expectedTarget.port,
  );

const runtimeLaneDatabaseEvidenceSchema = z
  .object({
    artifact: z.literal("RUNTIME_LANE_DATABASE_TARGET_VERIFICATION"),
    version: z.literal(1),
    destructiveOperationsAllowed: z.literal(false),
    laneCount: laneCountSchema,
    targets: z.array(databaseTargetSchema).min(1),
  })
  .strict()
  .superRefine((value, context) => {
    if (!databasePlanMatchesResources(value))
      context.addIssue({
        code: "custom",
        path: ["targets"],
        message:
          "Database targets must be the exact canonical runtime lane plan",
      });
  });
const runtimeLaneRedisEvidenceSchema = z
  .object({
    artifact: z.literal("RUNTIME_LANE_REDIS_TARGET_VERIFICATION"),
    version: z.literal(1),
    destructiveOperationsAllowed: z.literal(false),
    recreationAuthorized: z.literal(true),
    laneCount: laneCountSchema,
    targets: z.array(redisTargetSchema).min(1),
  })
  .strict()
  .superRefine((value, context) => {
    if (!redisPlanMatchesResources(value))
      context.addIssue({
        code: "custom",
        path: ["targets"],
        message: "Redis targets must be the exact canonical runtime lane plan",
      });
  });
export const runtimeLaneDatabaseTargetVerificationSchema =
  runtimeLaneDatabaseEvidenceSchema.readonly();
export const runtimeLaneRedisTargetVerificationSchema =
  runtimeLaneRedisEvidenceSchema.readonly();

type DatabaseTarget = z.infer<typeof databaseTargetSchema>;
export type RuntimeLaneDatabaseTargetVerification = z.infer<
  typeof runtimeLaneDatabaseTargetVerificationSchema
>;
export type RuntimeLaneRedisTargetVerification = z.infer<
  typeof runtimeLaneRedisTargetVerificationSchema
>;

export const runtimeLaneCountFrom = (value: string): number => {
  const laneCount = Number(value);
  if (
    !Number.isInteger(laneCount) ||
    laneCount < MIN_RUNTIME_LANE_COUNT ||
    laneCount > MAX_RUNTIME_LANE_COUNT
  )
    throw new Error(
      `Runtime target lane count must be an integer from ${MIN_RUNTIME_LANE_COUNT} to ${MAX_RUNTIME_LANE_COUNT}`,
    );
  return laneCount;
};

const databaseTarget = (
  baseDatabaseUrl: string,
  developerDatabaseUrl: string,
  nodeEnv: string | undefined,
  resource: ReturnType<typeof runtimeLaneResources>[number],
): DatabaseTarget => {
  const databaseUrl = runtimeLaneDatabaseUrl(
    baseDatabaseUrl,
    resource.databaseName,
  );
  if (sameE2eDatabaseTarget(databaseUrl, developerDatabaseUrl))
    throw new Error(
      `Runtime lane database ${resource.databaseName} must differ from DATABASE_URL`,
    );
  assertStrictNonProdDatabaseTarget(
    "runtime-lane-database-target-verification",
    databaseUrl,
    nodeEnv,
  );
  const identity = e2eDatabaseIdentity(databaseUrl);
  return databaseTargetSchema.parse({
    laneId: resource.laneId,
    database: resource.databaseName,
    host: identity.host,
    port: Number(identity.port),
  });
};

export const verifyRuntimeLaneDatabaseTargets = (
  input: Readonly<{
    baseDatabaseUrl: string;
    developerDatabaseUrl: string;
    laneCount: number;
    nodeEnv?: string;
  }>,
): RuntimeLaneDatabaseTargetVerification => {
  if (sameE2eDatabaseTarget(input.baseDatabaseUrl, input.developerDatabaseUrl))
    throw new Error("E2E_DATABASE_URL must differ from DATABASE_URL");
  assertStrictNonProdDatabaseTarget(
    "runtime-lane-database-target-verification",
    input.baseDatabaseUrl,
    input.nodeEnv,
  );
  return runtimeLaneDatabaseTargetVerificationSchema.parse({
    artifact: "RUNTIME_LANE_DATABASE_TARGET_VERIFICATION",
    version: 1,
    destructiveOperationsAllowed: false,
    laneCount: input.laneCount,
    targets: runtimeLaneResources(input.laneCount).map((resource) =>
      databaseTarget(
        input.baseDatabaseUrl,
        input.developerDatabaseUrl,
        input.nodeEnv,
        resource,
      ),
    ),
  });
};

export const verifyRuntimeLaneRedisTargets = (
  input: Readonly<{
    flushValue: string;
    host: string;
    laneCount: number;
    recreationValue: string;
  }>,
): RuntimeLaneRedisTargetVerification => {
  if (input.recreationValue !== "true")
    throw new Error(
      "Runtime lane Redis target verification requires RUNTIME_SWEEP_REDIS_RECREATE=true",
    );
  if (input.host !== "127.0.0.1")
    throw new Error(
      "Runtime lane Redis target verification requires REDIS_HOST=127.0.0.1",
    );
  const targets = runtimeLaneResources(input.laneCount).map((resource) => {
    const target = e2eRedisResetTarget({
      E2E_REDIS_FLUSH: input.flushValue,
      REDIS_HOST: input.host,
      REDIS_PORT: String(resource.redisPort),
      RUNTIME_SWEEP_ARCHIVE: "guard-only",
    });
    if (target === null)
      throw new Error("Runtime lane Redis target verification requires flush");
    if (target.host !== "127.0.0.1")
      throw new Error(
        "Runtime lane Redis target host changed after validation",
      );
    return {
      laneId: resource.laneId,
      host: target.host,
      port: target.port,
    };
  });
  return runtimeLaneRedisTargetVerificationSchema.parse({
    artifact: "RUNTIME_LANE_REDIS_TARGET_VERIFICATION",
    version: 1,
    destructiveOperationsAllowed: false,
    recreationAuthorized: true,
    laneCount: input.laneCount,
    targets,
  });
};
