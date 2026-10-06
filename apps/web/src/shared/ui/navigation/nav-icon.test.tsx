// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";

import { render } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { NavIcon } from "./nav-icon";
import { NAV_LINKS } from "./nav-links";

describe("NavIcon", () => {
  it("gives every nav link except Feedback an icon, Trends included", () => {
    for (const { href, label } of NAV_LINKS) {
      const { container } = render(<NavIcon href={href} />);
      const hasIcon = container.querySelector("svg") !== null;
      expect(hasIcon, label).toBe(label !== "Feedback");
    }
  });
});
