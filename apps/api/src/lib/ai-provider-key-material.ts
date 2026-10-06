const AES_KEY_BYTES = 32;
const BASE64_QUANTUM = 4;
const HEX_KEY_PATTERN = /^[0-9a-f]{64}$/iu;
const BASE64_KEY_PATTERN = /^[A-Za-z0-9+/]*={0,2}$/u;

// Fixed diagnostic: it names the accepted shapes and must never embed the
// submitted material.
export const AI_PROVIDER_KEY_MATERIAL_MESSAGE =
  "AI provider encryption key must be 64 hex characters or canonical padded base64 encoding exactly 32 bytes";

export class AiProviderKeyMaterialError extends Error {
  constructor() {
    super(AI_PROVIDER_KEY_MATERIAL_MESSAGE);
    this.name = "AiProviderKeyMaterialError";
  }
}

// Single parser for the master key, shared by env validation and the
// credential codec: outer trim, 64-char case-insensitive hex, or canonical
// padded standard base64 of exactly 32 bytes. Node's base64 decoder silently
// drops invalid characters and tolerates padding mistakes, so the decoded
// bytes must re-encode to the identical string. Rejecting a malformed
// representation never changes the underlying key bytes: operators may
// canonicalize the encoding of the same bytes.
export const parseAiProviderKeyMaterial = (material: string): Buffer => {
  const value = material.trim();
  if (HEX_KEY_PATTERN.test(value)) {
    return Buffer.from(value, "hex");
  }
  if (value.length % BASE64_QUANTUM !== 0 || !BASE64_KEY_PATTERN.test(value)) {
    throw new AiProviderKeyMaterialError();
  }
  const decoded = Buffer.from(value, "base64");
  if (
    decoded.length !== AES_KEY_BYTES ||
    decoded.toString("base64") !== value
  ) {
    throw new AiProviderKeyMaterialError();
  }
  return decoded;
};
