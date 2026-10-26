import type { ReportSectionReadModel } from "@weeklyreport/shared";
import { draftSaveSchema } from "@weeklyreport/shared";
import { describe, expect, it } from "vitest";

import { expectDefined } from "../../../../test-utils/expect-defined";
import { makeReportSectionFixture } from "../../../../test-utils/report-section-fixtures";
import { applyDraftPatch } from "../lead-form/draft/lead-form-draft-patch";
import { sectionToDraftPayload } from "../lead-section-draft-payload";
import {
  buildConfirmAllCarriedPatch,
  buildConfirmCarriedItemPatch,
  buildMoveItemPatch,
  continuationConflict,
  continueToNextPatch,
  isUnconfirmedCarried,
  markCompletePatch,
  moveToCurrentWeekPatch,
  moveToNextWeekPatch,
  pauseItemPatch,
  promoteContinuationPatch,
} from "./lead-item-actions";

type LeadItem = ReportSectionReadModel["items"][number];

function itemWriteValid(item: Partial<LeadItem>): boolean {
  const merged = { ...carriedItem(), ...item };
  return draftSaveSchema.safeParse({
    reportSectionId: "44444444-4444-4444-8444-444444444444",
    version: 1,
    projectStatuses: [],
    activityStatuses: [],
    items: [
      {
        stableId: merged.stableId,
        projectId: merged.projectId,
        type: merged.type,
        text: merged.text,
        tag: merged.tag,
        workflowStatus: merged.workflowStatus,
        carriedOver: merged.carriedOver,
        pausedReason: merged.pausedReason,
        nextStepText: merged.nextStepText,
        stageNames: merged.stageNames,
      },
    ],
    risks: [],
    decisions: [],
  }).success;
}

function carriedItem(): LeadItem {
  return {
    id: "11111111-1111-4111-8111-111111111111",
    stableId: "22222222-2222-4222-8222-222222222222",
    projectId: "33333333-3333-4333-8333-333333333333",
    type: "current",
    text: "Carried-in work",
    tag: "feature",
    workflowStatus: "in_progress",
    carriedOver: true,
    priorityRank: 3,
    comments: [
      {
        id: "55555555-5555-4555-8555-555555555555",
        reviewerId: "66666666-6666-4666-8666-666666666666",
        reviewerName: "Reviewer",
        text: "Keep this context",
        createdAt: new Date("2026-09-14T00:00:00.000Z"),
      },
    ],
    stageNames: ["Planning"],
  };
}

function section(
  item: LeadItem = carriedItem(),
  status: "draft" | "submitted" = "draft",
): ReportSectionReadModel {
  return makeReportSectionFixture({
    reportSectionId: "77777777-7777-4777-8777-777777777777",
    status,
    items: [item],
    projects: [
      {
        projectId: "33333333-3333-4333-8333-333333333333",
        projectName: "Product",
        trafficLight: "green",
      },
    ],
  });
}

describe("moveToNextWeekPatch", () => {
  it("changes only the week and carried marker", () => {
    const patch = moveToNextWeekPatch();
    expect(patch).toEqual({
      type: "next",
      carriedOver: false,
    });
  });

  it("preserves workflow status and identity", () => {
    const moved = { ...carriedItem(), ...moveToNextWeekPatch() };
    expect(moved.type).toBe("next");
    expect(moved.workflowStatus).toBe("in_progress");
    expect(moved.carriedOver).toBe(false);
    // Durable identity is preserved — the published-lock and comment anchors
    // key on stableId, so the move must not touch it.
    expect(moved.stableId).toBe("22222222-2222-4222-8222-222222222222");
    expect(moved.id).toBe("11111111-1111-4111-8111-111111111111");
  });
});

