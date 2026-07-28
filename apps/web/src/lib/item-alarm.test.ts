import { describe, expect, it } from "vitest";

import { deriveItemAlarmFromRisks } from "./item-alarm";

const inProgress = {
  productId: "p1",
  stageNames: ["Development"],
  status: "in-progress" as const,
};

function risk(overrides: {
  productId?: string;
  stageNames?: string[];
  severity: "at-risk" | "blocked";
  text?: string;
}) {
  return {
    productId: overrides.productId ?? "p1",
    stageNames: overrides.stageNames,
    severity: overrides.severity,
    text: overrides.text ?? "A real risk",
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

  it("treats an empty-stage (wildcard) risk as covering any stage", () => {
    expect(
      deriveItemAlarmFromRisks(inProgress, [
        risk({ stageNames: [], severity: "at-risk" }),
      ]),
    ).toBe("at-risk");
  });

  it("covers a stage-less item with any same-product risk", () => {
    const stageless = { productId: "p1", status: "in-progress" as const };
    expect(
      deriveItemAlarmFromRisks(stageless, [
        risk({ stageNames: ["Testing"], severity: "blocked" }),
      ]),
    ).toBe("blocked");
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
        risk({ stageNames: [], severity: "blocked" }),
      ]),
    ).toBeNull();
  });

  it("heals a legacy single-stage label (stageName) when stageNames is absent", () => {
    const legacy = {
      productId: "p1",
      stageName: "Development",
      status: "in-progress" as const,
    };
    expect(
      deriveItemAlarmFromRisks(legacy, [
        risk({ stageNames: ["Development"], severity: "at-risk" }),
      ]),
    ).toBe("at-risk");
  });
});
