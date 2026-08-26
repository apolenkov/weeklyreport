import { mkdtemp, rm, writeFile } from "node:fs/promises";
import * as path from "node:path";

import { describe, expect, it, vi } from "vitest";

import { sha256Hex, stableSerialize } from "../../support/ids.ts";
import {
  fileDigest,
  LEASE_ARTIFACT,
  LEASE_VERSION,
} from "./preflight-persistent-server-lease.ts";

const SOURCE_SHA = "a".repeat(40);
const SOURCE_TREE = "b".repeat(40);
const CAMPAIGN_ID = "campaign-config-fixture";
const ATTEMPT_ID = "attempt-config-fixture";

vi.mock("../../source/runtime-source-authority.ts", () => ({
  assertRuntimeSourceAuthorityFromEnvironment: vi.fn(() =>
    Promise.resolve({
      source: {
        sourceSha: SOURCE_SHA,
        sourceTree: SOURCE_TREE,
        campaignId: CAMPAIGN_ID,
      },
    }),
  ),
}));

const serverFor = (name: "api" | "web", port: number, pid: number) => {
  const command = "/usr/bin/node";
  const cwd = `/tmp/${name}`;
  const args = [name, "--config-fixture"];
  return {
    name,
    host: "127.0.0.1",
    port,
    healthUrl:
      name === "api"
        ? `http://127.0.0.1:${String(port)}/health/ready`
        : `http://127.0.0.1:${String(port)}/`,
    pid,
    pgid: pid,
    uid: 501,
    startToken: `Wed Aug 26 17:00:0${String(pid % 10)} 2026`,
    cwd,
    command,
    args,
    commandDigest: sha256Hex({ command, cwd, args }),
  } as const;
};

const leaseText = (): string =>
  `${stableSerialize({
    artifact: LEASE_ARTIFACT,
    version: LEASE_VERSION,
    campaignId: CAMPAIGN_ID,
    attemptId: ATTEMPT_ID,
    sourceSha: SOURCE_SHA,
    sourceTree: SOURCE_TREE,
    sourceDigest: "c".repeat(64),
    createdAt: "2026-08-26T17:00:00.000Z",
    servers: [serverFor("api", 3102, 1001), serverFor("web", 3105, 1002)],
  })}
`;

const restoreEnvironment = (snapshot: NodeJS.ProcessEnv): void => {
  for (const key of Object.keys(process.env)) delete process.env[key];
  Object.assign(process.env, snapshot);
};

describe("persistent server lease Playwright wiring", () => {
  it("disables Playwright webServer only for a complete valid lease", async () => {
    const archiveRoot = await mkdtemp(
      path.join(process.cwd(), ".persistent-lease-config-"),
    );
    const snapshot = { ...process.env };
    const leasePath = path.join(archiveRoot, "PREFLIGHT_SERVER_LEASE.json");
    const text = leaseText();
    await writeFile(leasePath, text, { encoding: "utf8", mode: 0o600 });
    try {
      Object.assign(process.env, {
        E2E_API_PORT: "3102",
        E2E_DATABASE_URL: "postgresql://localhost/customreport_e2e",
        E2E_WEB_PORT: "3105",
        OTEL_EXPORTER_OTLP_ENDPOINT: "http://127.0.0.1:4318",
        OTEL_SERVICE_NAME: "config-fixture",
        OTEL_SERVICE_VERSION: SOURCE_SHA,
        PRISMA_USER_CONSENT_FOR_DANGEROUS_AI_ACTION: "давай",
        RUNTIME_SWEEP_ARCHIVE: archiveRoot,
        RUNTIME_SWEEP_PREFLIGHT_MODE: "canary",
        RUNTIME_SWEEP_PREFLIGHT_SERVER_LEASE: leasePath,
        RUNTIME_SWEEP_PREFLIGHT_SERVER_LEASE_SHA256: fileDigest(text),
        RUNTIME_SWEEP_PREFLIGHT_SOURCE_TREE: SOURCE_TREE,
        RUNTIME_SWEEP_PREFLIGHT_CAMPAIGN_ID: CAMPAIGN_ID,
        RUNTIME_SWEEP_PREFLIGHT_ATTEMPT_ID: ATTEMPT_ID,
        RUNTIME_SWEEP_PREFLIGHT_REVEAL_CONTINUATION_ATTEMPT_ID: ATTEMPT_ID,
        RUNTIME_SWEEP_SOURCE_SHA: SOURCE_SHA,
      });
      const { default: config } =
        await import("../playwright.preflight.config.ts");
      expect(config.webServer).toEqual([]);
    } finally {
      restoreEnvironment(snapshot);
      await rm(archiveRoot, { recursive: true, force: true });
    }
  });
});
