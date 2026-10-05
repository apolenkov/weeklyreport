import { describe, expect, it } from "vitest";

import { reportSectionFullInclude } from "./report-sections.include.js";

// TASK-145.61: the shared include decides the size of every report-section
// join; whole Project/Stage rows were loaded although the mapper reads a few
// columns only.
describe("reportSectionFullInclude", () => {
  it("selects status columns without joining Project or Stage rows", () => {
    expect(reportSectionFullInclude.projectStatuses).toEqual({
      select: { projectId: true, status: true, updatedAt: true },
    });
    expect(reportSectionFullInclude.stageStatuses).toEqual({
      select: {
        projectId: true,
        stageId: true,
        status: true,
        updatedAt: true,
      },
    });
  });

  it("selects only mapper-read columns of the author's stage assignments", () => {
    const { stageAssignments } = reportSectionFullInclude.author.select;
    expect(stageAssignments).not.toHaveProperty("include");
    expect(stageAssignments.select.stage).toEqual({
      select: { name: true, sortOrder: true },
    });
    expect(stageAssignments.select.project.select).not.toHaveProperty(
      "createdAt",
    );
  });
});
