/**
 * Characterization tests for the extracted snapshot mappers
 * (refactor-lead-mappers). Fixtures are transcribed from the previous
 * inline logic in `lead-form.tsx` — they pin today's behavior byte for
 * byte (design D5), they are NOT idealized expectations.
 */

import { describe, expect, it } from "vitest";

import type { LeadProduct } from "./lead-form";
import {
  applySnapshotStageOverrides,
  buildSnapshotStageMap,
  mapSnapshotDecisions,
  mapSnapshotItems,
  mapSnapshotRisks,
  type SnapPayload,
} from "./lead-snapshot";

const payload: SnapPayload = {
  stageStatuses: [
    { projectId: "proj-a", stageName: "Development", status: "green" },
    { projectId: "proj-a", stageName: "Testing", status: "yellow" },
  ],
  items: [
    {
      projectId: "proj-a",
      type: "current",
      text: "Ship the API",
      workflowStatus: "blocked",
      stageName: "Dev",
      priorityRank: 2,
    },
    {
      projectId: "proj-a",
      type: "next",
      text: "Write the docs",
      workflowStatus: "weird_status",
      stageName: null,
    },
    {
      projectId: "proj-b",
      type: "current",
      text: "Untracked stage",
      workflowStatus: "done",
      stageName: "Dev",
    },
  ],
  risks: [
    {
      projectId: "proj-a",
      risk: "DB migration is risky",
      impact: "Delay",
      mitigation: "Dry run",
      severity: "blocked",
      stageName: "Dev",
    },
    {
      projectId: "proj-a",
      risk: "No stage attached",
      impact: "Minor",
      mitigation: "None",
      severity: "warning",
      stageName: null,
    },
  ],
  decisions: [
    {
      productId: "proj-a",
      text: "Adopt feature flags",
      owner: "Boris",
      impact: "Safer rollouts",
      deadline: "2026-06-15",
      stageName: "Planning",
    },
    {
      productId: null,
      text: "Department-wide decision",
      owner: "Head",
      impact: "Org",
      deadline: null,
      stageName: null,
    },
  ],
};

const nameById = new Map([["proj-a", "Alpha Product"]]);
const AUTHOR = "Snapshot Author";

describe("buildSnapshotStageMap", () => {
  it("returns null for a null payload", () => {
    expect(buildSnapshotStageMap(null)).toBeNull();
    expect(buildSnapshotStageMap(undefined)).toBeNull();
  });

  it("keys stages via normalizeStageName and stores raw traffic", () => {
    const map = buildSnapshotStageMap(payload);
    expect([...(map?.get("proj-a")?.keys() ?? [])]).toEqual(["dev", "testing"]);
    expect(map?.get("proj-a")?.get("dev")?.traffic).toBe("green");
  });

  it("attaches risks/items only when stageName is present and the stage entry exists", () => {
    const map = buildSnapshotStageMap(payload);
    const dev = map?.get("proj-a")?.get("dev");
    // risk with stageName null and the proj-b item (no stage entry) are skipped.
    expect(dev?.risks).toEqual([{ severity: "blocked" }]);
    expect(dev?.items).toEqual([{ workflowStatus: "blocked" }]);
    expect(map?.get("proj-b")).toBeUndefined();
  });
});

describe("applySnapshotStageOverrides", () => {
  const product: LeadProduct = {
    id: "proj-a",
    name: "Alpha Product",
    overallStatus: "on-track",
    stages: [
      {
        stageName: "Dev",
        status: "on-track",
        ownership: "mine",
        assignee: "Me",
      },
      {
        stageName: "Testing",
        status: "empty",
        ownership: "locked",
        assignee: "Someone",
      },
      {
        stageName: "Support",
        status: "on-track",
        ownership: "mine",
        assignee: "Me",
      },
    ],
  };

  it("returns products untouched when the map is null", () => {
    const products = [product];
    expect(applySnapshotStageOverrides(products, null)).toBe(products);
  });

  it("overrides own stages from snapshot traffic + captured risks/items, skipping locked ones", () => {
    const map = buildSnapshotStageMap(payload);
    const [result] = applySnapshotStageOverrides([product], map);
    // Dev: green ("on-track") escalated to "blocked" by the captured risk/item.
    expect(result.stages[0]).toEqual({
      ...product.stages[0],
      status: "blocked",
    });
    // Testing: locked — skipped even though the snapshot has "yellow" for it.
    expect(result.stages[1]).toBe(product.stages[1]);
    // Support: no snapshot entry — untouched.
    expect(result.stages[2]).toBe(product.stages[2]);
  });
});

