import { describe, expect, it } from "vitest";

import {
  runtimeLaneCountFrom,
  runtimeLaneDatabaseTargetVerificationSchema,
  runtimeLaneRedisTargetVerificationSchema,
  verifyRuntimeLaneDatabaseTargets,
  verifyRuntimeLaneRedisTargets,
} from "./runtime-lane-target-verification.ts";

describe("runtime lane target verification", () => {
  it("derives canonical database targets without authorizing mutation", () => {
    const result = verifyRuntimeLaneDatabaseTargets({
      baseDatabaseUrl:
        "postgresql://runtime:secret@127.0.0.1:5432/customreport_e2e",
      developerDatabaseUrl:
        "postgresql://developer:secret@localhost:5432/customreport_dev",
      laneCount: 3,
    });

    expect(result).toEqual({
      artifact: "RUNTIME_LANE_DATABASE_TARGET_VERIFICATION",
      version: 1,
      destructiveOperationsAllowed: false,
      laneCount: 3,
      targets: [
        {
          laneId: "a",
          database: "customreport_e2e_lane_a_test",
          host: "loopback",
          port: 5432,
        },
        {
          laneId: "b",
          database: "customreport_e2e_lane_b_test",
          host: "loopback",
          port: 5432,
        },
        {
          laneId: "c",
          database: "customreport_e2e_lane_c_test",
          host: "loopback",
          port: 5432,
        },
      ],
    });
  });

  it("rejects an alias of the developer database", () => {
    expect(() =>
      verifyRuntimeLaneDatabaseTargets({
        baseDatabaseUrl:
          "postgresql://runtime:secret@127.0.0.1/customreport_e2e",
        developerDatabaseUrl:
          "postgresql://developer:other@localhost/customreport_e2e_lane_a_test",
        laneCount: 1,
      }),
    ).toThrow(/must differ from DATABASE_URL/u);
  });

  it.each([
    "http://localhost/customreport_e2e",
    "postgresql://localhost/",
    "postgresql://localhost/customreport_e2e/extra",
  ])("rejects malformed database identity %s", (baseDatabaseUrl) => {
    expect(() =>
      verifyRuntimeLaneDatabaseTargets({
        baseDatabaseUrl,
        developerDatabaseUrl:
          "postgresql://developer@localhost/customreport_dev",
        laneCount: 1,
      }),
    ).toThrow(/E2E_DATABASE_URL/u);
  });

  it.each([
    "postgresql://runtime@127.0.0.1/customreport_e2e?host=db.example.com&port=6543",
    "postgresql://runtime@127.0.0.1/customreport_e2e#db.example.com",
    "postgresql://runtime@127.0.0.1/%70roduction_test",
  ])("rejects ambiguous or encoded database target %s", (baseDatabaseUrl) => {
    expect(() =>
      verifyRuntimeLaneDatabaseTargets({
        baseDatabaseUrl,
        developerDatabaseUrl:
          "postgresql://developer@localhost/customreport_dev",
        laneCount: 1,
      }),
    ).toThrow();
  });

  it("rejects extra fields in typed database evidence", () => {
    const result = verifyRuntimeLaneDatabaseTargets({
      baseDatabaseUrl: "postgresql://runtime@localhost/customreport_e2e",
      developerDatabaseUrl: "postgresql://developer@localhost/customreport_dev",
      laneCount: 1,
    });

    expect(() =>
      runtimeLaneDatabaseTargetVerificationSchema.parse({
        ...result,
        callerClaim: "PASS",
      }),
    ).toThrow();
  });

  it("rejects incomplete, reordered, and mismatched database evidence", () => {
    const result = verifyRuntimeLaneDatabaseTargets({
      baseDatabaseUrl: "postgresql://runtime@localhost/customreport_e2e",
      developerDatabaseUrl: "postgresql://developer@localhost/customreport_dev",
      laneCount: 3,
    });
    const [first, second, third] = result.targets;
    if (first === undefined || second === undefined || third === undefined)
      throw new Error("Expected three database targets");

    [
      { ...result, targets: [first] },
      { ...result, targets: [second, first, third] },
      {
        ...result,
        targets: [{ ...first, database: second.database }, second, third],
      },
      {
        ...result,
        targets: [first, { ...second, port: first.port + 1 }, third],
      },
    ].forEach((candidate) => {
      expect(() =>
        runtimeLaneDatabaseTargetVerificationSchema.parse(candidate),
      ).toThrow();
    });
  });

  it.each([
    "postgresql://runtime@db.internal/customreport_e2e",
    "postgresql://runtime@127.0.0.1/prod",
  ])("rejects unsafe database base %s", (baseDatabaseUrl) => {
    expect(() =>
      verifyRuntimeLaneDatabaseTargets({
        baseDatabaseUrl,
        developerDatabaseUrl:
          "postgresql://developer@localhost/customreport_dev",
        laneCount: 1,
      }),
    ).toThrow();
  });

  it("rejects production mode even for a canonical local target", () => {
    expect(() =>
      verifyRuntimeLaneDatabaseTargets({
        baseDatabaseUrl: "postgresql://runtime@localhost/customreport_e2e",
        developerDatabaseUrl:
          "postgresql://developer@localhost/customreport_dev",
        laneCount: 1,
        nodeEnv: "production",
      }),
    ).toThrow(/NODE_ENV=production/u);
  });

  it("derives canonical Redis targets without authorizing mutation", () => {
    const result = verifyRuntimeLaneRedisTargets({
      flushValue: "true",
      host: "127.0.0.1",
      laneCount: 3,
      recreationValue: "true",
    });

    expect(result).toEqual({
      artifact: "RUNTIME_LANE_REDIS_TARGET_VERIFICATION",
      version: 1,
      destructiveOperationsAllowed: false,
      recreationAuthorized: true,
      laneCount: 3,
      targets: [
        { laneId: "a", host: "127.0.0.1", port: 6381 },
        { laneId: "b", host: "127.0.0.1", port: 6382 },
        { laneId: "c", host: "127.0.0.1", port: 6383 },
      ],
    });
  });

  it("rejects extra fields in typed Redis evidence", () => {
    const result = verifyRuntimeLaneRedisTargets({
      flushValue: "true",
      host: "127.0.0.1",
      laneCount: 1,
      recreationValue: "true",
    });

    expect(() =>
      runtimeLaneRedisTargetVerificationSchema.parse({
        ...result,
        callerClaim: "PASS",
      }),
    ).toThrow();
  });

  it("rejects incomplete, reordered, and noncanonical Redis evidence", () => {
    const result = verifyRuntimeLaneRedisTargets({
      flushValue: "true",
      host: "127.0.0.1",
      laneCount: 3,
      recreationValue: "true",
    });
    const [first, second, third] = result.targets;
    if (first === undefined || second === undefined || third === undefined)
      throw new Error("Expected three Redis targets");

    [
      { ...result, targets: [first] },
      { ...result, targets: [second, first, third] },
      { ...result, targets: [first, { ...second, port: 9999 }, third] },
    ].forEach((candidate) => {
      expect(() =>
        runtimeLaneRedisTargetVerificationSchema.parse(candidate),
      ).toThrow();
    });
  });

  it.each([
    { flushValue: "false", host: "127.0.0.1", recreationValue: "true" },
    { flushValue: "true", host: "localhost", recreationValue: "true" },
    { flushValue: "true", host: "127.0.0.1", recreationValue: "TRUE" },
  ])("rejects unsafe Redis configuration %j", (input) => {
    expect(() =>
      verifyRuntimeLaneRedisTargets({ ...input, laneCount: 1 }),
    ).toThrow();
  });

  it.each(["0", "1.5", "16", "unknown"])(
    "rejects invalid lane count %s",
    (value) => expect(() => runtimeLaneCountFrom(value)).toThrow(/1 to 15/u),
  );
});
