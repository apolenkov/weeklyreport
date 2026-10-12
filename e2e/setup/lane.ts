import {
  E2E_DATABASE_NAME,
  redisDbForDatabase,
} from "../../prisma/guards/_destructive-guard.js";

// Only the provisioned lanes; a broader guard pattern does not authorize more.
const LANE_DATABASES = {
  a: "weeklyreport_e2e_lane_a_test",
  b: "weeklyreport_e2e_lane_b_test",
} as const;

export interface E2eLane {
  readonly database: string;
  readonly redisDb: string;
}

/**
 * The disposable database and Redis DB one E2E process drives. `E2E_LANE`
 * unset or empty keeps the shared weeklyreport_e2e / Redis 15 target; `a` or
 * `b` selects the provisioned lane with its own Redis DB, so two processes
 * with different lanes share no data.
 */
export function resolveE2eLane(
  env: { readonly E2E_LANE?: string } = process.env,
): E2eLane {
  const selected = env.E2E_LANE;
  const database =
    selected === undefined || selected === ""
      ? E2E_DATABASE_NAME
      : Object.entries(LANE_DATABASES).find(([lane]) => lane === selected)?.[1];
  if (database === undefined) {
    throw new Error(
      `[e2e-lane] E2E_LANE must be unset, "a" or "b"; got "${String(selected)}".`,
    );
  }
  const redisDb = redisDbForDatabase(database);
  if (redisDb === undefined) {
    throw new Error(`[e2e-lane] ${database} has no Redis DB assigned.`);
  }
  return { database, redisDb };
}
