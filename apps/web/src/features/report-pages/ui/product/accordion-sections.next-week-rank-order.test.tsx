import { render } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import type {
  WeeklyProductReport,
  WeeklyReportItem,
} from "../../../report-sections";
import { AccordionSections } from "./accordion-sections";

function makeItem(id: string, priorityRank: number | null): WeeklyReportItem {
  return {
    id,
    stageLead: "Dev · AL",
    stage: "Development",
    owner: "AL",
    text: `Item ${id}`,
    status: "in-progress",
    priorityRank,
  };
}

function makeReport(
  weeks: Pick<WeeklyProductReport, "currentWeek" | "nextWeek">,
): WeeklyProductReport {
  return {
    id: "p1",
    authorIds: ["author-1"],
    initials: "PA",
    name: "Product Alpha",
    status: "on-track",
    statusLabel: "On track",
    leads: "Alice",
    risks: [],
    decisions: [],
    priorities: [],
    ...weeks,
  };
}

function renderedOrder(report: WeeklyProductReport): string[] {
  const { container } = render(
    <AccordionSections
      report={report}
      review={undefined}
      showNeedsAttention={false}
    />,
  );
  return [...container.querySelectorAll('[data-accordion-row="item"]')].map(
    (row) => /Item [ru]\d/.exec(row.textContent)?.[0] ?? "",
  );
}

// TASK-503.71 / C4915. The item editor offers a priority rank for Next Week
// items too, yet only Current Week is read in rank order.
describe("Accordion Next Week — read order of ranked items", () => {
  const ranked = [makeItem("r2", 2), makeItem("u1", null), makeItem("r1", 1)];

  it("control: Current Week reads rank 1, rank 2, then unranked", () => {
    expect(
      renderedOrder(makeReport({ currentWeek: ranked, nextWeek: [] })),
    ).toEqual(["Item r1", "Item r2", "Item u1"]);
  });

  it("reads Next Week in the same rank order as Current Week", () => {
    expect(
      renderedOrder(makeReport({ currentWeek: [], nextWeek: ranked })),
    ).toEqual(["Item r1", "Item r2", "Item u1"]);
  });
});