describe("moveToCurrentWeekPatch", () => {
  it("changes only the week", () => {
    expect(moveToCurrentWeekPatch()).toEqual({
      type: "current",
    });
  });

  it("preserves a paused status and its reason", () => {
    const paused = { ...carriedItem(), ...pauseItemPatch("blocked upstream") };
    const promoted = { ...paused, ...moveToCurrentWeekPatch() };
    expect(promoted.workflowStatus).toBe("paused");
    expect(promoted.pausedReason).toBe("blocked upstream");
    expect(
      draftSaveSchema.safeParse({
        reportSectionId: "44444444-4444-4444-8444-444444444444",
        version: 1,
        projectStatuses: [],
        activityStatuses: [],
        items: [
          {
            stableId: promoted.stableId,
            projectId: promoted.projectId,
            type: promoted.type,
            text: promoted.text,
            tag: promoted.tag,
            workflowStatus: promoted.workflowStatus,
            carriedOver: promoted.carriedOver,
            pausedReason: promoted.pausedReason,
            stageNames: promoted.stageNames,
          },
        ],
        risks: [],
        decisions: [],
      }).success,
    ).toBe(true);
  });

  it("round-trips with moveToNextWeekPatch, preserving durable identity", () => {
    const deferred = { ...carriedItem(), ...moveToNextWeekPatch() };
    const pulledBack = { ...deferred, ...moveToCurrentWeekPatch() };
    expect(pulledBack.type).toBe("current");
    expect(pulledBack.workflowStatus).toBe("in_progress");
    expect(pulledBack.carriedOver).toBe(false);
    expect(pulledBack.stableId).toBe("22222222-2222-4222-8222-222222222222");
    expect(pulledBack.id).toBe("11111111-1111-4111-8111-111111111111");
  });
});

describe("buildMoveItemPatch", () => {
  it.each(["next", "current"] as const)(
    "moves the same record to %s without changing saved fields",
    (target) => {
      const source =
        target === "next"
          ? carriedItem()
          : { ...carriedItem(), type: "next" as const, carriedOver: false };
      const original = section(source);
      const patch = buildMoveItemPatch(original, source.id ?? "", target);

      expect(patch).not.toBeNull();
      const moved = applyDraftPatch(original, expectDefined(patch));

      expect(moved.items).toHaveLength(1);
      expect(moved.items[0]).toMatchObject({
        id: source.id,
        stableId: source.stableId,
        type: target,
        text: source.text,
        workflowStatus: source.workflowStatus,
        priorityRank: source.priorityRank,
        comments: source.comments,
      });
      expect(moved.items[0]?.carriedOver).toBe(false);
      expect(original.items[0]).toEqual(source);
    },
  );

  it("returns no patch for a retry or an existing target lineage", () => {
    const source = { ...carriedItem(), carriedOver: false };
    expect(
      buildMoveItemPatch(section(source), source.id ?? "", "current"),
    ).toBeNull();

    const duplicate = {
      ...source,
      id: "88888888-8888-4888-8888-888888888888",
      type: "next" as const,
    };
    const conflicted = {
      ...section(source),
      items: [source, duplicate],
    };
    const conflictedBefore = structuredClone(conflicted);
    expect(buildMoveItemPatch(conflicted, source.id ?? "", "next")).toBeNull();
    // An explicit Next blocks the colliding move: the refused move touches
    // neither occurrence (a deep snapshot catches an in-place mutation).
    expect(conflicted).toEqual(conflictedBefore);
    expect(
      conflicted.items.filter(
        (item) => item.stableId === source.stableId && item.type === "next",
      ),
    ).toHaveLength(1);

    // A published source is read-only: no patch and no mutation.
    const published = section(source, "submitted");
    const publishedBefore = structuredClone(published);
    expect(buildMoveItemPatch(published, source.id ?? "", "next")).toBeNull();
    expect(published).toEqual(publishedBefore);
    expect(published.status).toBe("submitted");
  });

  it("keeps at most one target occurrence when the same move is saved twice", () => {
    const source = { ...carriedItem(), carriedOver: false };
    const original = section(source);
    const moved = applyDraftPatch(
      original,
      expectDefined(buildMoveItemPatch(original, source.id ?? "", "next")),
    );

    // A second attempt is a placement no-op, not another occurrence.
    expect(buildMoveItemPatch(moved, source.id ?? "", "next")).toBeNull();
    expect(moved.items).toHaveLength(1);
    expect(
      moved.items.filter(
        (item) => item.stableId === source.stableId && item.type === "next",
      ),
    ).toHaveLength(1);
  });

  it("preserves postponed status when explicitly moving Next to Current", () => {
    const source = {
      ...carriedItem(),
      type: "next" as const,
      workflowStatus: "postponed" as const,
      carriedOver: false,
    };
    const original = section(source);
    const patch = buildMoveItemPatch(original, source.id ?? "", "current");

    expect(patch).not.toBeNull();
    expect(
      applyDraftPatch(original, expectDefined(patch)).items[0],
    ).toMatchObject({
      type: "current",
      workflowStatus: "postponed",
    });
  });

  it.each([
    ["terminal", section({ ...carriedItem(), workflowStatus: "done" })],
    [
      "cancelled",
      section({
        ...carriedItem(),
        resolution: {
          kind: "wont_do",
          eventId: "99999999-9999-4999-8999-999999999999",
          reason: "No longer needed",
          actorId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
          actorName: "Lead",
          occurredAt: "2026-09-14T00:00:00.000Z",
          previousState: {
            type: "current",
            workflowStatus: "in_progress",
            pausedReason: null,
            nextStepText: null,
            text: "Carried-in work",
          },
        },
      }),
    ],
    ["submitted", section(carriedItem(), "submitted")],
    ["foreign", section(carriedItem())],
    [
      "legacy commitment",
      section({ ...carriedItem(), nextStepText: "Preserve this commitment" }),
    ],
  ])("returns no patch for %s work", (kind, candidate) => {
    const itemId = kind === "foreign" ? crypto.randomUUID() : carriedItem().id;
    expect(buildMoveItemPatch(candidate, itemId ?? "", "next")).toBeNull();
  });
});

