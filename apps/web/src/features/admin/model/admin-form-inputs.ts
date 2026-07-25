import type { DbRole } from "@customreport/shared";
import {
  composeName,
  type ReminderAudience,
  type ReminderPolicyKind,
} from "@customreport/shared";

// crypto.randomUUID required; throw rather than invent a non-UUID the API rejects.
function newId(): string {
  if (
    typeof crypto !== "undefined" &&
    typeof crypto.randomUUID === "function"
  ) {
    return crypto.randomUUID();
  }
  throw new Error(
    "crypto.randomUUID is required to generate ids for admin mutations",
  );
}

export interface AdminUserFormInput {
  // Structured ФИО parts. `middleName`/`position` hold "" when empty; the
  // mapper trims them to `null`. `name` is recomputed from the parts, never
  // entered directly.
  lastName: string;
  firstName: string;
  middleName: string;
  position: string;
  email: string;
  role: DbRole;
  groupId: string;
}

// existingId omitted → client mints UUID; name recomputed from ФИО parts.
/**
 * To Admin User Input.
 * @param form - The form argument.
 * @param existingId - The existingId argument.
 */
export function toAdminUserInput(
  form: AdminUserFormInput,
  existingId?: string,
): {
  id: string;
  email: string;
  name: string;
  lastName: string;
  firstName: string;
  middleName: string | null;
  position: string | null;
  role: DbRole;
  reportingGroupId: string | null;
} {
  const lastName = form.lastName.trim();
  const firstName = form.firstName.trim();
  const middleName = form.middleName.trim() || null;
  return {
    id: existingId ?? newId(),
    email: form.email.trim(),
    name: composeName({ lastName, firstName, middleName }),
    lastName,
    firstName,
    middleName,
    position: form.position.trim() || null,
    role: form.role,
    reportingGroupId: form.groupId || null,
  };
}

export interface ReportingGroupFormInput {
  name: string;
  description?: string | null;
  archived?: boolean;
  headUserId?: string | null;
}

/**
 * To Reporting Group Input.
 * @param form - The form argument.
 * @param existingId - The existingId argument.
 */
export function toReportingGroupInput(
  form: ReportingGroupFormInput,
  existingId?: string,
): {
  id: string;
  name: string;
  description: string | null;
  archived: boolean;
  headUserId: string | null;
} {
  return {
    id: existingId ?? newId(),
    name: form.name.trim(),
    description: form.description?.trim() ? form.description.trim() : null,
    archived: form.archived ?? false,
    headUserId: form.headUserId ?? null,
  };
}

export interface AdminProjectFormInput {
  name: string;
  leadOwnerId: string;
  leadName?: string;
  archived?: boolean;
}

export class UnresolvedProjectLeadError extends Error {
  override readonly name = "UnresolvedProjectLeadError";

  constructor(readonly leadOwnerId: string) {
    super(`No lead name resolved for owner ${leadOwnerId}`);
  }
}

// leadName required by schema; callers resolve from users list when missing.
/**
 * To Admin Project Input.
 * @param form - The form argument.
 * @param existingId - The existingId argument.
 */
export function toAdminProjectInput(
  form: AdminProjectFormInput,
  existingId?: string,
): {
  id: string;
  name: string;
  archived: boolean;
  leadId: string;
  leadName: string;
} {
  const leadName = form.leadName?.trim();
  if (!leadName) {
    throw new UnresolvedProjectLeadError(form.leadOwnerId);
  }

  return {
    id: existingId ?? newId(),
    name: form.name.trim(),
    archived: form.archived ?? false,
    leadId: form.leadOwnerId,
    leadName,
  };
}

// validUntilIso null = "forever" checkbox; dates are YYYY-MM-DD from type=date.
export interface AdminReminderPolicyFormInput {
  kind: ReminderPolicyKind;
  offsetMinutes: number;
  timezone: string;
  audience: ReminderAudience;
  active: boolean;
  validFromIso: string;
  validUntilIso: string | null;
}

// YYYY-MM-DD → Date at midnight UTC (matches Prisma DateTime); null = forever.
/**
 * To Reminder Policy Input.
 * @param form - The form argument.
 * @param existingId - The existingId argument.
 */
export function toReminderPolicyInput(
  form: AdminReminderPolicyFormInput,
  existingId?: string,
): {
  id: string;
  kind: ReminderPolicyKind;
  offsetMinutes: number;
  timezone: string;
  audience: ReminderAudience;
  active: boolean;
  validFrom: Date;
  validUntil: Date | null;
} {
  return {
    id: existingId ?? newId(),
    kind: form.kind,
    offsetMinutes: form.offsetMinutes,
    timezone: form.timezone,
    audience: form.audience,
    active: form.active,
    validFrom: new Date(`${form.validFromIso}T00:00:00.000Z`),
    validUntil:
      form.validUntilIso === null
        ? null
        : new Date(`${form.validUntilIso}T00:00:00.000Z`),
  };
}
