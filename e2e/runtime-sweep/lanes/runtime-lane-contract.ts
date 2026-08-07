import path from "node:path";

import { z } from "zod";

import {
  seedProfileSchema,
  sha256DigestSchema,
  sourceShaSchema,
} from "../source/contracts.ts";
import { freezeDeep } from "../source/manifest-source.ts";
import { sha256Hex } from "../support/ids.ts";

export const RUNTIME_LANE_IDS = ["a", "b", "c"] as const;

const MIN_SERVICE_PORT = 1024;
const MAX_TCP_PORT = 65_535;
const MAX_SHARD_CASES = 32;
const laneIdSchema = z.enum(RUNTIME_LANE_IDS);
const portSchema = z.number().int().min(MIN_SERVICE_PORT).max(MAX_TCP_PORT);
const caseGroupSchema = z
  .object({
    profile: seedProfileSchema,
    caseIds: z.array(z.string().min(1)).min(1).readonly(),
  })
  .strict();
const laneSchema = z
  .object({
    laneId: laneIdSchema,
    databaseName: z.string().regex(/^customreport_e2e_lane_[abc]_test$/u),
    redisPort: portSchema,
    apiPort: portSchema,
    webPort: portSchema,
    archiveRoot: z.string().min(1),
    groups: z.array(caseGroupSchema).readonly(),
  })
  .strict();
const sourceArtifactsSchema = z
  .object({
    SOURCE: sha256DigestSchema,
    PREFLIGHT: sha256DigestSchema,
    MATRIX: sha256DigestSchema,
    MANIFEST: sha256DigestSchema,
  })
  .strict();
const assignmentBodySchema = z
  .object({
    artifact: z.literal("RUNTIME_LANE_ASSIGNMENT"),
    version: z.literal(1),
    sourceSha: sourceShaSchema,
    matrixDigest: sha256DigestSchema,
    mode: z.enum(["one-cell", "one-shard", "full"]),
    sourceArchiveRoot: z.string().min(1),
    sourceArtifacts: sourceArtifactsSchema,
    profiles: z.array(seedProfileSchema).min(1).readonly(),
    lanes: z.array(laneSchema).length(RUNTIME_LANE_IDS.length).readonly(),
  })
  .strict();
const runtimeLaneAssignmentSchema = assignmentBodySchema
  .extend({ assignmentDigest: sha256DigestSchema })
  .strict();

export type RuntimeLaneAssignment = z.infer<typeof runtimeLaneAssignmentSchema>;
export type RuntimeLane = RuntimeLaneAssignment["lanes"][number];
export type RuntimeLaneMode = RuntimeLaneAssignment["mode"];

class RuntimeLaneAssignmentError extends Error {
  override readonly name = "RuntimeLaneAssignmentError";
}

const bodyFor = (
  assignment: RuntimeLaneAssignment,
): z.infer<typeof assignmentBodySchema> => {
  const { assignmentDigest: _assignmentDigest, ...body } = assignment;
  return body;
};

const allCaseIds = (assignment: RuntimeLaneAssignment): readonly string[] =>
  assignment.lanes.flatMap(({ groups }) =>
    groups.flatMap(({ caseIds }) => caseIds),
  );

const EXPECTED_RESOURCES = {
  a: {
    databaseName: "customreport_e2e_lane_a_test",
    redisPort: 6381,
    apiPort: 3112,
    webPort: 3115,
  },
  b: {
    databaseName: "customreport_e2e_lane_b_test",
    redisPort: 6382,
    apiPort: 3122,
    webPort: 3125,
  },
  c: {
    databaseName: "customreport_e2e_lane_c_test",
    redisPort: 6383,
    apiPort: 3132,
    webPort: 3135,
  },
} as const;

const inside = (root: string, candidate: string): boolean =>
  candidate !== root && candidate.startsWith(`${root}${path.sep}`);

const overlap = (left: string, right: string): boolean =>
  inside(left, right) || inside(right, left);

const assertArchiveRoots = (assignment: RuntimeLaneAssignment): void => {
  const sourceRoot = path.resolve(assignment.sourceArchiveRoot);
  if (
    !path.isAbsolute(assignment.sourceArchiveRoot) ||
    sourceRoot !== assignment.sourceArchiveRoot ||
    sourceRoot === path.parse(sourceRoot).root
  )
    throw new RuntimeLaneAssignmentError(
      "Source archive root must be a normalized absolute non-root path",
    );
  const laneRoots = assignment.lanes.map(({ archiveRoot }) => archiveRoot);
  laneRoots.forEach((laneRoot) => {
    if (
      !path.isAbsolute(laneRoot) ||
      path.resolve(laneRoot) !== laneRoot ||
      !inside(sourceRoot, laneRoot)
    )
      throw new RuntimeLaneAssignmentError(
        "Every lane archive must be a normalized child of the source archive",
      );
  });
  if (
    laneRoots.some((laneRoot, index) =>
      laneRoots.slice(index + 1).some((other) => overlap(laneRoot, other)),
    )
  )
    throw new RuntimeLaneAssignmentError("Lane archive roots must not overlap");
};

