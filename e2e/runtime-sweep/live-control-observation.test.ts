import { describe, expect, it } from "vitest";

import {
  observationFor,
  type PageSnapshot,
} from "./live-control-observation.ts";

const snapshot = (overrides: Partial<PageSnapshot> = {}): PageSnapshot => ({
  url: "http://127.0.0.1:3105/report",
  dom: '{"text":"Report","controls":[]}',
  focus: "BODY::Report",
  network: 1,
  ...overrides,
});

describe("live control observations", () => {
  it("accepts a switch state transition recorded as aria-checked DOM state", () => {
    const before = snapshot({
      dom: '{"text":"Report","controls":[{"ariaChecked":"false"}]}',
    });
    const after = snapshot({
      dom: '{"text":"Report","controls":[{"ariaChecked":"true"}]}',
    });

    expect(observationFor(before, after)).toEqual({
      kind: "dom",
      detail: "Live DOM or control state changed",
    });
  });

  it("does not count ordinary click focus as an action outcome", () => {
    const before = snapshot({ focus: "BODY::Report", focusTarget: "body#:" });
    const after = snapshot({
      focus: "BUTTON::Open",
      focusTarget: "button#open:",
    });

    expect(observationFor(before, after)).toBeUndefined();
  });

  it("accepts skip-link focus on the main content target", () => {
    const before = snapshot({
      focus: "A::Skip to content",
      focusTarget: "a#skip:",
    });
    const after = snapshot({
      focus: "MAIN::Report",
      focusTarget: "main#main-content:",
    });

    expect(observationFor(before, after)).toEqual({
      kind: "focus",
      detail: "Focus moved to page content after the action",
    });
  });

  it("accepts a meaningful page scroll after a skip-link action", () => {
    const before = snapshot({ scrollY: 0 });
    const after = snapshot({ scrollY: 480 });

    expect(observationFor(before, after)).toEqual({
      kind: "focus",
      detail: "Page content scroll position changed after the action",
    });
  });
});
