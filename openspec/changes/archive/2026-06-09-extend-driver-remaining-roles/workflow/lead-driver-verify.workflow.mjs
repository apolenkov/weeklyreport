export const meta = {
  name: "lead-driver-verify",
  description:
    "Adversarially verify candidate anomalies from the lead AI UI Driver against the catalog oracle + source code",
  phases: [
    { title: "Verify", detail: "one code-reading skeptic per candidate" },
  ],
};

// Phase-2 sibling of the lead AI Driver (task 3.1). The Driver (a Playwright-MCP
// agent) walks the `lead` surface and emits CANDIDATE anomalies — observations
// that appear to contradict the documented `then` in e2e/catalog/lead.yaml. Raw
// driver output is a known false-positive factory (the 621→10 sweep lesson), so
// every candidate is judged here by an INDEPENDENT, ADVERSARIAL, code-reading
// agent that tries to REFUTE it and defaults to "not a bug" when unsure.
//
// Input: args = { role?, catalog?, candidates: [ {route, intentId, kind,
//                  observed, expected, evidence, severity}, ... ] }
//   role defaults to "lead"; catalog defaults to e2e/catalog/<role>.yaml.
//   Run once per role so each skeptic reads the catalog matching its intentIds.
// Output: [ {candidate, verdict: {isReal, confidence, classification,
//            rootCause, reasoning, suggestedFix}} ]

// args may arrive as a parsed object or as a JSON string depending on how the
// caller passes it — tolerate both.
const parsedArgs = typeof args === "string" ? JSON.parse(args) : args;
const role = (parsedArgs && parsedArgs.role) || "lead";
const catalogPath =
  (parsedArgs && parsedArgs.catalog) || `e2e/catalog/${role}.yaml`;
const candidates = (parsedArgs && parsedArgs.candidates) || [];

const VERDICT_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: [
    "isReal",
    "confidence",
    "classification",
    "rootCause",
    "reasoning",
    "suggestedFix",
  ],
  properties: {
    isReal: {
      type: "boolean",
      description:
        "true ONLY if the observed behavior is a genuine defect — a real contradiction of intended design proven by source code. false for expected behavior, seeding artifacts, environmental quirks, or driver misreads.",
    },
    confidence: { type: "string", enum: ["high", "medium", "low"] },
    classification: {
      type: "string",
      enum: [
        "real-bug",
        "expected-behavior",
        "seeding-artifact",
        "environmental",
        "driver-misread",
      ],
    },
    rootCause: {
      type: "string",
      description:
        "If real-bug: the file:line or component + the code-level cause. Else: why it is NOT a bug, citing the code that makes the observed behavior correct/explained.",
    },
    reasoning: { type: "string" },
    suggestedFix: {
      type: "string",
      description: "If real-bug: a concrete, minimal fix. Else: empty string.",
    },
  },
};

if (candidates.length === 0) {
  log("No candidates passed — nothing to verify.");
  return { verified: [] };
}

log(
  `Verifying ${candidates.length} candidate anomalies (adversarial, code-reading).`,
);

const verdicts = await parallel(
  candidates.map(
    (c, i) => () =>
      agent(
        `You are an adversarial code reviewer judging ONE candidate anomaly reported by an automated UI driver for the CustomReport app's \`${role}\` role. Your default stance is SKEPTICAL: most driver findings are false positives (expected behavior, seed-data quirks, or misreads). Mark it a real bug ONLY if reading the source proves the observed behavior contradicts intended design.

## Candidate
- route: ${c.route}
- intentId: ${c.intentId ?? "(none)"}
- kind: ${c.kind}
- observed: ${c.observed}
- expected (documented \`then\`): ${c.expected}
- evidence: ${c.evidence}
- driver severity: ${c.severity}

## The oracle
Read \`/Users/wrk/work/customreport/${catalogPath}\` and find the intent \`${c.intentId ?? c.route}\` — its \`given\`/\`when\`/\`then\`/\`note\` are the intended behavior.

## Your job
1. Locate the relevant source in \`apps/web/src\` (and \`apps/api/src\` / \`prisma/\` if needed). Use grep/Read. Trace the actual logic behind the observed behavior.
2. Decide adversarially: is the observation a GENUINE defect, or is it explained by (a) intended design, (b) seed data / fixture state (e.g. a period with no submissions, a report in draft/published/read-only state, or empty history), (c) environment (dev-stub/auth, headless browser), or (d) a driver misread of the UI?
   - Trace the ACTUAL render/authz guard in source, not the catalog's loose phrasing — e.g. if the \`then\` says a control appears when "period != published" but the component gates on \`status === "open"\`, the code condition is what decides. A control hidden because its precondition is genuinely unmet is expected, not a bug.
   - When a candidate bundles two claims (e.g. "request is forbidden" AND "the failure is shown silently"), judge them SEPARATELY: one may be expected while the other is a real defect. Do not let a benign verdict on one claim dismiss the other.
3. If real, give the file:line root cause and a minimal fix. If not, cite the code/state that explains the observation.

Be decisive but conservative — when the code does not clearly prove a defect, set isReal=false with classification reflecting the most likely benign cause. Return the structured verdict.`,
        {
          label: `verify:${c.intentId ?? c.kind}-${i}`,
          phase: "Verify",
          schema: VERDICT_SCHEMA,
          agentType: "Explore",
          model: "sonnet",
        },
      ).then((verdict) => ({ candidate: c, verdict })),
  ),
);

const verified = verdicts.filter(Boolean);
const real = verified.filter((v) => v.verdict && v.verdict.isReal);
log(`Verified ${verified.length}; ${real.length} confirmed real.`);

return { verified };
