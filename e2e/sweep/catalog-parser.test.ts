import { describe, expect, it } from "vitest";

import { parseCatalog } from "./catalog-parser.ts";

const VALID_CATALOG = `role: lead
routes:
  - route: /lead/report
    access: [lead, head, admin]
    landing: "/lead/report/[reportId]"
    intents:
      - id: lead-report-bare-redirect
        intent: "Legacy bare report route redirects to canonical addressed form"
        given: "Lead visits /lead/report without a reportId path segment"
        when: "the page loads"
        then: "the user is redirected to the addressed form"
        note: "No console errors"
`;

const REDIRECT_CATALOG = `role: admin
routes:
  - route: /admin/activities
    access: [admin]
    landing: "/admin?tab=activities"
    intents:
      - id: admin-activities-redirect
        intent: "Legacy activities alias"
        given: "The admin opens the alias"
        when: "The page loads"
        then: "The browser lands on the activities tab"
`;

const RESOLVER_CATALOG = `role: viewer
routes:
  - route: /reports/latest
    access: [viewer]
    intents:
      - id: viewer-status-resolver
        intent: "Resolve the viewer's current or published status report"
        given: "The viewer has a prepared report state"
        when: "the viewer opens the status entry"
        then: "the resolver returns the state-bound landing outcome"
        note: "The route may also produce an empty or query-error outcome"
`;

describe("catalog parser integrity", () => {
  it("parses a well-formed catalog", () => {
    const parsed = parseCatalog(VALID_CATALOG);
    expect(parsed?.routes).toHaveLength(1);
    expect(parsed?.routes[0]?.intents).toHaveLength(1);
  });

  it("parses an exact route-level landing URL including its query", () => {
    expect(parseCatalog(REDIRECT_CATALOG)?.routes[0]?.landing).toBe(
      "/admin?tab=activities",
    );
  });

  it("allows a state-bound resolver route without an exact landing declaration", () => {
    const parsed = parseCatalog(RESOLVER_CATALOG);
    expect(parsed?.routes[0]?.route).toBe("/reports/latest");
    expect(parsed?.routes[0]?.landing).toBeUndefined();
  });

  it("returns null for a file without a role line (not a catalog)", () => {
    expect(parseCatalog("# just a comment\nroutes:\n")).toBeNull();
  });

  it("rejects duplicate routes", () => {
    const duplicated = `${VALID_CATALOG}  - route: /lead/report
    access: [lead]
    intents:
      - id: second-intent
        intent: "Duplicate route"
        given: "x"
        when: "x"
        then: "x"
`;
    expect(() => parseCatalog(duplicated)).toThrow(/Duplicate route/);
  });

  it("rejects duplicate intent ids within a route", () => {
    const duplicated = `role: lead
routes:
  - route: /lead/report
    access: [lead]
    intents:
      - id: same-id
        intent: "First intent"
        given: "x"
        when: "x"
        then: "x"
      - id: same-id
        intent: "Second intent"
        given: "y"
        when: "y"
        then: "y"
`;
    expect(() => parseCatalog(duplicated)).toThrow(/Duplicate intent id/);
  });

  it("rejects duplicate field assignment within an intent", () => {
    const duplicated = VALID_CATALOG.replace(
      '        given: "Lead visits /lead/report without a reportId path segment"',
      '        given: "First"\n        given: "Second"',
    );
    expect(() => parseCatalog(duplicated)).toThrow(/Duplicate field/);
  });

  it("rejects an intent missing a required behavioral field", () => {
    const truncated = VALID_CATALOG.replace(
      '        when: "the page loads"\n',
      "",
    );
    expect(() => parseCatalog(truncated)).toThrow(/missing its when field/);
  });

  it("rejects unknown lines", () => {
    const unknown = VALID_CATALOG.replace(
      '        note: "No console errors"',
      '        note: "No console errors"\n        frobnicate: "nope"',
    );
    expect(() => parseCatalog(unknown)).toThrow(/Unknown intent field/);
  });

  it("rejects duplicate route-level landing declarations", () => {
    const duplicated = REDIRECT_CATALOG.replace(
      '    landing: "/admin?tab=activities"',
      '    landing: "/admin?tab=activities"\n    landing: "/admin?tab=activities"',
    );
    expect(() => parseCatalog(duplicated)).toThrow(/Duplicate route field/);
  });

  it("rejects a blank landing declaration", () => {
    expect(() =>
      parseCatalog(
        REDIRECT_CATALOG.replace(
          '    landing: "/admin?tab=activities"',
          "    landing:",
        ),
      ),
    ).toThrow(/Blank landing URL/);
    expect(() =>
      parseCatalog(
        REDIRECT_CATALOG.replace(
          '    landing: "/admin?tab=activities"',
          '    landing: ""',
        ),
      ),
    ).toThrow(/Blank landing URL/);
  });

  it("rejects a landing field outside route-level placement", () => {
    const nested = REDIRECT_CATALOG.replace(
      '    landing: "/admin?tab=activities"',
      '      landing: "/admin?tab=activities"',
    );
    expect(() => parseCatalog(nested)).toThrow(/Malformed landing placement/);
  });

  it("rejects a known redirect alias without a landing declaration", () => {
    expect(() =>
      parseCatalog(
        REDIRECT_CATALOG.replace('    landing: "/admin?tab=activities"\n', ""),
      ),
    ).toThrow(/requires an exact landing URL/);
  });

  it("rejects an absolute, fragment, or non-canonical landing URL", () => {
    expect(() =>
      parseCatalog(
        REDIRECT_CATALOG.replace(
          '    landing: "/admin?tab=activities"',
          '    landing: "https://outside.example/admin"',
        ),
      ),
    ).toThrow(/Malformed landing URL/);
    expect(() =>
      parseCatalog(
        REDIRECT_CATALOG.replace(
          '    landing: "/admin?tab=activities"',
          '    landing: "/admin?tab=activities#main"',
        ),
      ),
    ).toThrow(/Malformed landing URL/);
  });
});
