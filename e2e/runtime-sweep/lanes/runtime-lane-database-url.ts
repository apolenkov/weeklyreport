import {
  e2eDatabaseIdentity,
  E2eDatabaseSetupError,
} from "../../helpers/e2e-database-target.ts";

export const runtimeLaneDatabaseUrl = (
  base: string,
  databaseName: string,
): string => {
  const baseIdentity = e2eDatabaseIdentity(base);
  if (baseIdentity.host !== "loopback")
    throw new E2eDatabaseSetupError(
      "Runtime lane database host must be loopback",
    );
  if (!/^[^/?#]+$/u.test(databaseName))
    throw new E2eDatabaseSetupError(
      "Runtime lane database name must be one path segment",
    );
  const url = new URL(base);
  url.pathname = `/${databaseName}`;
  const laneUrl = url.toString();
  const laneIdentity = e2eDatabaseIdentity(laneUrl);
  if (
    laneIdentity.host !== baseIdentity.host ||
    laneIdentity.port !== baseIdentity.port ||
    laneIdentity.database !== databaseName
  )
    throw new E2eDatabaseSetupError(
      "Runtime lane database URL changed its effective target",
    );
  return laneUrl;
};
