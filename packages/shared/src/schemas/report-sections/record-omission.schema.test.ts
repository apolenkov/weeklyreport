import { describe, expect, it } from "vitest";

import {
  recordOmissionSchema,
  summarizeRecordOmissions,
  summarizeRecordOmissionsForScopes,
} from "./record-omission.schema.js";

const productId = "10000000-0000-4000-8000-000000000001";
const activityId = "10000000-0000-4000-8000-000000000002";

describe("record omissions", () => {
  it("returns no disclosure for an empty authorized scope", () => {
    expect(summarizeRecordOmissionsForScopes([undefined], [])).toEqual({
      risks: 0,
      decisions: 0,
      unknown: false,
    });
  });

  it("counts a multi-stage bucket once across overlapping authorized scopes", () => {
    const metadata = recordOmissionSchema.parse({
      version: 1,
      buckets: [
        {
          kind: "risk",
          parentKind: "product",
          parentId: productId,
          stageNames: ["Build", "Test"],
          count: 2,
        },
      ],
    });
    expect(
      summarizeRecordOmissionsForScopes(
        [metadata],
        [
          { parentKind: "product", parentId: productId, stageNames: ["Build"] },
          { parentKind: "product", parentId: productId, stageNames: ["Test"] },
        ],
      ),
    ).toEqual({ risks: 2, decisions: 0, unknown: false });
  });
  it("distinguishes known zero, legacy unknown and malformed metadata", () => {
    expect(summarizeRecordOmissions([{ version: 1, buckets: [] }])).toEqual({
      risks: 0,
      decisions: 0,
      unknown: false,
    });
    expect(summarizeRecordOmissions([undefined])).toEqual({
      risks: 0,
      decisions: 0,
      unknown: true,
    });
    expect(
      recordOmissionSchema.safeParse({ version: 1, buckets: [{ count: -1 }] })
        .success,
    ).toBe(false);
    expect(summarizeRecordOmissions([])).toEqual({
      risks: 0,
      decisions: 0,
      unknown: false,
    });
  });

  it("scopes subjects and unions overlapping stages once per bucket", () => {
    const metadata = recordOmissionSchema.parse({
      version: 1,
      buckets: [
        {
          kind: "risk",
          parentKind: "product",
          parentId: productId,
          stageNames: ["Build", "Test"],
          count: 2,
        },
        {
          kind: "decision",
          parentKind: "activity",
          parentId: activityId,
          stageNames: [],
          count: 1,
        },
      ],
    });
    expect(
      summarizeRecordOmissions([metadata, undefined], {
        parentKind: "product",
        parentId: productId,
        stageNames: ["Build", "Test"],
      }),
    ).toEqual({ risks: 2, decisions: 0, unknown: true });
    expect(
      summarizeRecordOmissions([metadata], {
        parentKind: "activity",
        parentId: activityId,
      }),
    ).toEqual({ risks: 0, decisions: 1, unknown: false });
  });
});
