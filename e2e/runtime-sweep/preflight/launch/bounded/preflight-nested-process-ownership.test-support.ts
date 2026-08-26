import { writeFile } from "node:fs/promises";
import * as path from "node:path";

const launcherBody = String.raw`
import { createHash } from "node:crypto";
import { spawn } from "node:child_process";
import { appendFileSync, existsSync, readFileSync, writeFileSync } from "node:fs";
const value = (flag) => process.argv[process.argv.indexOf(flag) + 1];
const stable = (value) => JSON.stringify(value, Object.keys(value).sort());
const sha = (value) => createHash("sha256").update(stable(value)).digest("hex");
const readyPath = value("--ready");
const armPath = value("--arm");
const resultPath = value("--result");
const registry = value("--registry");
const nonce = value("--nonce");
const cwd = value("--expected-cwd");
const kind = value("--kind");
const separator = process.argv.indexOf("--");
const command = process.argv.slice(separator + 1);
const entry = { pid: process.pid, pgid: process.pid, sid: process.pid, uid: process.getuid(), birth: "test-birth", start: "test-start", cwd, kind };
const registryEntryDigest = sha(entry);
appendFileSync(registry, stable({ ...entry, registryEntryDigest }) + "\n", { mode: 0o600 });
const ready = { version: 1, nonce, ...entry, registryEntryDigest };
writeFileSync(readyPath, stable(ready) + "\n", { flag: "wx", mode: 0o600 });
const interval = setInterval(() => {
  if (!existsSync(armPath)) return;
  const arm = JSON.parse(readFileSync(armPath, "utf8"));
  if (arm.nonce !== nonce || arm.readyDigest !== sha(ready) || arm.registryEntryDigest !== registryEntryDigest) process.exit(65);
  clearInterval(interval);
  const env = Object.fromEntries(Object.entries(process.env).filter(([key]) => !key.startsWith("RUNTIME_SWEEP_NESTED_") && !key.startsWith("CR001_OWNED_")));
  const child = spawn(command[0], command.slice(1), { cwd: process.cwd(), env, stdio: "inherit", detached: false });
  child.once("exit", (code, signal) => {
    writeFileSync(resultPath, stable({ exitCode: code, signal, readyDigest: sha(ready), armDigest: sha(arm), registryEntryDigest }) + "\n", { flag: "wx", mode: 0o600 });
    process.exit(code ?? 1);
  });
}, 5);
`;

const registryBody = (failGone: boolean): string => String.raw`
import { readFileSync } from "node:fs";
const value = (flag) => process.argv[process.argv.indexOf(flag) + 1];
const mode = process.argv.includes("--assert-ready") ? "ready" : process.argv.includes("--assert-gone-ready") ? "gone" : "invalid";
if (mode === "invalid") process.exit(64);
const readyPath = value(mode === "ready" ? "--assert-ready" : "--assert-gone-ready");
const ready = JSON.parse(readFileSync(readyPath, "utf8"));
const entries = readFileSync(value("--registry"), "utf8").trim().split(/\n/u).map(JSON.parse);
if (!entries.some((entry) => entry.registryEntryDigest === ready.registryEntryDigest && entry.pid === ready.pid)) process.exit(2);
if (mode === "gone") {
  try { process.kill(-ready.pgid, 0); process.exit(3); } catch (error) { if (error?.code !== "ESRCH") throw error; }
  ${failGone ? "process.exit(23);" : ""}
}
`;

const rollbackBody = `
import { readFileSync } from "node:fs";
const value = (flag) => process.argv[process.argv.indexOf(flag) + 1];
if (!process.argv.includes("--signal-ready")) process.exit(64);
const ready = JSON.parse(readFileSync(value("--signal-ready"), "utf8"));
try { process.kill(-ready.pgid, value("--signal")); } catch (error) {
  if (error?.code !== "ESRCH") throw error;
}
`;

export const createNestedProcessOwnershipFixture = async (
  root: string,
  options: Readonly<{ failGone?: boolean }> = {},
): Promise<NodeJS.ProcessEnv> => {
  const launcher = path.join(root, "owned-launcher.mjs");
  const registryTool = path.join(root, "registry.mjs");
  const rollbackTool = path.join(root, "rollback.mjs");
  const registry = path.join(root, "owned-process-groups.jsonl");
  await Promise.all([
    writeFile(launcher, launcherBody, { mode: 0o600 }),
    writeFile(registryTool, registryBody(options.failGone === true), {
      mode: 0o600,
    }),
    writeFile(rollbackTool, rollbackBody, { mode: 0o600 }),
  ]);
  return {
    RUNTIME_SWEEP_NESTED_OWNED_COMMAND_LAUNCHER: launcher,
    RUNTIME_SWEEP_NESTED_PROCESS_GROUP_REGISTRY: registry,
    RUNTIME_SWEEP_NESTED_PROCESS_GROUP_REGISTRY_TOOL: registryTool,
    RUNTIME_SWEEP_NESTED_PROCESS_GROUP_ROLLBACK_TOOL: rollbackTool,
    RUNTIME_SWEEP_NESTED_PROCESS_OWNERSHIP_ROOT: root,
  };
};
