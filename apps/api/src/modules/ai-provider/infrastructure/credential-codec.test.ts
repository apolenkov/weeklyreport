import { describe, expect, it } from "vitest";

import {
  AesGcmCredentialCodec,
  CredentialCodecError,
} from "./credential-codec";

const KEY = "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA=";
const context = { revisionId: "revision-1", role: "generation" as const };

describe("AesGcmCredentialCodec", () => {
  it("round-trips a credential and exposes only masked metadata", () => {
    const codec = new AesGcmCredentialCodec(KEY, 7);
    const encrypted = codec.encrypt("sk-provider-secret", context);

    expect(codec.decrypt(encrypted, context)).toBe("sk-provider-secret");
    expect(encrypted.ciphertext).not.toContain("sk-provider-secret");
    expect(codec.metadata(encrypted)).toEqual({
      configured: true,
      maskedSuffix: "••••cret",
    });
  });

  it.each(["a", "abcd"])(
    "uses only the fixed mask for a short credential (%s)",
    (credential) => {
      const codec = new AesGcmCredentialCodec(KEY, 7);
      const encrypted = codec.encrypt(credential, context);

      expect(codec.decrypt(encrypted, context)).toBe(credential);
      expect(codec.metadata(encrypted)).toEqual({
        configured: true,
        maskedSuffix: "••••",
      });
      expect(encrypted.maskedSuffix).not.toContain(credential);
    },
  );

  it("rejects credential metadata outside the shared safe mask contract", () => {
    const codec = new AesGcmCredentialCodec(KEY, 7);
    const encrypted = codec.encrypt("provider-secret", context);

    expect(() =>
      codec.metadata({ ...encrypted, maskedSuffix: "secret" }),
    ).toThrow(/metadata/i);
  });

  it("detects tampering and rejects a different key version", () => {
    const codec = new AesGcmCredentialCodec(KEY, 1);
    const encrypted = codec.encrypt("secret", context);
    const tampered = { ...encrypted, ciphertext: `${encrypted.ciphertext}A` };

    expect(() => codec.decrypt(tampered, context)).toThrow(
      CredentialCodecError,
    );
    expect(() =>
      codec.decrypt({ ...encrypted, keyVersion: 2 }, context),
    ).toThrow(/version/i);
  });

  it("rejects a credential authenticated for another revision or role", () => {
    const codec = new AesGcmCredentialCodec(KEY, 1);
    const encrypted = codec.encrypt("secret", context);

    expect(() =>
      codec.decrypt(encrypted, {
        revisionId: "revision-2",
        role: "generation",
      }),
    ).toThrow(CredentialCodecError);
    expect(() =>
      codec.decrypt(encrypted, {
        revisionId: "revision-1",
        role: "embeddings",
      }),
    ).toThrow(CredentialCodecError);
  });

  it("validates key material before encryption", () => {
    expect(() => new AesGcmCredentialCodec("short", 1)).toThrow(
      /exactly 32 bytes/i,
    );
    expect(() => new AesGcmCredentialCodec(KEY, 0)).toThrow(/version/i);
  });

  it.each([
    ["lowercase hex", "a".repeat(64)],
    ["uppercase hex", "A".repeat(64)],
    ["outer-trimmed base64", `  ${KEY}  `],
  ])("accepts %s key material", (_label, material) => {
    const codec = new AesGcmCredentialCodec(material, 7);
    const encrypted = codec.encrypt("sk-provider-secret", context);
    expect(codec.decrypt(encrypted, context)).toBe("sk-provider-secret");
  });

  it.each([
    ["invalid character", `!${KEY.slice(1)}`],
    ["interior whitespace", `${KEY.slice(0, 20)} ${KEY.slice(21)}`],
    ["missing padding", KEY.slice(0, -1)],
    ["excess padding", `${KEY}=`],
  ])("rejects malformed base64 key encoding: %s", (_label, material) => {
    expect(() => new AesGcmCredentialCodec(material, 7)).toThrow(
      CredentialCodecError,
    );
    try {
      new AesGcmCredentialCodec(material, 7);
      expect.unreachable();
    } catch (error) {
      expect((error as Error).message).not.toContain(material.trim());
    }
  });
});
