import { describe, expect, it } from "vitest";

import {
  readRetainedDraftCopy,
  writeRetainedDraftCopy,
} from "./retained-draft-copy";

const source = {
  reportId: "10000000-0000-4000-8000-000000000001",
  reportSectionId: "10000000-0000-4000-8000-000000000002",
  kind: "risk" as const,
  stableId: "10000000-0000-4000-8000-000000000003",
};

describe("retained draft copy navigation", () => {
  it.each(["risk", "decision"] as const)(
    "carries only the %s source identifiers without changing other query context",
    (kind) => {
      const query = new URLSearchParams("feedback=1");
      writeRetainedDraftCopy(query, { ...source, kind });
      expect(readRetainedDraftCopy(query)).toEqual({ ...source, kind });
      expect(query.get("feedback")).toBe("1");
      expect([...query.keys()]).toEqual([
        "feedback",
        "copyReportId",
        "copySectionId",
        "copyKind",
        "copyStableId",
      ]);
    },
  );

  it.each(["copyReportId", "copySectionId", "copyKind", "copyStableId"])(
    "rejects a missing, malformed or repeated %s instead of choosing a source",
    (key) => {
      const query = new URLSearchParams();
      writeRetainedDraftCopy(query, source);
      query.delete(key);
      expect(readRetainedDraftCopy(query)).toBeNull();
      query.set(key, "invalid");
      expect(readRetainedDraftCopy(query)).toBeNull();
      writeRetainedDraftCopy(query, source);
      query.append(key, query.get(key) ?? "");
      expect(readRetainedDraftCopy(query)).toBeNull();
    },
  );

  it("consumes the copy intent without losing other route state", () => {
    const query = new URLSearchParams("feedback=1&scope=mine");
    writeRetainedDraftCopy(query, source);
    writeRetainedDraftCopy(query, null);
    expect(query.toString()).toBe("feedback=1&scope=mine");
    expect(readRetainedDraftCopy(query)).toBeNull();
  });
});
