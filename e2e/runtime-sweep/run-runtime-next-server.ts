import { type ChildProcess, spawn } from "node:child_process";
import { createRequire } from "node:module";
import * as path from "node:path";

import {
  parseRuntimeNextLane,
  prepareRuntimeNextDist,
  releaseRuntimeNextDist,
} from "./runtime-next-dist.ts";

const MAX_PORT = 65_535;

const parsePort = (value: string | undefined): number => {
  const port = Number(value);
  if (!Number.isInteger(port) || port < 1 || port > MAX_PORT)
    throw new Error("Runtime Next server requires a valid port");
  return port;
};

const waitForExit = (
  child: ChildProcess,
): Promise<Readonly<{ code: number | null; signal: NodeJS.Signals | null }>> =>
  new Promise((resolve, reject) => {
    child.once("error", reject);
    child.once("exit", (code, signal) => resolve({ code, signal }));
  });

const webRoot = path.resolve(import.meta.dirname, "..", "..", "apps", "web");
const lane = parseRuntimeNextLane(process.argv[2]);
const port = parsePort(process.argv[3]);
const nextCli = createRequire(import.meta.url).resolve("next/dist/bin/next");
const distDirectory = await prepareRuntimeNextDist(webRoot, lane, process.pid);

try {
  const child = spawn(process.execPath, [nextCli, "dev", "-p", String(port)], {
    cwd: webRoot,
    env: { ...process.env, NEXT_DIST_DIR: distDirectory },
    stdio: "inherit",
  });
  const forwardSignal = (signal: NodeJS.Signals): void => {
    if (child.exitCode === null && child.signalCode === null)
      child.kill(signal);
  };
  const onSigint = (): void => forwardSignal("SIGINT");
  const onSigterm = (): void => forwardSignal("SIGTERM");
  process.once("SIGINT", onSigint);
  process.once("SIGTERM", onSigterm);
  try {
    const outcome = await waitForExit(child);
    process.exitCode = outcome.code ?? (outcome.signal === null ? 0 : 1);
  } finally {
    process.off("SIGINT", onSigint);
    process.off("SIGTERM", onSigterm);
  }
} finally {
  await releaseRuntimeNextDist(webRoot, distDirectory);
}
