import { describe, expect, it } from "vitest";

import {
  revealPathFor,
  revealStepFor,
  revealSurfaceFor,
} from "../../../reveal-path.ts";
import type {
  RevealBranch,
  RevealCandidate,
} from "../../interaction/preflight-reveal-branches.ts";
import {
  candidatesForImmediateReveal,
  controlsForImmediateReveal,
} from "../preflight-reveal-registration.ts";

const controlFor = (
  controlKey: string,
  accessibleName: string,
  order: number,
) =>
  ({
    controlKey,
    ariaRole: "button",
    accessibleName,
    enabled: true,
    order,
    domOrderKey: `${String(order).padStart(4, "0")}:${controlKey}`,
    href: null,
    interactionEffect: null,
  }) as const;

const surfaceFor = (
  rowCount: number,
  expandedRow: number | undefined,
  includeRevealedControl = false,
) => {
  const occurrences = new Map<string, number>();
  return revealSurfaceFor([
    controlFor("button:Search:1", "Search", 0),
    ...Array.from({ length: rowCount }, (_, row) => {
      const expanded = expandedRow === row;
      const accessibleName = expanded
        ? "Hide action details"
        : "Show action details";
      const occurrence = (occurrences.get(accessibleName) ?? 0) + 1;
      occurrences.set(accessibleName, occurrence);
      return {
        ...controlFor(
          `button:${encodeURIComponent(accessibleName)}:${String(occurrence)}`,
          accessibleName,
          row + 1,
        ),
        ariaControls: `panel-row-${String(row)}`,
        ariaExpanded: expanded,
        disclosureIndependence: "source-bound-row-local" as const,
      };
    }),
    ...(includeRevealedControl
      ? [
          controlFor(
            "button:Copy%20action%20details:1",
            "Copy action details",
            rowCount + 1,
          ),
        ]
      : []),
    controlFor("button:Sign%20out:1", "Sign out", rowCount + 2),
  ]);
};

const branchFor = (
  before: ReturnType<typeof surfaceFor>,
  after: ReturnType<typeof surfaceFor>,
): RevealBranch => {
  const source = after.controls.find(({ ariaExpanded }) => ariaExpanded);
  if (source === undefined)
    throw new Error("Row-local fixture requires one expanded source");
  const sourceBefore = before.controls.find(
    ({ ariaControls }) => ariaControls === source.ariaControls,
  );
  if (sourceBefore === undefined)
    throw new Error("Row-local fixture source is missing before transition");
  const url = "/admin?tab=actions";
  return {
    path: revealPathFor(
      [
        revealStepFor(
          {
            controlKey: sourceBefore.controlKey,
            operation: "click",
            safety: "read-only",
            transition: "open",
          },
          before,
          after,
          url,
          url,
          {
            status: "unchanged",
            beforeDigest: "d".repeat(64),
            afterDigest: "d".repeat(64),
          },
        ),
      ],
      url,
    ),
    inventory: { controls: [], issues: [] },
    surface: after,
    url,
  };
};

const candidatesFor = (branch: RevealBranch): readonly RevealCandidate[] =>
  branch.surface.controls.map((control) => ({
    control: {
      controlKey: control.controlKey,
      domOrderKey: control.domOrderKey,
      order: control.order,
      role: control.ariaRole,
      accessibleName: control.accessibleName,
      enabled: control.enabled,
      disabled: !control.enabled,
      visible: true,
      tagName: "button",
      inputType: null,
      href: control.href,
      ...(control.ariaControls === undefined
        ? {}
        : { ariaControls: control.ariaControls }),
      ...(control.ariaExpanded === undefined
        ? {}
        : { ariaExpanded: control.ariaExpanded }),
      ...(control.disclosureIndependence === undefined
        ? {}
        : { disclosureIndependence: control.disclosureIndependence }),
    },
    action: {
      controlKey: control.controlKey,
      operation: "click",
      safety: "read-only",
      transition: "none",
    },
  }));

describe("row-local reveal candidate selection", () => {
  it("retains every directed pair without unchanged ordinary controls", () => {
    const rowCount = 20;
    const root = surfaceFor(rowCount, undefined);
    const directedPairs = new Set<string>();

    for (let sourceRow = 0; sourceRow < rowCount; sourceRow += 1) {
      const branch = branchFor(root, surfaceFor(rowCount, sourceRow, true));
      const changed = controlsForImmediateReveal(branch);
      const candidates = candidatesForImmediateReveal(
        { candidatesFor: () => candidatesFor(branch) },
        branch,
      );
      expect(
        changed.some(({ accessibleName }) => accessibleName === "Search"),
      ).toBe(false);
      expect(
        changed.some(({ accessibleName }) => accessibleName === "Sign out"),
      ).toBe(false);
      expect(
        candidates.some(
          ({ control: { accessibleName } }) => accessibleName === "Search",
        ),
      ).toBe(false);
      expect(
        candidates.some(
          ({ control: { accessibleName } }) => accessibleName === "Sign out",
        ),
      ).toBe(false);
      expect(
        candidates.filter(
          ({ control: { accessibleName } }) =>
            accessibleName === "Copy action details",
        ),
      ).toHaveLength(1);
      const toggles = candidates.filter(
        ({ control: { disclosureIndependence } }) =>
          disclosureIndependence === "source-bound-row-local",
      );
      expect(toggles).toHaveLength(rowCount);
      for (const { control: target } of toggles) {
        if (target.ariaControls !== `panel-row-${String(sourceRow)}`)
          directedPairs.add(
            `${String(sourceRow)}->${target.ariaControls ?? "missing"}`,
          );
      }
    }

    expect(directedPairs.size).toBe(rowCount * (rowCount - 1));
  });

  it("fails closed to the full surface for duplicate material targets", () => {
    const root = surfaceFor(2, undefined);
    const expanded = surfaceFor(2, 0);
    const first = expanded.controls.find(
      ({ ariaControls }) => ariaControls === "panel-row-0",
    );
    if (first === undefined) throw new Error("Fixture control is missing");
    const duplicate = revealSurfaceFor([
      ...expanded.controls,
      {
        ...first,
        controlKey: "button:Duplicate:1",
        domOrderKey: "9999:button:Duplicate:1",
        ariaControls: "panel-row-0",
      },
    ]);

    expect(controlsForImmediateReveal(branchFor(root, duplicate))).toEqual(
      duplicate.controls,
    );
  });
});
