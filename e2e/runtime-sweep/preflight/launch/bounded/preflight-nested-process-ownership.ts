import { type ChildProcess, spawn } from "node:child_process";
import { randomBytes } from "node:crypto";
import * as path from "node:path";

import {
  assertNestedProcessRegistered,
  createNestedProcessOwnershipFinalizer,
  type NestedProcessOwnershipHandle,
  type NestedProcessOwnershipPaths,
} from "./preflight-nested-process-ownership-finalizer.ts";
import {
  readyReceiptFor,
  writeArm,
} from "./preflight-nested-process-ownership-protocol.ts";

const NONCE_BYTES = 32;
const REGISTRY_FLAG = "--registry";
const EXPECTED_CWD_FLAG = "--expected-cwd";

const OWNERSHIP_ENV_KEYS = {
  launcher: "RUNTIME_SWEEP_NESTED_OWNED_COMMAND_LAUNCHER",
  registry: "RUNTIME_SWEEP_NESTED_PROCESS_GROUP_REGISTRY",
  registryTool: "RUNTIME_SWEEP_NESTED_PROCESS_GROUP_REGISTRY_TOOL",
  rollbackTool: "RUNTIME_SWEEP_NESTED_PROCESS_GROUP_ROLLBACK_TOOL",
  root: "RUNTIME_SWEEP_NESTED_PROCESS_OWNERSHIP_ROOT",
} as const;

export type NestedProcessOwnership = Readonly<{
  launcher: string;
  registry: string;
  registryTool: string;
  rollbackTool: string;
  root: string;
}>;

class NestedProcessOwnershipError extends Error {
  override readonly name = "NestedProcessOwnershipError";
}

const absoluteEnvironmentPath = (
  operationName: string,
  environment: NodeJS.ProcessEnv,
  key: (typeof OWNERSHIP_ENV_KEYS)[keyof typeof OWNERSHIP_ENV_KEYS],
): string | undefined => {
  const value = environment[key]?.trim();
  if (!value) return undefined;
  if (!path.isAbsolute(value))
    throw new NestedProcessOwnershipError(
      `${operationName} requires absolute ${key}`,
    );
  return value;
};

export const nestedProcessOwnershipFor = (
  operationName: string,
  environment: NodeJS.ProcessEnv,
): NestedProcessOwnership | undefined => {
  const values = Object.fromEntries(
    Object.entries(OWNERSHIP_ENV_KEYS).map(([name, key]) => [
      name,
      absoluteEnvironmentPath(operationName, environment, key),
    ]),
  ) as Record<keyof NestedProcessOwnership, string | undefined>;
  const configured = Object.values(values).filter(Boolean).length;
  if (configured === 0) return undefined;
  if (configured !== Object.keys(values).length)
    throw new NestedProcessOwnershipError(
      `${operationName} requires the complete nested process ownership environment`,
    );
  return values as NestedProcessOwnership;
};

type LaunchNestedOwnedProcessInput = Readonly<{
  readonly operationName: string;
  readonly ownership: NestedProcessOwnership;
  readonly command: string;
  readonly args: readonly string[];
  readonly repoRoot: string;
  readonly environment: NodeJS.ProcessEnv;
}>;

const spawnOwnedLauncher = (
  input: LaunchNestedOwnedProcessInput,
  paths: NestedProcessOwnershipPaths,
  nonce: string,
): ChildProcess =>
  spawn(
    process.execPath,
    [
      input.ownership.launcher,
      "--ready",
      paths.readyPath,
      "--arm",
      paths.armPath,
      "--result",
      paths.resultPath,
      REGISTRY_FLAG,
      input.ownership.registry,
      "--registry-tool",
      input.ownership.registryTool,
      EXPECTED_CWD_FLAG,
      input.repoRoot,
      "--nonce",
      nonce,
      "--kind",
      "nested-playwright",
      "--",
      input.command,
      ...input.args,
    ],
    {
      cwd: input.repoRoot,
      detached: true,
      env: input.environment,
      stdio: "inherit",
    },
  );

export const launchNestedOwnedProcess = async (
  input: LaunchNestedOwnedProcessInput,
): Promise<NestedProcessOwnershipHandle> => {
  const nonce = randomBytes(NONCE_BYTES).toString("hex");
  const instanceRoot = path.join(input.ownership.root, nonce);
  const paths = {
    readyPath: `${instanceRoot}.ready`,
    armPath: `${instanceRoot}.arm`,
    resultPath: `${instanceRoot}.result`,
  };
  const child = spawnOwnedLauncher(input, paths, nonce);
  const setup: {
    ready: Awaited<ReturnType<typeof readyReceiptFor>> | undefined;
    armDigest: string | undefined;
  } = { ready: undefined, armDigest: undefined };
  const finalizer = createNestedProcessOwnershipFinalizer({
    operationName: input.operationName,
    ownership: input.ownership,
    paths,
    child,
    repoRoot: input.repoRoot,
    ready: () => setup.ready,
    armDigest: () => setup.armDigest,
  });
  try {
    const ready = await readyReceiptFor({
      operationName: input.operationName,
      readyPath: paths.readyPath,
      child,
      nonce,
      repoRoot: input.repoRoot,
    });
    setup.ready = ready;
    assertNestedProcessRegistered({
      operationName: input.operationName,
      ownership: input.ownership,
      paths,
      repoRoot: input.repoRoot,
    });
    setup.armDigest = await writeArm({
      armPath: paths.armPath,
      nonce,
      ready,
    });
    return finalizer;
  } catch (error: unknown) {
    return finalizer.abort(error);
  }
};
