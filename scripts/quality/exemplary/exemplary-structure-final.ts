import { existsSync } from "node:fs";

import {
  currentSource,
  inventoryExpectation,
  readFinalEvidence,
  sourceRecord,
  stable,
} from "./exemplary-structure-baseline.ts";
import { STRUCTURAL_RULE_IDS } from "./exemplary-structure-contract.ts";
import { runStructuralBoundaryProbes } from "./exemplary-structure-probe.ts";

const finalProductExpectation = (
  evidence: ReturnType<typeof readFinalEvidence>,
) => ({
  fileCount: evidence.product.fileCount,
  fileDigest: evidence.product.fileDigest,
  contentDigest: evidence.product.contentDigest,
  findingCount: evidence.product.findingCount,
  affectedFileCount: evidence.product.affectedFileCount,
  byRule: evidence.product.byRule,
  configDigest: evidence.product.configDigest,
  classification: evidence.product.classification,
});

export const checkStructuralFinal = async () => {
  const evidence = readFinalEvidence();
  const product = await inventoryExpectation("product", true);
  const probes = await runStructuralBoundaryProbes();
  const failures: string[] = [];
  if (stable(currentSource()) !== stable(sourceRecord(evidence.source)))
    failures.push("source");
  if (product.inventory.source.binding !== evidence.source.binding)
    failures.push("source-binding");
  if (stable(product.comparable) !== stable(finalProductExpectation(evidence)))
    failures.push("product-inventory");
  if (
    product.inventory.suppressions.inlineCount !==
    evidence.product.inlineSuppressions
  )
    failures.push("inline-suppressions");
  if (
    product.inventory.suppressions.perFileWeakeningCount !==
    evidence.product.perFileWeakenings
  )
    failures.push("per-file-weakenings");
  if (
    product.inventory.suppressions.strictEnforcement.notStrictFileCount !==
    evidence.product.notStrictConfigFileCount
  )
    failures.push("strict-enforcement");
  const ruleProof = Object.fromEntries(
    STRUCTURAL_RULE_IDS.map((ruleId) => {
      const findings = product.inventory.candidate.byRule[ruleId].occurrences;
      const probe = probes.rules[ruleId]?.classification ?? "CONFIG";
      if (findings !== 0 || probe !== "REAL") failures.push(ruleId);
      return [ruleId, { findings, probe }];
    }),
  );
  if (
    evidence.product.inlineSuppressions !== 0 ||
    evidence.product.perFileWeakenings !== 0 ||
    evidence.product.notStrictConfigFileCount !== 0
  )
    failures.push("nonzero-final-denominator");
  if (!existsSync(evidence.archiveEvidence)) failures.push("archive-evidence");
  return {
    classification: failures.length === 0 ? "REAL" : "NOT_PROVEN",
    source: evidence.source,
    product: product.comparable,
    ruleProof,
    suppressions: {
      inline: product.inventory.suppressions.inlineCount,
      perFileWeakenings: product.inventory.suppressions.perFileWeakeningCount,
      notStrictConfigFiles:
        product.inventory.suppressions.strictEnforcement.notStrictFileCount,
    },
    probeControls: probes.controls,
    probeCleanup: "PASS",
    failures: [...new Set(failures)],
    archiveEvidence: evidence.archiveEvidence,
  };
};
