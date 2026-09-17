import { createHash } from "node:crypto";
import {
  mkdir,
  mkdtemp,
  readdir,
  readFile,
  rm,
  writeFile,
} from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";

import { afterEach, describe, expect, it } from "vitest";

import {
  inventoryOpenSpecScenarios,
  type OpenSpecScenario,
  refreshReticleSpecCoverage,
  type ReticleSpecCoverageRegistry,
  summarizeOpenSpecInventory,
  validateReticleSpecCoverage,
} from "./reticle-spec-coverage.ts";

const roots: string[] = [];

afterEach(async () => {
  await Promise.all(
    roots.splice(0).map((root) => rm(root, { recursive: true, force: true })),
  );
});

async function specsRoot(
  files: Readonly<Record<string, string>>,
): Promise<string> {
  const root = await mkdtemp(join(tmpdir(), "weeklyreport-reticle-specs-"));
  roots.push(root);
  for (const [relativePath, content] of Object.entries(files)) {
    await mkdir(dirname(join(root, relativePath)), { recursive: true });
    await writeFile(join(root, relativePath), content);
  }
  return root;
}

async function inventoryFailure(root: string): Promise<string> {
  try {
    await inventoryOpenSpecScenarios(root);
  } catch (error) {
    return error instanceof Error ? error.message : String(error);
  }
  throw new Error("expected the inventory to fail closed");
}

async function writeJson(path: string, value: unknown): Promise<void> {
  await mkdir(dirname(path), { recursive: true });
  await writeFile(path, `${JSON.stringify(value, null, 2)}\n`);
}

async function coverageFixture(): Promise<{
  specsRoot: string;
  registryPath: string;
  flowsRoot: string;
  projectId: string;
  registry: ReticleSpecCoverageRegistry;
}> {
  const root = await specsRoot({ "reporting/spec.md": REPORTING_SPEC });
  const [first, second] = await inventoryOpenSpecScenarios(root);
  if (first === undefined || second === undefined) throw new Error("fixture");
  const firstOutcome = first.outcomes[0];
  const secondOutcome = second.outcomes[0];
  if (firstOutcome === undefined || secondOutcome === undefined)
    throw new Error("fixture outcomes");
  const registryPath = join(root, ".reticle/spec-coverage.json");
  const flowsRoot = join(root, ".reticle/flows/project");
  await writeJson(join(flowsRoot, "reporting-flow.json"), {
    version: 1,
    name: "reporting-flow",
    projectId: "project",
    createdAt: 0,
    intent: "A lead saves a report and the saved query reaches success.",
    steps: [
      {
        tool: "reticle_act",
        anchor: { kind: "role", role: "button", name: "Save" },
        action: "click",
        expect: {
          state: {
            store: "queryClient",
            path: "save.status",
            equals: "success",
          },
        },
      },
    ],
    success: {
      state: { store: "queryClient", path: "save.status", equals: "success" },
    },
  });
  const registry: ReticleSpecCoverageRegistry = {
    version: 2,
    projectId: "project",
    scenarios: [
      {
        spec: first.spec,
        requirement: first.requirement,
        scenario: first.scenario,
        fingerprint: first.fingerprint,
        outcome: firstOutcome,
        coverage: {
          kind: "classified",
          proofs: [
            {
              kind: "reticle",
              flow: "reporting-flow",
              assertion: { location: "success" },
              consequence: "The submitted report is visible.",
            },
          ],
        },
      },
      {
        spec: second.spec,
        requirement: second.requirement,
        scenario: second.scenario,
        fingerprint: second.fingerprint,
        outcome: secondOutcome,
        coverage: {
          kind: "classified",
          proofs: [
            {
              kind: "deterministic",
              surface: "server-test",
              reference: "scripts/gates/reticle-spec-coverage.test.ts",
              detail: "Established by the draft API contract.",
            },
          ],
        },
      },
    ],
  };
  await writeJson(registryPath, registry);
  return {
    specsRoot: root,
    registryPath,
    flowsRoot,
    projectId: "project",
    registry,
  };
}

function identities(
  scenarios: readonly OpenSpecScenario[],
): Pick<OpenSpecScenario, "spec" | "requirement" | "scenario">[] {
  return scenarios.map(({ spec, requirement, scenario }) => ({
    spec,
    requirement,
    scenario,
  }));
}

function registryScenario(
  registry: ReticleSpecCoverageRegistry,
  index: number,
): ReticleSpecCoverageRegistry["scenarios"][number] {
  const scenario = registry.scenarios[index];
  if (scenario === undefined) throw new Error(`missing scenario ${index}`);
  return scenario;
}

function scenarioForSpec(
  registry: ReticleSpecCoverageRegistry,
  spec: string,
): ReticleSpecCoverageRegistry["scenarios"][number] {
  const scenario = registry.scenarios.find((entry) => entry.spec === spec);
  if (scenario === undefined) throw new Error(`missing scenario for ${spec}`);
  return scenario;
}

function excludedSpec(
  reason: string,
  outcomes: number,
): { reason: string; outcomes: number } {
  return { reason, outcomes };
}

function exclusionDeclaration(
  excludedSpecs: Readonly<Record<string, { reason: string; outcomes: number }>>,
): Record<string, unknown> {
  return {
    version: 1,
    projectId: "project",
    decision: {
      date: "2026-09-17",
      reference: "scripts/gates/reticle-spec-coverage.test.ts",
      detail: "Owner decision recorded for the coverage fixture.",
      minimumMandatoryOutcomes: 1,
    },
    excludedSpecs,
  };
}

