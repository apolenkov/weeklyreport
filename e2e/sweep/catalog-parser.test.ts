import { describe, expect, it } from "vitest";

import { parseCatalog } from "./catalog-parser.ts";

const VALID_CATALOG = `role: lead
routes:
  - route: /lead/report
    access: [lead, head, admin]
    intents:
      - id: lead-report-bare-redirect
        intent: "Legacy bare report route redirects to canonical addressed form"
        given: "Lead visits /lead/report without a reportId path segment"
        when: "the page loads"
        then: "the user is redirected to the addressed form"
        note: "No console errors"
`;

describe("catalog parser integrity", () => {
  it("parses a well-formed catalog", () => {
    const parsed = parseCatalog(VALID_CATALOG);
    expect(parsed?.routes).toHaveLength(1);
    expect(parsed?.routes[0]?.intents).toHaveLength(1);
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
});
