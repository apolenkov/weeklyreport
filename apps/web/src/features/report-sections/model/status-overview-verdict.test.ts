import type { ReportSectionReadModel } from "@weeklyreport/shared";
import { draftSaveSchema, resolvePlanInputSchema } from "@weeklyreport/shared";
import { describe, expect, it } from "vitest";

import { applyDraftPatch } from "./lead-form/draft/lead-form-draft-patch";
import {
  type PlanVerdict,
  type PlanVerdictWrite,
  planVerdictWrite,
  priorVerdictState,
} from "./status-overview-verdict";

type SectionItem = ReportSectionReadModel["items"][number];

const REPORT_ID = "10000000-0000-4000-8000-000000000001";
const PRIOR_ID = "10000000-0000-4000-8000-000000000002";
const LINKED_ID = "10000000-0000-4000-8000-000000000003";
const STABLE_ID = "10000000-0000-4000-8000-000000000004";
const PRODUCT_ID = "10000000-0000-4000-8000-000000000005";
const SECTION_ID = "10000000-0000-4000-8000-000000000006";
const COMMAND_ID = "10000000-0000-4000-8000-000000000007";

const REST_STATE_FIELDS = ["tag", "stageNames", "priorityRank"] as const;

function item(overrides: Partial<SectionItem> = {}): SectionItem {
  return {
    id: PRIOR_ID,
    stableId: STABLE_ID,
    projectId: PRODUCT_ID,
    type: "current",
    text: "Ship the importer",
    tag: "delivery",
    workflowStatus: "in_progress",
    carriedOver: false,
    priorityRank: 2,
    stageNames: ["Development", "QA"],
    ...overrides,
  };
}

function carried(overrides: Partial<SectionItem> = {}): SectionItem {
  return item({
    id: LINKED_ID,
    workflowStatus: "planned",
    carriedOver: true,
    ...overrides,
  });
}

function write(
  verdict: PlanVerdict,
  linked: SectionItem | null,
  reason?: string,
): PlanVerdictWrite {
  return planVerdictWrite({
    verdict,
    reason,
    prior: { reportId: REPORT_ID, item: item() },
    linked,
  });
}

function patchOf(result: PlanVerdictWrite): Partial<SectionItem> {
  if (result.kind !== "item-patch") throw new Error(`got ${result.kind}`);
  return result.patch;
}

function appliedItem(linked: SectionItem, patch: Partial<SectionItem>) {
  const section = {
    items: [linked],
    status: "draft",
  } as unknown as ReportSectionReadModel;
  const [applied] = applyDraftPatch(section, {
    kind: "item-patch",
    itemId: linked.id ?? "",
    patch,
  }).items;
  if (!applied) throw new Error("item lost");
  return applied;
}

function isValidWrite(row: SectionItem): boolean {
  return draftSaveSchema.safeParse({
    reportSectionId: SECTION_ID,
    version: 1,
    projectStatuses: [],
    activityStatuses: [],
    items: [
      {
        stableId: row.stableId,
        projectId: row.projectId,
        type: row.type,
        text: row.text,
        tag: row.tag,
        workflowStatus: row.workflowStatus,
        carriedOver: row.carriedOver,
        pausedReason: row.pausedReason,
        nextStepText: row.nextStepText,
        stageNames: row.stageNames,
      },
    ],
    risks: [],
    decisions: [],
  }).success;
}

function parsesAsCommand(result: PlanVerdictWrite): boolean {
  if (result.kind !== "resolve-plan") throw new Error(`got ${result.kind}`);
  return resolvePlanInputSchema.safeParse({
    ...result.input,
    reportSectionId: SECTION_ID,
    version: 1,
    commandId: COMMAND_ID,
  }).success;
}