const unique = (values: readonly unknown[]): boolean =>
  new Set(values).size === values.length;

const assertUniqueResources = (assignment: RuntimeLaneAssignment): void => {
  if (!unique(assignment.lanes.map(({ laneId }) => laneId)))
    throw new RuntimeLaneAssignmentError("Lane ids must be unique");
  if (!unique(assignment.lanes.map(({ databaseName }) => databaseName)))
    throw new RuntimeLaneAssignmentError("Lane database names must be unique");
  if (!unique(assignment.lanes.map(({ redisPort }) => redisPort)))
    throw new RuntimeLaneAssignmentError("Lane Redis ports must be unique");
  if (!unique(assignment.lanes.map(({ apiPort }) => apiPort)))
    throw new RuntimeLaneAssignmentError("Lane API ports must be unique");
  if (!unique(assignment.lanes.map(({ webPort }) => webPort)))
    throw new RuntimeLaneAssignmentError("Lane web ports must be unique");
  if (!unique(assignment.lanes.map(({ archiveRoot }) => archiveRoot)))
    throw new RuntimeLaneAssignmentError("Lane archive roots must be unique");
  const ports = assignment.lanes.flatMap(({ redisPort, apiPort, webPort }) => [
    redisPort,
    apiPort,
    webPort,
  ]);
  if (!unique(ports))
    throw new RuntimeLaneAssignmentError(
      "Redis, API, and web ports must be globally unique",
    );
};

const assertCanonicalResources = (assignment: RuntimeLaneAssignment): void => {
  assignment.lanes.forEach((lane) => {
    const expected = EXPECTED_RESOURCES[lane.laneId];
    if (
      lane.databaseName !== expected.databaseName ||
      lane.redisPort !== expected.redisPort ||
      lane.apiPort !== expected.apiPort ||
      lane.webPort !== expected.webPort
    )
      throw new RuntimeLaneAssignmentError(
        `Lane ${lane.laneId} does not use its canonical resource tuple`,
      );
  });
  if (
    assignment.lanes.some(
      (lane, index) => lane.laneId !== RUNTIME_LANE_IDS[index],
    )
  )
    throw new RuntimeLaneAssignmentError(
      "Runtime lanes must use canonical a, b, c order",
    );
  if (!unique(assignment.profiles))
    throw new RuntimeLaneAssignmentError("Assignment profiles must be unique");
};

const assertModeShape = (assignment: RuntimeLaneAssignment): void => {
  assignment.lanes.forEach((lane) => {
    if (
      lane.groups.some(({ profile }) => !assignment.profiles.includes(profile))
    )
      throw new RuntimeLaneAssignmentError(
        `Lane ${lane.laneId} contains an undeclared profile`,
      );
    const laneCaseCount = lane.groups.reduce(
      (total, { caseIds }) => total + caseIds.length,
      0,
    );
    if (assignment.mode === "one-cell" && laneCaseCount !== 1)
      throw new RuntimeLaneAssignmentError(
        `One-cell canary lane ${lane.laneId} must contain exactly one case`,
      );
    if (
      assignment.mode === "one-shard" &&
      (lane.groups.length !== 1 ||
        laneCaseCount < 1 ||
        laneCaseCount > MAX_SHARD_CASES)
    )
      throw new RuntimeLaneAssignmentError(
        `One-shard canary lane ${lane.laneId} must contain one frozen shard`,
      );
    if (assignment.mode === "full" && laneCaseCount === 0)
      throw new RuntimeLaneAssignmentError(
        `Full assignment lane ${lane.laneId} must not be empty`,
      );
  });
};

const assertAssignmentSemantics = (assignment: RuntimeLaneAssignment): void => {
  assertUniqueResources(assignment);
  assertCanonicalResources(assignment);
  assertModeShape(assignment);
  assertArchiveRoots(assignment);
  const caseIds = allCaseIds(assignment);
  if (!unique(caseIds))
    throw new RuntimeLaneAssignmentError(
      "A frozen case may be assigned to exactly one lane",
    );
};

export const parseRuntimeLaneAssignment = (
  value: unknown,
): RuntimeLaneAssignment => {
  const assignment = runtimeLaneAssignmentSchema.parse(value);
  if (sha256Hex(bodyFor(assignment)) !== assignment.assignmentDigest)
    throw new RuntimeLaneAssignmentError(
      "Runtime lane assignment digest does not match its contents",
    );
  assertAssignmentSemantics(assignment);
  return freezeDeep(assignment);
};

export const createRuntimeLaneAssignment = (
  body: z.input<typeof assignmentBodySchema>,
): RuntimeLaneAssignment => {
  const parsedBody = assignmentBodySchema.parse(body);
  return parseRuntimeLaneAssignment({
    ...parsedBody,
    assignmentDigest: sha256Hex(parsedBody),
  });
};
