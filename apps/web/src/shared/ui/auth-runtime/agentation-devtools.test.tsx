// @vitest-environment node

import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, describe, expect, it, vi } from "vitest";

import { AgentationDevtools } from "./agentation-devtools";

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("AgentationDevtools", () => {
  it("does not render the browser-only widget during a development server render", () => {
    vi.stubEnv("NODE_ENV", "development");
    vi.stubEnv("NEXT_PUBLIC_DISABLE_DEVTOOLS", undefined);

    expect(renderToStaticMarkup(<AgentationDevtools />)).toBe("");
  });

  it.each([
    ["the explicit disable flag", "development", "true"],
    ["the production environment", "production", undefined],
  ])("stays disabled for %s", (_reason, nodeEnv, disableDevtools) => {
    vi.stubEnv("NODE_ENV", nodeEnv);
    vi.stubEnv("NEXT_PUBLIC_DISABLE_DEVTOOLS", disableDevtools);

    expect(renderToStaticMarkup(<AgentationDevtools />)).toBe("");
  });
});
