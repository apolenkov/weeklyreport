// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";

import { render, screen } from "@testing-library/react";
import { createRef } from "react";
import { describe, expect, it, vi } from "vitest";

import { DocumentBodyPortal } from "../../../../shared/ui/dialogs/document-body-portal";
import { LeadSlidesDeckView } from "./lead-slides-deck-view";

const noop = vi.fn();

function renderDeck(dialogs: React.ReactNode) {
  const deckRef = createRef<HTMLDivElement | null>();
  const toggleRef = createRef<HTMLButtonElement | null>();
  render(
    <LeadSlidesDeckView
      deckRef={deckRef}
      toggleRef={toggleRef}
      fullscreen={{ isFullscreen: true, onToggle: noop }}
      deck={{
        slides: [],
        dialogs,
        showFullscreenControls: false,
      }}
      density="document"
      showDensityControl={false}
      onDensityChange={noop}
      selectedIndex={0}
      onSelect={noop}
    />,
  );
  return deckRef;
}

describe("LeadSlidesDeckView — dialog portal target", () => {
  it("portals deck dialogs inside the fullscreened deck element", () => {
    const deckRef = renderDeck(
      <DocumentBodyPortal>
        <div data-testid="portaled-dialog">dialog</div>
      </DocumentBodyPortal>,
    );

    const dialog = screen.getByTestId("portaled-dialog");
    expect(deckRef.current).not.toBeNull();
    expect(deckRef.current).toContainElement(dialog);
    expect(document.body.contains(dialog)).toBe(true);
    expect(dialog.parentElement).not.toBe(document.body);
  });

  it("keeps DocumentBodyPortal on document.body without a provider", () => {
    render(
      <DocumentBodyPortal>
        <div data-testid="plain-dialog">dialog</div>
      </DocumentBodyPortal>,
    );
    const dialog = screen.getByTestId("plain-dialog");
    expect(dialog.parentElement).toBe(document.body);
  });
});
