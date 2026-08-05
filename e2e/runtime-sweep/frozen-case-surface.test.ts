import { expect, test } from "vitest";

import type { DOMControl } from "./contracts.ts";
import { controlIssues } from "./frozen-case-evidence-validation.ts";
import type { MatrixExecutableCase } from "./matrix-finalizer.ts";

const matrixCase: MatrixExecutableCase = {
  caseId: "case-denied-product-action",
  stateId: "state-denied-product-action",
  sourceSha: "a".repeat(40),
  profile: "minimal",
  role: "lead",
  catalogRoute: "/lead/report/[reportId]",
  resolvedRoute: "/lead/report/report-id",
  state: {
    profileCapability: "editable-active-report",
    lifecycle: "open",
    submission: "draft",
    ownershipDensity: "single",
    permission: "non-owner",
    fault: "none",
    controlTransition: "none",
  },
  kind: "executable",
  execution: {
    kind: "control",
    action: {
      controlKey: "button:Edit:1",
      operation: "click",
      safety: "read-only",
      transition: "none",
    },
  },
};

const INAPPLICABLE_REASON = "The product content is denied for this account.";

const inapplicableControl: DOMControl = {
  controlKey: "button:Edit:1",
  cellId: matrixCase.caseId,
  ariaRole: "button",
  accessibleName: "Edit",
  enabled: false,
  order: 0,
  actionResult: {
    kind: "not-exercised",
    policy: "inapplicable",
    reason: INAPPLICABLE_REASON,
  },
};

test("accepts a product action omitted by an explicit denied surface", () => {
  expect(
    controlIssues(matrixCase, [inapplicableControl], [], {
      productContent: "denied",
      productActions: "inapplicable",
      productActionsReason: INAPPLICABLE_REASON,
      shell: "required",
    }),
  ).toEqual([]);
});

test("fails the same omitted action without the denied surface oracle", () => {
  expect(controlIssues(matrixCase, [inapplicableControl], [])).toContain(
    "case-denied-product-action frozen control button:Edit:1 was not exercised: The product content is denied for this account.",
  );
});
