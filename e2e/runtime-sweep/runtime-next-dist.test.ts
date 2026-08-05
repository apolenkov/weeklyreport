import { describe, expect, it } from "vitest";

import {
  parseRuntimeNextDist,
  RUNTIME_NEXT_DIST,
} from "./runtime-next-dist.ts";

describe("parseRuntimeNextDist", () => {
  it.each(Object.values(RUNTIME_NEXT_DIST))("accepts %s", (value) => {
    expect(parseRuntimeNextDist(value)).toBe(value);
  });

  it.each([undefined, ".next", "../.next", ".next-runtime-other"])(
    "rejects %s",
    (value) => {
      expect(() => parseRuntimeNextDist(value)).toThrow(
        "Unknown runtime Next dist directory",
      );
    },
  );
});
