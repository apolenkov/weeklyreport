// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";

import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { useSdlcTooltip } from "../../shared/ui/feedback/sdlc-tooltip";

// The layout wraps its content in SessionProvider + NavBar; both are
// passthroughs here so the tooltip-provider contract is what gets tested.
vi.mock("../../shared/lib/auth/session-provider", () => ({
  SessionProvider: ({ children }: { readonly children: React.ReactNode }) =>
    children,
  SessionContext: undefined,
  useSession: () => ({
    user: null,
    organization: null,
    isLoading: false,
  }),
}));
vi.mock("next/navigation", () => ({
  usePathname: () => "/lead/report",
}));
vi.mock("../../shared/ui/navigation/nav-bar", () => ({
  NavBar: () => null,
}));
vi.mock("../../shared/hooks/browser/use-hydrated-client", () => ({
  useHydratedClient: () => true,
}));

import AppGroupLayout from "./layout";

function TooltipProbe() {
  const tooltip = useSdlcTooltip();
  return (
    <button
      type="button"
      onMouseEnter={() =>
        tooltip.show(
          { top: 100, left: 200, width: 0, height: 0 } as DOMRect,
          "probe tooltip",
        )
      }
    >
      probe
    </button>
  );
}

describe("AppGroupLayout tooltip provider", () => {
  it("mounts the SdlcTooltipProvider so tooltips actually render", async () => {
    render(
      <AppGroupLayout>
        <TooltipProbe />
      </AppGroupLayout>,
    );

    const probe = screen.getByRole("button", { name: "probe" });
    fireEvent.mouseEnter(probe);

    expect(
      await screen.findByRole("tooltip", { name: "probe tooltip" }),
    ).toBeInTheDocument();
  });

  it("places application content inside the shared paper surface", () => {
    render(
      <AppGroupLayout>
        <main id="main-content" tabIndex={-1}>
          Application content
        </main>
      </AppGroupLayout>,
    );

    expect(
      screen.getByRole("main").closest(".operational-paper-shell"),
    ).not.toBeNull();
  });
});
