import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  createRuntimeLaneAssignment,
  type RuntimeLaneAssignment,
  runtimeLaneResources,
} from "../contracts/runtime-lane-contract.ts";
import { createRuntimeLaneRunIdentity } from "../profiles/runtime-lane-run-identity.ts";
import { initializeRuntimeLaneRun } from "../run-runtime-lanes.ts";
import { initializeRuntimeLaneResources } from "./runtime-lane-resource-initialization.ts";

const DIGEST = "a".repeat(64);
const SOURCE_SHA = "b".repeat(40);
const ROOT = "/Users/runtime-test/customreport-runtime-r92";

const assignment = (): RuntimeLaneAssignment =>
  createRuntimeLaneAssignment({
    artifact: "RUNTIME_LANE_ASSIGNMENT",
    version: 1,
    sourceSha: SOURCE_SHA,
    matrixDigest: DIGEST,
    mode: "one-cell",
    sourceArchiveRoot: ROOT,
    sourceArtifacts: {
      SOURCE: DIGEST,
      SOURCE_VALIDATION: DIGEST,
      PREFLIGHT: DIGEST,
      MATRIX: DIGEST,
      MANIFEST: DIGEST,
    },
    profiles: ["minimal"],
    lanes: runtimeLaneResources(4).map((resource) => ({
      ...resource,
      archiveRoot: `${ROOT}/lanes/one-cell/${resource.laneId}`,
      groups: [{ profile: "minimal", caseIds: [`case-${resource.laneId}`] }],
    })),
  });

const redisRunIds = (
  value: RuntimeLaneAssignment,
): ReadonlyMap<string, string> =>
  new Map(
    value.lanes.map(({ laneId, redisPort }) => [
      laneId,
      `redis-${String(redisPort)}`,
    ]),
  );

describe("runtime lane resource initialization", () => {
  beforeEach(() => {
    vi.stubEnv("NODE_ENV", "test");
    vi.stubEnv("PRISMA_USER_CONSENT_FOR_DANGEROUS_AI_ACTION", "давай");
    vi.stubEnv("RUNTIME_SWEEP_REDIS_RECREATE", "true");
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("recreates every canonical Redis before strict readiness", async () => {
    const value = assignment();
    const events: string[] = [];
    const expected = redisRunIds(value);
    const recreateRedis = vi.fn(() => {
      events.push("recreate");
      return Promise.resolve(new Map([["a", "container-a"]]));
    });
    const result = await initializeRuntimeLaneResources(
      {
        assignment: value,
        baseDatabaseUrl:
          "postgresql://user:secret@127.0.0.1:5432/customreport_e2e",
        redisRecreationAuthorized: true,
      },
      {
        recreateRedis,
        assertReadiness: vi.fn(() => {
          events.push("readiness");
          return Promise.resolve(expected);
        }),
      },
    );

    expect(result).toBe(expected);
    expect(events).toEqual(["recreate", "readiness"]);
    expect(recreateRedis).toHaveBeenCalledWith(
      value.lanes,
      expect.objectContaining({
        source: "RUNTIME_SWEEP_REDIS_RECREATE",
        value: "true",
      }),
    );
  });

  it("does not run readiness after a recreation identity failure", async () => {
    const assertReadiness = vi.fn();

    await expect(
      initializeRuntimeLaneResources(
        {
          assignment: assignment(),
          baseDatabaseUrl:
            "postgresql://user:secret@127.0.0.1:5432/customreport_e2e",
          redisRecreationAuthorized: true,
        },
        {
          recreateRedis: vi.fn(() =>
            Promise.reject(new Error("Redis container identity mismatch")),
          ),
          assertReadiness,
        },
      ),
    ).rejects.toThrow(/identity mismatch/u);
    expect(assertReadiness).not.toHaveBeenCalled();
  });

  it("propagates post-recreation readiness failure", async () => {
    await expect(
      initializeRuntimeLaneResources(
        {
          assignment: assignment(),
          baseDatabaseUrl:
            "postgresql://user:secret@127.0.0.1:5432/customreport_e2e",
          redisRecreationAuthorized: true,
        },
        {
          recreateRedis: vi.fn(() => Promise.resolve(new Map())),
          assertReadiness: vi.fn(() =>
            Promise.reject(new Error("Redis run_id is not distinct")),
          ),
        },
      ),
    ).rejects.toThrow(/run_id/u);
  });

  it("requires explicit recreation authorization before any Docker action", async () => {
    const recreateRedis = vi.fn();

    await expect(
      initializeRuntimeLaneResources(
        {
          assignment: assignment(),
          baseDatabaseUrl:
            "postgresql://user:secret@127.0.0.1:5432/customreport_e2e",
          redisRecreationAuthorized: false,
        },
        {
          recreateRedis,
          assertReadiness: vi.fn(),
        },
      ),
    ).rejects.toThrow(/RUNTIME_SWEEP_REDIS_RECREATE=true/u);
    expect(recreateRedis).not.toHaveBeenCalled();
  });

  it("does not create immutable run identity before all lane resources pass", async () => {
    const value = assignment();
    const expected = redisRunIds(value);
    const initializeResources = vi
      .fn()
      .mockRejectedValueOnce(new Error("lane b recreation interrupted"))
      .mockResolvedValueOnce(expected);
    const createRunIdentity = vi.fn(createRuntimeLaneRunIdentity);
    const prepareArchives = vi.fn(() => Promise.resolve());
    const input = {
      assignment: value,
      sourceAuthority: {
        expectedSource: {} as never,
        receiptFileSha256: DIGEST,
      },
      baseDatabaseUrl:
        "postgresql://user:secret@127.0.0.1:5432/customreport_e2e",
      redisRecreationAuthorized: true,
    };
    const dependencies = {
      prepareArchives,
      initializeResources,
      createRunIdentity,
    };

    await expect(initializeRuntimeLaneRun(input, dependencies)).rejects.toThrow(
      /lane b/u,
    );
    expect(createRunIdentity).not.toHaveBeenCalled();
    const result = await initializeRuntimeLaneRun(input, dependencies);

    expect(result.redisRunIds).toBe(expected);
    expect(result.run).toEqual(createRunIdentity.mock.results[0]?.value);
    expect(createRunIdentity).toHaveBeenCalledTimes(1);
    expect(prepareArchives).toHaveBeenCalledTimes(2);
  });

  it("does not initialize resources when source packet validation fails", async () => {
    const value = assignment();
    const initializeResources = vi.fn();
    const prepareArchives = vi.fn(() =>
      Promise.reject(new Error("copied receipt is not canonical")),
    );

    await expect(
      initializeRuntimeLaneRun(
        {
          assignment: value,
          sourceAuthority: {
            expectedSource: {} as never,
            receiptFileSha256: DIGEST,
          },
          baseDatabaseUrl:
            "postgresql://user:secret@127.0.0.1:5432/customreport_e2e",
          redisRecreationAuthorized: true,
        },
        {
          prepareArchives,
          initializeResources,
          createRunIdentity: vi.fn(),
        },
      ),
    ).rejects.toThrow(/receipt is not canonical/u);
    expect(initializeResources).not.toHaveBeenCalled();
  });
});
