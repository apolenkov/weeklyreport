import { BlockList, isIP } from "node:net";

import fc from "fast-check";
import { describe, expect, it } from "vitest";

import { parseE2eRuntimeDatabaseTarget } from "./e2e-destructive-target.js";

const SCRIPT = "api-guard-property";
const REFUSAL =
  /^\[api-guard-property\] Refusing E2E\/runtime destructive operation/u;
const NUM_RUNS = 300;
const SECRET_PREFIX = "wr-private-password-";
const password = fc
  .string({ unit: "grapheme", maxLength: 16 })
  .map((suffix) => `${SECRET_PREFIX}密碼:/@?#%${suffix}`);
const octet = fc.integer({ min: 0, max: 255 });
const ipv4 = fc
  .tuple(octet, octet, octet, octet)
  .map((parts) => parts.join("."));
const loopbackHost = fc.oneof(
  fc.constantFrom("localhost", "LOCALHOST", "[::1]"),
  fc.tuple(octet, octet, octet).map((rest) => `127.${rest.join(".")}`),
  octet.map((last) => `[::ffff:127.0.0.${last}]`),
  octet.map((last) => `[::ffff:7f00:${last.toString(16)}]`),
);
const structuredUrl = fc
  .record({
    scheme: fc.constantFrom("postgres", "postgresql"),
    host: fc.oneof(
      loopbackHost,
      ipv4,
      ipv4.map((host) => `[::ffff:${host}]`),
      fc
        .integer({ min: 0, max: 0xff_ff })
        .map((part) => `[2001:db8::${part.toString(16)}]`),
      fc.domain(),
      fc.constantFrom(
        "db.example.com",
        "localhost.example.com",
        "localhost.",
        "[::]",
        "%6cocalhost",
        "0x7f000001",
        "2130706433",
      ),
    ),
    port: fc.integer({ min: 1, max: 65_535 }),
    database: fc.oneof(
      fc.constant("customreport_e2e"),
      fc
        .constantFrom(..."abcdefghijklmno")
        .map((lane) => `customreport_e2e_lane_${lane}_test`),
      fc.constantFrom(
        "customreport",
        "production",
        "customreport_e2e_lane_p_test",
        "customreport_e2e_lane_a",
        "CUSTOMREPORT_E2E",
      ),
    ),
    password,
  })
  .map(
    ({ scheme, host, port, database, password: secret }) =>
      `${scheme}://guard:${encodeURIComponent(secret)}@${host}:${port}/${database}`,
  );

describe("API destructive target parser properties", () => {
  it("never exposes raw or percent-encoded passwords in refusals", () => {
    fc.assert(
      fc.property(password, (secret) => {
        const encoded = encodeURIComponent(secret);
        const urls = [
          `postgresql://guard:${encoded}@db.example.com/customreport_e2e`,
          `postgresql://guard:${encoded}@localhost/production`,
          `https://guard:${encoded}@localhost/customreport_e2e`,
          `postgresql://guard:${encoded}@localhost:65536/customreport_e2e`,
          `postgresql://guard:${encoded}@localhost/customreport_e2e?host=remote`,
          `postgresql://guard:${encoded}@[invalid]/customreport_e2e`,
          `postgresql://guard:${secret}@localhost/customreport_e2e`,
        ];
        for (const url of urls) {
          const parse = () => parseE2eRuntimeDatabaseTarget(SCRIPT, url);
          expect(parse).toThrow(REFUSAL);
          expect(parse).not.toThrow(SECRET_PREFIX);
          expect(parse).not.toThrow(secret);
          expect(parse).not.toThrow(encoded);
        }
      }),
      { numRuns: NUM_RUNS },
    );
  });

  it("only accepts loopback e2e databases with a positive witness in every run", () => {
    const loopbackIps = new BlockList();
    loopbackIps.addSubnet("127.0.0.0", 8, "ipv4");
    loopbackIps.addAddress("::1", "ipv6");
    loopbackIps.addSubnet("::ffff:127.0.0.0", 104, "ipv6");

    fc.assert(
      fc.property(
        loopbackHost,
        fc.oneof(fc.string({ unit: "binary" }), structuredUrl),
        (positiveHost, url) => {
          // Parse without a catch: rejecting every URL must fail this property.
          const positiveUrl = `postgresql://${positiveHost}/customreport_e2e`;
          const positive = {
            url: positiveUrl,
            target: parseE2eRuntimeDatabaseTarget(SCRIPT, positiveUrl),
          };
          const candidate = (() => {
            try {
              return {
                state: "accepted" as const,
                url,
                target: parseE2eRuntimeDatabaseTarget(SCRIPT, url),
              };
            } catch (error) {
              return { state: "refused" as const, error };
            }
          })();
          if (candidate.state === "refused") {
            expect(candidate.error).toBeInstanceOf(Error);
            expect(
              candidate.error instanceof Error ? candidate.error.message : "",
            ).toMatch(REFUSAL);
          }
          const accepted =
            candidate.state === "accepted" ? [positive, candidate] : [positive];
          for (const { url: acceptedUrl, target } of accepted) {
            const hostname = new URL(acceptedUrl).hostname;
            expect(target.host).toBe(hostname);
            expect(target.database).toMatch(
              /^customreport_e2e(?:_lane_[a-o]_test)?$/u,
            );
            const host = hostname.startsWith("[")
              ? hostname.slice(1, -1)
              : hostname;
            expect(
              host.toLowerCase() === "localhost" ||
                loopbackIps.check(host, isIP(host) === 6 ? "ipv6" : "ipv4"),
            ).toBe(true);
          }
        },
      ),
      { numRuns: NUM_RUNS },
    );
  });
});