describe("planVerdictWrite with a linked occurrence", () => {
  it("marks done: clears the carried marker and any next step", () => {
    const linked = carried({ nextStepText: "Follow up" });
    const result = write("done", linked);
    expect(result).toEqual({
      kind: "item-patch",
      itemId: LINKED_ID,
      patch: {
        type: "current",
        workflowStatus: "done",
        pausedReason: null,
        nextStepText: null,
        carriedOver: false,
      },
    });
    expect(isValidWrite(appliedItem(linked, patchOf(result)))).toBe(true);
  });

  it("continues: only clears the marker and keeps planned", () => {
    const linked = carried();
    const result = write("continue", linked);
    expect(patchOf(result)).toEqual({ type: "current", carriedOver: false });
    const applied = appliedItem(linked, patchOf(result));
    expect(applied.workflowStatus).toBe("planned");
    expect(applied.carriedOver).toBe(false);
  });

  it("continues an in-progress carried item without promoting it", () => {
    const linked = carried({ workflowStatus: "in_progress" });
    expect(patchOf(write("continue", linked))).not.toHaveProperty(
      "workflowStatus",
    );
  });

  it("continue returns a done or paused occurrence to planned", () => {
    const paused = carried({
      workflowStatus: "paused",
      pausedReason: "Waiting",
      carriedOver: false,
    });
    const result = write("continue", paused);
    expect(patchOf(result)).toMatchObject({
      workflowStatus: "planned",
      pausedReason: null,
    });
    expect(isValidWrite(appliedItem(paused, patchOf(result)))).toBe(true);
    expect(
      patchOf(write("continue", carried({ workflowStatus: "done" }))),
    ).toMatchObject({ workflowStatus: "planned" });
  });

  it("pauses with a trimmed reason as a paused Current occurrence", () => {
    const linked = carried();
    const result = write("paused", linked, "  Waiting for vendor  ");
    expect(patchOf(result)).toEqual({
      type: "current",
      workflowStatus: "paused",
      pausedReason: "Waiting for vendor",
      carriedOver: false,
    });
    expect(isValidWrite(appliedItem(linked, patchOf(result)))).toBe(true);
  });

  it("pauses a Next-placed record back into Current", () => {
    const linked = carried({ type: "next", carriedOver: false });
    const applied = appliedItem(linked, patchOf(write("paused", linked, "x")));
    expect(applied.type).toBe("current");
    expect(isValidWrite(applied)).toBe(true);
  });

  it("requires a reason for paused and won't do", () => {
    expect(() => write("paused", carried(), " ".repeat(3))).toThrow(/paused/);
    expect(() => write("paused", carried())).toThrow(/paused/);
    expect(() => write("wont_do", carried(), "")).toThrow(/not be done/);
    expect(() => write("wont_do", null)).toThrow(/not be done/);
  });

  it("moves a plain Current occurrence to Next as one planned Next record", () => {
    const linked = carried({ workflowStatus: "in_progress" });
    const result = write("next", linked);
    const applied = appliedItem(linked, patchOf(result));
    expect(applied).toMatchObject({
      type: "next",
      workflowStatus: "planned",
      carriedOver: false,
      pausedReason: null,
      nextStepText: null,
    });
    expect(isValidWrite(applied)).toBe(true);
  });

  it("does not duplicate an explicit Next record", () => {
    expect(
      write("next", carried({ type: "next", carriedOver: false })),
    ).toEqual({ kind: "already-recorded" });
  });

  it("never creates a second Next when a separate Next record exists", () => {
    const linked = carried();
    const nextRecord = item({
      id: PRIOR_ID,
      type: "next",
      workflowStatus: "planned",
    });
    const result = planVerdictWrite({
      verdict: "next",
      prior: { reportId: REPORT_ID, item: item() },
      linked,
      siblings: [linked, nextRecord],
    });
    expect(result).toEqual({ kind: "already-recorded" });
  });

  it("does not duplicate a Next commitment carried on the Current record", () => {
    const linked = carried({ nextStepText: "Phase two" });
    const result = write("next", linked);
    expect(patchOf(result)).toEqual({ carriedOver: false });
    expect(appliedItem(linked, patchOf(result)).type).toBe("current");
  });

  it("records won't do through the command on the linked record", () => {
    const result = write("wont_do", carried(), " Out of scope ");
    expect(result).toEqual({
      kind: "resolve-plan",
      input: {
        source: { kind: "current", recordId: LINKED_ID },
        outcome: "wont_do",
        reason: "Out of scope",
      },
    });
    expect(parsesAsCommand(result)).toBe(true);
  });

  it("blocks a verdict on a cancelled or unsaved occurrence", () => {
    const resolved = carried({
      resolution: { kind: "wont_do" } as SectionItem["resolution"],
    });
    expect(write("done", resolved).kind).toBe("blocked");
    expect(write("done", { ...carried(), id: undefined }).kind).toBe("blocked");
  });

  it.each(["done", "continue", "paused", "next"] as const)(
    "never touches stages, tag or priority for %s",
    (verdict) => {
      const result = write(verdict, carried(), "reason");
      for (const field of REST_STATE_FIELDS)
        expect(patchOf(result)).not.toHaveProperty(field);
      const applied = appliedItem(carried(), patchOf(result));
      expect(applied.stageNames).toEqual(["Development", "QA"]);
      expect(applied.tag).toBe("delivery");
      expect(applied.priorityRank).toBe(2);
    },
  );
});

