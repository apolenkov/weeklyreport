import { createHash } from "node:crypto";
import { lstat, readFile } from "node:fs/promises";
import * as path from "node:path";

import { sha256Hex } from "../../support/ids.ts";

export const PREFLIGHT_SERVER_LEASE_ENV =
  "RUNTIME_SWEEP_PREFLIGHT_SERVER_LEASE" as const;
export const PREFLIGHT_SERVER_LEASE_SHA_ENV =
  "RUNTIME_SWEEP_PREFLIGHT_SERVER_LEASE_SHA256" as const;
export const PREFLIGHT_SERVER_LEASE_SOURCE_TREE_ENV =
  "RUNTIME_SWEEP_PREFLIGHT_SOURCE_TREE" as const;
export const PREFLIGHT_SERVER_LEASE_CAMPAIGN_ENV =
  "RUNTIME_SWEEP_PREFLIGHT_CAMPAIGN_ID" as const;
export const PREFLIGHT_SERVER_LEASE_ATTEMPT_ENV =
  "RUNTIME_SWEEP_PREFLIGHT_ATTEMPT_ID" as const;

export const LEASE_ARTIFACT = "PREFLIGHT_SERVER_LEASE" as const;
export const LEASE_VERSION = 1 as const;
export const LOOPBACK_HOST = "127.0.0.1" as const;

const SHA40 = /^[0-9a-f]{40}$/u;
const SHA64 = /^[0-9a-f]{64}$/u;
const PRIVATE_FILE_MODE_MASK = 0o077;
export type PersistentServerName = "api" | "web";

export type PersistentServerLeaseServer = Readonly<{
  readonly name: PersistentServerName;
  readonly host: typeof LOOPBACK_HOST;
  readonly port: number;
  readonly healthUrl: string;
  readonly pid: number;
  readonly pgid: number;
  readonly uid: number;
  readonly startToken: string;
  readonly cwd: string;
  readonly command: string;
  readonly args: readonly string[];
  readonly commandDigest: string;
}>;

export type PersistentServerLease = Readonly<{
  readonly artifact: typeof LEASE_ARTIFACT;
  readonly version: typeof LEASE_VERSION;
  readonly campaignId: string;
  readonly attemptId: string;
  readonly sourceSha: string;
  readonly sourceTree: string;
  readonly sourceDigest: string;
  readonly createdAt: string;
  readonly servers: readonly [
    PersistentServerLeaseServer,
    PersistentServerLeaseServer,
  ];
}>;

export type PersistentServerLeaseExpected = Readonly<{
  readonly campaignId: string;
  readonly attemptId: string;
  readonly sourceSha: string;
  readonly sourceTree: string;
  readonly apiPort: number;
  readonly webPort: number;
}>;

export type PersistentServerLeaseProbe = Readonly<{
  readonly processGroup?: (server: PersistentServerLeaseServer) => void;
  readonly listener?: (server: PersistentServerLeaseServer) => void;
  readonly health?: (server: PersistentServerLeaseServer) => Promise<void>;
}>;

export type PersistentServerLeaseFile = Readonly<{
  readonly lease: PersistentServerLease;
  readonly digest: string;
}>;

export type PersistentServerLeaseHandle = Readonly<{
  readonly path: string;
  readonly digest: string;
  readonly lease: PersistentServerLease;
  readonly environment: NodeJS.ProcessEnv;
  readonly assertLive: () => Promise<void>;
  readonly close: () => Promise<void>;
}>;

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const requiredString = (value: unknown, name: string): string => {
  if (typeof value !== "string" || value.trim() === "")
    throw new Error(
      `Persistent server lease ${name} must be a non-empty string`,
    );
  return value;
};

const requiredSha = (value: unknown, name: string, pattern: RegExp): string => {
  const result = requiredString(value, name);
  if (!pattern.test(result))
    throw new Error(`Persistent server lease ${name} has an invalid digest`);
  return result;
};

const requiredPositiveInteger = (value: unknown, name: string): number => {
  if (!Number.isSafeInteger(value) || (value as number) <= 0)
    throw new Error(
      `Persistent server lease ${name} must be a positive integer`,
    );
  return value as number;
};

const requiredNonNegativeInteger = (value: unknown, name: string): number => {
  if (!Number.isSafeInteger(value) || (value as number) < 0)
    throw new Error(
      `Persistent server lease ${name} must be a non-negative integer`,
    );
  return value as number;
};

const assertKeys = (
  value: Record<string, unknown>,
  allowed: readonly string[],
  name: string,
): void => {
  const unknown = Object.keys(value).filter((key) => !allowed.includes(key));
  if (unknown.length > 0)
    throw new Error(
      `Persistent server lease ${name} contains unknown fields: ${unknown.join(",")}`,
    );
};

