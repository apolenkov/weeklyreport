// E2E destructive work has one deliberately narrow target contract. Production
// restore is a separate shell entrypoint and does not use this module.
export const E2E_DESTRUCTIVE_CONSENT = "давай" as const;
export const E2E_DATABASE_NAME = "customreport_e2e" as const;
const E2E_RUNTIME_DATABASE_PATTERN = /^customreport_e2e(?:_lane_[a-o]_test)?$/u;

export interface DestructiveTargetEnv {
  readonly ALLOW_PROD_DESTRUCTIVE?: string;
  readonly DATABASE_URL?: string;
  readonly NODE_ENV?: string;
  readonly PRISMA_USER_CONSENT_FOR_DANGEROUS_AI_ACTION?: string;
}

export interface E2eRuntimeDatabaseIdentity {
  readonly database: string;
  readonly host: string;
  readonly port: string;
}

const DEFAULT_POSTGRES_PORT = "5432";
const MAX_TCP_PORT = 65_535;
const IPV4_LOOPBACK_PREFIX = 127;
const IPV4_MAX_OCTET = 255;
const IPV4_PART_COUNT = 4;
const IPV4_MAPPED_HIGH_WORD = 0x7f_00;
const RAW_ASCII_SPACE_OR_CONTROL = /[\u0000-\u0020\u007F]/u;

const maskedUrl = (value: string): string => {
  try {
    const parsed = new URL(value);
    if (parsed.username !== "") parsed.username = "***";
    if (parsed.password !== "") parsed.password = "***";
    parsed.search = "";
    parsed.hash = "";
    return parsed.toString();
  } catch {
    return "<redacted>";
  }
};

const refuse = (scriptName: string, url: string, reason: string): never => {
  throw new Error(
    `[${scriptName}] Refusing E2E/runtime destructive operation on ` +
      `DATABASE_URL=${maskedUrl(url)}. ${reason} ` +
      "ALLOW_PROD_DESTRUCTIVE cannot bypass this guard.",
  );
};

const isLoopbackIpv4 = (host: string): boolean => {
  const parts = host.split(".");
  return (
    parts.length === IPV4_PART_COUNT &&
    parts.every((part) => /^(?:0|[1-9]\d*)$/u.test(part)) &&
    Number(parts[0]) === IPV4_LOOPBACK_PREFIX &&
    parts
      .slice(1)
      .every((part) => Number(part) >= 0 && Number(part) <= IPV4_MAX_OCTET)
  );
};

const isLoopbackHost = (hostname: string): boolean => {
  const host = hostname.toLowerCase().replaceAll(/^\[|\]$/gu, "");
  if (host === "localhost" || host === "::1" || isLoopbackIpv4(host)) {
    return true;
  }

  // URL normalisation can expose IPv4-mapped literals in either dotted or
  // hexadecimal form. Keep the accepted surface explicit and loopback-only.
  if (host.startsWith("::ffff:")) {
    const mapped = host.slice("::ffff:".length);
    if (isLoopbackIpv4(mapped)) return true;
    const mappedParts = mapped.split(":");
    if (mappedParts.length !== 2) return false;
    const high = Number.parseInt(mappedParts[0] ?? "", 16);
    const low = Number.parseInt(mappedParts[1] ?? "", 16);
    return (
      Number.isInteger(high) &&
      Number.isInteger(low) &&
      high === IPV4_MAPPED_HIGH_WORD &&
      low >= 0 &&
      low <= IPV4_MAX_OCTET
    );
  }
  return false;
};

const rawPortFromBracketedHost = (
  scriptName: string,
  databaseUrl: string,
  hostAndPort: string,
): string | undefined => {
  const closingBracket = hostAndPort.indexOf("]");
  if (closingBracket === -1) {
    return refuse(
      scriptName,
      databaseUrl,
      "DATABASE_URL has an ambiguous IPv6 host or port.",
    );
  }
  const suffix = hostAndPort.slice(closingBracket + 1);
  if (suffix !== "" && !/^:\d+$/u.test(suffix)) {
    return refuse(
      scriptName,
      databaseUrl,
      "DATABASE_URL has an ambiguous IPv6 host or port.",
    );
  }
  return suffix === "" ? undefined : suffix.slice(1);
};

