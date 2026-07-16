import type { ReportSectionReadModel } from "@customreport/shared";
import { describe, expect, it } from "vitest";

import { sectionToDraftPayload } from "../model/lead-section-draft-payload";
import {
  classifyReseed,
  reconcileSavedIdentities,
} from "./lead-form-draft-reconcile";

const SECTION_ID = "11111111-1111-4111-8111-111111111111";
const REPORT_ID = "22222222-2222-4222-8222-222222222222";
const AUTHOR_ID = "33333333-3333-4333-8333-333333333333";
const PROJECT_ID = "44444444-4444-4444-8444-444444444444";

function makeSection(
  text: string,
  id: string,
  stableId: string | undefined,
): ReportSectionReadModel {
  return {
    reportSectionId: SECTION_ID,
    reportId: REPORT_ID,
    authorId: AUTHOR_ID,
    authorName: "Test Lead",
    authorRole: "lead",
    version: 1,
    status: "draft",
    submittedAt: null,
    projects: [
      { projectId: PROJECT_ID, projectName: "Project", trafficLight: "green" },
    ],
    items: [
      {
        id,
        stableId,
        projectId: PROJECT_ID,
        activityId: null,
        type: "current",
        text,
        tag: "general",
        workflowStatus: "in_progress",
        carriedOver: false,
        stageIds: [],
      },
    ],
    risks: [],
    decisions: [],
    priorities: [],
    activities: [],
  } as ReportSectionReadModel;
}

describe("classifyReseed", () => {
  it("maps each server payload to its reseed trigger", () => {
    expect(classifyReseed("k", "k", false, false)).toBe("unchanged");
    expect(classifyReseed("new", "old", false, true)).toBe("save-echo");
    expect(classifyReseed("new", "old", true, false)).toBe("external-dirty");
    expect(classifyReseed("new", "old", false, false)).toBe("external-clean");
    // A save-echo classification wins over the dirty/clean branch.
    expect(classifyReseed("new", "old", true, true)).toBe("save-echo");
  });
});

describe("reconcileSavedIdentities", () => {
  it("adopts the server id + stableId while preserving newer local content", () => {
    const tempId = "77777777-7777-4777-8777-777777777777";
    const realId = "88888888-8888-4888-8888-888888888888";
    const realStable = "99999999-9999-4999-8999-999999999999";
    // Local draft carries newer text under a temporary id; the persisted
    // payload we sent matched the server snapshot's content under the temp id.
    const current = makeSection("newer local text", tempId, undefined);
    const saved = makeSection("saved snapshot", realId, realStable);
    const persisted = sectionToDraftPayload(
      makeSection("saved snapshot", tempId, undefined),
    );

    const result = reconcileSavedIdentities(current, saved, persisted);

    expect(result.items[0]).toMatchObject({
      id: realId,
      stableId: realStable,
      text: "newer local text",
    });
  });
});