describe("buildConfirmCarriedItemPatch", () => {
  it("clears only the carried marker on an owned Current occurrence", () => {
    const original = section();
    const patch = buildConfirmCarriedItemPatch(
      original,
      carriedItem().id ?? "",
    );

    expect(patch).not.toBeNull();
    const confirmed = applyDraftPatch(original, expectDefined(patch));
    expect(confirmed.items[0]).toEqual({
      ...original.items[0],
      carriedOver: false,
    });
  });

  it("is idempotent and unavailable for Next, submitted or foreign work", () => {
    const confirmed = { ...carriedItem(), carriedOver: false };
    const next = {
      ...carriedItem(),
      type: "next" as const,
      carriedOver: false,
    };

    expect(
      buildConfirmCarriedItemPatch(section(confirmed), confirmed.id ?? ""),
    ).toBeNull();
    expect(
      buildConfirmCarriedItemPatch(section(next), next.id ?? ""),
    ).toBeNull();
    expect(
      buildConfirmCarriedItemPatch(
        section(carriedItem(), "submitted"),
        carriedItem().id ?? "",
      ),
    ).toBeNull();
    expect(
      buildConfirmCarriedItemPatch(section(next), crypto.randomUUID()),
    ).toBeNull();
  });
});

function sectionOf(
  items: readonly LeadItem[],
  status: "draft" | "submitted" = "draft",
): ReportSectionReadModel {
  return { ...section(carriedItem(), status), items: [...items] };
}

describe("buildConfirmAllCarriedPatch", () => {
  function pending(index: number): LeadItem {
    return {
      ...carriedItem(),
      id: `1000000${index}-1111-4111-8111-111111111111`,
      stableId: `2000000${index}-2222-4222-8222-222222222222`,
    };
  }

  it("clears the marker on all N pending continuations in one patch", () => {
    const original = sectionOf([
      pending(1),
      pending(2),
      pending(3),
      pending(4),
    ]);
    const patch = expectDefined(buildConfirmAllCarriedPatch(original));
    const confirmed = applyDraftPatch(original, patch);

    expect(confirmed.items).toHaveLength(4);
    expect(confirmed.items.map((item) => item.carriedOver)).toEqual([
      false,
      false,
      false,
      false,
    ]);
    expect(confirmed.items.map((item) => item.id)).toEqual(
      original.items.map((item) => item.id),
    );
  });

  it("leaves decided, Next and cancelled rows unchanged", () => {
    const decided = { ...pending(1), carriedOver: false, text: "Decided" };
    const next = { ...pending(2), type: "next" as const, carriedOver: false };
    const paused = {
      ...pending(3),
      carriedOver: false,
      workflowStatus: "paused" as const,
      pausedReason: "Waiting",
    };
    const original = sectionOf([decided, pending(4), next, paused]);
    const confirmed = applyDraftPatch(
      original,
      expectDefined(buildConfirmAllCarriedPatch(original)),
    );

    expect(confirmed.items[0]).toBe(original.items[0]);
    expect(confirmed.items[2]).toBe(original.items[2]);
    expect(confirmed.items[3]).toBe(original.items[3]);
    expect(confirmed.items[1]).toEqual({
      ...original.items[1],
      carriedOver: false,
    });
  });

  it("is unavailable with nothing pending or outside a draft", () => {
    const decided = { ...pending(1), carriedOver: false };
    expect(buildConfirmAllCarriedPatch(sectionOf([decided]))).toBeNull();
    expect(buildConfirmAllCarriedPatch(sectionOf([]))).toBeNull();
    expect(
      buildConfirmAllCarriedPatch(sectionOf([pending(1)], "submitted")),
    ).toBeNull();
  });
});

