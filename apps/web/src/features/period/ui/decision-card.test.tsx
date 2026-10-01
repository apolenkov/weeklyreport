// @vitest-environment jsdom
//
// Pins the rendered "Due …" deadline chip across timezone boundaries: a
// deadline is a UTC date-only value, so the day must not shift for viewers
// east or west of UTC, and the label stays English regardless of the runtime
// locale.
import "@testing-library/jest-dom/vitest";

import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import type { DecisionEntry } from "../../report-sections";
import { DecisionCard } from "./decision-card";

const BASE_DECISION: DecisionEntry = {
  id: "d1",
  stableId: "88888888-8888-4888-8888-888888888888",
  productId: "p1",
  productName: "CRM",
  text: "Adopt new framework",
  owner: "Vasily Lead",
  impact: "Faster delivery",
  deadline: null,
  stageNames: ["Analysis"],
};

const noop = () => undefined;

// Node re-reads process.env.TZ per Date operation, so the render happens under
// `timeZone`. stubEnv is what restores an originally-absent TZ by deleting it —
// a plain reassignment would leave the string "undefined" behind.
function renderInTimeZone(timeZone: string, deadline: string | null) {
  vi.stubEnv("TZ", timeZone);
  render(
    <DecisionCard
      decision={{ ...BASE_DECISION, deadline }}
      readOnly
      publishedLocked={false}
      onEdit={noop}
      onDelete={noop}
    />,
  );
}

function chipText(): string | null {
  return screen.queryByText(/^Due /)?.textContent ?? null;
}

afterEach(() => {
  cleanup();
  vi.unstubAllEnvs();
});

describe("DecisionCard deadline chip", () => {
  it("exposes durable record lineage without changing the edit accessible name", () => {
    render(
      <DecisionCard
        decision={BASE_DECISION}
        readOnly={false}
        publishedLocked={false}
        onEdit={noop}
        onDelete={noop}
      />,
    );

    const edit = screen.getByRole("button", {
      name: "Edit decision: Adopt new framework",
    });
    expect(edit).toHaveAttribute(
      "aria-label",
      "Edit decision: Adopt new framework",
    );
    expect(edit).toHaveAttribute(
      "data-record-stable-id",
      "88888888-8888-4888-8888-888888888888",
    );
    expect(BASE_DECISION.id).not.toBe(BASE_DECISION.stableId);
  });

  it("names the edit action after the decision, truncating long text", () => {
    render(
      <DecisionCard
        decision={{ ...BASE_DECISION, text: "Adopt ".repeat(40) }}
        readOnly={false}
        publishedLocked={false}
        onEdit={noop}
        onDelete={noop}
      />,
    );

    const name = screen
      .getByRole("button", { name: /^Edit decision: Adopt/ })
      .getAttribute("aria-label");
    expect(name).toMatch(/^Edit decision: Adopt Adopt .*…$/);
    expect(name?.length).toBeLessThanOrEqual("Edit decision: ".length + 60);
  });

  it("omits record lineage for a new decision that has not been persisted", () => {
    const { stableId: _stableId, ...newDecision } = BASE_DECISION;
    render(
      <DecisionCard
        decision={newDecision}
        readOnly={false}
        publishedLocked={false}
        onEdit={noop}
        onDelete={noop}
      />,
    );

    expect(
      screen.getByRole("button", {
        name: "Edit decision: Adopt new framework",
      }),
    ).not.toHaveAttribute("data-record-stable-id");
  });

  it.each(["UTC", "America/New_York", "Asia/Tokyo", "Pacific/Kiritimati"])(
    "renders the stored UTC day in %s",
    (timeZone) => {
      renderInTimeZone(timeZone, "2026-07-26");
      expect(chipText()).toBe("Due Jul 26");
    },
  );

  // Proves the timezone stub is live, so the four-zone pin above cannot pass
  // vacuously: the same value formatted in the local zone is the day before.
  it("resists a local zone that would render the previous day", () => {
    renderInTimeZone("America/New_York", "2026-07-26");
    expect(
      new Date("2026-07-26").toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
      }),
    ).toBe("Jul 25");
    expect(chipText()).toBe("Due Jul 26");
  });

  it("renders no chip when the decision has no deadline", () => {
    renderInTimeZone("UTC", null);
    expect(chipText()).toBeNull();
  });

  // An unparseable deadline is data we cannot format — surface an explicit
  // error state instead of echoing the raw value verbatim.
  it("surfaces an error state for an unparseable deadline", () => {
    renderInTimeZone("UTC", "not-a-date");
    expect(screen.getByText("Due date unavailable")).toBeInTheDocument();
    expect(screen.queryByText(/Due not-a-date/)).toBeNull();
  });
});