function classifiedCoverage(
  registry: ReticleSpecCoverageRegistry,
  index: number,
): Extract<
  ReticleSpecCoverageRegistry["scenarios"][number]["coverage"],
  {
    kind: "classified";
  }
> {
  const coverage = registryScenario(registry, index).coverage;
  if (coverage.kind !== "classified") throw new Error("classified fixture");
  return coverage;
}

function savedFlow(
  predicate: unknown,
  projectId = "project",
): Record<string, unknown> {
  return {
    version: 1,
    name: "reporting-flow",
    projectId,
    createdAt: 0,
    intent: "A user observes the declared product consequence.",
    steps: [
      {
        tool: "reticle_act",
        anchor: { kind: "role", role: "button", name: "Save" },
        action: "click",
        expect: predicate,
      },
    ],
  };
}

const REPORTING_SPEC = `# Reporting Specification

## Purpose

Describe reporting behavior.

## Requirements

### Requirement: Leads submit weekly reports

A lead MUST submit exactly one report per week.

#### Scenario: A lead submits a report

- **WHEN** the lead submits a complete report
- **THEN** the report is stored with a submitted timestamp

#### Scenario: A lead submits a draft

- **WHEN** the lead saves an incomplete report
- **THEN** the report stays editable
`;

const OTHER_SPEC = `# Other Specification

## Purpose

Describe other behavior.

## Requirements

### Requirement: Other behavior stays covered

The other capability MUST stay covered.

#### Scenario: The other behavior is observable

- **WHEN** the other behavior runs
- **THEN** the other behavior is observable
`;

