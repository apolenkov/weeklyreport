import { randomUUID } from "node:crypto";
import { mkdir, readFile, rename, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";

const LEASE_DIRECTORY = path.join(
  os.tmpdir(),
  "customreport-runtime-sweep-lanes.lock",
);
const OWNER_FILE = "owner.json";

interface RuntimeLaneLeaseOwner {
  readonly pid: number;
  readonly token: string;
  readonly assignmentPath: string;
  readonly startedAt: string;
}

const processExists = (pid: number): boolean => {
  try {
    process.kill(pid, 0);
    return true;
  } catch (error: unknown) {
    const code =
      error instanceof Error && "code" in error ? String(error.code) : "";
    if (code === "ESRCH") return false;
    throw error;
  }
};

const readOwner = async (
  directory: string,
): Promise<RuntimeLaneLeaseOwner | undefined> => {
  try {
    return JSON.parse(
      await readFile(path.join(directory, OWNER_FILE), "utf8"),
    ) as RuntimeLaneLeaseOwner;
  } catch (error: unknown) {
    const code =
      error instanceof Error && "code" in error ? String(error.code) : "";
    if (code === "ENOENT") return undefined;
    throw error;
  }
};

const createLease = async (
  directory: string,
  owner: RuntimeLaneLeaseOwner,
): Promise<void> => {
  await mkdir(directory);
  await writeFile(
    path.join(directory, OWNER_FILE),
    `${JSON.stringify(owner)}\n`,
    { encoding: "utf8", flag: "wx" },
  );
};

export async function acquireRuntimeLaneLease(
  assignmentPath: string,
  directory = LEASE_DIRECTORY,
): Promise<Readonly<{ release: () => Promise<void> }>> {
  const owner: RuntimeLaneLeaseOwner = {
    pid: process.pid,
    token: randomUUID(),
    assignmentPath: path.resolve(assignmentPath),
    startedAt: new Date().toISOString(),
  };
  try {
    await createLease(directory, owner);
  } catch (error: unknown) {
    const code =
      error instanceof Error && "code" in error ? String(error.code) : "";
    if (code !== "EEXIST") throw error;
    const current = await readOwner(directory);
    if (current === undefined)
      throw new Error("Runtime lane lease owner metadata is missing");
    if (processExists(current.pid)) {
      throw new Error(
        `Runtime lane resources are leased by pid=${String(current.pid)} assignment=${current.assignmentPath}`,
      );
    }
    const staleDirectory = `${directory}.stale-${owner.token}`;
    await rename(directory, staleDirectory);
    await rm(staleDirectory, { recursive: true });
    await createLease(directory, owner);
  }
  return {
    release: async () => {
      const current = await readOwner(directory);
      if (current?.token !== owner.token) return;
      await rm(directory, { recursive: true });
    },
  };
}