const rawPortFromHostname = (
  scriptName: string,
  databaseUrl: string,
  hostAndPort: string,
): string | undefined => {
  const firstColon = hostAndPort.indexOf(":");
  const lastColon = hostAndPort.lastIndexOf(":");
  if (firstColon !== lastColon) {
    return refuse(
      scriptName,
      databaseUrl,
      "DATABASE_URL IPv6 hosts must use brackets.",
    );
  }
  return firstColon === -1 ? undefined : hostAndPort.slice(firstColon + 1);
};

const rawPortFor = (scriptName: string, databaseUrl: string): string => {
  const schemeEnd = databaseUrl.indexOf("://");
  if (schemeEnd === -1) return DEFAULT_POSTGRES_PORT;
  const authorityStart = schemeEnd + "://".length;
  const pathStart = databaseUrl.indexOf("/", authorityStart);
  const authority = databaseUrl.slice(
    authorityStart,
    pathStart === -1 ? databaseUrl.length : pathStart,
  );
  const hostAndPort = authority.slice(authority.lastIndexOf("@") + 1);
  const rawPort = hostAndPort.startsWith("[")
    ? rawPortFromBracketedHost(scriptName, databaseUrl, hostAndPort)
    : rawPortFromHostname(scriptName, databaseUrl, hostAndPort);

  if (rawPort === undefined) return DEFAULT_POSTGRES_PORT;
  if (!/^[1-9]\d*$/u.test(rawPort)) {
    return refuse(
      scriptName,
      databaseUrl,
      "DATABASE_URL port must be an exact decimal without leading zeroes.",
    );
  }
  return rawPort;
};

const assertRawUrlSyntax = (scriptName: string, databaseUrl: string): void => {
  if (RAW_ASCII_SPACE_OR_CONTROL.test(databaseUrl))
    refuse(
      scriptName,
      databaseUrl,
      "DATABASE_URL must not contain ASCII whitespace or control characters.",
    );
  if (databaseUrl.includes("?") || databaseUrl.includes("#"))
    refuse(
      scriptName,
      databaseUrl,
      "DATABASE_URL must not contain query or fragment delimiters.",
    );
};

const parseUrl = (scriptName: string, databaseUrl: string): URL => {
  try {
    return new URL(databaseUrl);
  } catch {
    return refuse(
      scriptName,
      databaseUrl,
      "DATABASE_URL is not a parseable PostgreSQL URL.",
    );
  }
};

