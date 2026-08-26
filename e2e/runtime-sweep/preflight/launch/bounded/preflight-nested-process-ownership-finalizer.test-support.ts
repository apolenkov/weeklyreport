import type { ChildProcess } from "node:child_process";
import { access, readFile, writeFile } from "node:fs/promises";
import * as path from "node:path";

import { stableSerialize } from "../../../support/ids.ts";
import type { NestedProcessOwnershipFinalizerInput } from "./preflight-nested-process-ownership-finalizer.ts";
import type { OwnedProcessReady } from "./preflight-nested-process-ownership-protocol.ts";

export const childFor = (
  exitCode: number | null = null,
  signalCode: NodeJS.Signals | null = null,
): ChildProcess => ({ exitCode, signalCode }) as ChildProcess;

export const linesFor = async (logPath: string): Promise<string[]> => {
  const text = await readFile(logPath, "utf8");
  return text.trim().split("\n");
};

export const handshakeExists = async (
  paths: Readonly<Record<string, string>>,
): Promise<boolean> => {
  for (const filePath of Object.values(paths)) {
    try {
      await access(filePath);
      return true;
    } catch (error: unknown) {
      if (
        error instanceof Error &&
        "code" in error &&
        (error.code === "ENOENT" || error.code === "EISDIR")
      )
        continue;
      throw error;
    }
  }
  return false;
};

const DIGEST_LENGTH = 64;

const ready = (cwd: string): OwnedProcessReady => ({
  version: 1,
  nonce: "n".repeat(DIGEST_LENGTH),
  pid: 101,
  pgid: 101,
  sid: 101,
  uid: process.getuid?.() ?? 0,
  birth: "birth-fixture",
  start: "start-fixture",
  cwd,
  kind: "nested-playwright",
  registryEntryDigest: "a".repeat(DIGEST_LENGTH),
});

export const commandScript = (logPath: string, fail: boolean): string =>
  [
    'import { appendFileSync } from "node:fs";',
    `const logPath = ${JSON.stringify(logPath)};`,
    `appendFileSync(logPath, process.argv.includes("--signal-ready") ? \`signal:\${process.argv.at(-1)}\\n\` : process.argv.includes("--assert-gone-ready") ? "gone\\n" : "other\\n");`,
    fail ? "process.exit(23);" : "",
  ].join("\n");

export const registrationFailureRegistryScript = (
  delegatePath: string,
  logPath?: string,
): string =>
  [
    'import { spawnSync } from "node:child_process";',
    logPath === undefined ? "" : 'import { appendFileSync } from "node:fs";',
    `const delegatePath = ${JSON.stringify(delegatePath)};`,
    logPath === undefined ? "" : `const logPath = ${JSON.stringify(logPath)};`,
    "const args = process.argv.slice(2);",
    logPath === undefined
      ? ""
      : String.raw`appendFileSync(logPath, "start " + args.join(" ") + "\n");`,
    'if (args.includes("--assert-ready")) process.exit(23);',
    'const run = () => spawnSync(process.execPath, [delegatePath, ...args], { encoding: "utf8" });',
    "const deadline = Date.now() + 2000;",
    "let result = run();",
    logPath === undefined
      ? ""
      : String.raw`appendFileSync(logPath, "result " + String(result.status) + " " + String(result.signal) + "\n");`,
    logPath === undefined
      ? ""
      : String.raw`while (result.status !== 0 && Date.now() < deadline) { result = run(); appendFileSync(logPath, "result " + String(result.status) + " " + String(result.signal) + "\n"); }`,
    logPath === undefined
      ? ""
      : String.raw`if (result.status === 0 && result.signal === null) appendFileSync(logPath, "success\n");`,
    logPath === undefined
      ? "while (result.status !== 0 && Date.now() < deadline) result = run();"
      : "",
    "if (result.status === 0 && result.signal === null) process.exit(0);",
    "if (result.stderr) process.stderr.write(result.stderr);",
    "process.exit(result.status ?? 1);",
  ].join("\n");

export const inputFor = async (options: {
  readonly root: string;
  readonly logPath: string;
  readonly child?: ChildProcess;
  readonly failingRollback?: boolean;
  readonly failingRegistry?: boolean;
}): Promise<{
  readonly input: NestedProcessOwnershipFinalizerInput;
  readonly paths: {
    readonly readyPath: string;
    readonly armPath: string;
    readonly resultPath: string;
  };
  readonly fixtureReady: OwnedProcessReady;
}> => {
  const paths = {
    readyPath: path.join(options.root, "ready.json"),
    armPath: path.join(options.root, "arm.json"),
    resultPath: path.join(options.root, "result.json"),
  } as const;
  const registryTool = path.join(options.root, "registry.mjs");
  const rollbackTool = path.join(options.root, "rollback.mjs");
  await writeFile(
    registryTool,
    commandScript(options.logPath, options.failingRegistry === true),
    { mode: 0o600 },
  );
  await writeFile(
    rollbackTool,
    commandScript(options.logPath, options.failingRollback === true),
    { mode: 0o600 },
  );
  const fixtureReady = ready(process.cwd());
  await writeFile(paths.readyPath, `${stableSerialize(fixtureReady)}\n`);
  const input: NestedProcessOwnershipFinalizerInput = {
    operationName: "ownership-finalizer-test",
    ownership: {
      registry: path.join(options.root, "registry.jsonl"),
      registryTool,
      rollbackTool,
    },
    paths,
    child: options.child ?? childFor(),
    repoRoot: process.cwd(),
    ready: () => fixtureReady,
    armDigest: () => undefined,
  };
  return { input, paths, fixtureReady };
};