describe("markCompletePatch", () => {
  it("marks the item done in place and drops any next-period commitment", () => {
    expect(markCompletePatch()).toEqual({
      workflowStatus: "done",
      nextStepText: null,
      pausedReason: null,
      carriedOver: false,
    });
  });
});

describe("next-period commitment normalization", () => {
  it("clears nextStepText only when completing an item", () => {
    const withNextStep = { ...carriedItem(), nextStepText: "Follow up" };

    expect({ ...withNextStep, ...markCompletePatch() }.nextStepText).toBeNull();
  });
});

describe("pauseItemPatch", () => {
  it("pauses the item in place with the given reason", () => {
    expect(pauseItemPatch("waiting on a dependency")).toEqual({
      workflowStatus: "paused",
      pausedReason: "waiting on a dependency",
    });
  });

  it("preserves durable identity when applied to an existing item", () => {
    const paused = { ...carriedItem(), ...pauseItemPatch("blocked upstream") };
    expect(paused.workflowStatus).toBe("paused");
    expect(paused.pausedReason).toBe("blocked upstream");
    expect(paused.stableId).toBe("22222222-2222-4222-8222-222222222222");
    expect(paused.id).toBe("11111111-1111-4111-8111-111111111111");
  });
});

describe("continueToNextPatch", () => {
  it("keeps the Current row and records the next intent without a type flip", () => {
    const patch = continueToNextPatch("Ship the follow-up");
    expect(patch).toEqual({
      type: "current",
      nextStepText: "Ship the follow-up",
    });
    const continued = { ...carriedItem(), ...patch };
    expect(continued.type).toBe("current");
    expect(continued.nextStepText).toBe("Ship the follow-up");
    expect(itemWriteValid(patch)).toBe(true);
  });
});

describe("promoteContinuationPatch", () => {
  it("moves the continuation into text and clears commitment and pause state", () => {
    const paused = { ...carriedItem(), ...pauseItemPatch("blocked upstream") };
    const promoted = {
      ...paused,
      ...promoteContinuationPatch("Follow-up work"),
    };
    expect(promoted.text).toBe("Follow-up work");
    expect(promoted.nextStepText).toBeNull();
    expect(promoted.workflowStatus).toBe("in_progress");
    expect(promoted.pausedReason).toBeNull();
    expect(promoted.carriedOver).toBe(false);
    expect(itemWriteValid(promoteContinuationPatch("Follow-up work"))).toBe(
      true,
    );
  });
});

describe("continuationConflict", () => {
  it("flags a different existing commitment but allows same or blank", () => {
    expect(continuationConflict({ nextStepText: "Old plan" }, "New plan")).toBe(
      true,
    );
    expect(
      continuationConflict({ nextStepText: "New plan" }, "  New plan  "),
    ).toBe(false);
    expect(continuationConflict({ nextStepText: null }, "New plan")).toBe(
      false,
    );
  });
});

describe("explicit section completion", () => {
  it("confirms carried paused work through the latest draft command without losing identity", () => {
    const raw = {
      ...carriedItem(),
      workflowStatus: "paused" as const,
      pausedReason: "Waiting for approval",
      nextStepText: "Old commitment",
    };
    const completed = applyDraftPatch(section(raw), {
      kind: "complete-item",
      itemId: raw.id ?? "",
    });
    const result = expectDefined(completed.items[0]);
    expect(result).toMatchObject({
      id: raw.id,
      stableId: raw.stableId,
      text: "Carried-in work",
      priorityRank: 3,
      workflowStatus: "done",
      pausedReason: null,
      carriedOver: false,
      nextStepText: null,
      comments: raw.comments,
    });
    expect(sectionToDraftPayload(completed).items[0]).toMatchObject({
      workflowStatus: "done",
      pausedReason: null,
      carriedOver: false,
      nextStepText: null,
    });
    expect(isUnconfirmedCarried(result)).toBe(false);
    expect(raw.carriedOver).toBe(true);
  });
});
