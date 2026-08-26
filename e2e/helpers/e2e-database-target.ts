import {
  assertE2eRuntimeDestructiveTarget,
  type DestructiveTargetEnv,
} from "../../prisma/guards/_destructive-guard.ts";

export interface E2eDatabaseIdentity {
  readonly database: string;
  readonly host: string;
  readonly localScope: boolean;
  readonly port: string;
}

export class E2eDatabaseSetupError extends Error {
  override readonly name = "E2eDatabaseSetupError";
}

const POSTGRES_PROTOCOLS = new Set(["postgres:", "postgresql:"]);
const PRODUCTION_DATABASE_NAME = /(^|[^a-z])(prod|production|live)([^a-z]|$)/iu;

const rejectStrictDatabaseTarget = (message: string): never => {
  throw new E2eDatabaseSetupError(message);
};

const normalizeDatabaseHost = (hostname: string): string => {
  const unwrapped = hostname.toLowerCase().replaceAll(/^\[|\]$/gu, "");
  const host = unwrapped.endsWith(".") ? unwrapped.slice(0, -1) : unwrapped;
  const numericHost = /^(?:0x[\da-f]+|[\da-f:.x]+)$/iu.test(host)
    ? (() => {
        try {
          const url = new URL(
            host.includes(":") ? `http://[${host}]` : `http://${host}`,
          );
          return url.hostname.toLowerCase().replaceAll(/^\[|\]$/gu, "");
        } catch {
          throw new E2eDatabaseSetupError(
            "E2E_DATABASE_URL contains an invalid numeric database host",
          );
        }
      })()
    : host;
  return numericHost === "localhost" ||
    numericHost === "::1" ||
    /^127(?:\.\d{1,3}){3}$/u.test(numericHost) ||
    /^::ffff:7f[\da-f]{2}:[\da-f]{1,4}$/iu.test(numericHost)
    ? "loopback"
    : numericHost;
};

const exactDatabaseName = (url: URL): string => {
  const decodedPath = decodeURIComponent(url.pathname);
  if (!/^\/[^/]+$/u.test(decodedPath))
    rejectStrictDatabaseTarget(
      "E2E_DATABASE_URL must name exactly one database path segment",
    );
  const database = decodedPath.slice(1);
  if (url.pathname !== `/${database}`)
    rejectStrictDatabaseTarget(
      "E2E_DATABASE_URL database path must be an exact, unencoded segment",
    );
  if (database.includes("%") || /[\u0000-\u001F\u007F]/u.test(database))
    rejectStrictDatabaseTarget(
      "E2E_DATABASE_URL database path must be safely decoded exactly once",
    );
  if (PRODUCTION_DATABASE_NAME.test(database))
    rejectStrictDatabaseTarget(
      `Database name "${database}" looks like production.`,
    );
  return database;
};

const parsedE2eUrl = (databaseUrl: string): URL => {
  if (databaseUrl !== databaseUrl.trim())
    rejectStrictDatabaseTarget(
      "E2E_DATABASE_URL must not contain leading or trailing whitespace",
    );
  const url = new URL(databaseUrl);
  if (!POSTGRES_PROTOCOLS.has(url.protocol))
    rejectStrictDatabaseTarget(
      "E2E_DATABASE_URL must use the postgres or postgresql protocol",
    );
  if (url.search !== "" || url.hash !== "")
    rejectStrictDatabaseTarget(
      "E2E_DATABASE_URL must not contain query parameters or a fragment",
    );
  return url;
};

export const e2eDatabaseIdentity = (
  databaseUrl: string,
): E2eDatabaseIdentity => {
  try {
    const url = parsedE2eUrl(databaseUrl);
    const host = normalizeDatabaseHost(url.hostname);
    if (host === "")
      rejectStrictDatabaseTarget("E2E_DATABASE_URL must name a database host");
    const database = exactDatabaseName(url);
    const port = url.port || "5432";
    const numericPort = Number(port);
    if (!Number.isInteger(numericPort) || numericPort <= 0)
      rejectStrictDatabaseTarget("E2E_DATABASE_URL must use a valid port");
    return {
      database,
      host,
      localScope: host === "loopback" || host.endsWith(".local"),
      port,
    };
  } catch (error: unknown) {
    if (error instanceof E2eDatabaseSetupError) throw error;
    throw new E2eDatabaseSetupError(
      "E2E_DATABASE_URL must be a parseable database URL",
    );
  }
};

export const sameE2eDatabaseTarget = (
  leftUrl: string,
  rightUrl: string,
): boolean => {
  const left = e2eDatabaseIdentity(leftUrl);
  const right = e2eDatabaseIdentity(rightUrl);
  const sameServer =
    left.host === right.host || (left.localScope && right.localScope);
  return (
    sameServer && left.port === right.port && left.database === right.database
  );
};

export const assertDistinctE2eDatabaseTarget = (
  e2eDatabaseUrl: string,
  developerDatabaseUrl: string | undefined,
): void => {
  if (
    developerDatabaseUrl !== undefined &&
    sameE2eDatabaseTarget(e2eDatabaseUrl, developerDatabaseUrl)
  )
    throw new E2eDatabaseSetupError(
      "E2E_DATABASE_URL must differ from DATABASE_URL",
    );
};

export const assertStrictNonProdDatabaseTarget = (
  scriptName: string,
  databaseUrl: string,
  nodeEnv: string | undefined,
  environment: DestructiveTargetEnv = process.env,
): void => {
  assertE2eRuntimeDestructiveTarget(scriptName, databaseUrl, {
    ...environment,
    DATABASE_URL: databaseUrl,
    ...(nodeEnv === undefined ? {} : { NODE_ENV: nodeEnv }),
  });
};
