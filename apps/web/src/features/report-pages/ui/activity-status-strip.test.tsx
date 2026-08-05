import type { ReportSectionReadModel } from "@customreport/shared";
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { createDemoSection } from "../../../test-utils/fixtures";
import { ActivityStatusStrip } from "./activity-status-strip";

const ACTIVITY_ID = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";

function sectionWithActivities(
  overrides: Partial<ReportSectionReadModel>,
): ReportSectionReadModel {
  return { ...createDemoSection(), ...overrides };
}

describe("ActivityStatusStrip", () => {
  it("renders one row per (activity, author) with the status label", () => {
    const sections = [
      sectionWithActivities({
        authorName: "Lead A",
        activities: [
          {
            activityId: ACTIVITY_ID,
            activityName: "Jira triage duty",
            jiraAccounts: [],
            status: "red",
            note: "Blocked on vendor",
            linkedProducts: [],
            derivedStatus: null,
          },
        ],
      }),
      sectionWithActivities({
        reportSectionId: "99999999-9999-4999-8999-999999999999",
        authorId: "88888888-8888-4888-8888-888888888888",
        authorName: "Lead B",
        activities: [
          {
            activityId: ACTIVITY_ID,
            activityName: "Jira triage duty",
            jiraAccounts: [],
            status: "green",
            linkedProducts: [],
            derivedStatus: null,
          },
        ],
      }),
    ];

    render(<ActivityStatusStrip sections={sections} />);

    // The same activity appears once per reporting author — independent rows.
    expect(screen.getAllByText("Jira triage duty")).toHaveLength(2);
    expect(screen.getByText("Blocked")).toBeInTheDocument();
    expect(screen.getByText("On Track")).toBeInTheDocument();
    expect(screen.getByText("Lead A")).toBeInTheDocument();
    expect(screen.getByText("Lead B")).toBeInTheDocument();
    expect(screen.getByText("Blocked on vendor")).toBeInTheDocument();
  });

  it("self-suppresses when no section carries an activity", () => {
    const { container } = render(
      <ActivityStatusStrip sections={[createDemoSection()]} />,
    );
    expect(container).toBeEmptyDOMElement();
  });
});
