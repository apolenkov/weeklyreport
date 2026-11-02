// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";

import { render } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { LeadReportAssistantMarkdown } from "./lead-report-assistant-markdown";

describe("LeadReportAssistantMarkdown paragraph grammar", () => {
  it("renders every physical line as its own paragraph, not a CommonMark soft break", () => {
    // The assistant answers in a chat style where a single newline already
    // separates statements; merging lines would glue unrelated sentences.
    const { container } = render(
      <LeadReportAssistantMarkdown markdown={"First line\nSecond line"} />,
    );

    const paragraphs = container.querySelectorAll("p");
    expect(paragraphs).toHaveLength(2);
    expect(paragraphs[0]).toHaveTextContent("First line");
    expect(paragraphs[1]).toHaveTextContent("Second line");
  });

  it("keeps a blank line as spacing and groups consecutive bullets in one list", () => {
    const { container } = render(
      <LeadReportAssistantMarkdown
        markdown={"Intro\n\n- one\n- two\n\nOutro"}
      />,
    );

    expect(container.querySelectorAll("p")).toHaveLength(2);
    expect(container.querySelectorAll("ul")).toHaveLength(1);
    expect(container.querySelectorAll("li")).toHaveLength(2);
    expect(container.querySelectorAll('[aria-hidden="true"]')).toHaveLength(2);
  });
});
