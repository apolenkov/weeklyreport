import type { PressLog } from "./batch.ts";
import type { Ctx } from "./logs.ts";
import { type ControlInfo, skipReason } from "./policy.ts";

// Reviewed owners: lead-submit-readiness-summary, publish-lock-button,
// section-verdict-control and request-changes-dialog. Other handlers remain
// excluded until they have a fixture-scoped scenario of their own.
const REPORT_ACTIONS = [
  /^(?:Submit(?: report)?|Publish(?: & lock| anyway)?|Reopen(?: period)?)$/i,
  /^(?:Approve|Request changes)\b/i,
];
const UNREVIEWED =
  /\b(?:activate|move to next week|test connection|validate|send|invite|restore|retry|replay|reset|wipe|delete|remove|archive|unarchive|export|download)\b/i;

export function syntheticSkipReason(
  control: ControlInfo,
  ctx: Ctx,
): string | null {
  if (control.disabled) return "disabled";
  if (UNREVIEWED.test(control.name))
    return "unreviewed: requires a dedicated synthetic scenario";
  if (
    ctx.config.allowSynthetic &&
    REPORT_ACTIONS.some((pattern) => pattern.test(control.name))
  ) {
    const path = String(ctx.browser.evaluate("location.pathname"));
    const report = ctx.config.fixtureReportId;
    if (report && path.split("/").includes(report)) return null;
    return "synthetic: action is outside the prepared report";
  }
  return skipReason(control);
}

/** A write attempt must never be replayed just to restore a UI branch. */
export function isSyntheticMutation(logs: readonly PressLog[]): boolean {
  return logs.some(
    (log) =>
      log.kind === "network" &&
      /^\d+ (?:POST|PUT|PATCH|DELETE) /i.test(log.detail),
  );
}
