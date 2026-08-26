import type { ChildProcess } from "node:child_process";
import { randomUUID } from "node:crypto";
import { link, open, readFile, rm } from "node:fs/promises";

import { sha256Hex, stableSerialize } from "../../../support/ids.ts";

const READY_POLL_MS = 20;
const ARM_DEADLINE_MS = 5000;
const PRIVATE_FILE_MODE = 0o600;

export type NestedProcessOwnershipPaths = Readonly<{
  readonly readyPath: string;
  readonly armPath: string;
  readonly resultPath: string;
}>;

export type OwnedProcessReady = Readonly<{
  version: 1;
  nonce: string;
  pid: number;
  pgid: number;
  sid: number;
  uid: number;
  birth: string;
  start: string;
  cwd: string;
  kind: "nested-playwright";
  registryEntryDigest: string;
}>;

class NestedProcessOwnershipProtocolError extends Error {
  override readonly name = "NestedProcessOwnershipProtocolError";
}

const parseReady = (
  operationName: string,
  text: string,
  expected: {
    readonly nonce: string;
    readonly pid: number;
    readonly cwd: string;
  },
): OwnedProcessReady => {
  const value: unknown = JSON.parse(text);
  if (
    typeof value !== "object" ||
    value === null ||
    Array.isArray(value) ||
    Object.keys(value)
      .sort((left, right) => left.localeCompare(right))
      .join(",") !==
      "birth,cwd,kind,nonce,pgid,pid,registryEntryDigest,sid,start,uid,version"
  )
    throw new NestedProcessOwnershipProtocolError(
      `${operationName} ownership ready receipt is not canonical`,
    );
  const ready = value as Partial<OwnedProcessReady>;
  if (
    ready.version !== 1 ||
    ready.nonce !== expected.nonce ||
    ready.pid !== expected.pid ||
    ready.pgid !== ready.pid ||
    ready.sid !== ready.pid ||
    ready.cwd !== expected.cwd ||
    ready.kind !== "nested-playwright" ||
    !Number.isSafeInteger(ready.uid) ||
    typeof ready.birth !== "string" ||
    ready.birth.length === 0 ||
    typeof ready.start !== "string" ||
    ready.start.length === 0 ||
    !/^[0-9a-f]{64}$/u.test(ready.registryEntryDigest ?? "")
  )
    throw new NestedProcessOwnershipProtocolError(
      `${operationName} ownership ready identity drifted`,
    );
  return ready as OwnedProcessReady;
};

const readyIfPresent = async (input: {
  readonly operationName: string;
  readonly readyPath: string;
  readonly nonce: string;
  readonly pid: number;
  readonly repoRoot: string;
}): Promise<OwnedProcessReady | undefined> => {
  try {
    return parseReady(
      input.operationName,
      await readFile(input.readyPath, "utf8"),
      { nonce: input.nonce, pid: input.pid, cwd: input.repoRoot },
    );
  } catch (error: unknown) {
    if (error instanceof Error && "code" in error && error.code === "ENOENT")
      return undefined;
    throw error;
  }
};

export const readyReceiptFor = async (input: {
  readonly operationName: string;
  readonly readyPath: string;
  readonly child: ChildProcess;
  readonly nonce: string;
  readonly repoRoot: string;
}): Promise<OwnedProcessReady> => {
  if (input.child.pid === undefined)
    throw new NestedProcessOwnershipProtocolError(
      `${input.operationName} ownership launcher has no pid`,
    );
  const deadline = Date.now() + ARM_DEADLINE_MS;
  const launchState: { error: unknown } = { error: undefined };
  const rememberLaunchError = (error: unknown): void => {
    launchState.error = error;
  };
  input.child.once("error", rememberLaunchError);
  try {
    while (Date.now() < deadline) {
      if (launchState.error !== undefined) throw launchState.error;
      if (input.child.exitCode !== null || input.child.signalCode !== null)
        throw new NestedProcessOwnershipProtocolError(
          `${input.operationName} ownership launcher exited before registration`,
        );
      const ready = await readyIfPresent({
        operationName: input.operationName,
        readyPath: input.readyPath,
        nonce: input.nonce,
        pid: input.child.pid,
        repoRoot: input.repoRoot,
      });
      if (ready !== undefined) return ready;
      await new Promise((resolve) => setTimeout(resolve, READY_POLL_MS));
    }
  } finally {
    input.child.removeListener("error", rememberLaunchError);
  }
  throw new NestedProcessOwnershipProtocolError(
    `${input.operationName} ownership launcher did not become ready`,
  );
};

export const writeArm = async (input: {
  readonly armPath: string;
  readonly nonce: string;
  readonly ready: OwnedProcessReady;
}): Promise<string> => {
  const body = {
    version: 1,
    nonce: input.nonce,
    readyDigest: sha256Hex(input.ready),
    registryEntryDigest: input.ready.registryEntryDigest,
  } as const;
  const temporaryPath = `${input.armPath}.${randomUUID()}.tmp`;
  const handle = await open(temporaryPath, "wx", PRIVATE_FILE_MODE);
  try {
    await handle.writeFile(`${stableSerialize(body)}\n`, "utf8");
    await handle.sync();
  } finally {
    await handle.close();
  }
  try {
    await link(temporaryPath, input.armPath);
  } finally {
    await rm(temporaryPath, { force: true });
  }
  return sha256Hex(body);
};

export const assertOwnedProcessResult = async (input: {
  readonly operationName: string;
  readonly resultPath: string;
  readonly ready: OwnedProcessReady;
  readonly armDigest: string;
  readonly child: ChildProcess;
}): Promise<void> => {
  const value: unknown = JSON.parse(await readFile(input.resultPath, "utf8"));
  if (
    typeof value !== "object" ||
    value === null ||
    Array.isArray(value) ||
    Object.keys(value)
      .sort((left, right) => left.localeCompare(right))
      .join(",") !== "armDigest,exitCode,readyDigest,registryEntryDigest,signal"
  )
    throw new NestedProcessOwnershipProtocolError(
      `${input.operationName} ownership result is not canonical`,
    );
  const result = value as Record<string, unknown>;
  if (
    result.readyDigest !== sha256Hex(input.ready) ||
    result.armDigest !== input.armDigest ||
    result.registryEntryDigest !== input.ready.registryEntryDigest ||
    result.exitCode !== input.child.exitCode ||
    result.signal !== input.child.signalCode
  )
    throw new NestedProcessOwnershipProtocolError(
      `${input.operationName} ownership result identity drifted`,
    );
};