describe("planVerdictWrite without an occurrence in the selected week", () => {
  it.each([
    ["done", "done"],
    ["continue", "continue"],
    ["next", "plan_next"],
  ] as const)("maps %s to the prior outcome %s", (verdict, outcome) => {
    const result = write(verdict, null);
    expect(result).toEqual({
      kind: "resolve-plan",
      input: {
        source: { kind: "prior", reportId: REPORT_ID, recordId: PRIOR_ID },
        outcome,
        stageNames: ["Development", "QA"],
        priorityRank: 2,
      },
    });
    expect(parsesAsCommand(result)).toBe(true);
  });

  it("creates paused through continue plus a follow-up on the new occurrence", () => {
    const result = write("paused", null, "Waiting");
    expect(result).toMatchObject({
      kind: "resolve-plan",
      input: { outcome: "continue", source: { kind: "prior" } },
      thenPatch: { workflowStatus: "paused", pausedReason: "Waiting" },
    });
    expect(parsesAsCommand(result)).toBe(true);
  });

  it("records won't do with only its reason", () => {
    const result = write("wont_do", null, "Dropped");
    expect(result).toEqual({
      kind: "resolve-plan",
      input: {
        source: { kind: "prior", reportId: REPORT_ID, recordId: PRIOR_ID },
        outcome: "wont_do",
        reason: "Dropped",
      },
    });
    expect(parsesAsCommand(result)).toBe(true);
  });

  it("preserves a missing priority as null and never writes the prior week", () => {
    const result = planVerdictWrite({
      verdict: "done",
      prior: { reportId: REPORT_ID, item: item({ priorityRank: null }) },
      linked: null,
    });
    expect(result).toMatchObject({
      kind: "resolve-plan",
      input: { priorityRank: null },
    });
    expect(result.kind).not.toBe("item-patch");
  });

  it("blocks when the prior record has no id", () => {
    expect(
      planVerdictWrite({
        verdict: "done",
        prior: { reportId: REPORT_ID, item: item({ id: undefined }) },
        linked: null,
      }).kind,
    ).toBe("blocked");
  });
});

describe("priorVerdictState", () => {
  const prior = item();

  it("is pending without an occurrence or while the carry is unconfirmed", () => {
    expect(priorVerdictState(prior, null, true)).toBe("pending");
    expect(priorVerdictState(prior, carried(), true)).toBe("pending");
  });

  it("shows nothing for a read-only lead until a verdict exists", () => {
    expect(priorVerdictState(prior, null, false)).toBeNull();
    expect(priorVerdictState(prior, carried(), false)).toBeNull();
    expect(
      priorVerdictState(prior, carried({ carriedOver: false }), false),
    ).toBe("continue");
  });

  it("shows nothing for a cancelled prior plan", () => {
    const cancelled = item({
      resolution: { kind: "wont_do" } as SectionItem["resolution"],
    });
    expect(priorVerdictState(cancelled, null, true)).toBeNull();
  });

  it.each([
    [{ workflowStatus: "done" }, "done"],
    [{ workflowStatus: "paused", pausedReason: "Waiting" }, "paused"],
    [{ workflowStatus: "postponed" }, "next"],
    [{ type: "next" }, "next"],
    [{ workflowStatus: "in_progress" }, "continue"],
    [{ workflowStatus: "planned" }, "continue"],
    [{ resolution: { kind: "wont_do" } }, "wont_do"],
  ] as const)(
    "reads a confirmed occurrence %j as %s",
    (overrides, expected) => {
      const linked = carried({
        ...(overrides as Partial<SectionItem>),
        carriedOver: false,
      });
      expect(priorVerdictState(prior, linked, true)).toBe(expected);
    },
  );

  // The stamp must be what the lead chose: write, apply, read back.
  it.each(["done", "continue", "paused", "next"] as const)(
    "round-trips %s through the written patch",
    (verdict) => {
      for (const linked of [
        carried(),
        carried({ workflowStatus: "in_progress" }),
        carried({ workflowStatus: "paused", pausedReason: "x" }),
        carried({ type: "next", carriedOver: false }),
      ]) {
        const result = write(verdict, linked, "Waiting");
        const after =
          result.kind === "item-patch"
            ? appliedItem(linked, result.patch)
            : linked;
        expect(priorVerdictState(prior, after, true)).toBe(verdict);
      }
    },
  );
});
