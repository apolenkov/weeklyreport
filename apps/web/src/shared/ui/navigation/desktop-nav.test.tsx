// @vitest-environment jsdom

import "@testing-library/jest-dom/vitest";

import { render, screen } from "@testing-library/react";
import type { ReactNode } from "react";
import { describe, expect, it, vi } from "vitest";

import type { NavLink } from "./nav-links";

vi.mock("next/link", () => ({
  default: ({
    href,
    children,
    scroll,
  }: {
    readonly href: string;
    readonly children: ReactNode;
    readonly scroll?: boolean;
  }) => (
    <a href={href} data-next-scroll={scroll === false ? "false" : "default"}>
      {children}
    </a>
  ),
}));

import { DesktopNav } from "./desktop-nav";

const links: readonly NavLink[] = [
  { href: "/reports", label: "History", roles: ["head"] },
  { href: "/head/report", label: "Status", roles: ["head"] },
];

describe("DesktopNav route transition contract", () => {
  it("keeps the persistent header in view when a primary link is activated", () => {
    render(<DesktopNav links={links} pathname="/reports" role="head" />);

    const primaryLinks = screen.getAllByRole("link");
    expect(primaryLinks).toHaveLength(2);
    for (const link of primaryLinks) {
      expect(link).toHaveAttribute("data-next-scroll", "false");
    }
  });
});
