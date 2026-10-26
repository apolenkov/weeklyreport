import { render, screen, waitFor } from "@testing-library/react";
import { useState } from "react";
import { describe, expect, it, vi } from "vitest";

import { revealAndFocus } from "./reveal-and-focus";

function Disclosure() {
  const [open, setOpen] = useState(false);
  return (
    <article>
      <button
        aria-expanded={open}
        aria-controls="focus-panel"
        onClick={() => setOpen(true)}
      >
        Reveal
      </button>
      <div id="focus-panel" hidden={!open} inert={!open}>
        <button>Record</button>
      </div>
    </article>
  );
}

describe("revealAndFocus", () => {
  it("reveals a hidden target before focusing it", async () => {
    render(<Disclosure />);
    const target = screen.getByText("Record");
    revealAndFocus(target, { scope: target.closest("article") });
    await waitFor(() => expect(target).toHaveFocus());
    expect(target.closest("[hidden], [inert]")).toBeNull();
    expect(screen.getByRole("button", { name: "Reveal" })).toHaveAttribute(
      "aria-expanded",
      "true",
    );
  });

  it("simply focuses when there is no expander, without searching outside its scope", () => {
    const outside = vi.fn();
    render(
      <>
        <button
          aria-expanded="false"
          aria-controls="orphan-panel"
          onClick={outside}
        >
          Unrelated expander
        </button>
        <article id="orphan-panel">
          <div hidden inert>
            <button>Record</button>
          </div>
        </article>
      </>,
    );
    const target = screen.getByText("Record");
    const focus = vi.spyOn(target, "focus");
    revealAndFocus(target, { scope: target.closest("article") });
    // A hidden orphan cannot receive browser focus; preserve the focus attempt
    // without inventing a disclosure outside the caller's scope.
    expect(focus).toHaveBeenCalledExactlyOnceWith();
    expect(outside).not.toHaveBeenCalled();
  });

  it("does nothing when the target is not found", () => {
    render(<button>Keep focus</button>);
    const origin = screen.getByRole("button", { name: "Keep focus" });
    origin.focus();
    revealAndFocus(document.getElementById("missing"));
    expect(origin).toHaveFocus();
  });

  it("preserves deferred review focus and nearest scrolling when preventScroll is requested", async () => {
    render(<button>Record</button>);
    const target = screen.getByRole("button", { name: "Record" });
    const focus = vi.spyOn(target, "focus");
    const scroll = vi.spyOn(target, "scrollIntoView");
    revealAndFocus(target, {
      focusOptions: { preventScroll: true },
      scrollOptions: { block: "nearest" },
    });
    expect(focus).not.toHaveBeenCalled();
    await waitFor(() => expect(target).toHaveFocus());
    expect(focus).toHaveBeenCalledWith({ preventScroll: true });
    expect(scroll).toHaveBeenCalledWith({ block: "nearest" });
  });
});
