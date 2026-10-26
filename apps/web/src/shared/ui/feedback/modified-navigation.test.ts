import { describe, expect, it } from "vitest";

import { isModifiedNavigation } from "./modified-navigation";

const plain = {
  button: 0,
  metaKey: false,
  ctrlKey: false,
  shiftKey: false,
  altKey: false,
};

describe("isModifiedNavigation", () => {
  it("accepts a plain primary click", () => {
    expect(isModifiedNavigation(plain)).toBe(false);
  });

  it.each([
    { button: 1 },
    { metaKey: true },
    { ctrlKey: true },
    { shiftKey: true },
    { altKey: true },
  ])("defers to the browser for %o", (change) => {
    expect(isModifiedNavigation({ ...plain, ...change })).toBe(true);
  });
});
