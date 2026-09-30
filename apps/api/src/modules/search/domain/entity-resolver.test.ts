import type { SearchPlan } from "@customreport/shared";
import { describe, expect, it } from "vitest";

import { createClarificationTokenCodec } from "../application/clarification-token.js";
import { buildAccessibleEntityCatalog } from "./entity-resolver.catalog.js";
import {
  resolveAccessibleEntities,
  resolveSearchPlanEntities,
} from "./entity-resolver.plan.js";

const actorId = "actor-a";
const env = {
  AUTH_JWT_SECRET: "entity-resolver-test-secret-with-at-least-32-chars",
} as NodeJS.ProcessEnv;

const plan = (overrides: Partial<SearchPlan> = {}): SearchPlan => ({
  periods: {
    includeCurrent: true,
    published: { mode: "none", count: null, references: [] },
  },
  authors: { mode: "self", references: [], includeSelf: true },
  subjects: {
    parentKinds: [],
    productReferences: [],
    activityReferences: [],
    linkedActivityMode: "exclude",
  },
  stages: { references: [] },
  recordKinds: [],
  filters: {
    itemTypes: [],
    itemWorkflowStatuses: [],
    riskSeverities: [],
    decisionStates: [],
    decisionTiming: [],
    canonicalHealth: [],
    carriedOver: null,
    hasPriority: null,
    priorityRanks: [],
  },
  retrieval: { mode: "structured", semanticQuery: null },
  output: {
    mode: "list",
    groupBy: [],
    requestedLimit: null,
    exhaustive: false,
  },
  ...overrides,
});

const catalog = buildAccessibleEntityCatalog([
  {
    kind: "author",
    id: actorId,
    label: "Alex Lead",
    aliases: ["Alex Lead"],
  },
  {
    kind: "product",
    id: "product-a",
    label: "Platform API",
    aliases: ["Platform—API"],
  },
  {
    kind: "product",
    id: "product-b",
    label: "Platform API",
    aliases: ["Platform API"],
  },
  {
    kind: "activity",
    id: "activity-a",
    label: "On-call",
    aliases: ["OPS—TEAM"],
  },
  {
    kind: "period",
    id: "period-a",
    label: "Week 31",
    aliases: ["Week 31"],
  },
]);

const baseInput = (nextPlan: SearchPlan) => ({
  plan: nextPlan,
  actorId,
  occurrences: [],
  sectionScopes: [],
  catalog,
  resolutionTokens: [],
  tokenCodec: createClarificationTokenCodec(env),
});

describe("accessible entity resolution", () => {
  it("resolves only exact aliases from the accessible catalog", () => {
    const result = resolveAccessibleEntities(
      baseInput(
        plan({
          authors: {
            mode: "selected",
            references: [" alex   lead "],
            includeSelf: false,
          },
          subjects: {
            parentKinds: ["product"],
            productReferences: ["platform—api"],
            activityReferences: [],
            linkedActivityMode: "exclude",
          },
        }),
      ),
    );

    expect(result).toEqual({
      kind: "resolved",
      references: {
        authorIds: [actorId],
        productIds: ["product-a"],
        activityIds: [],
        stageIds: [],
        periodIds: [],
      },
    });
  });

  it("returns no_results for an inaccessible or fuzzy reference", () => {
    const result = resolveAccessibleEntities(
      baseInput(
        plan({
          subjects: {
            parentKinds: ["product"],
            productReferences: ["Secret Platform"],
            activityReferences: [],
            linkedActivityMode: "exclude",
          },
        }),
      ),
    );

    expect(result).toEqual({ kind: "no_results" });
  });

  it("returns labeled opaque options for accessible ambiguity only", () => {
    const result = resolveAccessibleEntities(
      baseInput(
        plan({
          subjects: {
            parentKinds: ["product"],
            productReferences: ["Platform API"],
            activityReferences: [],
            linkedActivityMode: "exclude",
          },
        }),
      ),
    );

    expect(result.kind).toBe("clarification_required");
    if (result.kind !== "clarification_required") return;
    expect(result.options.map(({ label }) => label)).toEqual([
      "Platform API",
      "Platform API",
    ]);
    expect(
      result.options.every(({ token }) => token.split(".").length === 3),
    ).toBe(true);
  });

  it("accepts a selected token only while its entity remains accessible", () => {
    const codec = createClarificationTokenCodec(env);
    const token = codec.encode({
      actorId,
      entityKind: "product",
      entityId: "product-b",
      reference: "Platform API",
    });
    const input = {
      ...baseInput(
        plan({
          subjects: {
            parentKinds: ["product"],
            productReferences: ["Platform API"],
            activityReferences: [],
            linkedActivityMode: "exclude",
          },
        }),
      ),
      resolutionTokens: [token],
    };

    expect(resolveAccessibleEntities(input)).toEqual({
      kind: "resolved",
      references: {
        authorIds: [actorId],
        productIds: ["product-b"],
        activityIds: [],
        stageIds: [],
        periodIds: [],
      },
    });

    const aclChanged = {
      ...input,
      catalog: buildAccessibleEntityCatalog(
        catalog.entities.filter((entity) => entity.id !== "product-b"),
      ),
    };
    expect(resolveAccessibleEntities(aclChanged)).toEqual({
      kind: "no_results",
    });
  });

  it("rejects a token from another actor before using its entity id", () => {
    const codec = createClarificationTokenCodec(env);
    const token = codec.encode({
      actorId: "actor-b",
      entityKind: "product",
      entityId: "product-a",
      reference: "Platform API",
    });
    const result = resolveAccessibleEntities({
      ...baseInput(
        plan({
          subjects: {
            parentKinds: ["product"],
            productReferences: ["Platform API"],
            activityReferences: [],
            linkedActivityMode: "exclude",
          },
        }),
      ),
      resolutionTokens: [token],
    });

    expect(result).toEqual({ kind: "no_results" });
  });

  it("resolves canonical stages and carries occurrences into the internal plan", () => {
    const input = {
      ...baseInput(plan({ stages: { references: ["Dev", "Testing"] } })),
      tokenCodec: createClarificationTokenCodec(env),
    };
    const result = resolveSearchPlanEntities(input);

    expect(result.kind).toBe("resolved");
    if (result.kind !== "resolved") return;
    expect(result.plan.stageIds).toEqual(["Development", "Testing"]);
    expect(result.plan.occurrences).toEqual([]);
    expect(result.plan.sectionScopes).toEqual([]);
  });
});
