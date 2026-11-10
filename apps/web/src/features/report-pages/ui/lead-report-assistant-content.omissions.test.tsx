// @vitest-environment jsdom

import "@testing-library/jest-dom/vitest";

import { render, screen } from "@testing-library/react";
import type { RecordOmissionSummary } from "@weeklyreport/shared";
import { describe, expect, it } from "vitest";

import { LeadReportAssistantContent } from "./lead-report-assistant-content";

const noop = () => undefined;

type Outcome = Parameters<typeof LeadReportAssistantContent>[0]["outcome"];

const answer = (coverage: RecordOmissionSummary): Outcome => ({
  kind: "ok",
  answerMarkdown: "The release is on track.",
  citations: [],
  coverage,
  metadata: { truncated: false, insufficientEvidence: false },
});

function renderOutcome(outcome: Outcome) {
  render(
    <LeadReportAssistantContent
      outcome={outcome}
      onClarification={noop}
      onEditQuestion={noop}
      onRetry={noop}
    />,
  );
  return screen.queryByRole("note", {
    name: "Records the assistant leaves out",
  });
}

describe("LeadReportAssistantContent left-out records", () => {
  it("says beside an answer what the assistant does not read", () => {
    expect(
      renderOutcome(answer({ risks: 2, decisions: 1, unknown: false })),
    ).toHaveTextContent(
      "The assistant does not read 2 unfinished risks and 1 unfinished decision, still being written.",
    );
  });

  it("says it with an empty answer, so nothing found is not read as nothing exists", () => {
    expect(
      renderOutcome({
        kind: "no_results",
        coverage: { risks: 1, decisions: 0, unknown: false },
      }),
    ).toHaveTextContent(
      "The assistant does not read 1 unfinished risk, still being written.",
    );
  });

  it("calls uncounted reports unknown instead of complete", () => {
    expect(
      renderOutcome(answer({ risks: 0, decisions: 0, unknown: true })),
    ).toHaveTextContent(
      "Some reports were published before unfinished records were counted, so the answer may miss a few.",
    );
  });

  it("stays silent when nothing is left out", () => {
    expect(
      renderOutcome(answer({ risks: 0, decisions: 0, unknown: false })),
    ).toBeNull();
  });
});
