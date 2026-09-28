import { isAbsolute, resolve } from "node:path";

export type MigratorMode = "check" | "apply" | "rollback";

export interface DatabaseTarget {
  readonly host: string;
  readonly port: string;
  readonly database: string;
}

export interface MigratorConfig {
  readonly mode: MigratorMode;
  readonly databaseUrl: string;
  readonly target: DatabaseTarget;
  readonly artifactRoot: string;
  readonly confirmation: string | undefined;
}

export class MigratorConfigError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "MigratorConfigError";
  }
}

const MAX_TCP_PORT = 65_535;
const POSTGRES_PROTOCOLS: ReadonlySet<string> = new Set([
  "postgres:",
  "postgresql:",
]);
// pg-connection-string folds URL search params into the resolved config BEFORE
// falling back to the URL authority, so `?host=`, `?port=`, `?user=` and
// `?password=` silently override it. The confirmation token must bind the exact
// target pg will connect to, so identity fields are accepted only in the URL
// authority/path — never as query keys.
const CONNECTION_IDENTITY_QUERY_KEYS: ReadonlySet<string> = new Set([
  "database",
  "host",
  "password",
  "port",
  "user",
]);
const MODES: ReadonlySet<string> = new Set(["check", "apply", "rollback"]);

const refuse = (message: string): never => {
  throw new MigratorConfigError(message);
};

const decodeHost = (hostname: string): string | undefined => {
  try {
    // pg decodes the raw opaque hostname itself; do the same so an escaped
    // authority (for example `%2F…` socket paths) resolves identically.
    return decodeURIComponent(hostname);
  } catch {
    return undefined;
  }
};

const normalizeHost = (hostname: string): string => {
  const lowered = hostname.toLowerCase();
  const unbracketed =
    lowered.startsWith("[") && lowered.endsWith("]")
      ? lowered.slice(1, -1)
      : lowered;
  return unbracketed.endsWith(".") ? unbracketed.slice(0, -1) : unbracketed;
};

const parseUrl = (url: string): URL | undefined => {
  try {
    return new URL(url);
  } catch {
    return undefined;
  }
};

const decodePathSegment = (pathname: string): string | undefined => {
  try {
    return decodeURIComponent(pathname.slice(1));
  } catch {
    return undefined;
  }
};

export const parseDatabaseTarget = (databaseUrl: string): DatabaseTarget => {
  const parsed = parseUrl(databaseUrl);
  if (parsed === undefined) {
    return refuse("DATABASE_URL is not a parseable PostgreSQL URL");
  }
  if (!POSTGRES_PROTOCOLS.has(parsed.protocol)) {
    return refuse(
      `DATABASE_URL must use postgres/postgresql, got ${parsed.protocol}`,
    );
  }
  const identityOverrides = [...parsed.searchParams.keys()].filter((key) =>
    CONNECTION_IDENTITY_QUERY_KEYS.has(key),
  );
  if (identityOverrides.length > 0) {
    return refuse(
      `DATABASE_URL query parameter(s) ${identityOverrides
        .map((key) => `"${key}"`)
        .join(", ")} override the connection target pg resolves; keep ` +
        "host/port/database in the URL authority and path",
    );
  }
  const decodedHost = decodeHost(parsed.hostname);
  if (decodedHost === undefined) {
    return refuse("DATABASE_URL host is not decodable");
  }
  const host = normalizeHost(decodedHost);
  if (host === "") {
    return refuse("DATABASE_URL has no host");
  }
  // An omitted port is not "5432": pg resolves it through PGPORT at connect
  // time, so the confirmation token could bind a different target than the
  // one pg dials. The URL must pin the port explicitly.
  const port = parsed.port;
  if (port === "") {
    return refuse(
      "DATABASE_URL must pin an explicit port: an omitted port is inherited " +
        "from PGPORT at connect time and would not match the confirmation target",
    );
  }
  const numericPort = Number(port);
  if (
    !/^\d+$/u.test(port) ||
    !Number.isInteger(numericPort) ||
    numericPort < 1 ||
    numericPort > MAX_TCP_PORT
  ) {
    return refuse(`DATABASE_URL port "${port}" is not a TCP port`);
  }
  const database = decodePathSegment(parsed.pathname);
  if (database === undefined || database === "" || database.includes("/")) {
    return refuse("DATABASE_URL database name must be one path segment");
  }
  return { host, port, database };
};

export const confirmationToken = (target: DatabaseTarget): string =>
  `${target.host}|${target.port}|${target.database}`;

export const resolveConfig = (env: NodeJS.ProcessEnv): MigratorConfig => {
  const databaseUrl = env.DATABASE_URL;
  if (databaseUrl === undefined || databaseUrl === "") {
    return refuse("DATABASE_URL is required");
  }
  const target = parseDatabaseTarget(databaseUrl);

  const outputDir = env.PDF_OUTPUT_DIR;
  if (outputDir === undefined || outputDir === "") {
    return refuse("PDF_OUTPUT_DIR is required");
  }
  if (!isAbsolute(outputDir)) {
    return refuse("PDF_OUTPUT_DIR must be an absolute path");
  }

  const mode = env.PDF_ARTIFACT_MIGRATOR_MODE ?? "check";
  if (!MODES.has(mode)) {
    return refuse(
      `PDF_ARTIFACT_MIGRATOR_MODE must be check|apply|rollback, got "${mode}"`,
    );
  }

  const confirmation = env.PDF_ARTIFACT_MIGRATOR_CONFIRM;
  return {
    mode: mode as MigratorMode,
    databaseUrl,
    target,
    artifactRoot: resolve(outputDir),
    confirmation:
      confirmation === undefined || confirmation === ""
        ? undefined
        : confirmation,
  };
};
