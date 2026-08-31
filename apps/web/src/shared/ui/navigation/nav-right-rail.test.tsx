// @vitest-environment jsdom

import "@testing-library/jest-dom/vitest";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render as testingRender, screen } from "@testing-library/react";
import type { ReactElement } from "react";
import { describe, expect, it, vi } from "vitest";

vi.mock("../../../lib/web-env", () => ({
  webEnv: { devRoleSwitcher: vi.fn(() => false) },
}));

import { NavRightRail } from "./nav-right-rail";

function render(element: ReactElement) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return testingRender(
    <QueryClientProvider client={queryClient}>{element}</QueryClientProvider>,
  );
}

const RESPONSIVE_GEOMETRY = [
  "h-[var(--toolbar-control-h)]",
  "min-w-[var(--toolbar-control-h)]",
  "w-10",
] as const;

describe("NavRightRail responsive geometry", () => {
  it("keeps the available sign-out action within the shared control geometry", () => {
    const { container } = render(
      <NavRightRail sessionLoading={false} hasUser />,
    );

    const controls = Array.from(
      container.querySelectorAll<HTMLButtonElement>("button[data-testid]"),
    );

    expect(controls.map((control) => control.dataset.testid)).toEqual([
      "nav-logout",
    ]);
    expect(screen.getByRole("button", { name: "Sign out" })).toHaveAttribute(
      "aria-label",
      "Sign out",
    );

    for (const control of controls) {
      expect(control).toHaveClass(...RESPONSIVE_GEOMETRY);
    }
  });

  it("reserves matching responsive geometry for the loading skeleton", () => {
    const { container } = render(
      <NavRightRail sessionLoading hasUser={false} />,
    );

    const placeholders = Array.from(
      container.querySelectorAll<HTMLElement>('[aria-hidden="true"]'),
    );

    expect(placeholders).toHaveLength(3);
    for (const placeholder of placeholders) {
      expect(placeholder).toHaveClass(...RESPONSIVE_GEOMETRY);
    }
    expect(placeholders[0]).toHaveClass("xl:w-[92px]");
  });
});
