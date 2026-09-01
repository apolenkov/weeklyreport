import { describe, expect, it, vi } from "vitest";

import {
  type LocalBootstrapSpawn,
  runLocalBootstrap,
} from "./bootstrap-local.js";

const DATABASE_URL =
  "postgresql://customreport:localdev@127.0.0.1:5432/customreport_e2e";
const environment = {
  DATABASE_URL,
  E2E_DATABASE_URL: DATABASE_URL,
  NODE_ENV: "development",
  PRISMA_USER_CONSENT_FOR_DANGEROUS_AI_ACTION: "давай",
} as const;

const passingSpawn: LocalBootstrapSpawn = () => ({
  status: 0,
  signal: null,
});

describe("local disposable database bootstrap", () => {
  it.each([
    {
      ...environment,
      PRISMA_USER_CONSENT_FOR_DANGEROUS_AI_ACTION: "",
    },
    {
      ...environment,
      DATABASE_URL:
        "postgresql://customreport:localdev@127.0.0.1:5432/customreport_dev",
      E2E_DATABASE_URL:
        "postgresql://customreport:localdev@127.0.0.1:5432/customreport_dev",
    },
    {
      ...environment,
      E2E_DATABASE_URL:
        "postgresql://customreport:localdev@127.0.0.1:5432/customreport_e2e_lane_a_test",
    },
  ])("rejects unsafe input before spawning a child", (unsafeEnvironment) => {
    const spawn = vi.fn<LocalBootstrapSpawn>(passingSpawn);
    expect(() =>
      runLocalBootstrap("minimal", unsafeEnvironment, spawn),
    ).toThrow();
    expect(spawn).not.toHaveBeenCalled();
  });

  it("rejects a missing or unknown profile before spawning a child", () => {
    for (const profile of [undefined, "unknown"]) {
      const spawn = vi.fn<LocalBootstrapSpawn>(passingSpawn);
      expect(() => runLocalBootstrap(profile, environment, spawn)).toThrow(
        /Seed profile/u,
      );
      expect(spawn).not.toHaveBeenCalled();
    }
  });

  it("generates the client, creates, migrates, and seeds in order", () => {
    const spawn = vi.fn<LocalBootstrapSpawn>(passingSpawn);
    runLocalBootstrap("minimal", environment, spawn);
    expect(spawn).toHaveBeenCalledTimes(4);
    expect(spawn.mock.calls[0]?.slice(0, 2)).toEqual([
      "pnpm",
      ["--filter", "@customreport/api", "db:generate"],
    ]);
    expect(
      spawn.mock.calls
        .slice(1)
        .map(([, args]) => args.find((arg) => arg.endsWith(".ts"))),
    ).toEqual([
      expect.stringMatching(/create-e2e-database\.ts$/u),
      expect.stringMatching(/migrate-deploy\.ts$/u),
      expect.stringMatching(/seed-profile\.ts$/u),
    ]);
    expect(spawn.mock.calls[3]?.[1]).toContain("minimal");
  });

  it("stops before database work when client generation fails", () => {
    const spawn = vi
      .fn<LocalBootstrapSpawn>(passingSpawn)
      .mockReturnValueOnce({ status: 1, signal: null });
    expect(() => runLocalBootstrap("demo", environment, spawn)).toThrow(
      /db:generate failed/u,
    );
    expect(spawn).toHaveBeenCalledTimes(1);
  });

  it("stops before seed when migration fails", () => {
    const spawn = vi
      .fn<LocalBootstrapSpawn>(passingSpawn)
      .mockReturnValueOnce({ status: 0, signal: null })
      .mockReturnValueOnce({ status: 0, signal: null })
      .mockReturnValueOnce({ status: 1, signal: null });
    expect(() => runLocalBootstrap("demo", environment, spawn)).toThrow(
      /migrate-deploy\.ts failed/u,
    );
    expect(spawn).toHaveBeenCalledTimes(3);
  });
});
