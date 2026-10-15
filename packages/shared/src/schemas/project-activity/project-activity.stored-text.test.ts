import { describe, expect, it } from "vitest";

import { sectionActivitySchema } from "../report-sections/section-record.schema.js";
import {
  projectActivityCreateSchema,
  projectActivitySchema,
} from "./project-activity.schema.js";

// TASK-503.108: activity names and Jira accounts earlier write rules admitted
// and the current ones reject. The catalogue read keeps them exactly; the
// catalogue write keeps rejecting them.
const LEGACY = "⁠";
const LATER_FAMILY = "ㅤ";
const GROUP_ID = "10800000-0000-4000-8000-000000000051";
const ACTIVITY_ID = "10800000-0000-4000-8000-000000000052";

describe("activity reads of stored text the write rule now rejects", () => {
  it("reads a stored catalogue activity exactly", () => {
    const stored = {
      id: ACTIVITY_ID,
      name: LEGACY,
      groupId: GROUP_ID,
      linkedProducts: [],
      jiraAccounts: [LEGACY, LATER_FAMILY],
      archived: false,
      leadIds: [],
    };

    expect(projectActivitySchema.parse(stored)).toEqual(stored);
  });

  it("reads a stored weekly title override exactly", () => {
    const stored = {
      activityId: ACTIVITY_ID,
      activityName: LEGACY,
      titleOverride: LEGACY,
      status: null,
      note: LEGACY,
      jiraAccounts: [LEGACY],
      linkedProducts: [],
      derivedStatus: null,
      alarmFloor: null,
    };

    expect(sectionActivitySchema.parse(stored)).toMatchObject(stored);
  });

  it.each([
    ["name", { name: LEGACY }],
    ["Jira account", { name: "Visible", jiraAccounts: [LEGACY] }],
  ])("keeps rejecting that %s on a catalogue write", (_field, input) => {
    expect(
      projectActivityCreateSchema.safeParse({ groupId: GROUP_ID, ...input })
        .success,
    ).toBe(false);
  });
});
