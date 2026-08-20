# Lead report assistant — SearchPlan wire contract

This document fixes the exact v1 normalized shape for the single
`search_report_entries` function. The implementation MUST preserve field names,
literals, normalization rules, and no-filter semantics. JSON Schema is generated
from the shared Zod source; this document is the design contract, not a second
hand-written runtime schema.

## Boundary

The planner function parameters are exactly one `SearchPlan` object. The shared
Zod boundary uses strict objects and rejects unknown fields. The parser accepts
omitted optional fields and materializes only the documented defaults below; after
normalization, the parsed `SearchPlan` has the complete shape shown in this
document. Empty arrays and explicit `null` values mean no filter as specified
below. Defaults never select an author, grant access, add a database identifier,
change an ACL decision, or choose a semantic threshold.

## Normalization defaults

When the planner omits a field, the shared schema applies these defaults before
cross-field validation:

- `periods`: `includeCurrent: true`; published `mode: "latest"`, `count: 3`,
  and `references: []`;
- `authors`: `mode: "self"`, `references: []`, and `includeSelf: true`;
- `subjects`: empty `parentKinds`, product and activity references, and
  `linkedActivityMode: "exclude"`;
- `stages.references`, `recordKinds`, and all filter arrays: `[]`;
- nullable filters `carriedOver`, `hasPriority`, and `output.requestedLimit`:
  `null`;
- `retrieval`: `mode: "structured"` and `semanticQuery: null`;
- `output`: `mode: "list"`, `groupBy: []`, and `exhaustive: false`.

These defaults are schema normalization, not hidden product behavior. Explicit
mode-specific combinations are still checked by `.superRefine()` and rejected
when their required references or semantic query are missing.

Clarification tokens are not model-generated SearchPlan fields. They remain in the
validated assistant request beside the question and are applied by the server during
entity resolution after planning. The model never has to copy or transform an opaque
authorization-adjacent token.

## Exact TypeScript shape

```ts
type SearchPlan = Readonly<{
  periods: Readonly<{
    includeCurrent: boolean;
    published: Readonly<{
      mode: "none" | "latest" | "all" | "named";
      count: number | null;
      references: readonly string[];
    }>;
  }>;
  authors: Readonly<{
    mode: "self" | "all_visible" | "selected";
    references: readonly string[];
    includeSelf: boolean;
  }>;
  subjects: Readonly<{
    parentKinds: readonly ("product" | "activity")[];
    productReferences: readonly string[];
    activityReferences: readonly string[];
    linkedActivityMode: "exclude" | "include" | "only";
  }>;
  stages: Readonly<{
    references: readonly string[];
  }>;
  recordKinds: readonly (
    | "item"
    | "risk"
    | "decision"
    | "product_status"
    | "stage_status"
    | "activity_status"
  )[];
  filters: Readonly<{
    itemTypes: readonly ("current" | "next")[];
    itemWorkflowStatuses: readonly (
      "planned" | "in_progress" | "paused" | "postponed" | "done"
    )[];
    riskSeverities: readonly ("at-risk" | "blocked")[];
    decisionStates: readonly ("open" | "resolved")[];
    decisionTiming: readonly (
      | "without_deadline"
      | "overdue"
      | "due_today"
      | "upcoming"
      | "resolved_on_time"
      | "resolved_late"
    )[];
    canonicalHealth: readonly ("blocked" | "at-risk" | "on-track" | "empty")[];
    carriedOver: boolean | null;
    hasPriority: boolean | null;
    priorityRanks: readonly number[];
  }>;
  retrieval: Readonly<{
    mode: "structured" | "semantic_ranked";
    semanticQuery: string | null;
  }>;
  output: Readonly<{
    mode: "list" | "count" | "summary" | "comparison";
    groupBy: readonly (
      | "period"
      | "author"
      | "subject"
      | "stage"
      | "record_kind"
      | "canonical_health"
      | "item_type"
      | "item_workflow_status"
      | "risk_severity"
      | "decision_state"
      | "decision_timing"
    )[];
    requestedLimit: number | null;
    exhaustive: boolean;
  }>;
}>;
```

## Canonical and assistant-owned schemas

The implementation composes existing shared schemas for `itemTypes`,
`itemWorkflowStatuses`, `riskSeverities`, and the traffic-light adapters. The existing
`CanonicalStatus` type MUST gain a colocated `canonicalStatusSchema` and derive its
type from that schema; its literals are not duplicated in the assistant contract.

The following are assistant search vocabulary because the report model stores no
equivalent enum:

- `decisionStateSchema = z.enum(["open", "resolved"])`;
- `decisionTimingSchema = z.enum(["without_deadline", "overdue", "due_today",
"upcoming", "resolved_on_time", "resolved_late"])`.

They are query-time derived classifications, not new persisted Decision fields.

## Decision derivation

Use the trusted server date and configured application timezone. Decision deadlines
are calendar dates, not instants.

- `open`: `resolvedAt == null`.
- `resolved`: `resolvedAt != null`.
- `without_deadline`: `deadline == null`, regardless of resolution state.
- `overdue`: open, with deadline calendar date before the trusted server date.
- `due_today`: open, with deadline calendar date equal to the trusted server date.
- `upcoming`: open, with deadline calendar date after the trusted server date.
- `resolved_on_time`: resolved, deadline present, and the local calendar date of
  `resolvedAt` is on or before the deadline date.
