import { createHmac, timingSafeEqual } from "node:crypto";

import { sha256Hex, stableSerialize } from "../../../support/ids.ts";
import type {
  RevealBootstrap,
  RevealContinuationReceipt,
  RevealExecutionGrant,
  RevealParentPass,
  RevealReceiptChunk,
} from "./preflight-reveal-continuation-schemas.ts";

const R188_HASH_DOMAIN = "customreport/runtime-sweep/reveal/v4";
export const R188_DIGEST_LENGTH = sha256Hex("").length;
export const R188_ZERO_DIGEST = "0".repeat(R188_DIGEST_LENGTH);
const R188_VERSION_SEGMENT = R188_HASH_DOMAIN.split("/").at(-1);
export const R188_WIRE_VERSION = Number(
  R188_VERSION_SEGMENT?.slice("v".length),
);

/** Hashes canonical bytes with an explicit domain; cross-artifact hash reuse is rejected. */
const domainDigestFor = (domain: string, value: unknown): string =>
  sha256Hex({ domain: `${R188_HASH_DOMAIN}/${domain}`, value });

export const canonicalBytesFor = (value: unknown): Uint8Array =>
  new TextEncoder().encode(stableSerialize(value));

export const contentDigestFor = (kind: string, value: unknown): string =>
  domainDigestFor(`content/${kind}`, value);

export const hmacFor = (
  key: string,
  domain: string,
  value: unknown,
): string => {
  if (key.trim() === "") throw new Error("R188 HMAC key must not be empty");
  return createHmac("sha256", key)
    .update(`${R188_HASH_DOMAIN}/hmac/${domain}\n`, "utf8")
    .update(stableSerialize(value), "utf8")
    .digest("hex");
};

export const constantTimeEqualHex = (left: string, right: string): boolean => {
  const digestPattern = new RegExp(
    `^[0-9a-f]{${String(R188_DIGEST_LENGTH)}}$`,
    "u",
  );
  if (!digestPattern.test(left) || !digestPattern.test(right)) return false;
  const leftBytes = Buffer.from(left, "hex");
  const rightBytes = Buffer.from(right, "hex");
  return timingSafeEqual(leftBytes, rightBytes);
};

export const grantDigestForBody = (
  body: Omit<RevealExecutionGrant, "grantDigest">,
): string => domainDigestFor("grant", body);

export const chunkDigestForBody = (
  body: Omit<RevealReceiptChunk, "chunkDigest">,
): string => domainDigestFor("receipt-chunk", body);

export const bootstrapDigestForBody = (
  body: Omit<RevealBootstrap, "bootstrapDigest">,
): string => domainDigestFor("bootstrap", body);

export const parentPassDigestForBody = (
  body: Omit<RevealParentPass, "passDigest">,
): string => domainDigestFor("parent-pass", body);

export const receiptDigestForBody = (
  body: Omit<RevealContinuationReceipt, "digest">,
): string => domainDigestFor("terminal-receipt", body);
