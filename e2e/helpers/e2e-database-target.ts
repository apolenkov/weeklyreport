import { assertNonProdDestructiveTarget } from "../../prisma/guards/_destructive-guard.ts";

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

export const e2eDatabaseIdentity = (
  databaseUrl: string,
): E2eDatabaseIdentity => {
  try {
    const url = new URL(databaseUrl);
    if (!POSTGRES_PROTOCOLS.has(url.protocol))
      rejectStrictDatabaseTarget(
        "E2E_DATABASE_URL must use the postgres or postgresql protocol",
      );
    if (url.search !== "" || url.hash !== "")
      rejectStrictDatabaseTarget(
        "E2E_DATABASE_URL must not contain query parameters or a fragment",
      );
    const host = normalizeDatabaseHost(url.hostname);
    if (host === "")
      rejectStrictDatabaseTarget("E2E_DATABASE_URL must name a database host");
    const decodedPath = decodeURIComponent(url.pathname);
    if (!/^\/[^/]+$/u.test(decodedPath))
      rejectStrictDatabaseTarget(
        "E2E_DATABASE_URL must name exactly one database path segment",
      );
    const database = decodedPath.slice(1);
    if (database.includes("%") || /[\u0000-\u001F\u007F]/u.test(database))
      rejectStrictDatabaseTarget(
        "E2E_DATABASE_URL database path must be safely decoded exactly once",
      );
    if (PRODUCTION_DATABASE_NAME.test(database))
      rejectStrictDatabaseTarget(
        `Database name "${database}" looks like production.`,
      );
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

const canonicalDatabaseUrl = (
  databaseUrl: string,
  identity: E2eDatabaseIdentity,
): string => {
  const url = new URL(databaseUrl);
  url.hostname = identity.host === "loopback" ? "127.0.0.1" : identity.host;
  url.pathname = `/${identity.database}`;
  return url.toString();
};

export const assertStrictNonProdDatabaseTarget = (
  scriptName: string,
  databaseUrl: string,
  nodeEnv: string | undefined,
): void => {
  const identity = e2eDatabaseIdentity(databaseUrl);
  if (nodeEnv === "production")
    rejectStrictDatabaseTarget(
      `[${scriptName}] Refusing: NODE_ENV=production.`,
    );
  assertNonProdDestructiveTarget(scriptName, {
    DATABASE_URL: canonicalDatabaseUrl(databaseUrl, identity),
    ...(nodeEnv === undefined ? {} : { NODE_ENV: nodeEnv }),
  });
};
