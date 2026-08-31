import { isPeriodOverlapConflict } from "../../period/index.js";
import { AdminPeriodOverlapError } from "../admin-errors.js";

// Translate the global range exclusion constraint into the public overlap error.
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
