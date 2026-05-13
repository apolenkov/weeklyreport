import { z } from "zod";

/**
 * 39-05 (PERF-05): full-text search.
 *
 * The search procedure (`search.query`) returns a flat array of hits across
 * Item / Risk / Decision / Project. Each hit carries a discriminated `type`
 * so the UI can pick an icon and a deep-link target. `snippet` is the raw
 * `ts_headline()` result with `<<…>>` markers around matched terms — the
 * UI converts those to <mark> tags.
 *
 * `rank` comes from `ts_rank(searchTsv, plainto_tsquery(...))`. The service
 * orders results by rank descending and caps at the requested limit.
 */
export const searchHitTypeSchema = z.enum([
  "item",
  "risk",
  "decision",
  "project",
]);
export type SearchHitType = z.infer<typeof searchHitTypeSchema>;

export const searchHitSchema = z.object({
  type: searchHitTypeSchema,
  id: z.string().uuid(),
  /** First line / projection of the matched field — used as the result row's
   * primary label. */
  title: z.string(),
  /** ts_headline output with `<<` / `>>` markers around matched tokens.
   * UI strips the markers and replaces them with <mark> tags. */
  snippet: z.string(),
  /** ts_rank float — strictly informational; ordering is server-side. */
  rank: z.number(),
  /** Optional FK pointers used to build the click-through URL. */
  projectId: z.string().uuid().optional(),
  reportId: z.string().uuid().optional(),
  reportSectionId: z.string().uuid().optional(),
  /** ISO timestamp of the underlying row (Item/Risk/Decision/Project.createdAt). */
  createdAt: z.string().datetime(),
});
export type SearchHit = z.infer<typeof searchHitSchema>;

/**
 * Input shape for `search.query`.
 *
 * - `q` minimum length 2 — the spec is explicit about that floor (Russian
 *   compounds, English abbreviations like "PR" / "QA" benefit from a low
 *   threshold). 3-char floor was rejected.
 * - `scope='mine'` filters to rows the caller authored (item/risk/decision)
 *   or leads (project). `scope='all'` is admin/head-only and is rejected
 *   server-side for `lead` sessions with FORBIDDEN.
 */
export const searchQueryInputSchema = z.object({
  q: z.string().min(2).max(200),
  scope: z.enum(["mine", "all"]).default("mine"),
  limit: z.number().int().min(1).max(50).default(20),
});
export type SearchQueryInput = z.infer<typeof searchQueryInputSchema>;

export const searchQueryOutputSchema = z.array(searchHitSchema);
export type SearchQueryOutput = z.infer<typeof searchQueryOutputSchema>;
