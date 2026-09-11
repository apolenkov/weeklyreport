import { render, screen } from "@testing-library/react";
import { expect, it } from "vitest";

import { EditorAvailabilityNotice } from "./lead-editor-availability-notice";

it("distinguishes pending editing controls from an unavailable section", () => {
  const { rerender } = render(
    <EditorAvailabilityNotice
      editor={{ status: "loading", mode: "overview" }}
    />,
  );

  expect(screen.getByRole("status")).toHaveTextContent(
    "Loading editing controls",
  );
  expect(screen.getByRole("status")).not.toHaveTextContent("not editable");

  rerender(<EditorAvailabilityNotice editor={{ status: "unavailable" }} />);

  expect(screen.getByRole("status")).toHaveTextContent(
    "This report section is not editable",
  );
});
