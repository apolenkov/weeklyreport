export const meta = {
  name: "ai-ui-driver-verify",
  description:
    "Adversarially verify candidate anomalies from the AI UI Driver against the per-role catalog oracle + source code",
  phases: [
    { title: "Verify", detail: "one code-reading skeptic per candidate" },
  ],
};

// Phase-2 sibling of the AI UI Driver (the `ai-ui-driver` skill). The Driver (a
// Playwright-MCP agent) walks a role's surface and emits CANDIDATE anomalies —
// observations that appear to contradict the documented `then` in the role's
// catalog (`e2e/catalog/<role>.yaml`), OR hard runtime failures (crash, console
// error, failed nav, infinite skeleton, layout break) found while exploring
// paths the catalog does not enumerate. Raw driver output is a known
// false-positive factory (the 621->10 sweep lesson), so every candidate is
// judged here by an INDEPENDENT, ADVERSARIAL, code-reading agent that tries to
// REFUTE it and defaults to "not a bug" when the source does not prove a defect.
//
// IMPORTANT: this first-pass skeptic is fallible in BOTH directions — it
// false-dismisses real bugs and false-confirms non-bugs. Its verdicts are
// CANDIDATES for the main (Opus) session to re-verify empirically (browser
// repro + shared-component blast-radius), not conclusions. See the skill's
// "Re-verify both ways" guardrail.
//
// Input: args = { role?, catalog?, candidates: [ {route, intentId, kind,
//                  observed, expected, evidence, severity}, ... ] }
//   role defaults to "lead"; catalog defaults to e2e/catalog/<role>.yaml.
//   Run ONCE PER ROLE so each skeptic reads the catalog matching its intentIds.
//   Free-exploration candidates carry no intentId and kind "crash" — they are
//   judged purely on whether the runtime failure is a genuine defect, with no
//   catalog lookup.
// Output: { verified: [ {candidate, verdict: {isReal, confidence,
//            classification, rootCause, reasoning, suggestedFix}} ] }

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
        "true ONLY if the observed behavior is a genuine defect — a real contradiction of intended design proven by source code, or a real runtime crash/error. false for expected behavior, seeding artifacts, environmental quirks, or driver misreads.",
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
  `Verifying ${candidates.length} candidate anomalies for role '${role}' (adversarial, code-reading).`,
);

const verdicts = await parallel(
  candidates.map((c, i) => () => {
    const hasOracle = Boolean(c.intentId);
    const oracleBlock = hasOracle
      ? `## The oracle
Read \`/home/user/work/customreport/${catalogPath}\` and find the intent \`${c.intentId}\` — its \`given\`/\`when\`/\`then\`/\`note\` are the intended behavior.`
      : `## No oracle (free-exploration finding)
This candidate was found exploring a path the catalog does not enumerate, so there is NO documented \`then\`. Judge it ONLY as a hard runtime failure: a genuine crash / unhandled error / failed navigation / broken render that no user should hit. If the failure is environmental (dev-stub, headless, seed state) or expected for the action taken, set isReal=false.`;

    return agent(
      `You are an adversarial code reviewer judging ONE candidate anomaly reported by an automated UI driver for the CustomReport app's \`${role}\` role. Your default stance is SKEPTICAL: most driver findings are false positives (expected behavior, seed-data quirks, or misreads). Mark it a real bug ONLY if reading the source proves a genuine defect.

## Candidate
- route: ${c.route}
- intentId: ${c.intentId ?? "(none — free exploration)"}
- kind: ${c.kind}
- observed: ${c.observed}
- expected (documented \`then\`): ${c.expected ?? "(none)"}
- evidence: ${c.evidence}
- driver severity: ${c.severity}

${oracleBlock}

## Your job
1. Locate the relevant source in \`apps/web/src\` (and \`apps/api/src\` / \`prisma/\` if needed). Use grep/Read. Trace the actual logic behind the observed behavior.
2. Decide adversarially: is the observation a GENUINE defect, or is it explained by (a) intended design, (b) seed data / fixture state (e.g. a period with no submissions, a report in draft/published/read-only state, or empty history), (c) environment (dev-stub/auth, headless browser), or (d) a driver misread of the UI?
   - Trace the ACTUAL render/authz guard in source, not the catalog's loose phrasing — e.g. if the \`then\` says a control appears when "period != published" but the component gates on \`status === "open"\`, the code condition is what decides. A control hidden because its precondition is genuinely unmet is expected, not a bug.
   - When a candidate bundles two claims (e.g. "request is forbidden" AND "the failure is shown silently"), judge them SEPARATELY: one may be expected while the other is a real defect. Do not let a benign verdict on one claim dismiss the other.
   - Watch for shared components: a control that "leaks" to the wrong role often comes from a shared component embedded on multiple routes. Note in rootCause if the relevant code is shared, so the fix is not applied blindly.
3. If real, give the file:line root cause and a minimal fix. If not, cite the code/state that explains the observation.

Be decisive but conservative — when the code does not clearly prove a defect, set isReal=false with classification reflecting the most likely benign cause. Return the structured verdict.`,
      {
        label: `verify:${role}:${c.intentId ?? c.kind}-${i}`,
        phase: "Verify",
        schema: VERDICT_SCHEMA,
        agentType: "Explore",
        model: "sonnet",
      },
    ).then((verdict) => ({ candidate: c, verdict }));
  }),
);

const verified = verdicts.filter(Boolean);
const real = verified.filter((v) => v.verdict && v.verdict.isReal);
log(`Verified ${verified.length}; ${real.length} skeptic-confirmed real.`);

return { verified };