- `resolved_late`: resolved, deadline present, and the local calendar date of
  `resolvedAt` is after the deadline date.

These timing values are mutually exclusive for one candidate. `decisionStates` and
`decisionTiming` remain independent filter dimensions and combine with AND.

## Explicit no-filter values

- `periods` has no generic no-filter form because at least one source must be selected.
- Empty `authors.references` means no named-author references for the selected mode.
- Empty subject/stage reference arrays and empty `parentKinds` mean no filter in that
  dimension.
- Empty `recordKinds` means all six candidate kinds.
- Every empty array under `filters` means no filter for that field.
- `carriedOver: null` means either value.
- `hasPriority: null` with `priorityRanks: []` means no priority filter.
- `semanticQuery: null` means there is no semantic residual and is valid only for
  `structured` retrieval.
- `groupBy: []` means no grouping.
- `requestedLimit: null` means the user did not request a display limit; the server's
  configured evidence and hard limits still apply.

`linkedActivityMode` is an explicit subject expansion, not a nullable filter:

- `exclude`: do not add activities merely because they are linked to a selected
  product;
- `include`: include directly selected product candidates and activities linked to
  selected products;
- `only`: return only activities linked to selected products.

## Cross-field rules

The strict Zod schema MUST enforce all of these in `.superRefine()`:

1. At least one period source is selected.
2. Published mode rules:
   - `none` -> `count: null`, `references: []`;
   - `latest` -> `count` is an integer from 1 through 52, `references: []`;
   - `all` -> `count: null`, `references: []`;
   - `named` -> `count: null`, one through 52 references.
3. Author mode rules:
   - `self` -> `references: []`, `includeSelf: true`;
   - `all_visible` -> `references: []`, `includeSelf` remains explicit;
   - `selected` -> one through 20 references, `includeSelf` remains explicit.
4. `linkedActivityMode: "include" | "only"` requires at least one product reference.
5. Reference arrays contain unique `safeText({ max: 200 })` values after normalization;
   stage and entity arrays contain at most 20 values.
6. `recordKinds` contains unique values and at most six entries.
7. Item-only filters require `recordKinds` to be empty or contain `item`.
8. Risk severity requires `recordKinds` to be empty or contain `risk`.
9. Decision state/timing requires `recordKinds` to be empty or contain `decision`.
10. Canonical health requires `recordKinds` to be empty or contain at least one of
    `product_status`, `stage_status`, or `activity_status`.
11. Non-empty `priorityRanks` requires `hasPriority: true`; ranks are unique integers
    from 1 through 100. `hasPriority: false` requires an empty rank array.
12. `structured` requires `semanticQuery: null`.
13. `semantic_ranked` requires `safeText({ max: 500 })` and an effective kind set that
    contains `item`, `risk`, `decision`, or `activity_status`. Product/stage status
    may accompany those kinds only as supporting exact facts.
14. `comparison` requires one or two `groupBy` dimensions. Other output modes allow
    zero through two unique grouping dimensions.
15. `requestedLimit` is null or an integer from 1 through 200.
16. `count` and `comparison` are complete-set operations regardless of display limit;
    `requestedLimit` never changes server aggregates.

Values inside one array combine with OR. Non-empty dimensions combine with AND.

## Default planner output example

Question: `What should I pay attention to?`

```json
{
  "periods": {
    "includeCurrent": true,
    "published": { "mode": "latest", "count": 3, "references": [] }
  },
  "authors": { "mode": "self", "references": [], "includeSelf": true },
  "subjects": {
    "parentKinds": [],
    "productReferences": [],
    "activityReferences": [],
    "linkedActivityMode": "exclude"
  },
  "stages": { "references": [] },
  "recordKinds": [],
  "filters": {
    "itemTypes": [],
    "itemWorkflowStatuses": [],
    "riskSeverities": [],
    "decisionStates": [],
    "decisionTiming": [],
    "canonicalHealth": [],
    "carriedOver": null,
    "hasPriority": null,
    "priorityRanks": []
  },
  "retrieval": {
    "mode": "semantic_ranked",
    "semanticQuery": "requires attention"
  },
  "output": {
    "mode": "summary",
    "groupBy": [],
    "requestedLimit": null,
    "exhaustive": false
  }
}
```

## Exact structured example

Question: `How many unresolved overdue decisions do I have in the current report?`

```json
{
  "periods": {
    "includeCurrent": true,
    "published": { "mode": "none", "count": null, "references": [] }
  },
  "authors": { "mode": "self", "references": [], "includeSelf": true },
  "subjects": {
    "parentKinds": [],
    "productReferences": [],
    "activityReferences": [],
    "linkedActivityMode": "exclude"
  },
  "stages": { "references": [] },
  "recordKinds": ["decision"],
  "filters": {
    "itemTypes": [],
    "itemWorkflowStatuses": [],
    "riskSeverities": [],
    "decisionStates": ["open"],
    "decisionTiming": ["overdue"],
    "canonicalHealth": [],
    "carriedOver": null,
    "hasPriority": null,
    "priorityRanks": []
  },
  "retrieval": { "mode": "structured", "semanticQuery": null },
  "output": {
    "mode": "count",
    "groupBy": [],
    "requestedLimit": null,
    "exhaustive": true
  }
}
```
