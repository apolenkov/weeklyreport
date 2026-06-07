import type { SearchHit, UserSession } from "@customreport/shared";
import { describe, expect, it, vi } from "vitest";

import {
  SearchAuthorizationError,
  type SearchRepository,
  SearchService,
} from "./search.service.js";

const userId = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const otherUserId = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
const groupA = "aaaaaaaa-aaaa-4aaa-8aaa-000000000001";
const groupB = "bbbbbbbb-bbbb-4bbb-8bbb-000000000002";
const reportId = "cccccccc-cccc-4ccc-8ccc-cccccccccccc";
const sectionId = "dddddddd-dddd-4ddd-8ddd-dddddddddddd";
const projectId = "eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee";
const itemId = "ffffffff-ffff-4fff-8fff-ffffffffffff";
const riskId = "11111111-1111-4111-8111-111111111111";
const decisionId = "22222222-2222-4222-8222-222222222222";

function makeSession(overrides: Partial<UserSession> = {}): UserSession {
  return {
    userId,
    email: "test@t.local",
    name: "Test User",
    role: "lead",
    reportingGroupId: groupA,
    viewerGroupAccess: [],
    ...overrides,
  };
}

function makeHit(overrides: Partial<SearchHit> = {}): SearchHit {
  return {
    type: "item",
    id: itemId,
    title: "release blocker",
    snippet: "release <<blocker>>",
    rank: 0.5,
    projectId,
    reportId,
    reportSectionId: sectionId,
    createdAt: "2026-05-06T08:00:00.000Z",
    ...overrides,
  };
}

function createRepository(
  handler: (params: {
    q: string;
    scope: "mine" | "all";
    userId: string;
    groupIds: string[] | null;
    excludeTypes: SearchHit["type"][];
    limit: number;
  }) => SearchHit[],
): SearchRepository {
  return {
    // eslint-disable-next-line @typescript-eslint/require-await -- mock implements the async SearchRepository contract (no awaitable work in the stub)
    async search(params) {
      // Faithfully model the real repository, which omits excluded-type chunks
      // from the query entirely, so service tests exercise the true contract.
      const hits = handler(params);
      return params.excludeTypes.length > 0
        ? hits.filter((hit) => !params.excludeTypes.includes(hit.type))
        : hits;
    },
  };
}

