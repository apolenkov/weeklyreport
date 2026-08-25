import { describe, expect, it } from "vitest";

import {
  assertRevealPath,
  canonicalRevealUrlFor,
  parseRevealPath,
  revealPathFor,
  revealStepFor,
  revealSurfaceFor,
} from "../../reveal-path.ts";
import { assertSameRevealOrigin } from "../guards/preflight-reveal-guards.ts";

const DATABASE_DIGEST = "d".repeat(64);
const surface = revealSurfaceFor([
  {
    controlKey: "button:Open:0",
    ariaRole: "button",
    accessibleName: "Open",
    enabled: true,
    order: 0,
    domOrderKey: "0000:button:Open:0",
    href: null,
    interactionEffect: null,
  },
]);
const action = {
  controlKey: "button:Open:0",
  operation: "click" as const,
  safety: "read-only" as const,
  transition: "open" as const,
};
const proof = {
  status: "unchanged" as const,
  beforeDigest: DATABASE_DIGEST,
  afterDigest: DATABASE_DIGEST,
};

describe("reveal URL identity", () => {
  it("preserves exact duplicate-query order and hash", () => {
    expect(canonicalRevealUrlFor("/lead?a=2&a=1#dialog")).toBe(
      "/lead?a=2&a=1#dialog",
    );
    expect(revealPathFor([], "/lead?a=2&a=1").digest).not.toBe(
      revealPathFor([], "/lead?a=1&a=2").digest,
    );
  });

  it("accepts a URL-only semantic transition and rejects a true no-op", () => {
    const transition = revealStepFor(
      action,
      surface,
      surface,
      "/lead?panel=closed",
      "/lead?panel=open#dialog",
      proof,
    );
    expect(() =>
      assertRevealPath(
        revealPathFor([transition], "/lead?panel=closed"),
        surface,
      ),
    ).not.toThrow();
    const noOp = revealStepFor(
      action,
      surface,
      surface,
      "/lead?panel=closed",
      "/lead?panel=closed",
      proof,
    );
    expect(() =>
      assertRevealPath(revealPathFor([noOp], "/lead?panel=closed"), surface),
    ).toThrow(/change the semantic state/iu);
  });

  it("rejects an initial URL changed without a new digest", () => {
    const path = revealPathFor([], "/lead?a=2&a=1");
    expect(() =>
      parseRevealPath({ ...path, initialUrl: "/lead?a=1&a=2" }),
    ).toThrow(/digest/iu);
  });

  it("rejects a reveal action that leaves the live browser origin", () => {
    expect(() =>
      assertSameRevealOrigin(
        "http://127.0.0.1:3000/lead",
        "https://outside.example/lead",
      ),
    ).toThrow(/browser origin/iu);
  });
});
