import { spawn } from "node:child_process";
import { once } from "node:events";
import { mkdtemp, readdir, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import * as path from "node:path";

import { describe, expect, it } from "vitest";

import { sha256Hex, stableSerialize } from "../../../support/ids.ts";
import {
  assertOwnedProcessResult,
  type OwnedProcessReady,
  readyReceiptFor,
  writeArm,
} from "./preflight-nested-process-ownership-protocol.ts";

const DIGEST_LENGTH = 64;
const readyFor = (pid: number, cwd: string): OwnedProcessReady => ({
  version: 1,
  nonce: "n".repeat(DIGEST_LENGTH),
  pid,
  pgid: pid,
  sid: pid,
  uid: process.getuid?.() ?? 0,
  birth: "birth-fixture",
  start: "start-fixture",
  cwd,
  kind: "nested-playwright",
  registryEntryDigest: "a".repeat(DIGEST_LENGTH),
});

const stop = async (child: ReturnType<typeof spawn>): Promise<void> => {
  if (child.exitCode === null && child.signalCode === null)
    child.kill("SIGKILL");
  if (child.exitCode === null && child.signalCode === null)
    await once(child, "exit");
};

describe("nested process ownership protocol", () => {
  it("publishes a complete ARM receipt without a visible partial file", async () => {
    const root = await mkdtemp(path.join(tmpdir(), "owned-arm-atomic-"));
    const armPath = path.join(root, "owned.arm");
    try {
      const ready = readyFor(process.pid, process.cwd());
      const digest = await writeArm({
        armPath,
        nonce: ready.nonce,
        ready,
      });
      expect(JSON.parse(await readFile(armPath, "utf8"))).toEqual({
        nonce: ready.nonce,
        readyDigest: sha256Hex(ready),
        registryEntryDigest: ready.registryEntryDigest,
        version: 1,
      });
      expect(digest).toHaveLength(DIGEST_LENGTH);
      expect(await readdir(root)).toEqual(["owned.arm"]);
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });

  it.each([
    ["nonce", { nonce: "wrong" }],
    ["birth", { birth: "" }],
    ["cwd", { cwd: "/wrong" }],
    ["registry digest", { registryEntryDigest: "invalid" }],
  ] as const)("rejects a wrong %s before ARM", async (_label, drift) => {
    const root = await mkdtemp(path.join(tmpdir(), "owned-ready-negative-"));
    const child = spawn(
      process.execPath,
      ["-e", "setInterval(() => 0, 1000)"],
      {
        stdio: "ignore",
      },
    );
    try {
      if (child.pid === undefined) throw new Error("Fixture child has no pid");
      const readyPath = path.join(root, "READY.json");
      await writeFile(
        readyPath,
        `${stableSerialize({ ...readyFor(child.pid, process.cwd()), ...drift })}\n`,
        { mode: 0o600 },
      );
      await expect(
        readyReceiptFor({
          operationName: "ownership-negative",
          readyPath,
          child,
          nonce: "n".repeat(DIGEST_LENGTH),
          repoRoot: process.cwd(),
        }),
      ).rejects.toThrow(/ready identity drifted/iu);
    } finally {
      await stop(child);
      await rm(root, { recursive: true, force: true });
    }
  });

  it("rejects a missing or digest-mismatched RESULT", async () => {
    const root = await mkdtemp(path.join(tmpdir(), "owned-result-negative-"));
    const child = spawn(process.execPath, ["-e", ""], { stdio: "ignore" });
    try {
      if (child.pid === undefined) throw new Error("Fixture child has no pid");
      const ready = readyFor(child.pid, process.cwd());
      await once(child, "exit");
      const missing = path.join(root, "missing.result");
      await expect(
        assertOwnedProcessResult({
          operationName: "ownership-negative",
          resultPath: missing,
          ready,
          armDigest: "b".repeat(DIGEST_LENGTH),
          child,
        }),
      ).rejects.toThrow();
      const mismatched = path.join(root, "mismatched.result");
      await writeFile(
        mismatched,
        `${stableSerialize({
          exitCode: child.exitCode,
          signal: child.signalCode,
          readyDigest: sha256Hex(ready),
          armDigest: "c".repeat(DIGEST_LENGTH),
          registryEntryDigest: ready.registryEntryDigest,
        })}\n`,
      );
      await expect(
        assertOwnedProcessResult({
          operationName: "ownership-negative",
          resultPath: mismatched,
          ready,
          armDigest: "b".repeat(DIGEST_LENGTH),
          child,
        }),
      ).rejects.toThrow(/result identity drifted/iu);
    } finally {
      await stop(child);
      await rm(root, { recursive: true, force: true });
    }
  });
});
