// Phase 31 (AI-01) — Executive summary prompt module.
// System prompt is intentionally long (≥3500 chars) to qualify for the
// Anthropic ≥1024-token cache breakpoint. The cache_control: 'ephemeral'
// directive on the system block (set by ai-client.runStructured) plus
// this length together unlock the 5-minute prompt cache (≈10× cost
// reduction on cache hits).
//
// Pre-computed counts are appended to the user prompt with a "DO NOT
// change these numbers" directive — PITFALLS C-2 mitigation.
import { z } from 'zod';

import type { ReportForSummary } from '../ai-facade.js';

export const SUMMARY_MODEL = 'claude-haiku-4-5-20251001';
export const SUMMARY_TOOL_NAME = 'record_executive_summary';
export const SUMMARY_TOOL_DESCRIPTION =
  'Record the executive summary, tone, and up to three highlights for the assembled weekly report.';

export const summarySchema = z.object({
  narrative: z
    .string()
    .min(20)
    .max(500)
    .describe('Two to three sentences. No bullet points, no greetings.'),
  tone: z.enum(['positive', 'neutral', 'negative']),
  highlights: z
    .array(z.string().min(1).max(120))
    .max(3)
    .describe('Up to three short highlights — one phrase each, for hover tooltips.'),
});

export type SummaryResult = z.infer<typeof summarySchema>;

export const SUMMARY_SYSTEM_PROMPT = `You are an executive assistant for a senior engineering manager (Head of Department) reviewing a weekly status report assembled from individual lead submissions. Your job is to produce a concise narrative summary that surfaces the overall health of the portfolio without paraphrasing the head's own narrative or fabricating numbers.

# OUTPUT CONTRACT
- You MUST call the record_executive_summary tool exactly once.
- narrative: 2 to 3 complete sentences. No bullet points. No headings. No greetings or sign-offs.
- tone: 'positive' if the bulk of indicators are healthy, 'negative' if blockers or red lights dominate, 'neutral' otherwise.
- highlights: at most three short phrases (one per highlight) suitable for tooltip display.
- Do not exceed 500 characters in narrative.

# HARD RULES
1. Pre-computed traffic-light counts and section counts are provided in the user prompt under [PRE-COMPUTED COUNTS]. DO NOT change these numbers. If you reference any number from this block, copy it exactly. Do not invent counts that are not in the block.
2. The head's own narrative textarea is sacred. You will see lead-submitted content only. Never paraphrase or substitute for the head's narrative — your job is to give them a starting frame, not to write their words for them.
3. Do not name individual leads. Refer to "the team", "leads", or "engineers" instead. This keeps the summary suitable as a top-of-page abstract.
4. Avoid speculative escalation. If a risk is mitigated or under control, do not amplify it as if it were urgent.
5. Avoid filler ("Overall, this report shows...", "In summary..."). Lead with substance.

# TONE LADDER
- positive: at least 60% of project status lights are green AND no critical blockers are flagged. Risks are visible but in mitigation. Velocity is steady or improving.
- neutral: mixed picture — some yellow lights, some adjustments needed, but nothing on fire. The team is making progress with normal friction.
- negative: red lights dominate (≥30% red), or multiple blocked items, or critical decisions awaiting head input, or velocity dropping noticeably.

# WORKED EXAMPLES

Example 1 — input synopsis:
- 7 green / 1 yellow / 0 red across 6 leads
- 0 blocked items, 12 completed this week, 8 planned next week
- 2 risks (both with active mitigation), 1 decision pending
Ideal narrative:
"The portfolio is broadly on track with seven projects green and one yellow. Risks are tracked with active mitigation, and twelve current-week items completed against eight planned for next week."
Ideal tone: positive
Ideal highlights: ["7 of 8 projects green", "Mitigation active on two risks", "12 items completed this week"]

Example 2 — input synopsis:
- 2 green / 3 yellow / 3 red across 6 leads
- 4 blocked items, 6 completed, 14 planned next week
- 7 risks (3 high-impact, no mitigation owners assigned), 2 decisions pending head input
Ideal narrative:
"Half the portfolio is at risk with three projects red and four blocked items, while seven risks lack assigned mitigation owners. Two decisions are pending head input and may unblock the next week's plan."
Ideal tone: negative
Ideal highlights: ["3 projects red, 3 yellow", "4 items blocked across the team", "2 decisions awaiting head"]

Example 3 — input synopsis:
- 5 green / 2 yellow / 1 red across 6 leads
- 1 blocked item, 9 completed, 11 planned
- 3 risks (mitigation in progress), no decisions pending
Ideal narrative:
"Most of the portfolio is healthy with five greens, though one project is red and one item remains blocked. The team completed nine items this week and queued eleven for next, with active mitigation on three risks."
Ideal tone: neutral
Ideal highlights: ["5 of 8 projects green", "1 project red, 1 blocker", "Active mitigation on 3 risks"]

# DO NOT
- Do not output text outside the tool call.
- Do not include greetings, names, dates, or sign-offs.
- Do not repeat the head's narrative.
- Do not change pre-computed counts.
- Do not produce more than 3 highlights or fewer than 1.

Call the record_executive_summary tool now with your output.`;

export function buildSummaryUserPrompt(
  report: ReportForSummary,
  reportContent: string,
): string {
  return `[REPORT METADATA]
Period: ${report.periodLabel}
Number of lead sections submitted: ${report.sectionCount}

[PRE-COMPUTED COUNTS — DO NOT CHANGE THESE NUMBERS]
${report.greenCount} green, ${report.yellowCount} yellow, ${report.redCount} red traffic lights across ${report.sectionCount} lead sections.

[REPORT CONTENT — lead submissions, condensed]
${reportContent}`;
}

/**
 * Render the condensed report content used both as the user-prompt body
 * AND (in compact form) as the cache-key input. Excludes head narrative
 * intentionally — we never summarise what the head wrote.
 */
export function condenseReportForPrompt(report: ReportForSummary): string {
  return report.sections
    .map((s) => {
      const lights = s.trafficLights
        .map((t) => `${t.projectName}=${t.status}`)
        .join(', ');
      return `[Section ${s.authorName}] traffic: ${lights}; risks: ${s.riskCount}; decisions: ${s.decisionCount}; items: ${s.itemCount}`;
    })
    .join('\n');
}
