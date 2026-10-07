import { describe, expect, it } from "vitest";

import { isStrongJwtSecret } from "./jwt-secret.js";

describe("isStrongJwtSecret", () => {
  it.each([
    "a".repeat(32),
    ` ${"b".repeat(32)} `, // 32 meaningful chars with padding
    `${"c".repeat(32)}   `,
  ])("accepts a value with >=32 meaningful characters: %j", (secret) => {
    expect(isStrongJwtSecret(secret)).toBe(true);
  });

  it.each([
    undefined,
    "",
    " ".repeat(32),
    "a".repeat(31),
    ` ${"b".repeat(31)} `, // 31 meaningful chars with padding
  ])("rejects a missing or weak secret: %j", (secret) => {
    expect(isStrongJwtSecret(secret)).toBe(false);
  });

  it("never mutates the accepted secret bytes", () => {
    const padded = `  ${"d".repeat(32)}  `;
    expect(isStrongJwtSecret(padded)).toBe(true);
    expect(padded.startsWith(" ")).toBe(true);
  });
});