describe("OpenSpec scenario inventory", () => {
  it("derives structured identities and fingerprints from capability specs", async () => {
    const root = await specsRoot({ "reporting/spec.md": REPORTING_SPEC });

    const scenarios = await inventoryOpenSpecScenarios(root);

    expect(identities(scenarios)).toEqual([
      {
        spec: "reporting",
        requirement: "Leads submit weekly reports",
        scenario: "A lead submits a report",
      },
      {
        spec: "reporting",
        requirement: "Leads submit weekly reports",
        scenario: "A lead submits a draft",
      },
    ]);
    expect(Object.keys(scenarios[0] ?? {}).sort()).toEqual([
      "fingerprint",
      "normativeText",
      "outcomes",
      "requirement",
      "scenario",
      "spec",
    ]);

    for (const scenario of scenarios) {
      expect(scenario.fingerprint).toMatch(/^[0-9a-f]{64}$/u);
      expect(scenario.fingerprint).toBe(
        createHash("sha256").update(scenario.normativeText).digest("hex"),
      );
    }

    const [submitted, draft] = scenarios;
    expect(submitted?.normativeText).toContain(
      "### Requirement: Leads submit weekly reports",
    );
    expect(submitted?.normativeText).toContain(
      "A lead MUST submit exactly one report per week.",
    );
    expect(submitted?.normativeText).toContain(
      "#### Scenario: A lead submits a report",
    );
    expect(submitted?.normativeText).toContain(
      "THEN** the report is stored with a submitted timestamp",
    );
    expect(submitted?.normativeText).not.toContain("A lead submits a draft");
    expect(draft?.normativeText).not.toContain("A lead submits a report");
    expect(submitted?.fingerprint).not.toBe(draft?.fingerprint);
  });

  it("extracts ordered THEN and following AND outcomes", async () => {
    const root = await specsRoot({
      "reporting/spec.md": `# Reporting Specification

## Requirements

### Requirement: Reports expose complete evidence

The report contract MUST preserve both visible and internal guarantees.

#### Scenario: A mixed report is submitted

- **GIVEN** a report draft exists
- **AND** the draft has all required fields
- **WHEN** the lead submits the report
- **THEN** the browser shows the submitted report
- **AND** the API stores the submitted timestamp
- WHEN a second submission is attempted
- THEN the browser keeps the submitted state
`,
    });

    const [scenario] = await inventoryOpenSpecScenarios(root);

    expect(
      scenario?.outcomes.map(({ ordinal, keyword, text }) => ({
        ordinal,
        keyword,
        text,
      })),
    ).toEqual([
      {
        ordinal: 1,
        keyword: "THEN",
        text: "the browser shows the submitted report",
      },
      {
        ordinal: 2,
        keyword: "AND",
        text: "the API stores the submitted timestamp",
      },
      {
        ordinal: 3,
        keyword: "THEN",
        text: "the browser keeps the submitted state",
      },
    ]);
    expect(
      scenario?.outcomes.every(({ fingerprint }) =>
        /^[0-9a-f]{64}$/u.test(fingerprint),
      ),
    ).toBe(true);
  });

  it("keeps duplicate outcome text distinct by ordinal", async () => {
    const root = await specsRoot({
      "reporting/spec.md": `# Reporting Specification

## Requirements

### Requirement: Repeated outcomes remain addressable

The report contract MUST remain addressable.

#### Scenario: Repeated outcome branches

- WHEN the first branch runs
- THEN the report is visible
- WHEN the second branch runs
- THEN the report is visible
`,
    });

    const [scenario] = await inventoryOpenSpecScenarios(root);

    expect(
      scenario?.outcomes.map(({ ordinal, text }) => ({ ordinal, text })),
    ).toEqual([
      { ordinal: 1, text: "the report is visible" },
      { ordinal: 2, text: "the report is visible" },
    ]);
    expect(scenario?.outcomes[0]?.fingerprint).not.toBe(
      scenario?.outcomes[1]?.fingerprint,
    );
  });

  it("ignores fenced snippets and rejects scenarios without a normative outcome", async () => {
    const root = await specsRoot({
      "reporting/spec.md": `# Reporting Specification

## Requirements

### Requirement: Reports expose outcomes

The report contract MUST hold.

#### Scenario: A fenced example is not an outcome

- WHEN the report is submitted
- THEN the report is visible

\`\`\`gherkin
- THEN this example is not normative
- AND neither is this example
\`\`\`

- AND the audit event is recorded

#### Scenario: A scenario has no outcome

- WHEN the report is opened

`,
    });

    await expect(inventoryOpenSpecScenarios(root)).rejects.toThrow(
      /no normative THEN outcome/u,
    );
  });

  it("keeps fenced outcome text out of the extracted fingerprint", async () => {
    const root = await specsRoot({
      "reporting/spec.md": `# Reporting Specification

## Requirements

### Requirement: Reports expose outcomes

The report contract MUST hold.

#### Scenario: A fenced example is ignored

- WHEN the report is submitted
- THEN the report is visible

\`\`\`json
~~~
\`\`\`not-a-close
\`\`
- THEN this example is not normative
{"THEN":"this is an example"}
\`\`\`

- AND the audit event is recorded
`,
    });

    const [scenario] = await inventoryOpenSpecScenarios(root);
    expect(scenario?.outcomes.map(({ text }) => text)).toEqual([
      "the report is visible",
      "the audit event is recorded",
    ]);
  });

  it("fails closed on an outcome marker without normative text", async () => {
    const root = await specsRoot({
      "reporting/spec.md": `# Reporting Specification

## Requirements

### Requirement: Reports expose outcomes

The report contract MUST hold.

#### Scenario: An outcome is malformed

- WHEN the report is submitted
- **THEN**
`,
    });

    const message = await inventoryFailure(root);

    expect(message).toMatch(/malformed outcome/u);
    expect(message).toContain("reporting/spec.md");
    expect(message).toContain("THEN");
  });

  it("keeps duplicate scenario titles under distinct parents distinct", async () => {
    const root = await specsRoot({
      "alpha/spec.md": `# Alpha Specification

## Requirements

### Requirement: First parent

The first parent MUST hold.

#### Scenario: Shared title

- **WHEN** the first parent is exercised
- **THEN** the first parent holds

### Requirement: Second parent

The second parent MUST hold.

#### Scenario: Shared title

- **WHEN** the second parent is exercised
- **THEN** the second parent holds
`,
      "beta/spec.md": `# Beta Specification

## Requirements

### Requirement: First parent

A different capability MUST hold.

#### Scenario: Shared title

- **WHEN** the beta capability is exercised
- **THEN** the beta capability holds
`,
    });

    const scenarios = await inventoryOpenSpecScenarios(root);

    expect(identities(scenarios)).toEqual([
      { spec: "alpha", requirement: "First parent", scenario: "Shared title" },
      { spec: "alpha", requirement: "Second parent", scenario: "Shared title" },
      { spec: "beta", requirement: "First parent", scenario: "Shared title" },
    ]);
    expect(new Set(scenarios.map(({ fingerprint }) => fingerprint)).size).toBe(
      3,
    );
  });

  it("changes the fingerprint when normative text changes", async () => {
    const fingerprints = async (root: string): Promise<string[]> =>
      (await inventoryOpenSpecScenarios(root)).map(
        ({ fingerprint }) => fingerprint,
      );
    const baseline = await specsRoot({ "reporting/spec.md": REPORTING_SPEC });
    const editedScenario = await specsRoot({
      "reporting/spec.md": REPORTING_SPEC.replace(
        "the report stays editable",
        "the report stays editable until Friday",
      ),
    });
    const editedRequirement = await specsRoot({
      "reporting/spec.md": REPORTING_SPEC.replace(
        "exactly one report per week",
        "exactly one report per weekday",
      ),
    });
    const renamedScenario = await specsRoot({
      "reporting/spec.md": REPORTING_SPEC.replace(
        "#### Scenario: A lead submits a draft",
        "#### Scenario: A lead parks a draft",
      ),
    });
    const renamedRequirement = await specsRoot({
      "reporting/spec.md": REPORTING_SPEC.replace(
        "### Requirement: Leads submit weekly reports",
        "### Requirement: Leads file weekly reports",
      ),
    });

    const baselineFingerprints = await fingerprints(baseline);

    expect(await fingerprints(editedScenario)).not.toEqual(
      baselineFingerprints,
    );
    expect(await fingerprints(editedRequirement)).not.toEqual(
      baselineFingerprints,
    );
    expect(await fingerprints(renamedScenario)).not.toEqual(
      baselineFingerprints,
    );
    expect(await fingerprints(renamedRequirement)).not.toEqual(
      baselineFingerprints,
    );
  });

  it("normalizes formatting-only edits out of the fingerprint", async () => {
    const fingerprints = async (root: string): Promise<string[]> =>
      (await inventoryOpenSpecScenarios(root)).map(
        ({ fingerprint }) => fingerprint,
      );
    const baseline = await specsRoot({ "reporting/spec.md": REPORTING_SPEC });
    const reformatted = await specsRoot({
      "reporting/spec.md": REPORTING_SPEC.split("\n")
        .map((line) => `${line}   `)
        .join("\r\n")
        .concat("\r\n\r\n"),
    });

    expect(await fingerprints(reformatted)).toEqual(
      await fingerprints(baseline),
    );
  });

  it("fails closed on a scenario before any requirement", async () => {
    const root = await specsRoot({
      "reporting/spec.md": `# Reporting Specification

## Requirements

#### Scenario: Orphan scenario

- **WHEN** nothing declares it
- **THEN** the inventory fails closed

### Requirement: Late requirement

The late requirement MUST hold.

#### Scenario: Late scenario

- **WHEN** the late requirement is exercised
- **THEN** it holds
`,
    });

    const message = await inventoryFailure(root);

    expect(message).toMatch(/orphan scenario/u);
    expect(message).toContain("reporting/spec.md");
    expect(message).toContain("#### Scenario: Orphan scenario");
  });

  it("fails closed on heading levels that look like directives", async () => {
    const malformedHeadings = [
      "## Requirement: Wrong level",
      "#### Requirement: Wrong level",
      "### Scenario: Wrong level",
      "##### Scenario: Wrong level",
    ];

    for (const malformed of malformedHeadings) {
      const root = await specsRoot({
        "reporting/spec.md": `# Reporting Specification

## Requirements

### Requirement: Reporting

The reporting contract MUST hold.

${malformed}

- **WHEN** the heading is malformed
- **THEN** the inventory fails closed
`,
      });

      const message = await inventoryFailure(root);

      expect(message).toMatch(/malformed heading/u);
      expect(message).toContain("reporting/spec.md");
      expect(message).toContain(malformed);
    }
  });

  it("accepts plural section headings and unrelated headings", async () => {
    const root = await specsRoot({
      "reporting/spec.md": `# Reporting Specification

## Purpose

Reporting stays deterministic.

## Requirements

### Requirement: Reporting

The reporting contract MUST hold.

### Notes

Notes are not directives.

#### Scenario: Reporting holds

- **WHEN** the reporting contract is exercised
- **THEN** it holds
`,
    });

    const scenarios = await inventoryOpenSpecScenarios(root);

    expect(identities(scenarios)).toEqual([
      {
        spec: "reporting",
        requirement: "Reporting",
        scenario: "Reporting holds",
      },
    ]);
  });

  it("fails closed on duplicate structured identities", async () => {
    const root = await specsRoot({
      "reporting/spec.md": `# Reporting Specification

## Requirements

### Requirement: Reporting

The reporting contract MUST hold.

#### Scenario: Repeated scenario

- **WHEN** the first copy is exercised
- **THEN** it holds

#### Scenario: Repeated scenario

- **WHEN** the second copy is exercised
- **THEN** it holds too
`,
    });

    const message = await inventoryFailure(root);

    expect(message).toMatch(/duplicate scenario identity/u);
    expect(message).toContain("reporting/spec.md");
    expect(message).toContain("Reporting");
    expect(message).toContain("Repeated scenario");
  });

  it("orders deterministically and reads only capability spec.md files", async () => {
    const root = await specsRoot({
      "zulu/spec.md": `# Zulu Specification

## Requirements

### Requirement: Zulu requirement

Zulu MUST hold.

#### Scenario: Zulu scenario

- **WHEN** zulu runs
- **THEN** zulu holds
`,
      "alpha/spec.md": `# Alpha Specification

## Requirements

### Requirement: Alpha requirement

Alpha MUST hold.

#### Scenario: Alpha first

- **WHEN** alpha runs first
- **THEN** alpha holds

#### Scenario: Alpha second

- **WHEN** alpha runs second
- **THEN** alpha still holds
`,
      "spec.md": `# Root Specification

## Requirements

### Requirement: Root requirement

Root MUST hold.

#### Scenario: Root scenario

- **WHEN** root runs
- **THEN** root holds
`,
      "alpha/notes.md": `# Alpha Notes

## Requirements

### Requirement: Notes requirement

Notes MUST hold.

#### Scenario: Notes scenario

- **WHEN** notes run
- **THEN** notes hold
`,
      "alpha/nested/spec.md": `# Nested Specification

## Requirements

### Requirement: Nested requirement

Nested MUST hold.

#### Scenario: Nested scenario

- **WHEN** nested runs
- **THEN** nested holds
`,
      "README.md": "# Specification index\n",
    });

    const scenarios = await inventoryOpenSpecScenarios(root);

    expect(identities(scenarios)).toEqual([
      {
        spec: "alpha",
        requirement: "Alpha requirement",
        scenario: "Alpha first",
      },
      {
        spec: "alpha",
        requirement: "Alpha requirement",
        scenario: "Alpha second",
      },
      {
        spec: "zulu",
        requirement: "Zulu requirement",
        scenario: "Zulu scenario",
      },
    ]);
  });

  it("reports the current corpus denominator from a single inventory", async () => {
    const corpusRoot = resolve(import.meta.dirname, "../../openspec/specs");

    const scenarios = await inventoryOpenSpecScenarios(corpusRoot);
    const specFiles = (await readdir(corpusRoot, { withFileTypes: true }))
      .filter((entry) => entry.isDirectory())
      .map((entry) => join(corpusRoot, entry.name, "spec.md"));
    const sourceScenarioCount = (
      await Promise.all(specFiles.map((path) => readFile(path, "utf8")))
    ).reduce(
      (total, content) =>
        total + (content.match(/^#### Scenario:/gmu)?.length ?? 0),
      0,
    );
    const summary = summarizeOpenSpecInventory(scenarios);

    expect(summary.scenarios).toBe(sourceScenarioCount);
    expect(summary.outcomes).toBe(
      scenarios.reduce(
        (total, scenario) => total + scenario.outcomes.length,
        0,
      ),
    );
    expect(summary.outcomes).toBeGreaterThan(summary.scenarios);
    expect(scenarios.every((scenario) => scenario.outcomes.length > 0)).toBe(
      true,
    );
  });
});

describe("Reticle specification coverage", () => {
  it("rejects a deterministic proof without a check reference", async () => {
    const fixture = await coverageFixture();
    const proof = classifiedCoverage(fixture.registry, 1).proofs[0];
    if (proof.kind !== "deterministic") throw new Error("fixture proof");
    delete (proof as { reference?: string }).reference;
    await writeJson(fixture.registryPath, fixture.registry);

    await expect(validateReticleSpecCoverage(fixture)).rejects.toThrow(
      "invalid deterministic proof",
    );
  });

  it("rejects a deterministic proof with an unresolvable check reference", async () => {
    const fixture = await coverageFixture();
    const proof = classifiedCoverage(fixture.registry, 1).proofs[0];
    if (proof.kind !== "deterministic") throw new Error("fixture proof");
    proof.reference = "scripts/gates/missing-deterministic-check.test.ts";
    await writeJson(fixture.registryPath, fixture.registry);

    await expect(validateReticleSpecCoverage(fixture)).rejects.toThrow(
      "unresolvable deterministic reference",
    );
  });

  it("rejects a registry project ID that differs from the configured project", async () => {
    const fixture = await coverageFixture();
    fixture.registry.projectId = "other-project";
    await writeJson(fixture.registryPath, fixture.registry);

    await expect(validateReticleSpecCoverage(fixture)).rejects.toThrow(
      "registry projectId mismatch",
    );
  });

  it("accepts an exact registry with a consequence flow and explicit exclusion", async () => {
    const fixture = await coverageFixture();

    await expect(validateReticleSpecCoverage(fixture)).resolves.toEqual({
      scenarios: 2,
      outcomes: 2,
      reticleOutcomes: 1,
      deterministicOutcomes: 1,
      mixedOutcomes: 0,
      totalProofs: 2,
      unclassifiedOutcomes: 0,
      excludedOutcomes: 0,
      excludedProofs: 0,
      mandatoryOutcomes: 2,
      flows: 1,
    });
  });

  it("counts an excluded specification without demanding its coverage", async () => {
    const root = await specsRoot({
      "reporting/spec.md": REPORTING_SPEC,
      "other/spec.md": OTHER_SPEC,
    });
    const registryPath = join(root, ".reticle/spec-coverage.json");
    const exclusionsPath = join(root, ".reticle/spec-coverage-exclusions.json");
    await writeJson(registryPath, {
      version: 2,
      projectId: "project",
      scenarios: [],
    });
    const registry = await refreshReticleSpecCoverage({
      specsRoot: root,
      registryPath,
      projectId: "project",
    });
    scenarioForSpec(registry, "other").coverage = {
      kind: "classified",
      proofs: [
        {
          kind: "deterministic",
          surface: "static-source-gate",
          reference: "scripts/gates/reticle-spec-coverage.test.ts",
          detail: "Established by the coverage validator fixture.",
        },
      ],
    };
    scenarioForSpec(registry, "reporting").coverage = {
      kind: "classified",
      proofs: [
        {
          kind: "deterministic",
          surface: "server-test",
          detail: "Legacy deterministic proof without a reference.",
        },
      ],
    } as never;
    await writeJson(registryPath, registry);
    await writeJson(
      exclusionsPath,
      exclusionDeclaration({
        reporting: excludedSpec(
          "Not part of the declared critical surface.",
          2,
        ),
      }),
    );

    await expect(
      validateReticleSpecCoverage({
        specsRoot: root,
        registryPath,
        flowsRoot: join(root, ".reticle/flows/project"),
        projectId: "project",
        exclusionsPath,
      }),
    ).resolves.toEqual({
      scenarios: 3,
      outcomes: 3,
      reticleOutcomes: 0,
      deterministicOutcomes: 1,
      mixedOutcomes: 0,
      totalProofs: 1,
      unclassifiedOutcomes: 1,
      excludedOutcomes: 2,
      excludedProofs: 1,
      mandatoryOutcomes: 1,
      flows: 0,
    });
    await expect(
      refreshReticleSpecCoverage({
        specsRoot: root,
        registryPath,
        projectId: "project",
        exclusionsPath,
      }),
    ).resolves.toBeDefined();
  });

  it.each([
    [
      "an unknown specification",
      { unknown: excludedSpec("No such specification exists.", 1) },
      "unknown excluded specification: unknown",
    ],
    [
      "an empty reason",
      { reporting: excludedSpec("", 2) },
      "invalid excluded specification",
    ],
    [
      "a stale outcome count",
      { reporting: excludedSpec("Outside the declared surface.", 1) },
      "excluded specification outcome count changed: reporting declares 1 but the corpus has 2",
    ],
  ])(
    "rejects exclusions that name %s",
    async (_label, excludedSpecs, error) => {
      const fixture = await coverageFixture();
      const exclusionsPath = join(
        fixture.specsRoot,
        ".reticle/spec-coverage-exclusions.json",
      );
      await writeJson(exclusionsPath, exclusionDeclaration(excludedSpecs));

      await expect(
        validateReticleSpecCoverage({ ...fixture, exclusionsPath }),
      ).rejects.toThrow(error);
    },
  );

  it("rejects an exclusion decision whose reference does not resolve", async () => {
    const fixture = await coverageFixture();
    const exclusionsPath = join(
      fixture.specsRoot,
      ".reticle/spec-coverage-exclusions.json",
    );
    const declaration = exclusionDeclaration({
      reporting: excludedSpec("Outside the declared surface.", 2),
    });
    declaration.decision = {
      date: "2026-09-17",
      reference: "docs/missing-owner-decision.md",
      detail: "Owner decision recorded for the coverage fixture.",
      minimumMandatoryOutcomes: 1,
    };
    await writeJson(exclusionsPath, declaration);

    await expect(
      validateReticleSpecCoverage({ ...fixture, exclusionsPath }),
    ).rejects.toThrow("unresolvable exclusion decision reference");
  });

  it.each([
    [
      "another project",
      { projectId: "other-project" },
      "exclusions projectId mismatch",
    ],
    [
      "a legacy version",
      { version: 2 },
      "invalid Reticle specification coverage exclusions",
    ],
    [
      "a floor above the mandatory outcomes",
      {
        decision: {
          date: "2026-09-17",
          reference: "scripts/gates/reticle-spec-coverage.test.ts",
          detail: "Owner decision recorded for the coverage fixture.",
          minimumMandatoryOutcomes: 3,
        },
      },
      "mandatory coverage floor not met",
    ],
  ])("rejects exclusions that declare %s", async (_label, override, error) => {
    const fixture = await coverageFixture();
    const exclusionsPath = join(
      fixture.specsRoot,
      ".reticle/spec-coverage-exclusions.json",
    );
    await writeJson(exclusionsPath, {
      ...exclusionDeclaration({
        reporting: excludedSpec("Outside the declared surface.", 2),
      }),
      ...override,
    });

    await expect(
      validateReticleSpecCoverage({ ...fixture, exclusionsPath }),
    ).rejects.toThrow(error);
  });

  it.each([
    [
      "missing",
      (registry: ReticleSpecCoverageRegistry) => registry.scenarios.pop(),
    ],
    [
      "unknown",
      (registry: ReticleSpecCoverageRegistry) =>
        registry.scenarios.push({
          ...registryScenario(registry, 0),
          scenario: "Unknown",
        }),
    ],
    [
      "duplicate",
      (registry: ReticleSpecCoverageRegistry) =>
        registry.scenarios.push(registryScenario(registry, 0)),
    ],
    [
      "stale scenario fingerprint",
      (registry: ReticleSpecCoverageRegistry) => {
        registryScenario(registry, 0).fingerprint = "0".repeat(64);
      },
    ],
    [
      "stale outcome fingerprint",
      (registry: ReticleSpecCoverageRegistry) => {
        (
          registryScenario(registry, 0).outcome as { fingerprint: string }
        ).fingerprint = "0".repeat(64);
      },
    ],
    [
      "unclassified",
      (registry: ReticleSpecCoverageRegistry) => {
        registryScenario(registry, 0).coverage = { kind: "unclassified" };
      },
    ],
    [
      "invalid deterministic surface",
      (registry: ReticleSpecCoverageRegistry) => {
        classifiedCoverage(registry, 1).proofs[0] = {
          kind: "deterministic",
          surface: "unknown" as never,
          reference: "scripts/gates/reticle-spec-coverage.test.ts",
          detail: "A concrete check exists.",
        };
      },
    ],
    [
      "invalid deterministic detail",
      (registry: ReticleSpecCoverageRegistry) => {
        classifiedCoverage(registry, 1).proofs[0] = {
          kind: "deterministic",
          surface: "server-test",
          reference: "scripts/gates/reticle-spec-coverage.test.ts",
          detail: "",
        };
      },
    ],
    [
      "invalid Reticle mapping",
      (registry: ReticleSpecCoverageRegistry) => {
        const proof = classifiedCoverage(registry, 0).proofs[0];
        if (proof.kind === "reticle") proof.consequence = "";
      },
    ],
  ])("rejects %s registry entries", async (expected, mutate) => {
    const fixture = await coverageFixture();
    mutate(fixture.registry);
    await writeJson(fixture.registryPath, fixture.registry);

    await expect(validateReticleSpecCoverage(fixture)).rejects.toThrow(
      expected,
    );
  });

  it.each([
    [
      "empty proof list",
      (registry: ReticleSpecCoverageRegistry) => {
        classifiedCoverage(registry, 0).proofs = [] as never;
      },
      "invalid proof array",
    ],
    [
      "missing second proof flow",
      (registry: ReticleSpecCoverageRegistry) => {
        classifiedCoverage(registry, 0).proofs = [
          classifiedCoverage(registry, 0).proofs[0],
          {
            kind: "reticle",
            flow: "missing-proof-flow",
            assertion: { location: "success" },
            consequence: "The second required browser consequence is observed.",
          },
        ] as never;
      },
      "missing flow: missing-proof-flow",
    ],
    [
      "invalid second proof",
      (registry: ReticleSpecCoverageRegistry) => {
        classifiedCoverage(registry, 0).proofs = [
          classifiedCoverage(registry, 0).proofs[0],
          {
            kind: "deterministic",
            surface: "unknown",
            reference: "scripts/gates/reticle-spec-coverage.test.ts",
            detail: "Not a registered evidence surface.",
          },
        ] as never;
      },
      "invalid deterministic surface",
    ],
  ])("rejects %s in a proof array", async (_label, mutate, expected) => {
    const fixture = await coverageFixture();
    mutate(fixture.registry);
    await writeJson(fixture.registryPath, fixture.registry);

    await expect(validateReticleSpecCoverage(fixture)).rejects.toThrow(
      expected,
    );
  });

  it("counts mixed proofs once while exposing overlapping proof counts", async () => {
    const fixture = await coverageFixture();
    classifiedCoverage(fixture.registry, 0).proofs.push({
      kind: "deterministic",
      surface: "database-test",
      reference: "scripts/gates/reticle-spec-coverage.test.ts",
      detail: "The saved report row is committed.",
    });
    await writeJson(fixture.registryPath, fixture.registry);

    await expect(validateReticleSpecCoverage(fixture)).resolves.toEqual({
      scenarios: 2,
      outcomes: 2,
      reticleOutcomes: 1,
      deterministicOutcomes: 2,
      mixedOutcomes: 1,
      totalProofs: 3,
      unclassifiedOutcomes: 0,
      excludedOutcomes: 0,
      excludedProofs: 0,
      mandatoryOutcomes: 2,
      flows: 1,
    });
  });

  it("rejects legacy registries during ordinary refresh", async () => {
    const fixture = await coverageFixture();
    fixture.registry.version = 1 as never;
    await writeJson(fixture.registryPath, fixture.registry);

    await expect(
      refreshReticleSpecCoverage({
        specsRoot: fixture.specsRoot,
        registryPath: fixture.registryPath,
        projectId: "project",
      }),
    ).rejects.toThrow("invalid Reticle specification coverage registry");
  });

  it.each([
    ["missing flow", undefined],
    [
      "empty intent",
      {
        version: 1,
        name: "reporting-flow",
        projectId: "project",
        createdAt: 0,
        intent: "",
        steps: [],
        success: { state: {} },
      },
    ],
    [
      "action-only",
      {
        version: 1,
        name: "reporting-flow",
        projectId: "project",
        createdAt: 0,
        intent: "Save",
        steps: [
          {
            tool: "reticle_act",
            anchor: { kind: "role", role: "button", name: "Save" },
            action: "click",
          },
        ],
      },
    ],
    [
      "assertion-only step",
      {
        version: 1,
        name: "reporting-flow",
        projectId: "project",
        createdAt: 0,
        intent: "Save",
        steps: [
          {
            expect: {
              state: {
                store: "queryClient",
                path: "save.status",
                equals: "success",
              },
            },
          },
        ],
      },
      "invalid flow steps",
    ],
    [
      "element-presence-only",
      {
        version: 1,
        name: "reporting-flow",
        projectId: "project",
        createdAt: 0,
        intent: "Save",
        steps: [
          {
            tool: "reticle_act",
            anchor: { kind: "role", role: "button", name: "Save" },
            action: "click",
            expect: { element: { role: "status" } },
          },
        ],
      },
    ],
    [
      "element-presence-only",
      {
        version: 1,
        name: "reporting-flow",
        projectId: "project",
        createdAt: 0,
        intent: "Save",
        steps: [
          {
            tool: "reticle_act",
            anchor: { kind: "role", role: "button", name: "Save" },
            action: "click",
            expect: { console: { level: "error", absent: true } },
          },
        ],
      },
    ],
  ])("rejects a mapped flow with %s", async (label, flow, error = label) => {
    const fixture = await coverageFixture();
    registryScenario(fixture.registry, 0).coverage = {
      kind: "classified",
      proofs: [
        {
          kind: "reticle",
          flow: "bad-flow",
          assertion: { location: "step", step: 0 },
          consequence: "The report save reaches its declared result.",
        },
      ],
    };
    await writeJson(fixture.registryPath, fixture.registry);
    if (flow !== undefined)
      await writeJson(join(fixture.flowsRoot, "bad-flow.json"), flow);

    await expect(validateReticleSpecCoverage(fixture)).rejects.toThrow(error);
  });

  it.each([
    ["empty state", savedFlow({ state: {} }), "invalid flow steps"],
    ["empty net", savedFlow({ net: {} }), "invalid flow steps"],
    [
      "unknown assertion channel",
      savedFlow({ route: { pathname: "/reports/1" } }),
      "invalid flow steps",
    ],
    [
      "unknown absent channel",
      savedFlow({ toast: { absent: true } }),
      "invalid flow steps",
    ],
    [
      "mismatched project",
      savedFlow(
        {
          state: {
            store: "queryClient",
            path: "save.status",
            equals: "success",
          },
        },
        "other-project",
      ),
      "flow projectId mismatch",
    ],
  ])("rejects unsupported saved flow form: %s", async (_label, flow, error) => {
    const fixture = await coverageFixture();
    registryScenario(fixture.registry, 0).coverage = {
      kind: "classified",
      proofs: [
        {
          kind: "reticle",
          flow: "bad-flow",
          assertion: { location: "step", step: 0 },
          consequence: "The report save reaches its declared result.",
        },
      ],
    };
    await writeJson(fixture.registryPath, fixture.registry);
    await writeJson(join(fixture.flowsRoot, "bad-flow.json"), flow);

    await expect(validateReticleSpecCoverage(fixture)).rejects.toThrow(error);
  });

  it("rejects unsafe flow names and assertion locators before reading a flow", async () => {
    const fixture = await coverageFixture();
    const proof = classifiedCoverage(fixture.registry, 0).proofs[0];
    if (proof.kind !== "reticle") throw new Error("fixture coverage");
    proof.flow = "../escape";
    proof.assertion = { location: "step", step: 0, extra: true } as never;
    await writeJson(fixture.registryPath, fixture.registry);

    await expect(validateReticleSpecCoverage(fixture)).rejects.toThrow(
      "invalid Reticle mapping",
    );
  });

  it.each([
    { state: { store: "queryClient", path: "save.status", equals: "success" } },
    { net: { method: "POST", urlContains: "save", count: 1 } },
    { signal: "report:saved" },
    {
      console: { level: "error", absent: true },
      state: { store: "queryClient", path: "save.status", equals: "success" },
    },
  ])("accepts consequence predicate %#", async (predicate) => {
    const fixture = await coverageFixture();
    await writeJson(join(fixture.flowsRoot, "reporting-flow.json"), {
      version: 1,
      name: "reporting-flow",
      projectId: "project",
      createdAt: 0,
      intent: "A user observes the declared product consequence.",
      steps: [
        {
          tool: "reticle_act",
          anchor: { kind: "role", role: "button", name: "Save" },
          action: "click",
          expect: predicate,
        },
      ],
    });
    registryScenario(fixture.registry, 0).coverage = {
      kind: "classified",
      proofs: [
        {
          kind: "reticle",
          flow: "reporting-flow",
          assertion: { location: "step", step: 0 },
          consequence: "The report save reaches its declared result.",
        },
      ],
    };
    await writeJson(fixture.registryPath, fixture.registry);

    await expect(validateReticleSpecCoverage(fixture)).resolves.toMatchObject({
      flows: 1,
    });
  });

  it("refreshes outcomes and resets changed or new coverage", async () => {
    const fixture = await coverageFixture();
    await writeFile(
      join(fixture.specsRoot, "reporting/spec.md"),
      REPORTING_SPEC.replace(
        "- **THEN** the report is stored with a submitted timestamp\n\n#### Scenario: A lead submits a draft",
        "- **THEN** the report is stored with a submitted timestamp\n- **AND** the audit event is recorded\n\n#### Scenario: A lead submits a draft",
      ).replace(
        "the report stays editable",
        "the report stays editable until Friday",
      ),
    );

    const refreshed = await refreshReticleSpecCoverage({
      specsRoot: fixture.specsRoot,
      registryPath: fixture.registryPath,
      projectId: "project",
    });
    const persisted = JSON.parse(
      await readFile(fixture.registryPath, "utf8"),
    ) as unknown;

    expect(refreshed).toEqual(persisted);
    expect(refreshed.scenarios[0]?.coverage.kind).toBe("unclassified");
    expect(refreshed.scenarios[1]?.coverage.kind).toBe("unclassified");
    expect(refreshed.scenarios[2]?.coverage.kind).toBe("unclassified");
    await expect(
      refreshReticleSpecCoverage({
        specsRoot: fixture.specsRoot,
        registryPath: fixture.registryPath,
        projectId: "project",
      }),
    ).resolves.toEqual(refreshed);
  });

  it("refreshes only when both scenario and outcome fingerprints match", async () => {
    const fixture = await coverageFixture();
    const coverage = classifiedCoverage(fixture.registry, 0);
    coverage.proofs.push({
      kind: "deterministic",
      surface: "database-test",
      reference: "scripts/gates/reticle-spec-coverage.test.ts",
      detail: "The submitted report row is persisted.",
    });
    await writeJson(fixture.registryPath, fixture.registry);
    const originalFingerprint = registryScenario(
      fixture.registry,
      0,
    ).fingerprint;
    const originalOutcomeFingerprint = registryScenario(fixture.registry, 0)
      .outcome.fingerprint;
    const originalProofs = structuredClone(coverage.proofs);

    const refreshed = await refreshReticleSpecCoverage({
      specsRoot: fixture.specsRoot,
      registryPath: fixture.registryPath,
      projectId: "project",
    });
    expect(refreshed.scenarios[0]?.coverage).toEqual({
      kind: "classified",
      proofs: originalProofs,
    });
    expect(refreshed.scenarios[0]?.fingerprint).toBe(originalFingerprint);
    expect(refreshed.scenarios[0]?.outcome.fingerprint).toBe(
      originalOutcomeFingerprint,
    );

    const stale = JSON.parse(
      await readFile(fixture.registryPath, "utf8"),
    ) as ReticleSpecCoverageRegistry;
    const staleScenario = stale.scenarios[0];
    if (staleScenario === undefined) throw new Error("fixture scenario");
    (staleScenario.outcome as { fingerprint: string }).fingerprint = "0".repeat(
      64,
    );
    await writeJson(fixture.registryPath, stale);
    const reset = await refreshReticleSpecCoverage({
      specsRoot: fixture.specsRoot,
      registryPath: fixture.registryPath,
      projectId: "project",
    });
    expect(reset.scenarios[0]?.coverage.kind).toBe("unclassified");
  });

  it.each([
    [
      "duplicate existing registry entry",
      (registry: ReticleSpecCoverageRegistry) => {
        registry.scenarios.push(registryScenario(registry, 0));
      },
    ],
    [
      "invalid existing registry entry",
      (registry: ReticleSpecCoverageRegistry) => {
        const scenario = registry.scenarios[0];
        if (scenario === undefined) throw new Error("fixture scenario");
        scenario.coverage = { kind: "unknown" } as never;
      },
    ],
  ])(
    "fails closed instead of hiding %s during refresh",
    async (error, mutate) => {
      const fixture = await coverageFixture();
      mutate(fixture.registry);
      await writeJson(fixture.registryPath, fixture.registry);

      await expect(
        refreshReticleSpecCoverage({
          specsRoot: fixture.specsRoot,
          registryPath: fixture.registryPath,
          projectId: "project",
        }),
      ).rejects.toThrow(error);
    },
  );
});
