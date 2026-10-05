import type { FullControl, FullProbe } from "./full-probe.ts";
import type { FullFrame } from "./full-restore.ts";
import { pageKey } from "./policy.ts";
import { controlFamily } from "./round.ts";

/** A page opened without these query values shows them anyway: the explicit and the bare URL are one page. */
const ADMIN_DEFAULTS: Readonly<Record<string, string>> = {
  tab: "users",
  aiTab: "provider",
  settingsTab: "identity",
};

/** Admin tab, AI sub-tab and settings sub-tab defaults leave the key; the feature choice only matters on the Features sub-tab. */
function withoutAdminDefaults(parsed: URL): void {
  if (parsed.pathname !== "/admin") return;
  const { searchParams } = parsed;
  for (const [name, value] of Object.entries(ADMIN_DEFAULTS))
    if (searchParams.get(name) === value) searchParams.delete(name);
  if (searchParams.get("aiTab") !== "features")
    searchParams.delete("aiFeature");
}

/** Full mode preserves record identifiers and query-controlled views. */
export function fullPageKey(url: string): string {
  const parsed = new URL(url);
  withoutAdminDefaults(parsed);
  parsed.searchParams.sort();
  return `${parsed.pathname}${parsed.search}`;
}

const TRANSIENT_PARAMS: ReadonlySet<string> = new Set(["source", "recovery"]);
/** A uuid or number in a query value names a record, not a view. */
const RECORD_ID = /^(?:[0-9a-f]{8}-[0-9a-f-]{27}|\d+)$/i;

/** One representative per page family: record ids collapse, query views (tabs, archive) stay apart. */
export function fullFamilyKey(url: string): string {
  const parsed = new URL(url);
  withoutAdminDefaults(parsed);
  const query = new URLSearchParams(
    [...parsed.searchParams].filter(
      ([name, value]) =>
        name !== "mode" &&
        !TRANSIENT_PARAMS.has(name) &&
        !RECORD_ID.test(value),
    ),
  );
  query.sort();
  const base = pageKey(url);
  const rest = query.toString();
  if (!rest) return base;
  return `${base}${base.includes("?") ? "&" : "?"}${rest}`;
}

export function fullUrl(url: string): string {
  const parsed = new URL(url);
  parsed.hash = "";
  parsed.searchParams.sort();
  return parsed.href;
}

/** The selected row owns every one of its actions, including later descendants. */
export function rowSkipReason(
  control: FullControl,
  representatives: Map<string, string>,
): string | null {
  if (!control.row) return null;
  const selected = representatives.get(control.row.family);
  if (!selected) {
    representatives.set(control.row.family, control.row.id);
    return null;
  }
  return selected === control.row.id
    ? null
    : `representative-row: covered by ${selected}`;
}

/** Repeats outside table rows ("Open X details" x 12): the first control of a family in a surface is the exemplar. */
export function familySkipReason(
  control: FullControl,
  representatives: Map<string, string>,
): string | null {
  const family = `family:${control.surface ?? ""}|${controlFamily(control)}`;
  const selected = representatives.get(family);
  if (!selected) {
    representatives.set(family, control.name);
    return null;
  }
  return selected === control.name
    ? null
    : `representative-family: covered by ${selected}`;
}

/** A modal owns input while open; inactive page controls remain outside this state's plan. */
export function stateControls(probe: FullProbe): readonly FullControl[] {
  return probe.surface
    ? probe.controls.filter((control) => control.surface === probe.surface)
    : probe.controls;
}

export function findFullControl(
  probe: FullProbe,
  elementId: string,
): FullControl | undefined {
  return probe.controls.find((control) => control.elementId === elementId);
}

/**
 * The live control for a planned one: the same element id, else the same identity at the same position
 * while the list of such controls keeps its length (a re-render shifts DOM paths, not what the controls are).
 */
export function matchControl(
  live: FullProbe,
  planned: FullControl,
  plannedFrom: FullProbe,
): FullControl | undefined {
  const exact = findFullControl(live, planned.elementId);
  if (exact) return exact;
  const key = controlKey(planned);
  const was = plannedFrom.controls.filter((c) => controlKey(c) === key);
  const now = live.controls.filter((c) => controlKey(c) === key);
  if (was.length !== now.length) return undefined;
  return now[was.findIndex((c) => c.elementId === planned.elementId)];
}

export function fullControlReason(control: FullControl): string | null {
  if (control.role === "textbox") return "input: requires a named scenario";
  if (
    /^(activate|enable|move|plan this work|mark|save|apply|create|confirm|toggle|detach|attach|unlink|assign|unassign|transfer)\b/i.test(
      control.name,
    )
  )
    return "dangerous: unaudited write action";
  return null;
}

/** Path-independent identity: expanding a card shifts its siblings' DOM positions, not what they are. */
export function controlKey(control: FullControl): string {
  return `${control.tag}|${control.role ?? ""}|${control.name}|${control.surface ?? ""}`;
}

/** What a state opened from `frame` must not plan again. */
export function childKnown(frame: FullFrame): ReadonlySet<string> {
  return new Set([...frame.known, ...frame.probe.controls.map(controlKey)]);
}
