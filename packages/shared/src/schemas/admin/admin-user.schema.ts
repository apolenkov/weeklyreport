import { z } from "zod";

import { roleSchema } from "../auth/auth.js";
import { safeText } from "../primitives/report-primitives.schema.js";

/** Maximum length of a reporting group name shown on a user. */
export const MAX_REPORTING_GROUP_NAME_LENGTH = 200;

/**
 * Shared admin-user fields. Free-text fields are declared by each schema
 * below: the read contract keeps stored values as-is, the write contract
 * applies the safe-text rule.
 */
const adminUserNonTextShape = {
  id: z.uuid(),
  email: z.email(),
  role: roleSchema,
  reportingGroupId: z.uuid().nullable().optional(),
  reportingGroupName: z
    .string()
    .min(1)
    .max(MAX_REPORTING_GROUP_NAME_LENGTH)
    .nullable()
    .optional(),
  // Restore must preserve the durable lifecycle flag carried by the snapshot.
  isActive: z.boolean(),
};

/** Validates the admin-managed user profile and access assignment (read contract). */
export const adminUserSchema = z
  .object({
    ...adminUserNonTextShape,
    // Stored display name, denormalized from the parts below on write.
    name: z.string().min(1),
    // Structured ФИО parts (surname-first). last/first required, patronymic
    // optional. The admin form recomputes `name` from these on save.
    lastName: z.string().min(1),
    firstName: z.string().min(1),
    middleName: z.string().nullable(),
    // Admin-maintained HR job title (должность), independent of `role`.
    position: z.string().nullable(),
  })
  .readonly();

/**
 * Input for `admin.users.saveUser`: the same user shape, with every free-text
 * field validated by the shared safe-text primitive (rejects null bytes and
 * values made only of whitespace or invisible characters). Stored values are
 * read through `adminUserSchema` and are not re-validated here.
 */
export const adminUserInputSchema = z
  .object({
    ...adminUserNonTextShape,
    name: safeText(),
    lastName: safeText(),
    firstName: safeText(),
    middleName: safeText().nullable(),
    position: safeText().nullable(),
  })
  .readonly();
