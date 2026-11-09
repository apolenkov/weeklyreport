import type { RetainedReadOnlyReason } from "@weeklyreport/shared";

/** The lifecycle facts of the report a recovery source belongs to. */
export interface RecoverySourceLifecycle {
  readonly status: "draft" | "published";
  readonly periodStatus: "open" | "published" | "reopened";
  readonly archived: boolean;
}

/**
 * Why recovery shows a source read-only, or null when recovery does not apply.
 * An archived report stays archived whatever it was before; a reopened one is
 * editable again, but only through the normal form. An open section on the
 * current form keeps its drafts there, where they are editable: a read-only
 * copy would misstate their status.
 */
export function recoveryReadOnlyReason(
  lifecycle: RecoverySourceLifecycle,
  onCurrentForm: boolean,
): RetainedReadOnlyReason | null {
  if (lifecycle.archived) return "archived";
  if (lifecycle.periodStatus === "reopened") return "reopened";
  if (lifecycle.status === "published") return "published";
  return onCurrentForm ? null : "not-current";
}
