import { isPeriodOverlapConflict } from "../../period/index.js";
import { AdminPeriodOverlapError } from "../admin-errors.js";

// Translate both the rollout-era exact-boundary index and the global range
// exclusion constraint into the same public overlap error.
export async function periodOverlapGuarded<T>(
  write: () => Promise<T>,
): Promise<T> {
  try {
    return await write();
  } catch (error) {
    if (isPeriodOverlapConflict(error)) {
      throw new AdminPeriodOverlapError(
        "A period already exists for these dates.",
      );
    }
    throw error;
  }
}
