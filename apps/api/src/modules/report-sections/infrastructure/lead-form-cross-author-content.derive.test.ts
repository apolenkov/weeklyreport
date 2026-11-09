// An incomplete risk or decision is its author's private draft: a co-owner's
// cross-author read carries neither its text nor a stage status derived from it.
import { describe, expect, it, vi } from "vitest";

import type { PrismaService } from "../../../infrastructure/prisma/prisma.service";
import { fetchForeignStatusSections } from "./lead-form-cross-author.fetch";
import { buildCrossAuthorContentRows } from "./lead-form-cross-author-content.derive";

const AUTHOR = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const PROJECT = "11111111-1111-4111-8111-111111111111";
const OTHER_PROJECT = "11111111-1111-4111-8111-222222222222";
const STAGE = "dddddddd-dddd-4ddd-8ddd-dddddddddddd";
const STAGE_NAME = "Development";

const authorEntries = new Map([
  [
    AUTHOR,
    {
      authorId: AUTHOR,
      authorName: "Иванов Пётр",
      authorRole: "lead" as const,
      sharedProjectIds: new Set([PROJECT]),
      stageAssignments: [
        { projectId: PROJECT, stageId: STAGE, stageName: STAGE_NAME },
      ],
    },
  ],
]);

const risk = {
  projectId: PROJECT,
  risk: "vendor slips",
  impact: "release moves" as string | null,
  mitigation: "second vendor" as string | null,
  severity: "blocked",
  stageNames: [STAGE_NAME],
};

const decision = {
  productId: PROJECT,
  text: "pick a vendor",
  owner: "CTO",
  deadline: null,
  impact: "budget" as string | null,
  resolvedAt: null,
  stageNames: [STAGE_NAME],
};

function rowsFor(
  risks: readonly (typeof risk & { id: string })[],
  decisions: readonly (typeof decision & { id: string })[],
) {
  return buildCrossAuthorContentRows(
    [{ authorId: AUTHOR, items: [], risks, decisions, stageStatuses: [] }],
    authorEntries,
  );
}

describe("buildCrossAuthorContentRows with incomplete records", () => {
  it("hides incomplete risks and decisions on a shared product", () => {
    const [row] = rowsFor(
      [
        { id: "complete", ...risk, severity: "at-risk" },
        { id: "no-impact", ...risk, impact: null },
        { id: "no-mitigation", ...risk, mitigation: null },
      ],
      [
        { id: "complete", ...decision },
        { id: "draft", ...decision, impact: null },
      ],
    );

    expect(row?.risks.map(({ id }) => id)).toEqual(["complete"]);
    expect(row?.decisions.map(({ id }) => id)).toEqual(["complete"]);
  });

  it("counts the unfinished records it hides, on shared products only", () => {
    const [row] = rowsFor(
      [
        { id: "complete", ...risk },
        { id: "no-impact", ...risk, impact: null },
        { id: "no-mitigation", ...risk, mitigation: null },
        { id: "elsewhere", ...risk, projectId: OTHER_PROJECT, impact: null },
      ],
      [
        { id: "draft", ...decision, impact: null },
        {
          id: "elsewhere",
          ...decision,
          productId: OTHER_PROJECT,
          impact: null,
        },
      ],
    );

    expect(row?.recordOmissions).toEqual({
      risks: 2,
      decisions: 1,
      unknown: false,
    });
  });

  it("derives the co-owner's stage status from complete risks only", () => {
    const [drafted] = rowsFor([{ id: "draft", ...risk, impact: null }], []);
    const [completed] = rowsFor([{ id: "complete", ...risk }], []);

    expect(drafted?.stages[0]?.status).toBeNull();
    expect(completed?.stages[0]?.status).toBe("red");
  });
});

describe("fetchForeignStatusSections", () => {
  it("reads only complete risks for the status-only co-owner view", async () => {
    interface StatusQueryArgs {
      readonly select: { readonly risks: { readonly where?: unknown } };
    }
    const findMany = vi.fn<
      (args: StatusQueryArgs) => Promise<readonly unknown[]>
    >(() => Promise.resolve([]));
    const prisma = {
      reportSection: { findMany },
    } as unknown as PrismaService;

    await fetchForeignStatusSections(prisma, "report-id", [AUTHOR]);

    expect(findMany.mock.calls[0]?.[0].select.risks.where).toEqual({
      impact: { not: null },
      mitigation: { not: null },
    });
  });
});
