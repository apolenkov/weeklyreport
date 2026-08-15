import { describe, expect, it } from "vitest";

import { actionLogCatalogFindings } from "./catalog-content-contract.js";

const GROUNDED_ACTION_LOG = `
      - id: admin-actions-view
        intent: View whitelisted event details in the Action Log
        when: Search loaded rows by displayed timestamp, then load another page
        then: Copy whitelisted event details without any request or response body
        note: Search covers loaded rows only. Cursor pagination shows 20 rows per page.
`;

const GROUNDED_GUIDANCE = `
Generated controls, fields, retention, and access claims require live source or an accepted OpenSpec change.
`;

describe("actionLogCatalogFindings", () => {
  it("accepts the grounded Action Log wording and review rule", () => {
    expect(
      actionLogCatalogFindings(GROUNDED_ACTION_LOG, GROUNDED_GUIDANCE),
    ).toEqual([]);
  });

  it("rejects the historical raw-payload hallucination", () => {
    expect(
      actionLogCatalogFindings(
        GROUNDED_ACTION_LOG.replace("whitelisted event details", "raw payload"),
        GROUNDED_GUIDANCE,
      ),
    ).toContainEqual(expect.stringContaining("raw payload"));
  });

  it.each([
    ["whitelisted event details", "safe details"],
    ["displayed timestamp", "time"],
    ["Search covers loaded rows only", "Search all history"],
    ["20 rows per page", "cursor pagination"],
  ])("requires the Action Log phrase %s", (required, replacement) => {
    expect(
      actionLogCatalogFindings(
        GROUNDED_ACTION_LOG.replaceAll(required, replacement),
        GROUNDED_GUIDANCE,
      ),
    ).toContainEqual(expect.stringContaining(required));
  });

  it("requires source-or-OpenSpec grounding guidance", () => {
    expect(
      actionLogCatalogFindings(GROUNDED_ACTION_LOG, "human review"),
    ).toContainEqual(
      expect.stringContaining("live source or an accepted OpenSpec change"),
    );
  });
});
