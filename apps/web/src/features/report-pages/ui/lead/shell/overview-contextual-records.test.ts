import { describe, expect, it } from "vitest";

import {
  prepareContextualDecision,
  prepareContextualRisk,
} from "./overview-contextual-records";

const parent = {
  kind: "product" as const,
  id: "p",
  name: "Product",
  product: {
    id: "p",
    name: "Product",
    overallStatus: "on-track" as const,
    stages: [],
  },
};
const activity = { kind: "activity" as const, id: "a", name: "Activity" };
const identity = {
  id: "11111111-1111-4111-8111-111111111111",
  stableId: "22222222-2222-4222-8222-222222222222",
};
const risk = {
  text: "Risk",
  impact: "Impact",
  mitigation: "Mitigation",
  severity: "blocked" as const,
  stageNames: ["Build"],
};
const decision = {
  text: "Decision",
  impact: "Impact",
  deadline: "2026-11-03",
  stageNames: ["Build"],
};
const context = {
  parent,
  eligibleParents: [parent],
  eligibleStages: ["Build"],
  identity,
};

describe("contextual record preparation", () => {
  it("prepares product records with caller identity", () => {
    expect(prepareContextualRisk({ ...context, input: risk })).toMatchObject({
      ok: true,
      record: {
        ...identity,
        productId: "p",
        stageNames: ["Build"],
        severity: "blocked",
      },
    });
    expect(
      prepareContextualDecision({
        ...context,
        input: decision,
        authorName: "Lead",
      }),
    ).toMatchObject({
      ok: true,
      record: {
        ...identity,
        productId: "p",
        owner: "Lead",
        deadline: "2026-11-03",
      },
    });
  });
  it("prepares activity records without product stages", () => {
    const args = {
      ...context,
      parent: activity,
      eligibleParents: [activity],
      eligibleStages: [],
    };
    expect(
      prepareContextualRisk({ ...args, input: { ...risk, stageNames: [] } }),
    ).toMatchObject({
      ok: true,
      record: { activityId: "a", productId: "", stageNames: [] },
    });
    expect(
      prepareContextualDecision({
        ...args,
        input: { ...decision, stageNames: [] },
        authorName: "Lead",
      }),
    ).toMatchObject({
      ok: true,
      record: { activityId: "a", productId: "", stageNames: [] },
    });
  });
  it("rejects stale ownership and stages without substitution", () => {
    expect(
      prepareContextualRisk({ ...context, eligibleParents: [], input: risk }),
    ).toMatchObject({
      ok: false,
      errors: { parent: expect.any(String) as string },
    });
    expect(
      prepareContextualDecision({
        ...context,
        eligibleStages: [],
        input: decision,
        authorName: "Lead",
      }),
    ).toMatchObject({
      ok: false,
      errors: { stageNames: expect.any(String) as string },
    });
    expect(
      prepareContextualRisk({
        ...context,
        parent: activity,
        eligibleParents: [activity],
        input: risk,
      }),
    ).toMatchObject({
      ok: false,
      errors: { stageNames: expect.any(String) as string },
    });
  });
  it("rejects missing required fields and authoritative author", () => {
    expect(
      prepareContextualRisk({
        ...context,
        input: { ...risk, text: "", impact: "", mitigation: "" },
      }),
    ).toMatchObject({
      ok: false,
      errors: {
        text: expect.any(String) as string,
      },
    });
    expect(
      prepareContextualDecision({
        ...context,
        input: { ...decision, text: "", impact: "", deadline: "invalid" },
        authorName: " ",
      }),
    ).toMatchObject({
      ok: false,
      errors: {
        text: expect.any(String) as string,
        deadline: expect.any(String) as string,
        authorName: expect.any(String) as string,
      },
    });
  });
  it("keeps identical text with distinct identities distinct", () => {
    const first = prepareContextualRisk({ ...context, input: risk });
    const second = prepareContextualRisk({
      ...context,
      identity: {
        id: "33333333-3333-4333-8333-333333333333",
        stableId: "44444444-4444-4444-8444-444444444444",
      },
      input: risk,
    });
    expect(
      first.ok && second.ok && first.record.stableId !== second.record.stableId,
    ).toBe(true);
  });
});
