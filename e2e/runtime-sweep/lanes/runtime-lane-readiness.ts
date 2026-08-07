import net from "node:net";

import pg from "pg";

import type { RuntimeLaneAssignment } from "./runtime-lane-contract.ts";

const LOOPBACK_HOSTS = new Set(["127.0.0.1", "localhost", "::1"]);
const REDIS_INFO_TIMEOUT_MS = 5000;
const REDIS_RUN_ID = /(?:^|\r\n)run_id:([^\r\n]+)/u;

export const runtimeLaneDatabaseUrl = (
  base: string,
  databaseName: string,
): string => {
  const url = new URL(base);
  if (!LOOPBACK_HOSTS.has(url.hostname))
    throw new Error("Runtime lane database host must be loopback");
  url.pathname = `/${databaseName}`;
  return url.toString();
};

const currentDatabase = async (databaseUrl: string): Promise<string> => {
  const client = new pg.Client({ connectionString: databaseUrl });
  try {
    await client.connect();
    const result = await client.query<{ current_database: string }>(
      "SELECT current_database()",
    );
    const database = result.rows[0]?.current_database;
    if (database === undefined)
      throw new Error("Runtime lane database identity query returned no row");
    return database;
  } finally {
    await client.end().catch(() => undefined);
  }
};

export const runtimeLaneRedisRunId = (port: number): Promise<string> =>
  new Promise((resolve, reject) => {
    const socket = net.createConnection({ host: "127.0.0.1", port });
    const chunks: Buffer[] = [];
    const timeout = setTimeout(() => {
      socket.destroy();
      reject(new Error(`Runtime lane Redis ${port} INFO timed out`));
    }, REDIS_INFO_TIMEOUT_MS);
    socket.on("connect", () => {
      socket.write("*2\r\n$4\r\nINFO\r\n$6\r\nserver\r\n");
    });
    socket.on("data", (chunk: Buffer) => {
      chunks.push(chunk);
      const response = Buffer.concat(chunks).toString("utf8");
      const match = REDIS_RUN_ID.exec(response);
      if (match?.[1] !== undefined) {
        clearTimeout(timeout);
        socket.destroy();
        resolve(match[1]);
      }
    });
    socket.on("error", (error) => {
      clearTimeout(timeout);
      reject(error);
    });
  });

const assertPortFree = (port: number): Promise<void> =>
  new Promise((resolve, reject) => {
    const server = net.createServer();
    server.once("error", reject);
    server.listen({ host: "127.0.0.1", port }, () => {
      server.close((error) =>
        error === undefined ? resolve() : reject(error),
      );
    });
  });

export async function assertRuntimeLaneReadiness(
  input: Readonly<{
    readonly assignment: RuntimeLaneAssignment;
    readonly baseDatabaseUrl: string;
  }>,
): Promise<ReadonlyMap<string, string>> {
  const databases = await Promise.all(
    input.assignment.lanes.map(({ databaseName }) =>
      currentDatabase(
        runtimeLaneDatabaseUrl(input.baseDatabaseUrl, databaseName),
      ),
    ),
  );
  input.assignment.lanes.forEach(({ databaseName }, index) => {
    if (databases[index] !== databaseName)
      throw new Error(
        `Runtime lane database identity mismatch: ${String(databases[index])} != ${databaseName}`,
      );
  });
  const redisRunIds = await Promise.all(
    input.assignment.lanes.map(({ redisPort }) =>
      runtimeLaneRedisRunId(redisPort),
    ),
  );
  if (new Set(redisRunIds).size !== redisRunIds.length)
    throw new Error("Runtime lanes must use distinct Redis instances");
  await Promise.all(
    input.assignment.lanes.flatMap(({ apiPort, webPort }) => [
      assertPortFree(apiPort),
      assertPortFree(webPort),
    ]),
  );
  return new Map(
    input.assignment.lanes.map(({ laneId }, index) => {
      const runId = redisRunIds[index];
      if (runId === undefined)
        throw new Error(`Runtime lane ${laneId} Redis identity is missing`);
      return [laneId, runId] as const;
    }),
  );
}
