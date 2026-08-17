import {
  createCipheriv,
  createDecipheriv,
  createHmac,
  randomBytes,
} from "node:crypto";

const AES_KEY_BYTES = 32;
const AES_NONCE_BYTES = 12;
const MASK_SUFFIX_LENGTH = 4;
const BASE64_QUANTUM = 4;
const EMPTY_CREDENTIAL_MESSAGE = "Provider credential must be non-empty";

export type EncryptedCredential = Readonly<{
  ciphertext: string;
  nonce: string;
  tag: string;
  keyVersion: number;
  maskedSuffix: string;
}>;

export type StoredCredential = Readonly<{
  ciphertext: string;
  nonce: string;
  tag: string;
  keyVersion: number;
  maskedSuffix: string;
}>;

export type CredentialContext = Readonly<{
  revisionId: string;
  role: "generation" | "embeddings";
}>;

export class CredentialCodecError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "CredentialCodecError";
  }
}

const decodeKey = (material: string): Buffer => {
  const value = material.trim();
  const hex = /^[0-9a-f]{64}$/iu.test(value)
    ? Buffer.from(value, "hex")
    : Buffer.from(value, "base64");
  if (hex.length !== AES_KEY_BYTES) {
    throw new CredentialCodecError(
      "AI provider encryption key must encode exactly 32 bytes",
    );
  }
  return hex;
};

const assertKeyVersion = (keyVersion: number): void => {
  if (!Number.isInteger(keyVersion) || keyVersion < 1) {
    throw new CredentialCodecError(
      "AI provider encryption key version is invalid",
    );
  }
};

const aadFor = (keyVersion: number, context: CredentialContext): Buffer =>
  Buffer.from(
    `customreport:ai-provider:v2:key:${keyVersion}:revision:${context.revisionId}:role:${context.role}`,
    "utf8",
  );

const encode = (value: Uint8Array): string =>
  Buffer.from(value).toString("base64");

const decode = (value: string, label: string): Buffer => {
  if (
    value.length % BASE64_QUANTUM !== 0 ||
    !/^[A-Za-z0-9+/]*={0,2}$/u.test(value)
  ) {
    throw new CredentialCodecError(`Encrypted credential ${label} is invalid`);
  }
  const decoded = Buffer.from(value, "base64");
  if (decoded.length === 0) {
    throw new CredentialCodecError(`Encrypted credential ${label} is invalid`);
  }
  return decoded;
};

const maskCredential = (credential: string): string => {
  const value = credential.trim();
  if (value.length === 0) {
    throw new CredentialCodecError(EMPTY_CREDENTIAL_MESSAGE);
  }
  return `••••${value.slice(-MASK_SUFFIX_LENGTH)}`;
};

export class AesGcmCredentialCodec {
  private readonly key: Buffer;

  constructor(
    keyMaterial: string,
    private readonly keyVersion: number,
  ) {
    this.key = decodeKey(keyMaterial);
    assertKeyVersion(keyVersion);
  }

  encrypt(credential: string, context: CredentialContext): EncryptedCredential {
    const value = credential.trim();
    if (value.length === 0) {
      throw new CredentialCodecError(EMPTY_CREDENTIAL_MESSAGE);
    }
    const nonce = randomBytes(AES_NONCE_BYTES);
    const cipher = createCipheriv("aes-256-gcm", this.key, nonce);
    cipher.setAAD(aadFor(this.keyVersion, context));
    const ciphertext = Buffer.concat([
      cipher.update(value, "utf8"),
      cipher.final(),
    ]);
    return {
      ciphertext: encode(ciphertext),
      nonce: encode(nonce),
      tag: encode(cipher.getAuthTag()),
      keyVersion: this.keyVersion,
      maskedSuffix: maskCredential(value),
    };
  }

  decrypt(stored: StoredCredential, context: CredentialContext): string {
    assertKeyVersion(stored.keyVersion);
    if (stored.keyVersion !== this.keyVersion) {
      throw new CredentialCodecError(
        "Encrypted credential key version is unsupported",
      );
    }
    try {
      const decipher = createDecipheriv(
        "aes-256-gcm",
        this.key,
        decode(stored.nonce, "nonce"),
      );
      decipher.setAAD(aadFor(stored.keyVersion, context));
      decipher.setAuthTag(decode(stored.tag, "authentication tag"));
      return Buffer.concat([
        decipher.update(decode(stored.ciphertext, "ciphertext")),
        decipher.final(),
      ]).toString("utf8");
    } catch {
      throw new CredentialCodecError(
        "Encrypted credential authentication failed",
      );
    }
  }

  fingerprint(credential: string): string {
    const value = credential.trim();
    if (value.length === 0) {
      throw new CredentialCodecError("Provider credential must be non-empty");
    }
    return createHmac("sha256", this.key)
      .update("customreport:ai-provider:credential-fingerprint:v1\0", "utf8")
      .update(value, "utf8")
      .digest("hex");
  }

  metadata(stored: StoredCredential): Readonly<{
    configured: true;
    maskedSuffix: string;
  }> {
    assertKeyVersion(stored.keyVersion);
    if (stored.maskedSuffix.trim().length === 0) {
      throw new CredentialCodecError(
        "Encrypted credential metadata is invalid",
      );
    }
    return { configured: true, maskedSuffix: stored.maskedSuffix };
  }
}