const parseServer = (value: unknown): PersistentServerLeaseServer => {
  if (!isRecord(value))
    throw new Error("Persistent server lease server is invalid");
  assertKeys(
    value,
    [
      "name",
      "host",
      "port",
      "healthUrl",
      "pid",
      "pgid",
      "uid",
      "startToken",
      "cwd",
      "command",
      "args",
      "commandDigest",
    ],
    "server",
  );
  const name = value.name;
  if (name !== "api" && name !== "web")
    throw new Error("Persistent server lease server name is invalid");
  if (value.host !== LOOPBACK_HOST)
    throw new Error("Persistent server lease server host must be loopback");
  const port = requiredPositiveInteger(value.port, "server.port");
  const pid = requiredPositiveInteger(value.pid, "server.pid");
  const pgid = requiredPositiveInteger(value.pgid, "server.pgid");
  if (pid !== pgid)
    throw new Error("Persistent server lease leader pid and pgid must match");
  const uid = requiredNonNegativeInteger(value.uid, "server.uid");
  const argsValue: unknown = value.args;
  if (
    !Array.isArray(argsValue) ||
    !argsValue.every((arg): arg is string => typeof arg === "string")
  )
    throw new Error("Persistent server lease server args are invalid");
  const args: string[] = argsValue;
  const command = requiredString(value.command, "server.command");
  const cwd = requiredString(value.cwd, "server.cwd");
  const expectedCommandDigest = sha256Hex({ command, cwd, args });
  const commandDigest = requiredSha(
    value.commandDigest,
    "server.commandDigest",
    SHA64,
  );
  if (commandDigest !== expectedCommandDigest)
    throw new Error("Persistent server lease command digest does not match");
  return Object.freeze({
    name,
    host: LOOPBACK_HOST,
    port,
    healthUrl: requiredString(value.healthUrl, "server.healthUrl"),
    pid,
    pgid,
    uid,
    startToken: requiredString(value.startToken, "server.startToken"),
    cwd,
    command,
    args: Object.freeze([...args]),
    commandDigest,
  });
};

export const parsePersistentServerLease = (
  value: unknown,
): PersistentServerLease => {
  if (!isRecord(value))
    throw new Error("Persistent server lease JSON is invalid");
  assertKeys(
    value,
    [
      "artifact",
      "version",
      "campaignId",
      "attemptId",
      "sourceSha",
      "sourceTree",
      "sourceDigest",
      "createdAt",
      "servers",
    ],
    "root",
  );
  if (value.artifact !== LEASE_ARTIFACT || value.version !== LEASE_VERSION)
    throw new Error("Persistent server lease artifact/version is invalid");
  const servers = value.servers;
  if (
    !Array.isArray(servers) ||
    servers.length !== 2 ||
    servers.some((server) => !isRecord(server))
  )
    throw new Error("Persistent server lease must contain api and web servers");
  const parsedServers = servers.map(parseServer);
  const apiServer = parsedServers.find((server) => server.name === "api");
  const webServer = parsedServers.find((server) => server.name === "web");
  if (apiServer === undefined || webServer === undefined)
    throw new Error(
      "Persistent server lease must contain one api and one web server",
    );
  return Object.freeze({
    artifact: LEASE_ARTIFACT,
    version: LEASE_VERSION,
    campaignId: requiredString(value.campaignId, "campaignId"),
    attemptId: requiredString(value.attemptId, "attemptId"),
    sourceSha: requiredSha(value.sourceSha, "sourceSha", SHA40),
    sourceTree: requiredSha(value.sourceTree, "sourceTree", SHA40),
    sourceDigest: requiredSha(value.sourceDigest, "sourceDigest", SHA64),
    createdAt: requiredString(value.createdAt, "createdAt"),
    servers: Object.freeze([apiServer, webServer] as const),
  });
};

export const fileDigest = (text: string): string =>
  createHash("sha256").update(text, "utf8").digest("hex");

const assertPrivateLeaseFile = async (leasePath: string): Promise<void> => {
  const file = await lstat(leasePath);
  if (!file.isFile() || (file.mode & PRIVATE_FILE_MODE_MASK) !== 0)
    throw new Error("Persistent server lease must be a private regular file");
};

export const readPersistentServerLease = async (input: {
  readonly path: string;
  readonly digest: string;
}): Promise<PersistentServerLeaseFile> => {
  const leasePath = input.path;
  if (leasePath !== path.resolve(leasePath))
    throw new Error(
      "Persistent server lease path must be normalized and absolute",
    );
  if (!SHA64.test(input.digest))
    throw new Error("Persistent server lease file digest is invalid");
  await assertPrivateLeaseFile(leasePath);
  const text = await readFile(leasePath, "utf8");
  const digest = fileDigest(text);
  if (digest !== input.digest)
    throw new Error("Persistent server lease file digest changed");
  return { lease: parsePersistentServerLease(JSON.parse(text)), digest };
};

export const assertPersistentServerLeaseIdentity = (
  lease: PersistentServerLease,
  expected: PersistentServerLeaseExpected,
): void => {
  const apiServer = lease.servers.find((server) => server.name === "api");
  const webServer = lease.servers.find((server) => server.name === "web");
  const comparisons: readonly [string, boolean][] = [
    ["campaign", lease.campaignId === expected.campaignId],
    ["attempt", lease.attemptId === expected.attemptId],
    ["source SHA", lease.sourceSha === expected.sourceSha],
    ["source tree", lease.sourceTree === expected.sourceTree],
    ["api port", apiServer?.port === expected.apiPort],
    ["web port", webServer?.port === expected.webPort],
  ];
  const mismatch = comparisons.find(([, matches]) => !matches)?.[0];
  if (mismatch !== undefined)
    throw new Error(`Persistent server lease ${mismatch} identity mismatch`);
};
