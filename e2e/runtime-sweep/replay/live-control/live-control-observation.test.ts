import { describe, expect, it } from "vitest";

import {
  controlAlreadyActive,
  controlCountDecreased,
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

  it("does not count bare viewport scrolling as an action outcome", () => {
    const before = snapshot({ scrollY: 0 });
    const after = snapshot({ scrollY: 480 });

    expect(observationFor(before, after)).toBeUndefined();
  });

  it("accepts only a monotonic resource increase in the same document", () => {
    const before = snapshot({ documentId: "document-a", network: 4 });

    expect(
      observationFor(
        before,
        snapshot({ documentId: "document-a", network: 5 }),
      ),
    ).toEqual({
      kind: "network",
      detail: "1 resource request(s) observed",
    });
    expect(
      observationFor(
        before,
        snapshot({ documentId: "document-a", network: 0 }),
      ),
    ).toBeUndefined();
    expect(
      observationFor(
        before,
        snapshot({ documentId: "document-b", network: 0 }),
      ),
    ).toBeUndefined();
  });

  it("recognizes an already-pressed read-only control", () => {
    const before = snapshot();
    const withControl: PageSnapshot = {
      ...before,
      controls: [
        {
          role: "button",
          name: "Read",
          title: null,
          checked: undefined,
          ariaChecked: null,
          ariaExpanded: null,
          ariaPressed: "true",
          selected: null,
          value: undefined,
        },
      ],
    };

    expect(
      controlAlreadyActive(withControl, {
        controlKey: "button:Read:1",
        ariaRole: "button",
        accessibleName: "Read",
      }),
    ).toBe(true);
  });

  it("recognizes a read-only control whose semantic target is already expanded", () => {
    const before: PageSnapshot = {
      ...snapshot(),
      controls: [
        {
          role: "button",
          name: "Product Alpha",
          title: "Open Product Alpha details",
          checked: undefined,
          ariaChecked: null,
          ariaExpanded: null,
          ariaPressed: null,
          controlledExpanded: true,
          selected: null,
          value: undefined,
        },
      ],
    };

    expect(
      controlAlreadyActive(before, {
        controlKey: "button:Open%20Product%20Alpha%20details:1",
        ariaRole: "button",
        accessibleName: "Open Product Alpha details",
      }),
    ).toBe(true);
  });

  it("recognizes an aria-current read-only button as already active", () => {
    const before: PageSnapshot = {
      ...snapshot(),
      controls: [
        {
          role: "button",
          name: "Shared context Ivanov V.P. 40% ready",
          title: null,
          checked: undefined,
          ariaChecked: null,
          ariaCurrent: "true",
          ariaExpanded: null,
          ariaPressed: null,
          selected: null,
          value: undefined,
        },
      ],
    };

    expect(
      controlAlreadyActive(before, {
        controlKey: "button:Shared%20context:1",
        ariaRole: "button",
        accessibleName: "Shared context Ivanov V.P. 40% ready",
      }),
    ).toBe(true);
  });

  it("does not accept a control whose semantic target is still collapsed", () => {
    const before: PageSnapshot = {
      ...snapshot(),
      controls: [
        {
          role: "button",
          name: "Product Alpha",
          title: "Open Product Alpha details",
          checked: undefined,
          ariaChecked: null,
          ariaExpanded: null,
          ariaPressed: null,
          controlledExpanded: false,
          selected: null,
          value: undefined,
        },
      ],
    };

    expect(
      controlAlreadyActive(before, {
        controlKey: "button:Open%20Product%20Alpha%20details:1",
        ariaRole: "button",
        accessibleName: "Open Product Alpha details",
      }),
    ).toBe(false);
  });

  it("does not treat an active switch as an idempotent click", () => {
    const before: PageSnapshot = {
      ...snapshot(),
      controls: [
        {
          role: "switch",
          name: "Notifications",
          title: null,
          checked: undefined,
          ariaChecked: "true",
          ariaExpanded: null,
          ariaPressed: null,
          selected: null,
          value: undefined,
        },
      ],
    };

    expect(
      controlAlreadyActive(before, {
        controlKey: "switch:Notifications:1",
        ariaRole: "switch",
        accessibleName: "Notifications",
      }),
    ).toBe(false);
  });

  it("recognizes deletion only when the matching semantic control count decreases", () => {
    const deleteControl = {
      role: "button",
      name: "Delete",
      title: null,
      checked: undefined,
      ariaChecked: null,
      ariaExpanded: null,
      ariaPressed: null,
      selected: null,
      value: undefined,
    };
    const before = snapshot({ controls: [deleteControl, deleteControl] });
    const after = snapshot({ controls: [deleteControl] });
    const target = {
      controlKey: "button:Delete:1",
      ariaRole: "button",
      accessibleName: "Delete",
    };

    expect(controlCountDecreased(before, after, target)).toBe(true);
    expect(controlCountDecreased(before, before, target)).toBe(false);
  });
});
