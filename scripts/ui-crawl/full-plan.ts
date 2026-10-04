import type { FullControl, FullProbe } from "./full-probe.ts";
import type { FullFrame } from "./full-restore.ts";
import { pageKey } from "./policy.ts";
import { controlFamily } from "./round.ts";

/** Full mode preserves record identifiers and query-controlled views. */
export function fullPageKey(url: string): string {
  const parsed = new URL(url);
  parsed.searchParams.sort();
  return `${parsed.pathname}${parsed.search}`;
}

const TRANSIENT_PARAMS: ReadonlySet<string> = new Set(["source", "recovery"]);
/** A uuid or number in a query value names a record, not a view. */
const RECORD_ID = /^(?:[0-9a-f]{8}-[0-9a-f-]{27}|\d+)$/i;

/** One representative per page family: record ids collapse, query views (tabs, archive) stay apart. */
export function fullFamilyKey(url: string): string {
  const parsed = new URL(url);
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

export function fullControlReason(control: FullControl): string | null {
  if (control.role === "textbox") return "input: requires a named scenario";
  if (
    /^(activate|enable|move|plan this work|mark|save|apply|create|confirm)\b/i.test(
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
