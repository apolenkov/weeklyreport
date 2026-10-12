// @vitest-environment jsdom

import { act, render, screen } from "@testing-library/react";
import { createRef } from "react";
import { hydrateRoot } from "react-dom/client";
import { renderToString } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

import { LeadSlidesDeckView } from "../../../features/slides/ui/lead/lead-slides-deck-view";
import { DocumentBodyPortal } from "./document-body-portal";

describe("DocumentBodyPortal", () => {
  it("renders no server markup and mounts children directly under body", () => {
    expect(
      renderToString(
        <DocumentBodyPortal>
          <span>Portal content</span>
        </DocumentBodyPortal>,
      ),
    ).toBe("");

    const { unmount } = render(
      <DocumentBodyPortal>
        <span>Portal content</span>
      </DocumentBodyPortal>,
    );

    expect(screen.getByText("Portal content").parentElement).toBe(
      document.body,
    );
    unmount();
    expect(screen.queryByText("Portal content")).not.toBeInTheDocument();
  });

  it("mounts a lead deck portal once inside its resolved target", () => {
    const deckRef = createRef<HTMLDivElement>();
    const mountedParents: (HTMLElement | null)[] = [];
    const noop = () => undefined;
    const { unmount } = render(
      <LeadSlidesDeckView
        deckRef={deckRef}
        toggleRef={createRef<HTMLButtonElement>()}
        fullscreen={{ isFullscreen: true, onToggle: noop }}
        deck={{
          slides: [],
          showFullscreenControls: false,
          dialogs: (
            <DocumentBodyPortal>
              <span
                ref={(node) => {
                  if (node) mountedParents.push(node.parentElement);
                }}
              >
                Deck portal
              </span>
            </DocumentBodyPortal>
          ),
        }}
        density="document"
        showDensityControl={false}
        onDensityChange={noop}
        selectedIndex={0}
        onSelect={noop}
      />,
    );

    expect(mountedParents).toHaveLength(1);
    expect(mountedParents[0]).not.toBe(document.body);
    expect(deckRef.current).toContainElement(mountedParents[0] ?? null);
    expect(deckRef.current).toContainElement(screen.getByText("Deck portal"));
    unmount();
  });

  it("hydrates the empty server shell without a mismatch", async () => {
    const serverMarkup = renderToString(
      <DocumentBodyPortal>
        <span>Hydrated portal</span>
      </DocumentBodyPortal>,
    );
    const container = document.createElement("div");
    container.innerHTML = serverMarkup;
    document.body.append(container);
    const consoleError = vi
      .spyOn(console, "error")
      .mockImplementation(() => undefined);

    const root = hydrateRoot(
      container,
      <DocumentBodyPortal>
        <span>Hydrated portal</span>
      </DocumentBodyPortal>,
    );
    await act(() => Promise.resolve());

    expect(screen.getByText("Hydrated portal").parentElement).toBe(
      document.body,
    );
    expect(consoleError).not.toHaveBeenCalled();

    act(() => {
      root.unmount();
    });
    container.remove();
    consoleError.mockRestore();
  });
});
