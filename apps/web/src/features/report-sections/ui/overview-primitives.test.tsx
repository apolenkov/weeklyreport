import { fireEvent, render, screen } from "@testing-library/react";
import { Button } from "@weeklyreport/ui/components/ui/button";
import { expect, it, vi } from "vitest";

it("keeps an unavailable action focusable and announces the reason without running it", () => {
  const action = vi.fn();
  const explain = vi.fn();
  render(
    <Button aria-disabled onClick={action} onUnavailable={explain}>
      Move
    </Button>,
  );
  const button = screen.getByRole("button", { name: "Move" });
  button.focus();
  expect(button).toHaveFocus();
  fireEvent.click(button);
  expect(action).not.toHaveBeenCalled();
  expect(explain).toHaveBeenCalledOnce();
});