describe("SearchService", () => {
  it("returns matching items for a 2-char query (the spec floor)", async () => {
    const repo = createRepository(({ q }) => {
      expect(q).toBe("PR");
      return [makeHit({ title: "PR review" })];
    });
    const service = new SearchService(repo);

    const result = await service.query(
      { q: "PR", scope: "mine", limit: 20 },
      makeSession({ role: "lead" }),
    );

    expect(result).toHaveLength(1);
    expect(result[0]?.title).toBe("PR review");
  });

  it('rejects scope="all" for lead role with SearchAuthorizationError', async () => {
    const spy = vi.fn(() => [] as SearchHit[]);
    const service = new SearchService(createRepository(spy));

    await expect(
      service.query(
        { q: "release", scope: "all", limit: 20 },
        makeSession({ role: "lead" }),
      ),
    ).rejects.toBeInstanceOf(SearchAuthorizationError);

    // Repository must NOT have been called — auth gate is upstream.
    expect(spy).not.toHaveBeenCalled();
  });

  it('rejects scope="all" for viewer role', async () => {
    const service = new SearchService(createRepository(() => []));

    await expect(
      service.query(
        { q: "release", scope: "all", limit: 20 },
        makeSession({ role: "viewer", viewerGroupAccess: [groupA] }),
      ),
    ).rejects.toBeInstanceOf(SearchAuthorizationError);
  });

  it('allows scope="all" for head role', async () => {
    const repo = createRepository(({ scope }) => {
      expect(scope).toBe("all");
      return [makeHit()];
    });
    const service = new SearchService(repo);

    const result = await service.query(
      { q: "release", scope: "all", limit: 20 },
      makeSession({ role: "head" }),
    );

    expect(result).toHaveLength(1);
  });

  it('allows scope="all" for admin role', async () => {
    const repo = createRepository(({ scope }) => {
      expect(scope).toBe("all");
      return [makeHit()];
    });
    const service = new SearchService(repo);

    const result = await service.query(
      { q: "release", scope: "all", limit: 20 },
      makeSession({ userId: otherUserId, role: "admin" }),
    );

    expect(result).toHaveLength(1);
  });

  it('forwards userId to the repository for scope="mine"', async () => {
    const repo = createRepository((params) => {
      expect(params.userId).toBe(userId);
      expect(params.scope).toBe("mine");
      return [];
    });
    const service = new SearchService(repo);

    await service.query(
      { q: "release", scope: "mine", limit: 20 },
      makeSession({ role: "lead" }),
    );
  });

  it("excludes project hits for a lead (no product destination → would dead-end)", async () => {
    let seenExclude: SearchHit["type"][] | undefined;
    const repo = createRepository((params) => {
      seenExclude = params.excludeTypes;
      return [
        makeHit({ id: itemId, type: "item", title: "CRM blocker", rank: 0.9 }),
        makeHit({
          id: projectId,
          type: "project",
          title: "CRM-Sales Hub",
          rank: 0.8,
          reportId: undefined,
          reportSectionId: undefined,
        }),
      ];
    });
    const service = new SearchService(repo);

    const result = await service.query(
      { q: "CRM", scope: "mine", limit: 20 },
      makeSession({ role: "lead" }),
    );

    // Service tells the repository to omit the project chunk for leads, so no
    // project hit is ever fetched — it never consumes a slot in the limit.
    expect(seenExclude).toEqual(["project"]);
    expect(result.map((r) => r.type)).toEqual(["item"]);
    expect(result.some((r) => r.type === "project")).toBe(false);
  });

  it("keeps project hits for head (has the /admin product surface)", async () => {
    let seenExclude: SearchHit["type"][] | undefined;
    const repo = createRepository((params) => {
      seenExclude = params.excludeTypes;
      return [
        makeHit({
          id: projectId,
          type: "project",
          title: "CRM-Sales Hub",
          rank: 0.8,
          reportId: undefined,
          reportSectionId: undefined,
        }),
      ];
    });
    const service = new SearchService(repo);

    const result = await service.query(
      { q: "CRM", scope: "all", limit: 20 },
      makeSession({ role: "head" }),
    );

    expect(seenExclude).toEqual([]);
    expect(result.map((r) => r.type)).toEqual(["project"]);
  });

  it("returns empty array when repository finds nothing", async () => {
    const service = new SearchService(createRepository(() => []));

    const result = await service.query(
      { q: "unmatched", scope: "mine", limit: 20 },
      makeSession({ role: "lead" }),
    );

    expect(result).toEqual([]);
  });

  it("orders results by rank descending", async () => {
    const repo = createRepository(() => [
      makeHit({ id: itemId, rank: 0.1, title: "low" }),
      makeHit({
        id: riskId,
        type: "risk",
        rank: 0.9,
        title: "high",
        createdAt: "2026-05-06T07:00:00.000Z",
      }),
      makeHit({
        id: decisionId,
        type: "decision",
        rank: 0.5,
        title: "mid",
        createdAt: "2026-05-06T06:00:00.000Z",
      }),
    ]);
    const service = new SearchService(repo);

    const result = await service.query(
      { q: "rel", scope: "mine", limit: 20 },
      makeSession({ role: "lead" }),
    );

    expect(result.map((r) => r.title)).toEqual(["high", "mid", "low"]);
  });

  it("uses createdAt desc as a tie-breaker when rank is equal", async () => {
    const repo = createRepository(() => [
      makeHit({
        id: itemId,
        rank: 0.5,
        title: "older",
        createdAt: "2026-05-04T00:00:00.000Z",
      }),
      makeHit({
        id: riskId,
        type: "risk",
        rank: 0.5,
        title: "newer",
        createdAt: "2026-05-06T00:00:00.000Z",
      }),
    ]);
    const service = new SearchService(repo);

    const result = await service.query(
      { q: "rel", scope: "mine", limit: 20 },
      makeSession({ role: "lead" }),
    );

    expect(result.map((r) => r.title)).toEqual(["newer", "older"]);
  });

  it("applies the requested limit even when the repo returns more rows", async () => {
    const repo = createRepository(() =>
      Array.from({ length: 30 }, (_, idx) =>
        // Decreasing rank so the limit cuts the lowest-ranked rows.
        makeHit({
          id: `${itemId.slice(0, -2)}${idx.toString(16).padStart(2, "0")}`,
          rank: 1 - idx / 100,
          title: `hit-${idx}`,
        }),
      ),
    );
    const service = new SearchService(repo);

    const result = await service.query(
      { q: "foo", scope: "mine", limit: 5 },
      makeSession({ role: "lead" }),
    );

    expect(result).toHaveLength(5);
    expect(result[0]?.title).toBe("hit-0");
    expect(result[4]?.title).toBe("hit-4");
  });

  it("rejects q shorter than 2 characters via Zod", async () => {
    const service = new SearchService(createRepository(() => []));

    await expect(
      service.query(
        { q: "a", scope: "mine", limit: 20 },
        makeSession({ role: "lead" }),
      ),
    ).rejects.toThrow();
  });

  it("rejects q longer than 200 characters via Zod", async () => {
    const service = new SearchService(createRepository(() => []));

    await expect(
      service.query(
        { q: "x".repeat(201), scope: "mine", limit: 20 },
        makeSession({ role: "lead" }),
      ),
    ).rejects.toThrow();
  });

  // TD-03: group-scope filtering tests
  it("TD-03: head session passes own reportingGroupId as groupIds", async () => {
    const repo = createRepository((params) => {
      expect(params.groupIds).toEqual([groupA]);
      return [];
    });
    const service = new SearchService(repo);

    await service.query(
      { q: "release", scope: "mine", limit: 20 },
      makeSession({ role: "head", reportingGroupId: groupA }),
    );
  });

  it("TD-03: admin session passes null groupIds (no group filter)", async () => {
    const repo = createRepository((params) => {
      expect(params.groupIds).toBeNull();
      return [];
    });
    const service = new SearchService(repo);

    await service.query(
      { q: "release", scope: "all", limit: 20 },
      makeSession({ role: "admin" }),
    );
  });

  it("TD-03: viewer with granted groups passes those groupIds", async () => {
    const repo = createRepository((params) => {
      expect(params.groupIds).toEqual([groupA, groupB]);
      return [];
    });
    const service = new SearchService(repo);

    await service.query(
      { q: "release", scope: "mine", limit: 20 },
      makeSession({ role: "viewer", viewerGroupAccess: [groupA, groupB] }),
    );
  });

  it("TD-03: viewer with no granted groups returns empty without calling repository", async () => {
    const spy = vi.fn(() => [] as SearchHit[]);
    const service = new SearchService(createRepository(spy));

    const result = await service.query(
      { q: "release", scope: "mine", limit: 20 },
      makeSession({ role: "viewer", viewerGroupAccess: [] }),
    );

    expect(result).toEqual([]);
    expect(spy).not.toHaveBeenCalled();
  });

  it("TD-03: head with no reportingGroupId returns empty without calling repository", async () => {
    const spy = vi.fn(() => [] as SearchHit[]);
    const service = new SearchService(createRepository(spy));

    const result = await service.query(
      { q: "release", scope: "mine", limit: 20 },
      makeSession({ role: "head", reportingGroupId: undefined }),
    );

    expect(result).toEqual([]);
    expect(spy).not.toHaveBeenCalled();
  });
});
