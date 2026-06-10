/**
 * @vitest-environment jsdom
 *
 * add-version-pin (5.3): star toggle, pinned-first grouping, any version
 * is pinnable (not gated on isLatest — D4).
 */
import "@testing-library/jest-dom/vitest";

import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import type { VersionSnapshot } from "./mock-data";
import { VersionHistoryNav } from "./version-history-nav";

const PINNED_V1: VersionSnapshot = {
  version: 1,
  timestamp: "2026-04-01 08:00",
  itemCount: 2,
  riskCount: 0,
  decisionCount: 0,
  pinned: true,
};

const AUTOSAVE_V2: VersionSnapshot = {
  version: 2,
  timestamp: "2026-05-01 09:00",
  itemCount: 3,
  riskCount: 1,
  decisionCount: 0,
  pinned: false,
};

const AUTOSAVE_V3: VersionSnapshot = {
  version: 3,
  timestamp: "2026-06-01 10:00",
  itemCount: 4,
  riskCount: 1,
  decisionCount: 1,
  pinned: false,
};

// Opens the history modal and returns the dialog element.
function openModal(
  versions: VersionSnapshot[],
  onTogglePin?: (v: number, p: boolean) => void,
) {
  render(<VersionHistoryNav versions={versions} onTogglePin={onTogglePin} />);
  fireEvent.click(
    screen.getByRole("button", { name: /Version .* — open history/ }),
  );
  return screen.getByRole("dialog");
}

describe("VersionHistoryNav — add-version-pin: star toggle fires onTogglePin", () => {
  it("clicking a filled star calls onTogglePin(version, false) to unpin", () => {
    const onTogglePin = vi.fn();
    openModal([PINNED_V1, AUTOSAVE_V2], onTogglePin);

    // Version 1 is pinned — its star button should say "Unpin version 1"
    const unpin = screen.getByRole("button", { name: "Unpin version 1" });
    fireEvent.click(unpin);

    expect(onTogglePin).toHaveBeenCalledWith(1, false);
  });

  it("clicking an empty star calls onTogglePin(version, true) to pin", () => {
    const onTogglePin = vi.fn();
    openModal([AUTOSAVE_V3, AUTOSAVE_V2], onTogglePin);

    const pin = screen.getByRole("button", { name: "Pin version 3" });
    fireEvent.click(pin);

    expect(onTogglePin).toHaveBeenCalledWith(3, true);
  });

  it("any version is pinnable — not just the latest (D4)", () => {
    const onTogglePin = vi.fn();
    openModal([AUTOSAVE_V3, AUTOSAVE_V2, PINNED_V1], onTogglePin);

    // v1 is the oldest and already pinned — must still render its star button
    const unpin = screen.getByRole("button", { name: "Unpin version 1" });
    fireEvent.click(unpin);

    expect(onTogglePin).toHaveBeenCalledWith(1, false);
  });
});

describe("VersionHistoryNav — add-version-pin: pinned-first grouping", () => {
  it("pinned versions appear before unpinned versions in the modal", () => {
    openModal([AUTOSAVE_V3, AUTOSAVE_V2, PINNED_V1]);

    const dialog = screen.getByRole("dialog");
    const rows = dialog.querySelectorAll('[class*="rounded-lg"]');
    const texts = Array.from(rows).map((r) => r.textContent);

    // v1 is pinned — it must appear before v3 and v2 despite being the oldest.
    const pinnedIdx = texts.findIndex((t) => t.includes("Version 1"));
    const autosaveIdx = texts.findIndex((t) => t.includes("Version 3"));
    expect(pinnedIdx).toBeLessThan(autosaveIdx);
  });

  it("renders the Pinned group header when pinned versions exist", () => {
    openModal([AUTOSAVE_V3, PINNED_V1]);

    // The group header is a <p> with class containing "uppercase". The badge
    // on the row is a <span>. Query by role=paragraph or by matching the
    // specific element to avoid the multiple-match error from the row badge.
    const headers = screen
      .getAllByText("Pinned")
      .filter((el) => el.tagName === "P");
    expect(headers.length).toBeGreaterThanOrEqual(1);
  });

  it("does not render the Pinned header when no versions are pinned", () => {
    openModal([AUTOSAVE_V3, AUTOSAVE_V2]);

    const headers = screen
      .queryAllByText("Pinned")
      .filter((el) => el.tagName === "P");
    expect(headers).toHaveLength(0);
  });
});
