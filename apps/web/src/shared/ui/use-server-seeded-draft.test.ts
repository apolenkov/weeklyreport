/**
 * @vitest-environment jsdom
 */
import { act, renderHook } from "@testing-library/react";
import { StrictMode } from "react";
import { describe, expect, it } from "vitest";

import { useServerSeededDraft } from "./use-server-seeded-draft";

interface Settings {
  readonly timezone: string;
}

describe("useServerSeededDraft", () => {
  it("keeps a dirty draft across a server prop change", () => {
    const { result, rerender } = renderHook(
      (server: Settings) => useServerSeededDraft(server),
      { wrapper: StrictMode, initialProps: { timezone: "UTC" } },
    );

    act(() => result.current.setDraft({ timezone: "Europe/Berlin" }));
    rerender({ timezone: "America/New_York" });

    expect(result.current.draft).toEqual({ timezone: "Europe/Berlin" });
  });

  it("reseeds a clean draft when a distinct server value arrives", () => {
    const { result, rerender } = renderHook(
      (server: Settings) => useServerSeededDraft(server),
      { wrapper: StrictMode, initialProps: { timezone: "UTC" } },
    );

    rerender({ timezone: "America/New_York" });

    expect(result.current.draft).toEqual({ timezone: "America/New_York" });
  });

  it("keeps a dirty draft when the same server reference is passed again", () => {
    const server = { timezone: "UTC" };
    const { result, rerender } = renderHook(
      (s: Settings) => useServerSeededDraft(s),
      { wrapper: StrictMode, initialProps: server },
    );

    act(() => result.current.setDraft({ timezone: "Europe/Berlin" }));
    rerender(server);

    expect(result.current.draft).toEqual({ timezone: "Europe/Berlin" });
  });

  it("does not reseed a clean draft when the same server reference is passed again", () => {
    const server = { timezone: "UTC" };
    const { result, rerender } = renderHook(
      (s: Settings) => useServerSeededDraft(s),
      { wrapper: StrictMode, initialProps: server },
    );

    // Draft is clean (no setDraft call) — passing the identical reference
    // must not trigger a reseed render that would replace `draft` with a
    // new-but-equal object.
    const draftBeforeRerender = result.current.draft;
    rerender(server);

    expect(result.current.draft).toBe(draftBeforeRerender);
  });

  it("reseeds the next distinct server value after markClean", () => {
    const { result, rerender } = renderHook(
      (server: Settings) => useServerSeededDraft(server),
      { wrapper: StrictMode, initialProps: { timezone: "UTC" } },
    );

    act(() => result.current.setDraft({ timezone: "Europe/Berlin" }));
    act(() => result.current.markClean());
    rerender({ timezone: "America/New_York" });

    expect(result.current.draft).toEqual({ timezone: "America/New_York" });
  });
});