const parseDatabaseTarget = (
  scriptName: string,
  databaseUrl: string,
  allowAnyDatabase = false,
): E2eRuntimeDatabaseIdentity => {
  assertRawUrlSyntax(scriptName, databaseUrl);
  const port = rawPortFor(scriptName, databaseUrl);
  const parsed = parseUrl(scriptName, databaseUrl);

  if (parsed.protocol !== "postgres:" && parsed.protocol !== "postgresql:") {
    return refuse(
      scriptName,
      databaseUrl,
      "DATABASE_URL must use the postgres or postgresql protocol.",
    );
  }
  const numericPort = Number(port);
  if (
    !/^\d+$/u.test(port) ||
    !Number.isInteger(numericPort) ||
    numericPort < 1 ||
    numericPort > MAX_TCP_PORT
  ) {
    return refuse(
      scriptName,
      databaseUrl,
      "DATABASE_URL must use a TCP port from 1 through 65535.",
    );
  }
  if (!parsed.hostname || !isLoopbackHost(parsed.hostname)) {
    return refuse(
      scriptName,
      databaseUrl,
      `DATABASE_URL host "${parsed.hostname || "<empty>"}" is not loopback.`,
    );
  }

  let database: string;
  try {
    database = decodeURIComponent(parsed.pathname.slice(1));
  } catch {
    return refuse(
      scriptName,
      databaseUrl,
      "DATABASE_URL database path is not safely encoded.",
    );
  }
  if (parsed.pathname !== `/${database}`) {
    return refuse(
      scriptName,
      databaseUrl,
      "DATABASE_URL database name must be an exact, unencoded path segment.",
    );
  }
  if (
    parsed.pathname === "" ||
    !/^\/[^/]+$/u.test(parsed.pathname) ||
    database.includes("/") ||
    /[\u0000-\u001F\u007F]/u.test(database) ||
    (!allowAnyDatabase && !E2E_RUNTIME_DATABASE_PATTERN.test(database))
  ) {
    return refuse(
      scriptName,
      databaseUrl,
      `database name "${database || "<empty>"}" is not one of ` +
        `"${E2E_DATABASE_NAME}" or customreport_e2e_lane_[a-o]_test.`,
    );
  }

  return {
    database,
    host: parsed.hostname,
    port,
  };
};

/** Compare exact local PostgreSQL targets without comparing credentials. */
export const sameLocalPostgresDatabaseTarget = (
  scriptName: string,
  leftUrl: string,
  rightUrl: string,
): boolean => {
  const left = parseDatabaseTarget(scriptName, leftUrl, true);
  const right = parseDatabaseTarget(scriptName, rightUrl, true);
  return left.database === right.database && left.port === right.port;
};

/**
 * Parse and validate the exact disposable E2E/runtime database target.
 * Parsing has no database, Redis, process, or filesystem side effects.
 */
export function parseE2eRuntimeDatabaseTarget(
  scriptName: string,
  databaseUrl: string,
): E2eRuntimeDatabaseIdentity {
  return parseDatabaseTarget(scriptName, databaseUrl);
}

/** Assert the exact disposable target without authorizing a mutation. */
function assertE2eRuntimeDatabaseTarget(
  scriptName: string,
  databaseUrl: string | undefined,
  env: DestructiveTargetEnv = process.env,
): void {
  if (env.NODE_ENV?.toLowerCase() === "production") {
    throw new Error(
      `[${scriptName}] Refusing E2E/runtime destructive operation: ` +
        "NODE_ENV=production.",
    );
  }

  const url = databaseUrl ?? "";
  if (!url) {
    throw new Error(
      `[${scriptName}] Refusing E2E/runtime destructive operation: ` +
        "DATABASE_URL not set.",
    );
  }

  parseDatabaseTarget(scriptName, url);
}

/**
 * Assert the exact target and operator consent before the first destructive
 * primitive. Call this immediately before Prisma, pg, CREATE DATABASE, reset,
 * seed, cleanup, or child-process execution.
 */
export function assertE2eRuntimeDestructiveTarget(
  scriptName: string,
  databaseUrl: string | undefined,
  env: DestructiveTargetEnv = process.env,
): void {
  if (
    env.PRISMA_USER_CONSENT_FOR_DANGEROUS_AI_ACTION !== E2E_DESTRUCTIVE_CONSENT
  ) {
    throw new Error(
      `[${scriptName}] Refusing E2E/runtime destructive operation: ` +
        "PRISMA_USER_CONSENT_FOR_DANGEROUS_AI_ACTION must equal " +
        `"${E2E_DESTRUCTIVE_CONSENT}" exactly.`,
    );
  }
  assertE2eRuntimeDatabaseTarget(scriptName, databaseUrl, env);
}

/** Assert process DATABASE_URL before a direct destructive seed/script. */
export function assertE2eRuntimeDestructive(
  scriptName: string,
  env: DestructiveTargetEnv = process.env,
): void {
  assertE2eRuntimeDestructiveTarget(scriptName, env.DATABASE_URL, env);
}
