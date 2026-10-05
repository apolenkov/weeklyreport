import { findFullControl } from "./full-plan.ts";
import type { FullControl, FullProbe } from "./full-probe.ts";
import { pairwise } from "./pairwise.ts";

export type FullFactor = Readonly<{
  id: string;
  values: readonly string[];
  controls: readonly FullControl[];
  kind: "select" | "choice" | "toggle";
}>;

export type FilterPlan = Readonly<{
  factors: readonly FullFactor[];
  combinations: readonly Readonly<Record<string, string>>[];
}>;

/** Only finite, policy-approved controls participate; free text requires a named fixture. */
export function filterPlan(controls: readonly FullControl[]): FilterPlan {
  const factors = new Map<string, FullFactor>();
  for (const control of controls) {
    if (control.tag === "select") {
      factors.set(control.elementId, {
        id: control.elementId,
        values: control.options,
        controls: [control],
        kind: "select",
      });
    } else if (["tab", "radio"].includes(control.role ?? "") && control.group) {
      const previous = factors.get(control.group);
      factors.set(control.group, {
        id: control.group,
        values: [...(previous?.values ?? []), control.elementId],
        controls: [...(previous?.controls ?? []), control],
        kind: "choice",
      });
    } else if (["switch", "checkbox"].includes(control.role ?? "")) {
      factors.set(control.elementId, {
        id: control.elementId,
        values: ["off", "on"],
        controls: [control],
        kind: "toggle",
      });
    }
  }
  const finite = [...factors.values()].filter(
    (factor) => factor.values.length > 1,
  );
  return {
    factors: finite,
    combinations: finite.length > 0 ? pairwise(finite) : [],
  };
}

export function factorValue(
  probe: FullProbe,
  factor: FullFactor,
): string | undefined {
  if (factor.kind === "choice")
    return factor.controls.find(
      (control) => findFullControl(probe, control.elementId)?.selected,
    )?.elementId;
  const control = findFullControl(probe, factor.id);
  if (!control) return undefined;
  return factor.kind === "select"
    ? control.value
    : control.selected
      ? "on"
      : "off";
}

/** Resolve again after each selection: a preceding filter can remove a later option. */
export function factorTarget(
  probe: FullProbe,
  factor: FullFactor,
  value: string,
): FullControl | undefined {
  const id = factor.kind === "choice" ? value : factor.id;
  const live = findFullControl(probe, id);
  if (!live || live.disabled) return undefined;
  if (factor.kind === "select")
    return live.options.includes(value)
      ? { ...live, alternatives: [value] }
      : undefined;
  return live;
}
