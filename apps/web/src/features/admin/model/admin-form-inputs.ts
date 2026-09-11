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
  readonly lastName: string;
  readonly firstName: string;
  readonly middleName: string;
  readonly position: string;
  readonly email: string;
  readonly role: DbRole;
  // null = no owning group (viewer, or none selectable).
  readonly groupId: string | null;
}

export class MissingUserGroupError extends Error {
  override readonly name = "MissingUserGroupError";

  constructor() {
    super("A non-viewer user requires an owning group");
  }
}

// existingId omitted → client mints UUID; name recomputed from ФИО parts.
export function toAdminUserInput(
  form: AdminUserFormInput,
  existingId?: string,
  isActive = true,
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
  isActive: boolean;
} {
  const lastName = form.lastName.trim();
  const firstName = form.firstName.trim();
  const middleName = form.middleName.trim() || null;
  const groupId = form.groupId?.trim() || null;
  if (form.role !== "viewer" && groupId === null) {
    throw new MissingUserGroupError();
  }
  return {
    id: existingId ?? newId(),
    email: form.email.trim(),
    name: composeName({ lastName, firstName, middleName }),
    lastName,
    firstName,
    middleName,
    position: form.position.trim() || null,
    role: form.role,
    reportingGroupId: form.role === "viewer" ? null : groupId,
    isActive,
  };
}

export interface ReportingGroupFormInput {
  name: string;
  description?: string | null;
  archived?: boolean;
  headUserId?: string | null;
}

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
  leadName?: string | undefined;
  archived?: boolean | undefined;
}

export class UnresolvedProjectLeadError extends Error {
  override readonly name = "UnresolvedProjectLeadError";

  constructor(readonly leadOwnerId: string) {
    super(`No lead name resolved for owner ${leadOwnerId}`);
  }
}

// leadName required by schema; callers resolve from users list when missing.
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
