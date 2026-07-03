import { describe, expect, it } from "vitest";

import { deriveItemAlarmFromRisks } from "./item-alarm";

const inProgress = {
  productId: "p1",
  stageIds: ["Development"],
  status: "in-progress" as const,
};

function risk(overrides: {
  productId?: string;
  stageIds?: string[];
  severity: "at-risk" | "blocked";
  text?: string;
}) {
  return {
    productId: overrides.productId ?? "p1",
    stageIds: overrides.stageIds,
    severity: overrides.severity,
    text: overrides.text ?? "A real risk",
  };
}

describe("deriveItemAlarmFromRisks", () => {
  it("floors an in-progress item to a covering blocked risk", () => {
    expect(
      deriveItemAlarmFromRisks(inProgress, [
        risk({ stageIds: ["Development"], severity: "blocked" }),
      ]),
    ).toBe("blocked");
  });

  it("floors an in-progress item to a covering at-risk risk", () => {
    expect(
      deriveItemAlarmFromRisks(inProgress, [
        risk({ stageIds: ["Development"], severity: "at-risk" }),
      ]),
    ).toBe("at-risk");
  });

  it("takes the highest covering severity (blocked beats at-risk)", () => {
    expect(
      deriveItemAlarmFromRisks(inProgress, [
        risk({ stageIds: ["Development"], severity: "at-risk" }),
        risk({ stageIds: ["Development"], severity: "blocked" }),
      ]),
    ).toBe("blocked");
  });

  it("returns null when no risk covers the item's stage", () => {
    expect(
      deriveItemAlarmFromRisks(inProgress, [
        risk({ stageIds: ["Testing"], severity: "blocked" }),
      ]),
    ).toBeNull();
  });

  it("returns null when no risks exist at all", () => {
    expect(deriveItemAlarmFromRisks(inProgress, [])).toBeNull();
  });

  it("treats an empty-stage (wildcard) risk as covering any stage", () => {
    expect(
      deriveItemAlarmFromRisks(inProgress, [
        risk({ stageIds: [], severity: "at-risk" }),
      ]),
    ).toBe("at-risk");
  });

  it("covers a stage-less item with any same-product risk", () => {
    const stageless = { productId: "p1", status: "in-progress" as const };
    expect(
      deriveItemAlarmFromRisks(stageless, [
        risk({ stageIds: ["Testing"], severity: "blocked" }),
      ]),
    ).toBe("blocked");
  });

  it("ignores a risk on a different product", () => {
    expect(
      deriveItemAlarmFromRisks(inProgress, [
        risk({
          productId: "p2",
          stageIds: ["Development"],
          severity: "blocked",
        }),
      ]),
    ).toBeNull();
  });

  it("ignores an empty (placeholder) risk", () => {
    expect(
      deriveItemAlarmFromRisks(inProgress, [
        risk({ stageIds: ["Development"], severity: "blocked", text: "  " }),
      ]),
    ).toBeNull();
  });

  it("never floors a completed item (finished work is not in-flight)", () => {
    expect(
      deriveItemAlarmFromRisks({ ...inProgress, status: "completed" }, [
        risk({ stageIds: ["Development"], severity: "blocked" }),
      ]),
    ).toBeNull();
  });

  it("never floors a planned (next-week) item", () => {
    expect(
      deriveItemAlarmFromRisks({ ...inProgress, status: "planned" }, [
        risk({ stageIds: [], severity: "blocked" }),
      ]),
    ).toBeNull();
  });

  it("heals a legacy single-stage label (stageName) when stageIds is absent", () => {
    const legacy = {
      productId: "p1",
      stageName: "Development",
      status: "in-progress" as const,
    };
    expect(
      deriveItemAlarmFromRisks(legacy, [
        risk({ stageIds: ["Development"], severity: "at-risk" }),
      ]),
    ).toBe("at-risk");
  });
});
