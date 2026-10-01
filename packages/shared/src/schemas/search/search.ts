import { z } from "zod";

import { safeText } from "../primitives/report-primitives.schema.js";

/** Search result kinds supported by the unified full-text endpoint. */
const searchHitTypeSchema = z.enum(["item", "risk", "decision", "project"]);
/** Describes a ranked search result and its navigation anchors. */
const searchHitSchema = z
  .object({
    type: searchHitTypeSchema,
    id: z.uuid(),
    /**
     * First line / projection of the matched field — used as the result row's
     * primary label.
     */
    title: z.string(),
    /**
     * ts_headline output with `<<` / `>>` markers around matched tokens.
     * UI strips the markers and replaces them with <mark> tags.
     */
    snippet: z.string(),
    /** ts_rank float — strictly informational; ordering is server-side. */
    rank: z.number(),
    /** Optional FK pointers used to build the click-through URL. */
    projectId: z.uuid().optional(),
    reportId: z.uuid().optional(),
    reportSectionId: z.uuid().optional(),
    /**
     * ISO ordering timestamp: the live row's createdAt, or the immutable
     * publication timestamp for a frozen snapshot hit.
     */
    createdAt: z.iso.datetime(),
  })
  .readonly();
/** Ranked search result with navigation anchors. */
export type SearchHit = z.infer<typeof searchHitSchema>;

const MAX_SEARCH_RESULTS_LIMIT = 50;
const DEFAULT_SEARCH_RESULTS_LIMIT = 20;

/**
 * Role-agnostic wire shape. SearchService authorizes the requested scope for
 * the current session; in particular, viewers may request only `published`.
 */
export const searchQueryInputSchema = z
  .object({
    q: safeText({ min: 2, max: 200 }),
    scope: z.enum(["mine", "all", "published"]).default("mine"),
    limit: z
      .number()
      .int()
      .min(1)
      .max(MAX_SEARCH_RESULTS_LIMIT)
      .default(DEFAULT_SEARCH_RESULTS_LIMIT),
  })
  .readonly();
/** Caller-authorized search scope with a bounded result limit. */
export type SearchQueryInput = z.infer<typeof searchQueryInputSchema>;

/** Describes the ordered result list returned by full-text search. */
export const searchQueryOutputSchema = z.array(searchHitSchema).readonly();
/** Ordered result list returned by full-text search. */
export type SearchQueryOutput = z.infer<typeof searchQueryOutputSchema>;
