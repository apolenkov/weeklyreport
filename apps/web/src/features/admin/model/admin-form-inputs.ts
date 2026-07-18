/**
 * Form-state → API-input helpers for the admin tabs. Each helper translates
 * the mock-shaped form state stored in an admin tab into the Zod-validated
 * input expected by the corresponding mutation. They live together so any
 * contract drift (e.g. schema field renames) collects in one place.
 */

import type { DbRole } from "@customreport/shared";
import {
  composeName,
  type ReminderAudience,
  type ReminderPolicyKind,
} from "@customreport/shared";

/**
 * Generates a v4 UUID. The browser's `crypto.randomUUID` is required by every
 * env that runs this code (Next.js 16 + Node 20+). The fallback throws because
 * Zod will reject a non-UUID id at the API boundary.
 */
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

/**
 * Maps the Users tab form state to the `adminUserSchema` payload. When editing
 * an existing user, pass `existingId`; when adding a new user, omit it and a
 * fresh UUID is generated client-side (the server will accept the inserted id
 * as-is per the schema's `id: uuid()`). `name` is recomputed from the parts in
 * surname-first ФИО order.
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

/**
 * Maps the Products tab form state to the `adminProjectSchema` payload.
 * `leadName` is required by the schema; if the form does not carry it, callers
 * resolve it from the users list before invoking this helper.
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
  return {
    id: existingId ?? newId(),
    name: form.name.trim(),
    archived: form.archived ?? false,
    leadId: form.leadOwnerId,
    leadName: (form.leadName ?? "").trim() || "Unknown Lead",
  };
}

/**
 * Reminders Tab policy editor form-state.
 *
 * The form binds:
 *   - `kind`, `offsetMinutes`, `timezone`, `audience`, `active`: 1:1 with
 *     `reminderPolicySchema`.
 *   - `validFromIso`: `YYYY-MM-DD` from a `<input type="date">`. Always
 *     present; defaults to today on the "Add" form.
 *   - `validUntilIso`: `YYYY-MM-DD` or `null`. `null` means the user has
 *     ticked the "forever" checkbox so the upper bound is open.
 */
export interface AdminReminderPolicyFormInput {
  kind: ReminderPolicyKind;
  offsetMinutes: number;
  timezone: string;
  audience: ReminderAudience;
  active: boolean;
  validFromIso: string;
  validUntilIso: string | null;
}

/**
 * Maps the policy form state to the `reminderPolicySchema` payload.
 *
 * The "forever" checkbox flips `validUntilIso` to `null` which becomes
 * `validUntil: null` on the wire. Otherwise the YYYY-MM-DD string is
 * coerced into a JS Date at midnight UTC (matching how the prisma column
 * stores `DateTime`); the schema's `z.coerce.date()` accepts either form
 * but emitting a Date here means the network payload after JSON.stringify
 * is a clean ISO timestamp.
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
