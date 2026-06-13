import { describe, expect, it } from "vitest";

import { assertTestDatabaseUrl } from "./prisma-test-helper";

describe("assertTestDatabaseUrl", () => {
  describe("accepts _test-suffixed databases", () => {
    it("accepts a standard localhost _test URL", () => {
      expect(() =>
        assertTestDatabaseUrl(
          "postgresql://u:p@localhost:5432/customreport_test",
        ),
      ).not.toThrow();
    });

    it("accepts a remote host with _test suffix", () => {
      expect(() =>
        assertTestDatabaseUrl(
          "postgresql://user:pass@db.example.com:5432/myapp_test",
        ),
      ).not.toThrow();
    });

    it("accepts a URL with a ?schema=... query string", () => {
      expect(() =>
        assertTestDatabaseUrl(
          "postgresql://u:p@localhost:5432/customreport_test?schema=public",
        ),
      ).not.toThrow();
    });
  });

  describe("rejects non-_test databases", () => {
    const rejectedCases: [string, string][] = [
      ["postgresql://u:p@localhost:5432/customreport", "customreport"],
      ["postgresql://u:p@localhost:5432/customreport_dev", "customreport_dev"],
      ["postgresql://u:p@localhost:5432/customreport_uat", "customreport_uat"],
      [
        "postgresql://u:p@localhost:5432/customreport_prod",
        "customreport_prod",
      ],
      ["postgresql://u:p@localhost:5432/customreport_e2e", "customreport_e2e"],
    ];

    it.each(rejectedCases)("rejects %s", (url, expectedDbName) => {
      expect(() => assertTestDatabaseUrl(url)).toThrow(
        new RegExp(`"${expectedDbName}"`),
      );
    });

    it("error message contains the offending DB name, not credentials", () => {
      let caughtError: unknown;
      try {
        assertTestDatabaseUrl(
          "postgresql://secretuser:secretpass@localhost:5432/customreport_dev",
        );
      } catch (error_) {
        caughtError = error_;
      }
      expect(caughtError).toBeInstanceOf(Error);
      const msg = (caughtError as Error).message;
      expect(msg).toContain("customreport_dev");
      expect(msg).not.toContain("secretuser");
      expect(msg).not.toContain("secretpass");
    });

    it("refuses a path-less URL without echoing credentials", () => {
      let caughtError: unknown;
      try {
        assertTestDatabaseUrl(
          "postgresql://secretuser:secretpass@db.example.com:5432",
        );
      } catch (error_) {
        caughtError = error_;
      }
      expect(caughtError).toBeInstanceOf(Error);
      const msg = (caughtError as Error).message;
      expect(msg).not.toContain("secretuser");
      expect(msg).not.toContain("secretpass");
      expect(msg).not.toContain("db.example.com");
    });

    it("refuses an unparseable URL without echoing it", () => {
      expect(() => assertTestDatabaseUrl("not a url")).toThrow(/_test/);
    });

    it("error message contains the _test hint", () => {
      expect(() =>
        assertTestDatabaseUrl(
          "postgresql://u:p@localhost:5432/customreport_dev",
        ),
      ).toThrow(/_test/);
    });
  });
});
