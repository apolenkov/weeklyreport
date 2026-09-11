import { describe, expect, it, vi } from "vitest";

import { createOverviewInputMemory } from "./overview-input-memory";

describe("overview input memory", () => {
  it("isolates reports and retains the exact composer draft until explicit clearing", () => {
    const memory = createOverviewInputMemory<{ text: string }>();
    const composer = { text: "Unsaved result" };
    memory.write("first", composer);
    expect(memory.read("second")).toBeNull();
    memory.write("second", { text: "Another report" });
    expect(memory.read("first")).toBe(composer);
    memory.write("first", null);
    expect(memory.read("first")).toBeNull();
    expect(memory.hasInput()).toBe(true);
    memory.write("second", null);
    expect(memory.hasInput()).toBe(false);
  });

  it("supports functional updates and subscriptions without no-op notifications", () => {
    const memory = createOverviewInputMemory<string>();
    const listener = vi.fn();
    const unsubscribe = memory.subscribe(listener);
    memory.write("report", "retained");
    memory.write("report", (value) => value);
    expect(listener).toHaveBeenCalledTimes(1);
    memory.write("report", (value) => `${value ?? ""} input`);
    expect(memory.read("report")).toBe("retained input");
    unsubscribe();
    memory.write("report", null);
    expect(listener).toHaveBeenCalledTimes(2);
  });

  it("does not share memory between sessions", () => {
    const firstSession = createOverviewInputMemory<string>();
    const secondSession = createOverviewInputMemory<string>();
    firstSession.write("report", "private input");
    expect(secondSession.read("report")).toBeNull();
  });
});