describe("snapshot projections — null-payload invariant (design D4)", () => {
  it("all four projections return [] for a null payload, never the draft", () => {
    expect(mapSnapshotItems(null, nameById, AUTHOR, "current")).toEqual([]);
    expect(mapSnapshotItems(null, nameById, AUTHOR, "next")).toEqual([]);
    expect(mapSnapshotRisks(null, nameById)).toEqual([]);
    expect(mapSnapshotDecisions(null, nameById)).toEqual([]);
  });

  it("a payload without the projected array also yields []", () => {
    expect(mapSnapshotItems({}, nameById, AUTHOR, "current")).toEqual([]);
    expect(mapSnapshotRisks({}, nameById)).toEqual([]);
    expect(mapSnapshotDecisions({}, nameById)).toEqual([]);
  });
});

describe("mapSnapshotItems", () => {
  it("filters by type with snap:cw:/snap:nw: positional ids and priorityRank null-coalescing", () => {
    const current = mapSnapshotItems(payload, nameById, AUTHOR, "current");
    const next = mapSnapshotItems(payload, nameById, AUTHOR, "next");
    expect(current).toEqual([
      {
        id: "snap:cw:0",
        productId: "proj-a",
        productName: "Alpha Product",
        stageName: "Dev",
        status: "blocked",
        text: "Ship the API",
        author: AUTHOR,
        priorityRank: 2,
      },
      {
        id: "snap:cw:1",
        productId: "proj-b",
        productName: "proj-b",
        stageName: "Dev",
        status: "completed",
        text: "Untracked stage",
        author: AUTHOR,
        priorityRank: null,
      },
    ]);
    // Unknown workflow coerces to 'planned'; null stageName becomes undefined.
    expect(next).toEqual([
      {
        id: "snap:nw:0",
        productId: "proj-a",
        productName: "Alpha Product",
        stageName: undefined,
        status: "planned",
        text: "Write the docs",
        author: AUTHOR,
        priorityRank: null,
      },
    ]);
  });
});

describe("mapSnapshotRisks", () => {
  it("coerces non-'blocked' severity to 'at-risk' and uses snap:risk: ids", () => {
    const risks = mapSnapshotRisks(payload, nameById);
    expect(risks.map((r) => r.id)).toEqual(["snap:risk:0", "snap:risk:1"]);
    expect(risks.map((r) => r.severity)).toEqual(["blocked", "at-risk"]);
    // null stageName becomes undefined.
    expect(risks[1]).toEqual({
      id: "snap:risk:1",
      productId: "proj-a",
      productName: "Alpha Product",
      stageName: undefined,
      severity: "at-risk",
      text: "No stage attached",
      impact: "Minor",
      mitigation: "None",
    });
  });
});

describe("mapSnapshotDecisions", () => {
  it("maps decisions with snap:dec: ids; department decisions keep empty product fields", () => {
    const decisions = mapSnapshotDecisions(payload, nameById);
    expect(decisions).toEqual([
      {
        id: "snap:dec:0",
        productId: "proj-a",
        productName: "Alpha Product",
        text: "Adopt feature flags",
        owner: "Boris",
        impact: "Safer rollouts",
        deadline: "2026-06-15",
        stageName: "Planning",
      },
      {
        id: "snap:dec:1",
        productId: "",
        productName: "",
        text: "Department-wide decision",
        owner: "Head",
        impact: "Org",
        deadline: null,
        stageName: undefined,
      },
    ]);
  });
});
