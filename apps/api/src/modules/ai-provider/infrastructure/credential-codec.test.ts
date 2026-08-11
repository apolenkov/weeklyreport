import { describe, expect, it } from "vitest";

import {
  AesGcmCredentialCodec,
  CredentialCodecError,
} from "./credential-codec";

const KEY = "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA=";

describe("AesGcmCredentialCodec", () => {
  it("round-trips a credential and exposes only masked metadata", () => {
    const codec = new AesGcmCredentialCodec(KEY, 7);
    const encrypted = codec.encrypt("sk-provider-secret");

    expect(codec.decrypt(encrypted)).toBe("sk-provider-secret");
    expect(encrypted.ciphertext).not.toContain("sk-provider-secret");
    expect(codec.metadata(encrypted)).toEqual({
      configured: true,
      maskedSuffix: "••••cret",
    });
  });

  it("detects tampering and rejects a different key version", () => {
    const codec = new AesGcmCredentialCodec(KEY, 1);
    const encrypted = codec.encrypt("secret");
    const tampered = { ...encrypted, ciphertext: `${encrypted.ciphertext}A` };

    expect(() => codec.decrypt(tampered)).toThrow(CredentialCodecError);
    expect(() => codec.decrypt({ ...encrypted, keyVersion: 2 })).toThrow(
      /version/i,
    );
  });

  it("validates key material before encryption", () => {
    expect(() => new AesGcmCredentialCodec("short", 1)).toThrow(
      /exactly 32 bytes/i,
    );
    expect(() => new AesGcmCredentialCodec(KEY, 0)).toThrow(/version/i);
  });
});
