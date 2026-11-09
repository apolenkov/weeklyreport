import { describe, expect, it } from "vitest";

import { deriveItemAlarmFromRisks } from "./item-alarm";

const inProgress = {
  productId: "p1",
  stageNames: ["Development"],
  status: "in-progress" as const,
};

function risk(overrides: {
  productId?: string;
  stageNames: string[];
  severity: "at-risk" | "blocked";
  text?: string;
  impact?: string | null;
  mitigation?: string | null;
}) {
  return {
    productId: overrides.productId ?? "p1",
    stageNames: overrides.stageNames,
    severity: overrides.severity,
    text: overrides.text ?? "A real risk",
    impact: overrides.impact === undefined ? "Slips" : overrides.impact,
    mitigation:
      overrides.mitigation === undefined ? "Escalate" : overrides.mitigation,
  };
}

describe("deriveItemAlarmFromRisks", () => {
  it("floors an in-progress item to a covering blocked risk", () => {
    expect(
      deriveItemAlarmFromRisks(inProgress, [
        risk({ stageNames: ["Development"], severity: "blocked" }),
      ]),
    ).toBe("blocked");
  });

  it("floors an in-progress item to a covering at-risk risk", () => {
    expect(
      deriveItemAlarmFromRisks(inProgress, [
        risk({ stageNames: ["Development"], severity: "at-risk" }),
      ]),
    ).toBe("at-risk");
  });

  it("takes the highest covering severity (blocked beats at-risk)", () => {
    expect(
      deriveItemAlarmFromRisks(inProgress, [
        risk({ stageNames: ["Development"], severity: "at-risk" }),
        risk({ stageNames: ["Development"], severity: "blocked" }),
      ]),
    ).toBe("blocked");
  });

  it("returns null when no risk covers the item's stage", () => {
    expect(
      deriveItemAlarmFromRisks(inProgress, [
        risk({ stageNames: ["Testing"], severity: "blocked" }),
      ]),
    ).toBeNull();
  });

  it("returns null when no risks exist at all", () => {
    expect(deriveItemAlarmFromRisks(inProgress, [])).toBeNull();
  });

  it("ignores a risk without an explicit stage", () => {
    expect(
      deriveItemAlarmFromRisks(inProgress, [
        risk({ stageNames: [], severity: "at-risk" }),
      ]),
    ).toBeNull();
  });

  it("ignores a risk on a different product", () => {
    expect(
      deriveItemAlarmFromRisks(inProgress, [
        risk({
          productId: "p2",
          stageNames: ["Development"],
          severity: "blocked",
        }),
      ]),
    ).toBeNull();
  });

  it("ignores an empty (placeholder) risk", () => {
    expect(
      deriveItemAlarmFromRisks(inProgress, [
        risk({ stageNames: ["Development"], severity: "blocked", text: "  " }),
      ]),
    ).toBeNull();
  });

  it("never floors a completed item (finished work is not in-flight)", () => {
    expect(
      deriveItemAlarmFromRisks({ ...inProgress, status: "completed" }, [
        risk({ stageNames: ["Development"], severity: "blocked" }),
      ]),
    ).toBeNull();
  });

  it("never floors a planned (next-week) item", () => {
    expect(
      deriveItemAlarmFromRisks({ ...inProgress, status: "planned" }, [
        risk({ stageNames: ["Development"], severity: "blocked" }),
      ]),
    ).toBeNull();
  });

  it.each([
    ["impact", { impact: "" }],
    ["mitigation", { mitigation: null }],
  ])("a blocked risk without %s floors nothing", (_label, missing) => {
    const draft = { stageNames: ["Development"], severity: "blocked" as const };

    expect(
      deriveItemAlarmFromRisks(inProgress, [risk({ ...draft, ...missing })]),
    ).toBeNull();
    expect(deriveItemAlarmFromRisks(inProgress, [risk(draft)])).toBe("blocked");
  });

  it("an incomplete blocked risk does not hide a complete at-risk one", () => {
    expect(
      deriveItemAlarmFromRisks(inProgress, [
        risk({ stageNames: ["Development"], severity: "blocked", impact: "" }),
        risk({ stageNames: ["Development"], severity: "at-risk" }),
      ]),
    ).toBe("at-risk");
  });
});
