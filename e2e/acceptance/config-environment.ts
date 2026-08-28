import {
  assertE2eRuntimeDatabaseTarget,
  sameLocalPostgresDatabaseTarget,
} from "../../prisma/guards/_destructive-guard.ts";

export const DEFAULT_ACCEPTANCE_API_PORT = 3122;
export const DEFAULT_ACCEPTANCE_WEB_PORT = 3125;
const MAX_TCP_PORT = 65_535;

type AcceptanceEnvironmentInput = Readonly<Record<string, string | undefined>>;

export interface AcceptanceEnvironment {
  readonly apiPort: number;
  readonly apiUrl: string;
  readonly databaseUrl: string;
  readonly webPort: number;
  readonly webUrl: string;
}

const portFor = (
  name: string,
  rawValue: string | undefined,
  fallback: number,
): number => {
  const raw = rawValue ?? String(fallback);
  if (!/^[1-9]\d{0,4}$/u.test(raw)) {
    throw new Error(`${name} must be an exact TCP port from 1 through 65535.`);
  }
  const port = Number(raw);
  if (port > MAX_TCP_PORT) {
    throw new Error(`${name} must be an exact TCP port from 1 through 65535.`);
  }
  return port;
};

export function acceptanceEnvironmentFor(
  environment: AcceptanceEnvironmentInput,
): AcceptanceEnvironment {
  const databaseUrl = environment.E2E_DATABASE_URL;
  assertE2eRuntimeDatabaseTarget(
    "acceptance-playwright-config",
    databaseUrl,
    environment,
  );
  if (databaseUrl === undefined) {
    throw new Error(
      "E2E_DATABASE_URL must be set for WeeklyReport acceptance.",
    );
  }

  const developmentDatabaseUrl = environment.DATABASE_URL;
  if (
    developmentDatabaseUrl !== undefined &&
    sameLocalPostgresDatabaseTarget(
      "acceptance-playwright-config",
      databaseUrl,
      developmentDatabaseUrl,
    )
  ) {
    throw new Error(
      "E2E_DATABASE_URL must differ from DATABASE_URL for WeeklyReport acceptance.",
    );
  }

  const apiPort = portFor(
    "ACCEPTANCE_API_PORT",
    environment.ACCEPTANCE_API_PORT,
    DEFAULT_ACCEPTANCE_API_PORT,
  );
  const webPort = portFor(
    "ACCEPTANCE_WEB_PORT",
    environment.ACCEPTANCE_WEB_PORT,
    DEFAULT_ACCEPTANCE_WEB_PORT,
  );
  if (apiPort === webPort) {
    throw new Error("ACCEPTANCE_API_PORT and ACCEPTANCE_WEB_PORT must differ.");
  }

  return {
    apiPort,
    apiUrl: `http://127.0.0.1:${apiPort}`,
    databaseUrl,
    webPort,
    webUrl: `http://127.0.0.1:${webPort}`,
  };
}
