import { describe, expect, it } from "vitest";

import type { MatrixExecutableCase } from "../../matrix/matrix-finalizer.ts";
import type { Action } from "../../source/contracts.ts";
import { NO_ROUTE_CACHE_CONTRACT_POLICY } from "../../source/contracts.ts";
import type { DomControlObservation } from "../dom/dom-inventory.ts";
import { controlIssues } from "../frozen-case/validation/frozen-case-control-validation.ts";
import {
  canonicalFrozenTargetControl,
  selectFrozenActionTarget,
} from "./frozen-action-target.ts";

const link = (
  controlKey: string,
  href: string,
  enabled = true,
): DomControlObservation => ({
  controlKey,
  domOrderKey: `0001:${controlKey}`,
  order: 1,
  role: "link",
  accessibleName: controlKey,
  enabled,
  disabled: !enabled,
  visible: true,
  tagName: "a",
  inputType: null,
  href,
});

const frozenAction = (href?: string): Action => ({
  controlKey: "link:Created%201%20min%20ago:1",
  operation: "click",
  safety: "read-only",
  transition: "none",
  ...(href === undefined ? {} : { target: { role: "link", href } }),
});

const disclosure = (
  controlKey: string,
  ariaControls: string,
  accessibleName = "Show action details",
  order = 1,
  ariaExpanded = false,
): DomControlObservation => ({
  controlKey,
  domOrderKey: `${String(order).padStart(4, "0")}:${controlKey}`,
  order,
  role: "button",
  accessibleName,
  enabled: true,
  disabled: false,
  visible: true,
  tagName: "button",
  inputType: null,
  href: null,
  ariaControls,
  ariaExpanded,
  disclosureIndependence: "source-bound-row-local",
});

describe("frozen action target selection", () => {
  it("rejects exact-key href drift and uses the stable target", () => {
    const exact = link(frozenAction().controlKey, "/reports/exact");
    const semantic = link("link:Renamed:1", "/reports/stable");

    expect(
      selectFrozenActionTarget(
        [exact, semantic],
        frozenAction("/reports/stable"),
      ),
    ).toBe(semantic);
  });

  it("resolves volatile accessible text by one exact role and href match", () => {
    const renamed = link("link:Created%20just%20now:1", "/reports/stable");

    expect(
      selectFrozenActionTarget([renamed], frozenAction("/reports/stable")),
    ).toBe(renamed);
  });

  it("fails closed when the stable href is ambiguous", () => {
    const first = link("link:First:1", "/reports/stable");
    const second = link("link:Second:1", "/reports/stable");

    expect(
      selectFrozenActionTarget(
        [first, second],
        frozenAction("/reports/stable"),
      ),
    ).toBeUndefined();
  });

  it("treats an enabled and disabled duplicate href as ambiguous", () => {
    const enabled = link("link:Enabled:1", "/reports/stable");
    const disabled = link("link:Disabled:1", "/reports/stable", false);

    expect(
      selectFrozenActionTarget(
        [enabled, disabled],
        frozenAction("/reports/stable"),
      ),
    ).toBeUndefined();
  });

  it("fails closed without a frozen href or with only a disabled match", () => {
    const renamed = link(
      "link:Created%20just%20now:1",
      "/reports/stable",
      false,
    );

    expect(selectFrozenActionTarget([renamed], frozenAction())).toBeUndefined();
    expect(
      selectFrozenActionTarget([renamed], frozenAction("/reports/stable")),
    ).toBeUndefined();
  });

  it("fails closed when an occurrence shift removes the frozen exact key", () => {
    const frozenBinding = {
      action: {
        controlKey: "button:Show%20action%20details:2",
        operation: "click",
        safety: "read-only",
        transition: "open",
      } satisfies Action,
      ariaControls: "panel-row-2",
      disclosureIndependence: "source-bound-row-local",
    } as const;
    const firstRowAfterExpand = disclosure(
      "button:Hide%20action%20details:1",
      "panel-row-1",
      "Hide action details",
      1,
      true,
    );
    const secondRowAfterFirstRowExpands = disclosure(
      "button:Show%20action%20details:1",
      frozenBinding.ariaControls,
      "Show action details",
      2,
    );

    expect(
      selectFrozenActionTarget(
        [firstRowAfterExpand, secondRowAfterFirstRowExpands],
        frozenBinding.action,
      ),
    ).toBeUndefined();
  });

  it("restores the frozen key when navigation removes a renamed target", () => {
    const renamed = link("link:Created%20just%20now:1", "/reports/stable");
    const action = frozenAction("/reports/stable");

    expect(canonicalFrozenTargetControl(renamed, action)).toEqual({
      ...renamed,
      controlKey: action.controlKey,
      domOrderKey: `0001:${action.controlKey}`,
    });
  });

  it("passes frozen control validation after volatile link navigation", () => {
    const action = frozenAction("/reports/stable");
    const target = canonicalFrozenTargetControl(
      link("link:Created%20just%20now:1", "/reports/stable"),
      action,
    );
    const matrixCase = {
      caseId: "case-link-drift",
      stateId: "state-link-drift",
      sourceSha: "a".repeat(40),
      profile: "minimal",
      role: "lead",
      catalogRoute: "/reports/history",
      resolvedRoute: "/reports/history",
      networkPolicy: NO_ROUTE_CACHE_CONTRACT_POLICY,
      state: {
        profileCapability: "canonical-identities",
        lifecycle: "open",
        submission: "draft",
        ownershipDensity: "single",
        permission: "allowed",
        fault: "none",
        controlTransition: "none",
      },
      kind: "executable",
      execution: { kind: "control", action },
    } as MatrixExecutableCase;
    const artifactId = "action-evidence";

    expect(
      controlIssues(
        matrixCase,
        [
          {
            controlKey: target.controlKey,
            cellId: matrixCase.caseId,
            ariaRole: target.role,
            accessibleName: target.accessibleName,
            enabled: target.enabled,
            order: target.order,
            actionResult: {
              kind: "exercised",
              result: "pass",
              evidenceIds: [artifactId],
            },
          },
        ],
        [
          {
            artifactId,
            kind: "control-action",
            dimension: "function",
            archivePath: "/archive/action/control-actions.json",
            digest: "b".repeat(64),
            capturedAt: "2026-08-07T00:00:00.000Z",
            cellId: matrixCase.caseId,
            sourceSha: matrixCase.sourceSha,
            profile: matrixCase.profile,
            role: matrixCase.role,
            catalogRoute: matrixCase.catalogRoute,
            resolvedRoute: matrixCase.resolvedRoute,
          },
        ],
      ),
    ).toEqual([]);
  });
});
