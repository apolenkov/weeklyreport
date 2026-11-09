import { publishedReportSnapshotSchema } from "@weeklyreport/shared";
import { describe, expect, it } from "vitest";

import {
  buildAssembledReportFromPrismaRow,
  toPublishedSnapshotJson,
  toSectionRecordOmissions,
} from "./published-report-snapshot.js";

type Row = Parameters<typeof buildAssembledReportFromPrismaRow>[0];

const id = (suffix: number) =>
  `10000000-0000-4000-8000-${suffix.toString().padStart(12, "0")}`;

const REPORT = id(1);
const GROUP = id(2);
const PRODUCT = id(4);
const ACTIVITY = id(7);

const risk = (
  suffix: number,
  parent: { projectId?: string; activityId?: string; stages?: string[] },
  mitigation: string | null,
) => ({
  id: id(suffix),
  stableId: id(suffix + 100),
  projectId: parent.projectId ?? null,
  activityId: parent.activityId ?? null,
  project: parent.projectId ? { name: "Product" } : null,
  risk: `Risk ${suffix}`,
  impact: "Delivery slips",
  mitigation,
  severity: "blocked",
  stageNames: parent.stages ?? [],
  recordComments: [],
});

const decision = (suffix: number, impact: string | null) => ({
  id: id(suffix),
  stableId: id(suffix + 100),
  text: `Decision ${suffix}`,
  owner: "Owner",
  deadline: null,
  impact,
  resolvedAt: null,
  stageNames: ["Development"],
  productId: PRODUCT,
  activityId: null,
  project: { name: "Product" },
  recordComments: [],
});

const section = (
  suffix: number,
  status: string,
  records: { risks?: unknown[]; decisions?: unknown[] },
) => ({
  id: id(suffix),
  reportId: REPORT,
  authorId: id(suffix + 1),
  version: 1,
  status,
  submittedAt: null,
  late: false,
  author: {
    name: `Lead ${suffix}`,
    role: "lead",
    stageAssignments: [],
    reportingGroupId: GROUP,
    reportingGroup: { id: GROUP, name: "Group" },
  },
  items: [],
  risks: records.risks ?? [],
  decisions: records.decisions ?? [],
  activityStatuses: [],
  itemOutcomeEvents: [],
  stageStatuses: [],
  projectStatuses: [],
  sectionReviews: [],
});

const report = (sections: unknown[]) =>
  ({
    id: REPORT,
    periodStart: new Date("2026-09-21T00:00:00Z"),
    periodEnd: new Date("2026-09-27T00:00:00Z"),
    deadline: null,
    status: "published",
    publishedAt: new Date("2026-09-28T12:00:00Z"),
    publishedById: id(3),
    publishedBy: { name: "Head" },
    sections,
  }) as unknown as Row;

const MIXED = section(20, "draft", {
  risks: [
    risk(30, { projectId: PRODUCT, stages: ["Testing", "Development"] }, null),
    risk(31, { projectId: PRODUCT, stages: ["Development", "Testing"] }, null),
    risk(32, { projectId: PRODUCT, stages: ["Development"] }, null),
    risk(33, { activityId: ACTIVITY }, null),
    risk(34, { projectId: PRODUCT, stages: ["Development"] }, "Escalate"),
  ],
  decisions: [decision(40, null), decision(41, "Scope moves")],
});

const freeze = (row: Row) =>
  publishedReportSnapshotSchema.parse(
    toPublishedSnapshotJson(
      buildAssembledReportFromPrismaRow(row),
      toSectionRecordOmissions(row),
    ),
  );

const product = (
  stageNames: string[],
  kind: "risk" | "decision",
  count = 1,
) => ({
  kind,
  parentKind: "product",
  parentId: PRODUCT,
  stageNames,
  count,
});

describe("frozen omission buckets", () => {
  it("freezes complete records and counts the omitted ones per scope", () => {
    const [frozen] = freeze(report([MIXED])).sections;

    expect(frozen?.risks.map((entry) => entry.id)).toEqual([id(34)]);
    expect(frozen?.decisions.map((entry) => entry.id)).toEqual([id(41)]);
    expect(frozen?.recordOmission).toEqual({
      version: 1,
      buckets: [
        product(["Development"], "decision"),
        {
          kind: "risk",
          parentKind: "activity",
          parentId: ACTIVITY,
          stageNames: [],
          count: 1,
        },
        product(["Development", "Testing"], "risk", 2),
        product(["Development"], "risk"),
      ],
    });
  });

  it("gives every section metadata, empty when nothing was omitted", () => {
    const { sections } = freeze(
      report([
        MIXED,
        section(50, "submitted", { decisions: [decision(60, "Scope moves")] }),
        section(70, "draft", {}),
      ]),
    );

    expect(
      sections.map((entry) => entry.recordOmission?.buckets.length),
    ).toEqual([4, 0, 0]);
  });

  it("stores no null detail, private text or identity of an omitted record", () => {
    const row = report([MIXED]);
    const json = JSON.stringify(
      toPublishedSnapshotJson(
        buildAssembledReportFromPrismaRow(row),
        toSectionRecordOmissions(row),
      ),
    );

    expect(json).not.toContain('"mitigation":null');
    expect(json).not.toContain('"impact":null');
    for (const omitted of [30, 31, 32, 33, 40]) {
      expect(json).not.toContain(id(omitted));
      expect(json).not.toContain(id(omitted + 100));
    }
    expect(json).not.toContain("Risk 30");
    expect(json).not.toContain("Decision 40");
  });

  it("keeps buckets out of the client-facing assembled report", () => {
    const assembled = buildAssembledReportFromPrismaRow(report([MIXED]));

    expect(JSON.stringify(assembled)).not.toContain("recordOmission");
  });

  it("does not mutate the raw rows it reads", () => {
    const row = report([MIXED]);
    const before = structuredClone(row);

    freeze(row);

    expect(row).toEqual(before);
  });

  it("freezes without counts as unknown, never as nothing omitted", () => {
    const legacy = publishedReportSnapshotSchema.parse(
      toPublishedSnapshotJson(
        buildAssembledReportFromPrismaRow(report([MIXED])),
      ),
    );

    expect(legacy.sections[0]?.recordOmission).toBeUndefined();
  });

  it("refuses a freeze whose counts miss a section", () => {
    const assembled = buildAssembledReportFromPrismaRow(report([MIXED]));

    expect(() => toPublishedSnapshotJson(assembled, new Map())).toThrow(
      /no omission count/,
    );
  });

  it("rejects a frozen record with a null detail", () => {
    const frozen = freeze(report([MIXED]));
    const withNull = {
      ...frozen,
      sections: frozen.sections.map((entry) => ({
        ...entry,
        risks: entry.risks.map((record) => ({ ...record, mitigation: null })),
      })),
    };

    expect(publishedReportSnapshotSchema.safeParse(withNull).success).toBe(
      false,
    );
  });
});
