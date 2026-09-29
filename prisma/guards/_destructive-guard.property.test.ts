import fc from "fast-check";
import { describe, expect, it } from "vitest";

import { parseE2eRuntimeDatabaseTarget } from "./_destructive-guard.js";

const NUM_RUNS = 300;
const SCRIPT = "guard-property";
const ALLOWED_DATABASES: readonly string[] = [
  "customreport_e2e",
  ..."abcdefghijklmno"
    .split("")
    .map((lane) => `customreport_e2e_lane_${lane}_test`),
];
const isAllowed = (name: string): boolean => ALLOWED_DATABASES.includes(name);

const octet = fc.integer({ min: 0, max: 255 });
const publicIpv4 = fc
  .tuple(
    fc.integer({ min: 1, max: 255 }).filter((first) => first !== 127),
    octet,
    octet,
    octet,
  )
  .map((parts) => parts.join("."));
const hextet = fc.integer({ min: 1, max: 0xff_ff }).map((n) => n.toString(16));
const nonLoopbackHost = fc.oneof(
  fc.domain(),
  publicIpv4,
  hextet.map((h) => `[2001:db8::${h}]`),
  publicIpv4.map((ip) => `[::ffff:${ip}]`),
);

const loopbackHost = fc.oneof(
  fc.constantFrom("localhost", "LocalHost", "[::1]"),
  fc.tuple(octet, octet, octet).map((rest) => `127.${rest.join(".")}`),
);
const port = fc.option(
  fc.integer({ min: 1, max: 65_535 }).map((n) => `:${n}`),
  { nil: "" },
);
const userinfo = fc.option(
  fc.stringMatching(/^[a-z0-9]{1,8}:[a-z0-9]{1,8}@$/u),
  { nil: "" },
);
const scheme = fc.constantFrom("postgres", "postgresql");

const buildUrl = (
  parts: { scheme: string; userinfo: string; host: string; port: string },
  database: string,
): string =>
  `${parts.scheme}://${parts.userinfo}${parts.host}${parts.port}/${database}`;
const urlParts = fc.record({
  scheme,
  userinfo,
  host: loopbackHost,
  port,
});

const run = (url: string) => () => parseE2eRuntimeDatabaseTarget(SCRIPT, url);

describe("destructive target parser properties", () => {
  it("rejects every non-loopback host", () => {
    fc.assert(
      fc.property(
        scheme,
        nonLoopbackHost,
        port,
        fc.constantFrom(...ALLOWED_DATABASES),
        (proto, host, portPart, database) => {
          const url = buildUrl(
            { scheme: proto, userinfo: "", host, port: portPart },
            database,
          );
          expect(run(url)).toThrow(/not loopback/u);
        },
      ),
      { numRuns: NUM_RUNS },
    );
  });

  it("rejects every database name outside the allowed set", () => {
    fc.assert(
      fc.property(
        urlParts,
        fc.string({ unit: "grapheme-ascii" }).filter((n) => !isAllowed(n)),
        (parts, database) => {
          expect(run(buildUrl(parts, database))).toThrow();
        },
      ),
      { numRuns: NUM_RUNS },
    );
  });

  it("rejects percent-encoded variants of allowed names", () => {
    const encodedVariant = fc
      .tuple(
        fc.constantFrom(...ALLOWED_DATABASES),
        fc.array(fc.boolean(), { minLength: 64, maxLength: 64 }),
      )
      .map(([name, mask]) =>
        [...name]
          .map((char, index) =>
            mask[index]
              ? `%${char.charCodeAt(0).toString(16).padStart(2, "0")}`
              : char,
          )
          .join(""),
      )
      .filter((encoded) => !isAllowed(encoded));
    fc.assert(
      fc.property(urlParts, encodedVariant, (parts, database) => {
        expect(run(buildUrl(parts, database))).toThrow();
      }),
      { numRuns: NUM_RUNS },
    );
  });

  it("accepts exactly the allowed databases on loopback hosts", () => {
    fc.assert(
      fc.property(
        urlParts,
        fc.oneof(
          fc.constantFrom(...ALLOWED_DATABASES),
          fc.stringMatching(/^customreport_e2e[a-z_]{0,12}$/u),
        ),
        (parts, database) => {
          const url = buildUrl(parts, database);
          if (!isAllowed(database)) {
            expect(run(url)).toThrow();
            return;
          }
          const identity = parseE2eRuntimeDatabaseTarget(SCRIPT, url);
          expect(identity.database).toBe(database);
          expect(identity.port).toBe(parts.port.slice(1) || "5432");
          // Documented equivalence: host case is not significant.
          expect(identity.host.toLowerCase()).toBe(parts.host.toLowerCase());
        },
      ),
      { numRuns: NUM_RUNS },
    );
  });

  it("only ever refuses with the guard error on arbitrary input", () => {
    const arbitraryUrl = fc.oneof(
      fc.string({ unit: "binary" }),
      fc
        .string({ unit: "grapheme" })
        .map((tail) => `postgresql://127.0.0.1/${tail}`),
      fc.string({ unit: "grapheme" }).map((tail) => `postgres://${tail}`),
    );
    fc.assert(
      fc.property(arbitraryUrl, (url) => {
        try {
          const identity = parseE2eRuntimeDatabaseTarget(SCRIPT, url);
          expect(isAllowed(identity.database)).toBe(true);
        } catch (error) {
          expect(error).toBeInstanceOf(Error);
          expect((error as Error).message).toMatch(
            /^\[guard-property\] Refusing E2E\/runtime destructive operation/u,
          );
        }
      }),
      { numRuns: NUM_RUNS },
    );
  });
});
