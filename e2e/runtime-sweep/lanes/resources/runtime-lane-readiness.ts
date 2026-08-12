import net from "node:net";

import pg from "pg";

import type { RuntimeLaneAssignment } from "../contracts/runtime-lane-contract.ts";
import { runtimeLaneDatabaseUrl } from "./runtime-lane-database-url.ts";

export { runtimeLaneDatabaseUrl } from "./runtime-lane-database-url.ts";

const REDIS_INFO_TIMEOUT_MS = 5000;
const REDIS_RUN_ID = /(?:^|\r\n)run_id:([^\r\n]+)/u;

export interface RuntimeLaneDatabaseReadiness {
  readonly activeClients: number;
  readonly database: string;
}

export interface RuntimeLaneRedisReadiness {
  readonly keyCount: number;
  readonly normalClients: number;
  readonly runId: string;
}

const databaseReadiness = async (
  databaseUrl: string,
): Promise<RuntimeLaneDatabaseReadiness> => {
  const client = new pg.Client({ connectionString: databaseUrl });
  try {
    await client.connect();
    const result = await client.query<{
      active_clients: number;
      current_database: string;
    }>(
      `SELECT current_database(), (
         SELECT count(*)::integer
         FROM pg_stat_activity
         WHERE datname = current_database()
           AND pid <> pg_backend_pid()
           AND backend_type = 'client backend'
       ) AS active_clients`,
    );
    const row = result.rows[0];
    if (row === undefined)
      throw new Error("Runtime lane database identity query returned no row");
    return {
      activeClients: row.active_clients,
      database: row.current_database,
    };
  } finally {
    await client.end().catch(() => undefined);
  }
};

export const assertRuntimeLaneDatabaseReadiness = (
  readiness: RuntimeLaneDatabaseReadiness,
  expectedDatabase: string,
): void => {
  if (readiness.database !== expectedDatabase)
    throw new Error(
      `Runtime lane database identity mismatch: ${readiness.database} != ${expectedDatabase}`,
    );
  if (readiness.activeClients !== 0)
    throw new Error(
      `Runtime lane database ${expectedDatabase} has ${String(readiness.activeClients)} foreign client(s)`,
    );
};

interface RespFrame {
  readonly nextOffset: number;
  readonly value: number | string;
}

const respLineEnd = (response: string, offset: number): number | undefined => {
  const end = response.indexOf("\r\n", offset);
  return end === -1 ? undefined : end;
};

const parseRespFrame = (
  response: string,
  offset: number,
): RespFrame | undefined => {
  const lineEnd = respLineEnd(response, offset);
  if (lineEnd === undefined) return undefined;
  const prefix = response[offset];
  const declared = Number(response.slice(offset + 1, lineEnd));
  if (!Number.isInteger(declared)) throw new Error("Invalid Redis response");
  if (prefix === ":") return { nextOffset: lineEnd + 2, value: declared };
  if (prefix !== "$") throw new Error("Unexpected Redis response frame");
  const valueStart = lineEnd + 2;
  const valueEnd = valueStart + declared;
  if (response.length < valueEnd + 2) return undefined;
  return {
    nextOffset: valueEnd + 2,
    value: response.slice(valueStart, valueEnd),
  };
};

const parseRedisReadiness = (
  response: string,
): RuntimeLaneRedisReadiness | undefined => {
  const clients = parseRespFrame(response, 0);
  if (clients === undefined) return undefined;
  const keyCount = parseRespFrame(response, clients.nextOffset);
  if (keyCount === undefined) return undefined;
  const server = parseRespFrame(response, keyCount.nextOffset);
  if (server === undefined) return undefined;
  if (
    typeof clients.value !== "string" ||
    typeof keyCount.value !== "number" ||
    typeof server.value !== "string"
  )
    throw new Error("Unexpected Redis readiness response types");
  const runId = REDIS_RUN_ID.exec(server.value)?.[1];
  if (runId === undefined) throw new Error("Redis readiness omitted run_id");
  return {
    keyCount: keyCount.value,
    normalClients: clients.value
      .split("\n")
      .filter((line) => line.startsWith("id=")).length,
    runId,
  };
};

const REDIS_READINESS_COMMAND =
  "*4\r\n$6\r\nCLIENT\r\n$4\r\nLIST\r\n$4\r\nTYPE\r\n$6\r\nnormal\r\n" +
  "*1\r\n$6\r\nDBSIZE\r\n" +
  "*2\r\n$4\r\nINFO\r\n$6\r\nserver\r\n";

const runtimeLaneRedisReadiness = (
  port: number,
): Promise<RuntimeLaneRedisReadiness> =>
  new Promise((resolve, reject) => {
    const socket = net.createConnection({ host: "127.0.0.1", port });
    const chunks: Buffer[] = [];
    const timeout = setTimeout(() => {
      socket.destroy();
      reject(new Error(`Runtime lane Redis ${port} readiness timed out`));
    }, REDIS_INFO_TIMEOUT_MS);
    socket.on("connect", () => socket.write(REDIS_READINESS_COMMAND));
    socket.on("data", (chunk: Buffer) => {
      chunks.push(chunk);
      try {
        const readiness = parseRedisReadiness(
          Buffer.concat(chunks).toString("utf8"),
        );
        if (readiness === undefined) return;
        clearTimeout(timeout);
        socket.destroy();
        resolve(readiness);
      } catch (error: unknown) {
        clearTimeout(timeout);
        socket.destroy();
        reject(error);
      }
    });
    socket.on("error", (error) => {
      clearTimeout(timeout);
      reject(error);
    });
  });

export const assertRuntimeLaneRedisReadiness = (
  readiness: RuntimeLaneRedisReadiness,
  port: number,
): void => {
  if (readiness.normalClients !== 1)
    throw new Error(
      `Runtime lane Redis ${String(port)} has ${String(readiness.normalClients - 1)} foreign client(s)`,
    );
  if (readiness.keyCount !== 0)
    throw new Error(
      `Runtime lane Redis ${String(port)} has ${String(readiness.keyCount)} stale key(s)`,
    );
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
      databaseReadiness(
        runtimeLaneDatabaseUrl(input.baseDatabaseUrl, databaseName),
      ),
    ),
  );
  input.assignment.lanes.forEach(({ databaseName }, index) => {
    const readiness = databases[index];
    if (readiness === undefined)
      throw new Error(`Runtime lane database ${databaseName} is missing`);
    assertRuntimeLaneDatabaseReadiness(readiness, databaseName);
  });
  const redisReadiness = await Promise.all(
    input.assignment.lanes.map(({ redisPort }) =>
      runtimeLaneRedisReadiness(redisPort),
    ),
  );
  input.assignment.lanes.forEach(({ redisPort }, index) => {
    const readiness = redisReadiness[index];
    if (readiness === undefined)
      throw new Error(`Runtime lane Redis ${String(redisPort)} is missing`);
    assertRuntimeLaneRedisReadiness(readiness, redisPort);
  });
  const redisRunIds = redisReadiness.map(({ runId }) => runId);
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
