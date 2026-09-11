import { renderHook } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { useInlineEditUnloadGuard } from "./use-inline-edit-unload-guard";

function appendLink(
  href: string,
  options: { readonly download?: boolean; readonly target?: string } = {},
) {
  const link = document.createElement("a");
  link.href = href;
  if (options.download === true) link.setAttribute("download", "");
  if (options.target !== undefined) link.target = options.target;

  const onNavigate = vi.fn();
  link.addEventListener("click", (event) => {
    onNavigate(event.defaultPrevented);
    event.preventDefault();
  });
  document.body.append(link);
  return { link, onNavigate };
}

function dispatchClick(
  element: Element,
  options: MouseEventInit = {},
): MouseEvent {
  const event = new MouseEvent("click", {
    bubbles: true,
    button: 0,
    cancelable: true,
    ...options,
  });
  element.dispatchEvent(event);
  return event;
}

afterEach(() => {
  document.body.replaceChildren();
});

describe("useInlineEditUnloadGuard", () => {
  it("keeps the inline form mounted when navigation is declined", () => {
    const confirm = vi.spyOn(window, "confirm").mockReturnValue(false);
    const { link, onNavigate } = appendLink("/reports");
    renderHook(useInlineEditUnloadGuard);

    const event = dispatchClick(link);

    expect(confirm).toHaveBeenCalledOnce();
    expect(event.defaultPrevented).toBe(true);
    expect(onNavigate).not.toHaveBeenCalled();
  });

  it("allows an approved same-tab external link to continue to its router handler", () => {
    const confirm = vi.spyOn(window, "confirm").mockReturnValue(true);
    const { link, onNavigate } = appendLink("https://example.com/reports");
    renderHook(useInlineEditUnloadGuard);

    dispatchClick(link);

    expect(confirm).toHaveBeenCalledOnce();
    expect(onNavigate).toHaveBeenCalledWith(false);
  });

  it("does not interfere with modified or new-tab/download link clicks", () => {
    const confirm = vi.spyOn(window, "confirm").mockReturnValue(false);
    const modified = appendLink("/reports");
    const newTab = appendLink("/reports", { target: "_blank" });
    const download = appendLink("/report.pdf", { download: true });
    renderHook(useInlineEditUnloadGuard);

    dispatchClick(modified.link, { ctrlKey: true });
    dispatchClick(newTab.link);
    dispatchClick(download.link);

    expect(confirm).not.toHaveBeenCalled();
    expect(modified.onNavigate).toHaveBeenCalledWith(false);
    expect(newTab.onNavigate).toHaveBeenCalledWith(false);
    expect(download.onNavigate).toHaveBeenCalledWith(false);
  });

  it("does not prompt for hash navigation within the current document", () => {
    const confirm = vi.spyOn(window, "confirm").mockReturnValue(false);
    const { link, onNavigate } = appendLink("#inline-editor");
    renderHook(useInlineEditUnloadGuard);

    dispatchClick(link);

    expect(confirm).not.toHaveBeenCalled();
    expect(onNavigate).toHaveBeenCalledWith(false);
  });

  it("removes both navigation and unload listeners when the editor closes", () => {
    const confirm = vi.spyOn(window, "confirm").mockReturnValue(false);
    const { link, onNavigate } = appendLink("/reports");
    const { unmount } = renderHook(useInlineEditUnloadGuard);
    const pendingUnload = new Event("beforeunload", { cancelable: true });

    window.dispatchEvent(pendingUnload);
    unmount();
    const closedUnload = new Event("beforeunload", { cancelable: true });
    window.dispatchEvent(closedUnload);
    dispatchClick(link);

    expect(pendingUnload.defaultPrevented).toBe(true);
    expect(closedUnload.defaultPrevented).toBe(false);
    expect(confirm).not.toHaveBeenCalled();
    expect(onNavigate).toHaveBeenCalledWith(false);
  });
});
