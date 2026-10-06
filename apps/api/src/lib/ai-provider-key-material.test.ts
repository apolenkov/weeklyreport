import { describe, expect, it } from "vitest";

import {
  AiProviderKeyMaterialError,
  parseAiProviderKeyMaterial,
} from "./ai-provider-key-material";

const KEY_BYTES = Buffer.alloc(32, 7);
const BASE64_KEY = KEY_BYTES.toString("base64");
const HEX_KEY = Buffer.alloc(32, 7).toString("hex");

describe("parseAiProviderKeyMaterial", () => {
  it.each([
    ["canonical padded base64", BASE64_KEY],
    ["lowercase hex", HEX_KEY],
    ["uppercase hex", HEX_KEY.toUpperCase()],
    ["outer-trimmed base64", `  ${BASE64_KEY}  `],
  ])("accepts %s and decodes the same 32 bytes", (_label, material) => {
    expect(parseAiProviderKeyMaterial(material)).toEqual(KEY_BYTES);
  });

  it.each([
    ["empty", ""],
    ["whitespace-only", " ".repeat(3)],
    ["invalid character", `!${BASE64_KEY.slice(1)}`],
    [
      "interior whitespace",
      `${BASE64_KEY.slice(0, 20)} ${BASE64_KEY.slice(21)}`,
    ],
    ["missing padding", BASE64_KEY.slice(0, -1)],
    ["excess padding", `${BASE64_KEY}=`],
    ["misplaced padding", `=${BASE64_KEY.slice(1)}`],
    ["base64 of 31 bytes", Buffer.alloc(31, 7).toString("base64")],
    ["base64 of 48 bytes", Buffer.alloc(48, 7).toString("base64")],
    ["hex of 63 chars", HEX_KEY.slice(0, -1)],
    ["non-hex character", `g${HEX_KEY.slice(1)}`],
  ])("rejects %s", (_label, material) => {
    expect(() => parseAiProviderKeyMaterial(material)).toThrow(
      AiProviderKeyMaterialError,
    );
  });

  it("never embeds the submitted material in the error", () => {
    const material = `!${BASE64_KEY.slice(1)}`;
    try {
      parseAiProviderKeyMaterial(material);
      expect.unreachable();
    } catch (error) {
      expect(error).toBeInstanceOf(AiProviderKeyMaterialError);
      expect((error as Error).message).not.toContain(material);
    }
  });
});
