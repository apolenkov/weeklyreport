import type { MatrixExecutableCase } from "../../matrix/matrix-finalizer.ts";
import { NO_ROUTE_CACHE_CONTRACT_POLICY } from "../../source/contracts.ts";
import type { DomInventory } from "../dom-inventory.ts";

const SOURCE_SHA_LENGTH = 40;

export const inventory = (accessibleName: string): DomInventory => ({
  controls: [
    {
      controlKey: `button:${accessibleName}:1`,
      domOrderKey: `0001:button:${accessibleName}:1`,
      order: 1,
      role: "button",
      accessibleName,
      enabled: true,
      disabled: false,
      visible: true,
      tagName: "button",
      inputType: null,
      href: null,
    },
  ],
  issues: [],
});

export const matrixCase: MatrixExecutableCase = {
  caseId: "case-rerender",
  stateId: "state-rerender",
  sourceSha: "a".repeat(SOURCE_SHA_LENGTH),
  profile: "minimal",
  role: "lead",
  catalogRoute: "/lead/report",
  resolvedRoute: "/lead/report",
  networkPolicy: NO_ROUTE_CACHE_CONTRACT_POLICY,
  state: {
    profileCapability: "editable-active-report",
    lifecycle: "open",
    submission: "draft",
    ownershipDensity: "single",
    permission: "allowed",
    fault: "none",
    controlTransition: "none",
  },
  kind: "executable",
  execution: {
    kind: "control",
    action: {
      controlKey: "button:After:1",
      operation: "click",
      safety: "read-only",
      transition: "none",
    },
  },
};
