import type { ReportSectionReadModel } from "@weeklyreport/shared";
import { describe, expect, it } from "vitest";

import { expectDefined } from "../../../../test-utils/expect-defined";
import { makeReportSectionFixture } from "../../../../test-utils/report-section-fixtures";
import { applyDraftPatch } from "../lead-form/draft/lead-form-draft-patch";
import {
  buildMoveItemPatch,
  buildNextWeekPlanAcknowledgementPatch,
  isSavedNextWeekPlan,
} from "./lead-item-actions";

type LeadItem = ReportSectionReadModel["items"][number];

function currentItem(): LeadItem {
  return {
    id: "11111111-1111-4111-8111-111111111111",
    stableId: "22222222-2222-4222-8222-222222222222",
    projectId: "33333333-3333-4333-8333-333333333333",
    activityId: null,
    type: "current",
    text: "Carried-in work",
    tag: "feature",
    workflowStatus: "in_progress",
    carriedOver: false,
    stageNames: ["Planning"],
  };
}

function section(
  item: LeadItem = currentItem(),
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

describe("buildMoveItemPatch with a saved next step", () => {
  it("keeps a Current occurrence in place when it already plans next week", () => {
    const source = {
      ...currentItem(),
      carriedOver: true,
      nextStepText: "Preserve this commitment",
    };
    const original = section(source);

    // A placement move cannot keep the saved commitment, so it stays refused;
    // the acknowledgement is the only action for this occurrence.
    expect(buildMoveItemPatch(original, source.id ?? "", "next")).toBeNull();

    const acknowledgment = expectDefined(
      buildNextWeekPlanAcknowledgementPatch(original, source.id ?? ""),
    );
    expect(acknowledgment).toEqual({
      kind: "item-patch",
      itemId: source.id,
      patch: { carriedOver: false },
    });
    const confirmed = applyDraftPatch(original, acknowledgment);
    expect(confirmed.items).toHaveLength(1);
    expect(confirmed.items[0]).toMatchObject({
      id: source.id,
      stableId: source.stableId,
      type: "current",
      text: source.text,
      workflowStatus: "in_progress",
      nextStepText: "Preserve this commitment",
      carriedOver: false,
    });
    // Neither the saved result nor the commitment is rewritten in place.
    expect(original.items[0]).toEqual(source);
  });

  it("still moves a Next occurrence with a saved step into Current", () => {
    const source = {
      ...currentItem(),
      type: "next" as const,
      nextStepText: "Carry this forward",
    };
    const original = section(source);

    expect(
      applyDraftPatch(
        original,
        expectDefined(buildMoveItemPatch(original, source.id ?? "", "current")),
      ).items[0],
    ).toMatchObject({
      type: "current",
      nextStepText: "Carry this forward",
      carriedOver: false,
    });
  });
});

describe("buildNextWeekPlanAcknowledgementPatch", () => {
  it("returns no patch outside unfinished Current draft work", () => {
    const committed = { ...currentItem(), nextStepText: "Follow up" };

    expect(
      buildNextWeekPlanAcknowledgementPatch(
        section({ ...committed, type: "next" as const }),
        committed.id ?? "",
      ),
    ).toBeNull();
    expect(
      buildNextWeekPlanAcknowledgementPatch(
        section({ ...committed, nextStepText: null }),
        committed.id ?? "",
      ),
    ).toBeNull();
    expect(
      buildNextWeekPlanAcknowledgementPatch(
        section(committed, "submitted"),
        committed.id ?? "",
      ),
    ).toBeNull();
  });
});

describe("isSavedNextWeekPlan", () => {
  it("recognizes a draft Current occurrence that already plans next week", () => {
    const committed = { ...currentItem(), nextStepText: "Follow up" };

    expect(isSavedNextWeekPlan(section(committed), committed.id ?? "")).toBe(
      true,
    );
  });

  it("is false outside unfinished Current draft work", () => {
    const committed = { ...currentItem(), nextStepText: "Follow up" };
    const resolved = {
      ...committed,
      resolution: {
        kind: "wont_do" as const,
        eventId: "99999999-9999-4999-8999-999999999999",
        reason: "No longer needed",
        actorId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
        actorName: "Lead",
        occurredAt: "2026-09-14T00:00:00.000Z",
        previousState: {
          type: "current" as const,
          workflowStatus: "in_progress" as const,
          pausedReason: null,
          nextStepText: null,
          text: "Carried-in work",
        },
      },
    };

    expect(
      isSavedNextWeekPlan(
        section({ ...committed, type: "next" as const }),
        committed.id ?? "",
      ),
    ).toBe(false);
    expect(
      isSavedNextWeekPlan(
        section({ ...committed, nextStepText: " ".repeat(3) }),
        committed.id ?? "",
      ),
    ).toBe(false);
    expect(
      isSavedNextWeekPlan(
        section({ ...committed, workflowStatus: "done" as const }),
        committed.id ?? "",
      ),
    ).toBe(false);
    expect(
      isSavedNextWeekPlan(
        section({ ...committed, nextStepText: null }),
        committed.id ?? "",
      ),
    ).toBe(false);
    expect(isSavedNextWeekPlan(section(resolved), committed.id ?? "")).toBe(
      false,
    );
    expect(
      isSavedNextWeekPlan(section(committed, "submitted"), committed.id ?? ""),
    ).toBe(false);
  });
});
