// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";

import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";

import { useFocusAfterRowRemoved } from "./use-focus-after-row-removed";

function Rows({ rows }: { readonly rows: readonly string[] }) {
  const listRef = useFocusAfterRowRemoved<HTMLUListElement>(rows.length);
  return (
    <ul ref={listRef} tabIndex={-1} aria-label="Rows">
      {rows.map((name) => (
        <li key={name}>
          <button type="button">{name}</button>
        </li>
      ))}
    </ul>
  );
}

describe("useFocusAfterRowRemoved", () => {
  it("moves focus to the container when the focused row disappears", async () => {
    const { rerender } = render(<Rows rows={["Ada", "Grace"]} />);
    await userEvent.click(screen.getByRole("button", { name: "Ada" }));

    rerender(<Rows rows={["Grace"]} />);

    expect(screen.getByRole("list", { name: "Rows" })).toHaveFocus();
  });

  it("leaves focus on a surviving row when another row disappears", async () => {
    const { rerender } = render(<Rows rows={["Ada", "Grace"]} />);
    const grace = screen.getByRole("button", { name: "Grace" });
    await userEvent.click(grace);

    rerender(<Rows rows={["Grace"]} />);

    expect(grace).toHaveFocus();
  });

  it("does not steal focus when a row is added", () => {
    const { rerender } = render(<Rows rows={["Ada"]} />);

    rerender(<Rows rows={["Ada", "Grace"]} />);

    expect(document.body).toHaveFocus();
  });
});
