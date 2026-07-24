import type { Request, Response } from "express";
import { describe, expect, it, vi } from "vitest";

import { createSamlUnavailableHandler } from "./auth.routes";

function makeRes() {
  const res = {
    status: vi.fn(),
    json: vi.fn(),
  };
  res.status.mockReturnValue(res);
  return res as unknown as Response & typeof res;
}

describe("createSamlUnavailableHandler", () => {
  it("answers 503 with an explicit not-configured error", () => {
    const handler = createSamlUnavailableHandler();
    const res = makeRes();

    handler({} as Request, res, vi.fn());

    // eslint-disable-next-line @typescript-eslint/unbound-method -- vitest asserts on the mock reference for a call check, not an unbound invocation
    expect(res.status).toHaveBeenCalledWith(503);
    expect(res.json).toHaveBeenCalledWith({
      error: "SAML is not configured on this deployment",
    });
  });
});
