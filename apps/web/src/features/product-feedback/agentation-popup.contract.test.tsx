import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import { Agentation } from "agentation";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const observers: ControlledResizeObserver[] = [];

class ControlledResizeObserver implements ResizeObserver {
  private readonly targets = new Set<Element>();

  constructor(private readonly callback: ResizeObserverCallback) {
    observers.push(this);
  }

  observe = (target: Element): void => {
    this.targets.add(target);
  };

  unobserve = (target: Element): void => {
    this.targets.delete(target);
  };

  disconnect = (): void => {
    this.targets.clear();
  };

  emit(): void {
    const entries = [...this.targets].map(
      (target) =>
        ({
          target,
          contentRect: target.getBoundingClientRect(),
        }) as ResizeObserverEntry,
    );
    this.callback(entries, this);
  }
}

interface PopupSize {
  height: number;
  width: number;
}

const rect = (width: number, height: number, left = 0, top = 0): DOMRect => ({
  bottom: top + height,
  height,
  left,
  right: left + width,
  toJSON: () => ({}),
  top,
  width,
  x: left,
  y: top,
});

const pixelLimit = (value: string): number | undefined => {
  const match = /^(\d+(?:\.\d+)?)px$/.exec(value);
  return match ? Number(match[1]) : undefined;
};

function installLayout(
  viewport: { height: number; width: number },
  popupSize: PopupSize,
  renderedScale = 1,
): void {
  vi.stubGlobal("innerHeight", viewport.height);
  vi.stubGlobal("innerWidth", viewport.width);
  vi.stubGlobal("ResizeObserver", ControlledResizeObserver);
  vi.spyOn(HTMLElement.prototype, "getBoundingClientRect").mockImplementation(
    function getBoundingClientRect(this: HTMLElement) {
      if (this.dataset.annotationPopup !== undefined) {
        const maxWidth = pixelLimit(this.style.maxWidth);
        const maxHeight = pixelLimit(this.style.maxHeight);
        return rect(
          Math.min(popupSize.width, maxWidth ?? popupSize.width) *
            renderedScale,
          Math.min(popupSize.height, maxHeight ?? popupSize.height) *
            renderedScale,
        );
      }
      return rect(120, 40, 0, 0);
    },
  );
  vi.spyOn(HTMLElement.prototype, "offsetWidth", "get").mockImplementation(
    function offsetWidth(this: HTMLElement) {
      if (this.dataset.annotationPopup === undefined) return 120;
      const maxWidth = pixelLimit(this.style.maxWidth);
      return Math.min(popupSize.width, maxWidth ?? popupSize.width);
    },
  );
  vi.spyOn(HTMLElement.prototype, "offsetHeight", "get").mockImplementation(
    function offsetHeight(this: HTMLElement) {
      if (this.dataset.annotationPopup === undefined) return 40;
      const maxHeight = pixelLimit(this.style.maxHeight);
      return Math.min(popupSize.height, maxHeight ?? popupSize.height);
    },
  );
}

function resizeViewport(viewport: { height: number; width: number }): void {
  vi.stubGlobal("innerHeight", viewport.height);
  vi.stubGlobal("innerWidth", viewport.width);
  fireEvent(window, new Event("resize"));
}

async function openComposer(clientX: number, clientY: number) {
  render(
    <>
      <button data-testid="feedback-target" type="button">
        Feedback target
      </button>
      <Agentation />
    </>,
  );
  const target = screen.getByTestId("feedback-target");
  Object.defineProperty(document, "elementFromPoint", {
    configurable: true,
    value: vi.fn(() => target),
  });

  fireEvent.click(await screen.findByTitle("Start feedback mode"));
  fireEvent.click(target, { clientX, clientY });

  const textarea = await screen.findByPlaceholderText("What should change?");
  const popup = textarea.closest<HTMLElement>("[data-annotation-popup]");
  if (!popup) throw new Error("Expected the native Agentation composer");
  await waitFor(() => expect(textarea).toHaveFocus());
  return { popup, textarea };
}

function expectPinnedActions(popup: HTMLElement, submitLabel: "Add" | "Save") {
  const content = popup.querySelector<HTMLElement>(
    "[data-annotation-popup-content]",
  );
  const cancel = within(popup).getByRole("button", { name: "Cancel" });
  const submit = within(popup).getByRole("button", { name: submitLabel });

  expect(content).not.toBeNull();
  expect(content).toHaveStyle({ overflowY: "auto" });
  expect(popup).toContainElement(cancel);
  expect(popup).toContainElement(submit);
  expect(content).not.toContainElement(cancel);
  expect(content).not.toContainElement(submit);
}

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  Reflect.deleteProperty(document, "elementFromPoint");
  localStorage.clear();
  observers.length = 0;
});

beforeEach(() => {
  localStorage.clear();
});

