import { z } from "zod";

import type { DbRole } from "../auth/auth";
import {
  type ReminderRecoverySnapshot,
  validateReminderRecoveryReferences,
} from "./reminder-recovery.validation";

type SnapshotCollectionName =
  | "groups"
  | "periods"
  | "policies"
  | "projects"
  | "reminderExecutions"
  | "reminderRules"
  | "users";

interface AdminSnapshotIntegrityInput extends ReminderRecoverySnapshot {
  readonly users: readonly {
    readonly id: string;
    readonly email: string;
    readonly role: DbRole;
    readonly reportingGroupId?: string | null | undefined;
  }[];
  readonly groups: readonly {
    readonly id: string;
    readonly headUserId?: string | null | undefined;
  }[];
  readonly projects: readonly {
    readonly id: string;
    readonly leadId: string;
  }[];
  readonly periods: readonly (ReminderRecoverySnapshot["periods"][number] & {
    readonly publishedById: string | null;
  })[];
}

interface SnapshotUniqueKey {
  readonly collection: SnapshotCollectionName;
  readonly field: string;
  readonly label: string;
}

function validateUniqueKey<Row>(
  rows: readonly Row[],
  { collection, field, label }: SnapshotUniqueKey,
  keyOf: (row: Row) => string,
  context: z.RefinementCtx,
): void {
  const firstIndexes = new Map(
    rows.map((row, index) => [keyOf(row), index] as const).toReversed(),
  );
  rows.forEach((row, index) => {
    const key = keyOf(row);
    const firstIndex = firstIndexes.get(key);
    if (firstIndex !== undefined && firstIndex !== index) {
      context.addIssue({
        code: "custom",
        path: [collection, index, field],
        message: `${label} duplicates ${collection}[${firstIndex}].`,
      });
    }
  });
}

function validateIds(
  rows: readonly { readonly id: string }[],
  collection: SnapshotCollectionName,
  context: z.RefinementCtx,
): void {
  validateUniqueKey(
    rows,
    { collection, field: "id", label: "Snapshot id" },
    (row) => row.id,
    context,
  );
}

function validateUniqueIdentities(
  snapshot: AdminSnapshotIntegrityInput,
  context: z.RefinementCtx,
): void {
  validateIds(snapshot.users, "users", context);
  validateIds(snapshot.groups, "groups", context);
  validateIds(snapshot.projects, "projects", context);
  validateIds(snapshot.periods, "periods", context);
  validateIds(snapshot.reminderRules, "reminderRules", context);
  validateIds(snapshot.reminderExecutions, "reminderExecutions", context);
  validateIds(snapshot.policies, "policies", context);
  validateUniqueKey(
    snapshot.users,
    { collection: "users", field: "email", label: "User email" },
    (user) => user.email.trim().toLowerCase(),
    context,
  );
  validateUniqueKey(
    snapshot.reminderRules,
    {
      collection: "reminderRules",
      field: "policyId",
      label: "Reminder report-policy-version tuple",
    },
    (rule) => `${rule.reportId}\u0000${rule.policyId}\u0000${rule.version}`,
    context,
  );
  validateUniqueKey(
    snapshot.reminderExecutions,
    {
      collection: "reminderExecutions",
      field: "dedupeKey",
      label: "Reminder execution dedupe key",
    },
    (execution) => execution.dedupeKey,
    context,
  );
}

function validateUserGroups(
  snapshot: AdminSnapshotIntegrityInput,
  context: z.RefinementCtx,
): void {
  const groupIds = new Set(snapshot.groups.map((group) => group.id));
  snapshot.users.forEach((user, index) => {
    if (user.role !== "viewer" && user.reportingGroupId == null) {
      context.addIssue({
        code: "custom",
        path: ["users", index, "reportingGroupId"],
        message:
          "Snapshot users with lead, head, or admin roles require reportingGroupId.",
      });
    }
    if (user.reportingGroupId != null && !groupIds.has(user.reportingGroupId)) {
      context.addIssue({
        code: "custom",
        path: ["users", index, "reportingGroupId"],
        message:
          "User reportingGroupId must reference a snapshot reporting group.",
      });
    }
  });
}

function validateUserReferences(
  snapshot: AdminSnapshotIntegrityInput,
  context: z.RefinementCtx,
): void {
  const usersById = new Map(snapshot.users.map((user) => [user.id, user]));
  snapshot.groups.forEach((group, index) => {
    if (group.headUserId == null) return;
    const head = usersById.get(group.headUserId);
    const path = ["groups", index, "headUserId"] as const;
    if (!head) {
      context.addIssue({
        code: "custom",
        path: [...path],
        message: "Group headUserId must reference a snapshot user.",
      });
    } else if (head.role !== "head" && head.role !== "admin") {
      context.addIssue({
        code: "custom",
        path: [...path],
        message: "Group headUserId must reference a head or admin user.",
      });
    }
  });
  snapshot.projects.forEach((project, index) => {
    if (!usersById.has(project.leadId)) {
      context.addIssue({
        code: "custom",
        path: ["projects", index, "leadId"],
        message: "Project leadId must reference a snapshot user.",
      });
    }
  });
  snapshot.periods.forEach((period, index) => {
    if (period.publishedById && !usersById.has(period.publishedById)) {
      context.addIssue({
        code: "custom",
        path: ["periods", index, "publishedById"],
        message: "Published period publisher must reference a snapshot user.",
      });
    }
  });
}

/** Validates deterministic identities and same-snapshot foreign-key closure. */
export function validateAdminSnapshotIntegrity(
  snapshot: AdminSnapshotIntegrityInput,
  context: z.RefinementCtx,
): void {
  validateUniqueIdentities(snapshot, context);
  validateUserGroups(snapshot, context);
  validateUserReferences(snapshot, context);
  validateReminderRecoveryReferences(snapshot, context);
}
