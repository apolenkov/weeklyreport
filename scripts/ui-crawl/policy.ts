/** Pure crawl policy: which controls are pressed, which are skipped and why. */

export type ControlInfo = Readonly<{
  tag: string;
  role: string | null;
  name: string;
  type: string | null;
  href: string | null;
  disabled: boolean;
  alternatives?: readonly string[];
}>;

// Lifecycle and destructive actions are only pressed by an explicit safe synthetic scenario.
const DANGEROUS = [
  /\b(delete|remove|publish|submit|archive|unarchive|reopen|approve|reject)\b/i,
  /\b(request changes|reset|wipe|revoke|discard|send|sign out|log ?out)\b/i,
  /\b(export|download|retry|replay|restore|merge)\b/i,
  /\b(deactivate|disable|suspend|ban|add new user)\b/i,
];

/** Names of controls that a reviewed synthetic scenario allows to be pressed despite DANGEROUS. */
const SAFE_SCENARIOS: ReadonlySet<string> = new Set(
  (process.env.CRAWL_SAFE ?? "").split(";").filter(Boolean),
);

/** Collapses ids so /lead/report/<uuid> and another report share one page key. */
export function pageKey(url: string): string {
  const { pathname, searchParams } = new URL(url);
  const mode = searchParams.get("mode");
  const path = pathname
    .replaceAll(
      /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi,
      ":id",
    )
    .replaceAll(/\/\d+(?=\/|$)/g, "/:n");
  return mode ? `${path}?mode=${mode}` : path;
}

export function sameOrigin(url: string, origin: string): boolean {
  try {
    return new URL(url).origin === origin;
  } catch {
    return false;
  }
}

/** Reason to leave a control unpressed, or null when it is safe to press. */
export function skipReason(control: ControlInfo): string | null {
  if (control.disabled) return "disabled";
  if (control.tag === "select" && control.alternatives?.length === 0)
    return "select with a single option";
  if (control.href !== null) return "link: reached through page navigation";
  if (control.type === "submit") return "dangerous: form submit";
  if (SAFE_SCENARIOS.has(control.name)) return null;
  const match = DANGEROUS.map((pattern) => pattern.exec(control.name)).find(
    Boolean,
  );
  return match ? `dangerous: ${match[1]?.toLowerCase() ?? "action"}` : null;
}
