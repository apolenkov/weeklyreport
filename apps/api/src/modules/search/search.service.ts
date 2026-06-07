import {
  type SearchHit,
  type SearchQueryInput,
  type SearchQueryOutput,
  searchQueryInputSchema,
  searchQueryOutputSchema,
  type UserSession,
} from "@customreport/shared";
import { createAppLogger } from "../../lib/logger.js";

/**
 * 39-05 (PERF-05): SearchRepository contract — Prisma-free at the service
 * boundary so unit tests can supply an in-memory fake. The Prisma
 * implementation lives in search.prisma-repository.ts and uses $queryRaw
 * with `plainto_tsquery('russian', ...)` against the GIN-indexed
 * `searchTsv` columns added in migration 20260506090026.
 */
export interface SearchRepository {
  search(params: {
    q: string;
    /** When 'mine', only rows authored by `userId` are returned (item/risk/
     * decision via reportSection.authorId; project via leadId). When 'all',
     * rows are unfiltered — the service layer enforces the role gate before
     * calling this. */
    scope: "mine" | "all";
    userId: string;
    /**
     * TD-03: group IDs derived via groupScopeFilter logic.
     *   null  → admin; no group filter (see all groups).
     *   [...] → non-admin; filter rows to these reporting-group IDs.
     * An empty array is rejected upstream (early-return empty result) so
     * the repository never receives an empty groupIds array.
     */
    groupIds: string[] | null;
    /**
     * Hit types the caller must never see — their UNION ALL chunk is omitted
     * from the query entirely (not fetched then dropped), so excluded types
     * never consume a slot in the `limit` budget. The service decides this per
     * role; an empty array fetches all types.
     */
    excludeTypes: SearchHit["type"][];
    limit: number;
  }): Promise<SearchHit[]>;
}

export class SearchAuthorizationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "SearchAuthorizationError";
  }
}

export class SearchService {
  private readonly logger = createAppLogger({
    service: "SearchService",
    logDir: process.env.LOG_DIR,
    minLevel:
      (process.env.LOG_LEVEL as
        | "debug"
        | "info"
        | "warn"
        | "error"
        | undefined) ?? "info",
  });

  constructor(private readonly repository: SearchRepository) {}

  /**
   * Run a full-text search across Item / Risk / Decision / Project.
   *
   * Authorization:
   *   - `lead` role + `scope='all'` → SearchAuthorizationError. The router
   *     maps this to TRPCError code FORBIDDEN.
   *   - `head` / `admin` roles can use either scope.
   *   - `viewer` role with `scope='mine'` is technically callable but
   *     returns an empty list because viewers author nothing; we still
   *     reject `scope='all'` for symmetry — viewers see only published
   *     reports through the archive surface, not raw search.
   *
   * Query sanitisation: we never interpolate `q` into raw SQL. The Prisma
   * repository uses `plainto_tsquery('russian', $1)` which auto-quotes
   * tokens and ignores ts_query operator chars. `q` is also length-bounded
   * (2..200) by the Zod schema.
   */
  async query(
    input: SearchQueryInput,
    session: UserSession,
  ): Promise<SearchQueryOutput> {
    const parsed = searchQueryInputSchema.parse(input);

    if (
      parsed.scope === "all" &&
      session.role !== "head" &&
      session.role !== "admin"
    ) {
      throw new SearchAuthorizationError(
        'scope="all" is restricted to head and admin sessions',
      );
    }

    // TD-03: derive allowed group IDs matching groupScopeFilter semantics:
    //   admin → null (no group filter; sees all groups)
    //   head/lead → [reportingGroupId] (own group only)
    //   viewer → viewerGroupAccess (granted groups, may be empty)
    const groupIds: string[] | null =
      session.role === "admin"
        ? null
        : session.role === "viewer"
          ? (session.viewerGroupAccess ?? [])
          : session.reportingGroupId
            ? [session.reportingGroupId]
            : [];

    // Viewer (or head/lead) with no group access → zero-row result,
    // consistent with groupScopeFilter({ id: { in: [] } }) semantics.
    if (groupIds !== null && groupIds.length === 0) {
      return searchQueryOutputSchema.parse([]);
    }

    // A `lead` has no product-detail destination: the only surface that shows a
    // Project (product) entity is /admin, which leads cannot access. Returning
    // a `project` hit to a lead therefore dead-ends the search — clicking it
    // navigates to /admin and renders "Page unavailable for your role". Exclude
    // project hits at the repository so they are never fetched and never consume
    // a slot in the `limit` budget; the lead's own items/risks/decisions for
    // that product still surface (they deep-link into /lead/report). Found by
    // the AI UI Driver (behavioral-ui-regression-gate task 3.1).
    const excludeTypes: SearchHit["type"][] =
      session.role === "lead" ? ["project"] : [];

    const hits = await this.repository.search({
      q: parsed.q,
      scope: parsed.scope,
      userId: session.userId,
      groupIds,
      excludeTypes,
      limit: parsed.limit,
    });

    // Server-side ordering: rank desc, then createdAt desc as a stable tie-
    // breaker so two equal-rank rows don't shuffle between calls.
    const sorted = [...hits].sort((a, b) => {
      if (b.rank !== a.rank) return b.rank - a.rank;
      return b.createdAt.localeCompare(a.createdAt);
    });

    const limited = sorted.slice(0, parsed.limit);
    this.logger.info("search executed", {
      scope: parsed.scope,
      role: session.role,
      hits: limited.length,
    });
    return searchQueryOutputSchema.parse(limited);
  }
}
