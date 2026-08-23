import { describe, expect, it } from "vitest";

import type { DomControlObservation } from "../../../replay/dom/dom-inventory.ts";
import type { Action } from "../../../source/contracts.ts";
import {
  revealPathFor,
  type RevealStep,
  revealStepFor,
  type RevealSurface,
  revealSurfaceFor,
} from "../../reveal-path.ts";
import type { RevealBranch } from "../interaction/preflight-reveal-branches.ts";
import type { ToggleBindingEligibilityPredicate } from "./preflight-reveal-canonicalization.ts";
import { independentDisclosureReductionDiagnosisFor } from "./preflight-reveal-canonicalization-diagnosis.ts";

const unchanged = {
  status: "unchanged" as const,
  beforeDigest: "d".repeat(64),
  afterDigest: "d".repeat(64),
};

const controlFor = (key: string, expanded: boolean): DomControlObservation => ({
  controlKey: key,
  domOrderKey: `${key}:0001`,
  order: 1,
  role: "button",
  accessibleName: key,
  enabled: true,
  disabled: false,
  visible: true,
  tagName: "button",
  inputType: null,
  href: null,
  ariaControls: `panel-${key}`,
  ariaExpanded: expanded,
  disclosureIndependence: "source-bound-row-local",
});

const surfaceFor = (
  states: readonly (readonly [string, boolean])[],
): RevealSurface =>
  revealSurfaceFor(states.map(([key, expanded]) => controlFor(key, expanded)));

const actionFor = (controlKey: string): Action => ({
  controlKey,
  operation: "click",
  safety: "read-only",
  transition: "open",
});

const candidateFor = (): RevealBranch => {
  const root = surfaceFor([
    ["a", false],
    ["b", false],
    ["c", false],
  ]);
  const first = surfaceFor([
    ["a", true],
    ["b", false],
    ["c", false],
  ]);
  const second = surfaceFor([
    ["a", true],
    ["b", true],
    ["c", false],
  ]);
  const final = surfaceFor([
    ["a", true],
    ["b", true],
    ["c", true],
  ]);
  const steps = [
    revealStepFor(actionFor("a"), root, first, "/admin", "/admin", unchanged),
    revealStepFor(actionFor("b"), first, second, "/admin", "/admin", unchanged),
    revealStepFor(actionFor("c"), second, final, "/admin", "/admin", unchanged),
  ];
  return {
    path: revealPathFor(steps, "/admin"),
    inventory: { controls: [], issues: [] },
    surface: final,
    url: "/admin",
  };
};

type StepMutator = (step: RevealStep) => RevealStep;

const withFirstStepFor = (
  branch: RevealBranch,
  mutate: StepMutator,
): RevealBranch => ({
  ...branch,
  path: revealPathFor(
    branch.path.steps.map((step, index) => (index === 0 ? mutate(step) : step)),
    branch.path.initialUrl,
  ),
});

const withControlFor = (
  surface: RevealSurface,
  key: string,
  mutate: (
    control: RevealSurface["controls"][number],
  ) => RevealSurface["controls"][number],
): RevealSurface =>
  revealSurfaceFor(
    surface.controls.map((control) =>
      control.controlKey === key ? mutate(control) : control,
    ),
  );

const predicateCasesFor = (): readonly {
  readonly predicate: ToggleBindingEligibilityPredicate;
  readonly mutate: StepMutator;
}[] => [
  {
    predicate: "operation-not-click",
    mutate: (step) => ({ ...step, operation: "navigate" }),
  },
  {
    predicate: "safety-not-read-only",
    mutate: (step) => ({ ...step, safety: "irreversible" }),
  },
  {
    predicate: "transition-not-scoped",
    mutate: (step) => ({ ...step, transition: "submit" }),
  },
  {
    predicate: "url-changed",
    mutate: (step) => ({ ...step, afterUrl: "/admin?changed" }),
  },
  {
    predicate: "modal-or-background-control",
    mutate: (step) => ({
      ...step,
      before: withControlFor(step.before, "a", (control) => ({
        ...control,
        keyboardFocusScope: "active-modal",
      })),
    }),
  },
  {
    predicate: "modal-or-background-control",
    mutate: (step) => ({
      ...step,
      after: withControlFor(step.after, "a", (control) => ({
        ...control,
        keyboardFocusScope: "active-modal",
      })),
    }),
  },
  {
    predicate: "source-control-not-source-bound",
    mutate: (step) => ({
      ...step,
      before: withControlFor(step.before, "a", (control) => ({
        ...control,
        disclosureIndependence: undefined,
      })),
    }),
  },
  {
    predicate: "target-id-invalid",
    mutate: (step) => ({
      ...step,
      before: withControlFor(step.before, "a", (control) => ({
        ...control,
        ariaControls: "",
      })),
    }),
  },
  {
    predicate: "source-expanded-state-invalid",
    mutate: (step) => ({
      ...step,
      before: withControlFor(step.before, "a", (control) => ({
        ...control,
        ariaExpanded: null,
      })),
    }),
  },
  {
    predicate: "before-target-not-unique",
    mutate: (step) => ({
      ...step,
      before: revealSurfaceFor([
        ...step.before.controls,
        ...step.before.controls
          .filter((control) => control.controlKey === "a")
          .map((control) => ({ ...control, controlKey: "a:duplicate" })),
      ]),
    }),
  },
  {
    predicate: "after-target-not-unique",
    mutate: (step) => ({
      ...step,
      after: revealSurfaceFor([
        ...step.after.controls,
        ...step.after.controls
          .filter((control) => control.ariaControls === "panel-a")
          .map((control) => ({ ...control, controlKey: "a:duplicate" })),
      ]),
    }),
  },
  {
    predicate: "after-expanded-state-invalid-or-unchanged",
    mutate: (step) => ({
      ...step,
      after: withControlFor(step.after, "a", (control) => ({
        ...control,
        ariaExpanded: false,
      })),
    }),
  },
];

describe("canonicalization step eligibility diagnosis", () => {
  it("emits a closed predicate and first failing step for every guard", () => {
    const branch = candidateFor();
    for (const { predicate, mutate } of predicateCasesFor()) {
      expect(
        independentDisclosureReductionDiagnosisFor({
          branch: withFirstStepFor(branch, mutate),
          knownBranches: [],
        }),
      ).toEqual({
        eligible: false,
        reason: "step-not-eligible",
        stepIndex: 0,
        predicate,
      });
    }
  });
});