describe("Agentation native popup placement", () => {
  it("uses the final unscaled dimensions for the pending composer at 1728x962", async () => {
    const popupSize = { width: 360, height: 420 };
    installLayout({ width: 1728, height: 962 }, popupSize, 0.95);

    const { popup } = await openComposer(12, 900);

    expect(popup).toHaveStyle({
      left: "188px",
      top: "460px",
      maxWidth: "1712px",
      maxHeight: "946px",
    });
    expectPinnedActions(popup, "Add");
  });

  it("clamps the pending composer after its anchor leaves a resized viewport", async () => {
    const popupSize = { width: 360, height: 420 };
    installLayout({ width: 1728, height: 962 }, popupSize);

    const { popup } = await openComposer(800, 900);
    expect(popup).toHaveStyle({ top: "460px", maxHeight: "946px" });

    resizeViewport({ width: 1728, height: 220 });

    await waitFor(() =>
      expect(popup).toHaveStyle({ top: "8px", maxHeight: "204px" }),
    );
    const rendered = popup.getBoundingClientRect();
    expect(Number.parseFloat(popup.style.top) + rendered.height).toBe(212);
  });

  it("keeps the popup and its fixed actions inside 8px narrow and short gutters", async () => {
    const popupSize = { width: 320, height: 500 };
    installLayout({ width: 280, height: 220 }, popupSize);

    const { popup } = await openComposer(272, 190);

    expect(popup).toHaveStyle({
      boxSizing: "border-box",
      display: "grid",
      left: "140px",
      top: "8px",
      maxWidth: "264px",
      maxHeight: "204px",
      overflow: "hidden",
    });
    expectPinnedActions(popup, "Add");

    const rendered = popup.getBoundingClientRect();
    expect(Number.parseFloat(popup.style.left) - rendered.width / 2).toBe(8);
    expect(Number.parseFloat(popup.style.left) + rendered.width / 2).toBe(272);
    expect(Number.parseFloat(popup.style.top)).toBe(8);
    expect(Number.parseFloat(popup.style.top) + rendered.height).toBe(212);
  });

  it("remeasures after expansion and applies the same placement to edit mode", async () => {
    const popupSize = { width: 280, height: 200 };
    installLayout({ width: 1728, height: 962 }, popupSize);

    const { popup, textarea } = await openComposer(800, 700);
    expect(popup).toHaveStyle({ left: "800px", top: "720px" });

    popupSize.height = 600;
    act(() => observers.at(-1)?.emit());
    await waitFor(() => expect(popup).toHaveStyle({ top: "80px" }));

    fireEvent.change(textarea, { target: { value: "Measured feedback" } });
    fireEvent.click(screen.getByRole("button", { name: "Add" }));
    await waitFor(() =>
      expect(
        screen.queryByPlaceholderText("What should change?"),
      ).not.toBeInTheDocument(),
    );

    const marker = document.querySelector<HTMLElement>(
      "[data-annotation-marker]",
    );
    if (!marker) throw new Error("Expected the native Agentation marker");
    popupSize.height = 300;
    fireEvent.click(marker);

    const editTextarea = await screen.findByPlaceholderText(
      "Edit your feedback...",
    );
    const editPopup = editTextarea.closest<HTMLElement>(
      "[data-annotation-popup]",
    );
    if (!editPopup) throw new Error("Expected the native edit composer");
    await waitFor(() => expect(editPopup.style.visibility).toBe("visible"));

    expect(editPopup).toHaveStyle({ left: "800px", top: "380px" });
    expectPinnedActions(editPopup, "Save");
  });

  it("clamps the edit composer after scrolling its anchor above the viewport", async () => {
    const popupSize = { width: 280, height: 300 };
    installLayout({ width: 1728, height: 962 }, popupSize);

    const { textarea } = await openComposer(800, 100);
    fireEvent.change(textarea, { target: { value: "Offscreen edit" } });
    fireEvent.click(screen.getByRole("button", { name: "Add" }));
    await waitFor(() =>
      expect(
        screen.queryByPlaceholderText("What should change?"),
      ).not.toBeInTheDocument(),
    );

    const marker = document.querySelector<HTMLElement>(
      "[data-annotation-marker]",
    );
    if (!marker) throw new Error("Expected the native Agentation marker");

    vi.stubGlobal("scrollY", 500);
    fireEvent.scroll(window);
    fireEvent.click(marker);

    const editTextarea = await screen.findByPlaceholderText(
      "Edit your feedback...",
    );
    await waitFor(() => expect(editTextarea).toHaveFocus());
    const editPopup = editTextarea.closest<HTMLElement>(
      "[data-annotation-popup]",
    );
    if (!editPopup) throw new Error("Expected the native edit composer");

    expect(editPopup).toHaveStyle({ left: "800px", top: "8px" });
    expectPinnedActions(editPopup, "Save");
  });
});
