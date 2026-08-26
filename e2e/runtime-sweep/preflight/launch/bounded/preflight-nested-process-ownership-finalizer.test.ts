import { mkdir, mkdtemp, readdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import * as path from "node:path";

import { describe, expect, it } from "vitest";

import { sha256Hex, stableSerialize } from "../../../support/ids.ts";
import { createNestedProcessOwnershipFixture } from "./preflight-nested-process-ownership.test-support.ts";
import {
  launchNestedOwnedProcess,
  nestedProcessOwnershipFor,
} from "./preflight-nested-process-ownership.ts";
import {
  childFor,
  commandScript,
  handshakeExists,
  inputFor,
  linesFor,
  registrationFailureRegistryScript,
} from "./preflight-nested-process-ownership-finalizer.test-support.ts";
import { createNestedProcessOwnershipFinalizer } from "./preflight-nested-process-ownership-finalizer.ts";

const DIGEST_LENGTH = 64;

describe("nested process ownership finalizer", () => {
  it("rolls back setup failure before gone assertion and removes no residue", async () => {
    const root = await mkdtemp(
      path.join(tmpdir(), "ownership-finalizer-abort-"),
    );
    const logPath = path.join(root, "commands.log");
    try {
      const fixture = await inputFor({ root, logPath });
      const finalizer = createNestedProcessOwnershipFinalizer(fixture.input);
      await expect(finalizer.abort(new Error("setup failed"))).rejects.toThrow(
        "setup failed",
      );
      await expect(linesFor(logPath)).resolves.toEqual([
        "signal:SIGTERM",
        "gone",
      ]);
      await expect(handshakeExists(fixture.paths)).resolves.toBe(false);
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });

  it("rolls back a registration failure after READY and leaves no handshake residue", async () => {
    const root = await mkdtemp(
      path.join(tmpdir(), "ownership-finalizer-registration-"),
    );
    try {
      const fixtureEnvironment =
        await createNestedProcessOwnershipFixture(root);
      const fixtureOwnership = nestedProcessOwnershipFor(
        "ownership-registration-test",
        fixtureEnvironment,
      );
      if (fixtureOwnership === undefined)
        throw new Error("Fixture ownership was not configured");
      const failingRegistryTool = path.join(root, "failing-registry.mjs");
      await writeFile(
        failingRegistryTool,
        registrationFailureRegistryScript(
          fixtureOwnership.registryTool,
          path.join(root, "failing-registry.log"),
        ),
        { mode: 0o600 },
      );
      const environment = {
        ...fixtureEnvironment,
        RUNTIME_SWEEP_NESTED_PROCESS_GROUP_REGISTRY_TOOL: failingRegistryTool,
      };
      const ownership = nestedProcessOwnershipFor(
        "ownership-registration-test",
        environment,
      );
      if (ownership === undefined)
        throw new Error("Failure fixture ownership was not configured");

      const launchFailure = await launchNestedOwnedProcess({
        operationName: "ownership-registration-test",
        ownership,
        command: process.execPath,
        args: ["-e", "setInterval(() => undefined, 1000)"],
        repoRoot: process.cwd(),
        environment,
      }).catch((error: unknown) => error);
      expect(launchFailure).toBeInstanceOf(Error);

      const residue = (await readdir(root)).filter((entry) =>
        /\.(?:ready|arm|result)$/u.test(entry),
      );
      expect(residue).toEqual([]);
    } finally {
      if (process.env.KEEP_OWNERSHIP_DEBUG !== "1")
        await rm(root, { recursive: true, force: true });
    }
  });

  it.each([
    ["normal", 0],
    ["nonzero", 17],
  ] as const)("validates RESULT for a %s exit", async (_label, exitCode) => {
    const root = await mkdtemp(
      path.join(tmpdir(), "ownership-finalizer-result-"),
    );
    const logPath = path.join(root, "commands.log");
    try {
      const fixture = await inputFor({
        root,
        logPath,
        child: childFor(exitCode),
      });
      const armDigest = "b".repeat(DIGEST_LENGTH);
      await writeFile(
        fixture.paths.armPath,
        `${stableSerialize({
          version: 1,
          nonce: fixture.fixtureReady.nonce,
          readyDigest: sha256Hex(fixture.fixtureReady),
          registryEntryDigest: fixture.fixtureReady.registryEntryDigest,
        })}\n`,
      );
      await writeFile(
        fixture.paths.resultPath,
        `${stableSerialize({
          armDigest,
          exitCode,
          readyDigest: sha256Hex(fixture.fixtureReady),
          registryEntryDigest: fixture.fixtureReady.registryEntryDigest,
          signal: null,
        })}\n`,
      );
      const finalizer = createNestedProcessOwnershipFinalizer({
        ...fixture.input,
        armDigest: () => armDigest,
      });
      await finalizer.close();
      await expect(linesFor(logPath)).resolves.toEqual(["gone"]);
      await expect(handshakeExists(fixture.paths)).resolves.toBe(false);
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });

  it("does not require RESULT after a successful birth-bound signal", async () => {
    const root = await mkdtemp(
      path.join(tmpdir(), "ownership-finalizer-signal-"),
    );
    const logPath = path.join(root, "commands.log");
    try {
      const fixture = await inputFor({ root, logPath });
      const finalizer = createNestedProcessOwnershipFinalizer(fixture.input);
      finalizer.signal("SIGTERM");
      await finalizer.close();
      await expect(linesFor(logPath)).resolves.toEqual([
        "signal:SIGTERM",
        "gone",
      ]);
      await expect(handshakeExists(fixture.paths)).resolves.toBe(false);
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });

  it("preserves a timeout as the primary error after ARM cleanup", async () => {
    const root = await mkdtemp(
      path.join(tmpdir(), "ownership-finalizer-timeout-"),
    );
    const logPath = path.join(root, "commands.log");
    try {
      const fixture = await inputFor({ root, logPath });
      const armDigest = "b".repeat(DIGEST_LENGTH);
      await writeFile(fixture.paths.armPath, "arm\n", { mode: 0o600 });
      const finalizer = createNestedProcessOwnershipFinalizer({
        ...fixture.input,
        armDigest: () => armDigest,
      });
      await expect(
        finalizer.abort(new Error("bounded operation timed out")),
      ).rejects.toThrow("bounded operation timed out");
      await expect(linesFor(logPath)).resolves.toEqual([
        "signal:SIGTERM",
        "gone",
      ]);
      await expect(handshakeExists(fixture.paths)).resolves.toBe(false);
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });

  it("retains handshake files when birth-bound rollback fails", async () => {
    const root = await mkdtemp(
      path.join(tmpdir(), "ownership-finalizer-failure-"),
    );
    const logPath = path.join(root, "commands.log");
    try {
      const fixture = await inputFor({
        root,
        logPath,
        failingRollback: true,
      });
      const finalizer = createNestedProcessOwnershipFinalizer(fixture.input);
      const failure = await finalizer
        .abort(new Error("setup failed"))
        .catch((error: unknown) => error);
      expect(failure).toBeInstanceOf(AggregateError);
      expect((failure as AggregateError).errors).toHaveLength(2);
      await expect(linesFor(logPath)).resolves.toEqual(["signal:SIGTERM"]);
      await expect(handshakeExists(fixture.paths)).resolves.toBe(true);
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });

  it("does not record a signal until the rollback command succeeds", async () => {
    const root = await mkdtemp(
      path.join(tmpdir(), "ownership-finalizer-retry-"),
    );
    const logPath = path.join(root, "commands.log");
    try {
      const fixture = await inputFor({
        root,
        logPath,
        failingRollback: true,
      });
      const finalizer = createNestedProcessOwnershipFinalizer(fixture.input);
      expect(() => finalizer.signal("SIGTERM")).toThrow();
      await writeFile(
        fixture.input.ownership.rollbackTool,
        commandScript(logPath, false),
        { mode: 0o600 },
      );
      expect(() => finalizer.signal("SIGTERM")).not.toThrow();
      await finalizer.close();
      await expect(linesFor(logPath)).resolves.toEqual([
        "signal:SIGTERM",
        "signal:SIGTERM",
        "gone",
      ]);
      await expect(handshakeExists(fixture.paths)).resolves.toBe(false);
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });

  it("does not remove handshake files until gone is proven", async () => {
    const root = await mkdtemp(
      path.join(tmpdir(), "ownership-finalizer-gone-"),
    );
    const logPath = path.join(root, "commands.log");
    try {
      const fixture = await inputFor({
        root,
        logPath,
        failingRegistry: true,
      });
      const finalizer = createNestedProcessOwnershipFinalizer(fixture.input);
      await expect(finalizer.abort(new Error("setup failed"))).rejects.toThrow(
        /cleanup failed/iu,
      );
      await expect(linesFor(logPath)).resolves.toEqual([
        "signal:SIGTERM",
        "gone",
      ]);
      await expect(handshakeExists(fixture.paths)).resolves.toBe(true);
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });

  it("reports cleanup failure together with the setup failure", async () => {
    const root = await mkdtemp(
      path.join(tmpdir(), "ownership-finalizer-cleanup-"),
    );
    const logPath = path.join(root, "commands.log");
    try {
      const fixture = await inputFor({ root, logPath });
      await mkdir(fixture.paths.armPath);
      const finalizer = createNestedProcessOwnershipFinalizer(fixture.input);
      const failure = await finalizer
        .abort(new Error("setup failed"))
        .catch((error: unknown) => error);
      expect(failure).toBeInstanceOf(AggregateError);
      expect((failure as AggregateError).errors).toHaveLength(2);
      await expect(linesFor(logPath)).resolves.toEqual([
        "signal:SIGTERM",
        "gone",
      ]);
      await expect(handshakeExists(fixture.paths)).resolves.toBe(true);
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });

  it("coalesces concurrent close calls and is idempotent after teardown", async () => {
    const root = await mkdtemp(
      path.join(tmpdir(), "ownership-finalizer-idempotent-"),
    );
    const logPath = path.join(root, "commands.log");
    try {
      const fixture = await inputFor({
        root,
        logPath,
        child: childFor(0),
      });
      const finalizer = createNestedProcessOwnershipFinalizer(fixture.input);
      await Promise.all([finalizer.close(), finalizer.close()]);
      await finalizer.close();
      await expect(linesFor(logPath)).resolves.toEqual(["gone"]);
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });
});
