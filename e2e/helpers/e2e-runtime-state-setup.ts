import {
  type E2eDatabaseSetupInput,
  reseedE2eDatabase,
} from "./e2e-database-setup.js";
import { resetE2eRedis } from "./e2e-redis-setup.js";

export async function reseedE2eRuntimeState(
  input: E2eDatabaseSetupInput,
): Promise<void> {
  reseedE2eDatabase(input);
  await resetE2eRedis();
}
