import { spawn } from "node:child_process";
import { readdir, stat } from "node:fs/promises";
import { dirname, extname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

// Node's native watch mode opens one persistent watcher for each imported
// module. The API import graph is larger than macOS's default per-process
// watcher limit, so development uses a small polling loop instead. Polling
// also compares mtime/size and ignores access-time events from module loads.
const API_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const WATCH_ROOTS = [
  resolve(API_ROOT, "src"),
  resolve(API_ROOT, "../../packages/shared/src"),
];
const ENV_FILE = resolve(API_ROOT, "../../.env");
const POLL_INTERVAL_MS = 500;
const SOURCE_EXTENSIONS = new Set([".json", ".js", ".mjs", ".ts", ".tsx"]);

const delay = (milliseconds) =>
  new Promise((resolvePromise) => setTimeout(resolvePromise, milliseconds));

const isSourceFile = (filePath) => SOURCE_EXTENSIONS.has(extname(filePath));

const collectSourceFiles = async (directory) => {
  const entries = await readdir(directory, { withFileTypes: true });
  const nestedFiles = await Promise.all(
    entries.map((entry) => {
      const absolutePath = join(directory, entry.name);
      if (entry.isDirectory()) {
        return collectSourceFiles(absolutePath);
      }
      return isSourceFile(absolutePath) ? [[absolutePath]] : [[]];
    }),
  );
  return nestedFiles.flat(2);
};

const collectSnapshot = async () => {
  const sourceFiles = (
    await Promise.all(WATCH_ROOTS.map(collectSourceFiles))
  ).flat();
  const watchedFiles = [...new Set([...sourceFiles, ENV_FILE])].toSorted();
  const fingerprints = await Promise.all(
    watchedFiles.map(async (filePath) => {
      try {
        const metadata = await stat(filePath);
        return `${filePath}:${metadata.mtimeMs}:${metadata.size}`;
      } catch {
        return `${filePath}:missing`;
      }
    }),
  );
  return fingerprints.join("\n");
};

const hasExited = (child) =>
  child.exitCode !== null || child.signalCode !== null;

const waitForExit = (child) =>
  hasExited(child)
    ? Promise.resolve()
    : new Promise((resolvePromise) => child.once("exit", resolvePromise));

const spawnApi = () =>
  spawn(
    process.execPath,
    [
      "--env-file=../../.env",
      "--import",
      "@swc-node/register/esm-register",
      "src/main.ts",
    ],
    {
      cwd: API_ROOT,
      stdio: "inherit",
    },
  );

const waitForChangeOrExit = async (baseline, child) => {
  const currentSnapshot = await collectSnapshot();
  const sourceChanged = currentSnapshot !== baseline;
  const childExited = child !== null && hasExited(child);
  if (sourceChanged || childExited) {
    return {
      kind: sourceChanged ? "changed" : "exited",
      snapshot: currentSnapshot,
    };
  }
  await delay(POLL_INTERVAL_MS);
  return waitForChangeOrExit(baseline, child);
};

const runWatcher = async (baseline) => {
  const child = spawnApi();
  const event = await waitForChangeOrExit(baseline, child);

  if (event.kind === "changed") {
    if (!hasExited(child)) {
      child.kill("SIGTERM");
    }
    await waitForExit(child);
    return runWatcher(event.snapshot);
  }

  console.error("API process stopped; waiting for a source change.");
  const nextChange = await waitForChangeOrExit(event.snapshot, null);
  return runWatcher(nextChange.snapshot);
};

const main = async () => runWatcher(await collectSnapshot());

main().catch((error) => {
  console.error("Development watcher failed:", error);
  process.exitCode = 1;
});
