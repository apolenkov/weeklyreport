import { STRUCTURAL_RULE_IDS } from "./exemplary-structure-contract.ts";
import { runStructuralBoundaryProbes } from "./exemplary-structure-probe.ts";

const result = await runStructuralBoundaryProbes();
const failures = STRUCTURAL_RULE_IDS.filter(
  (ruleId) => result.rules[ruleId]?.classification !== "REAL",
);
if (
  result.controls.vacuous !== "VACUOUS" ||
  result.controls.config !== "CONFIG" ||
  result.controls.noise !== "NOISE" ||
  result.controls.configurationErrorCount !== 2
)
  failures.push("classification-controls" as (typeof failures)[number]);

if (failures.length > 0)
  throw new Error(`Structural boundary probes failed: ${failures.join(", ")}`);

process.stdout.write(
  `exemplary-structure-probes PASS real=${STRUCTURAL_RULE_IDS.length} ` +
    `files=${result.denominator.fileCount} ` +
    `controls=VACUOUS,CONFIG,NOISE cleanup=PASS\n`,
);
