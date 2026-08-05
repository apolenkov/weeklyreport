export interface EvidenceReference {
  readonly path: string;
  readonly needle: string;
}

export interface FindingEvidence {
  readonly id: string;
  readonly resolved: boolean;
  readonly owner: string;
  readonly implementation: string;
  readonly spec: string;
  readonly tests: readonly EvidenceReference[];
  readonly probes: readonly EvidenceReference[];
  readonly commands: readonly string[];
}

export interface EvidenceManifest {
  readonly version: number;
  readonly expectedIds: readonly string[];
  readonly findings: readonly FindingEvidence[];
}

interface CommandEvidence {
  readonly command: string;
  readonly exitCode: number;
  readonly sourceDigest: string;
  readonly summary: string;
}

export interface EvidenceResults {
  readonly version: number;
  readonly generatedAt: string;
  readonly commands: readonly CommandEvidence[];
}

const record = (value: unknown, label: string): Record<string, unknown> => {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    throw new TypeError(`${label} must be an object`);
  }
  return value as Record<string, unknown>;
};

const string = (value: unknown, label: string): string => {
  if (typeof value !== "string" || value.length === 0) {
    throw new TypeError(`${label} must be a non-empty string`);
  }
  return value;
};

const array = (value: unknown, label: string): readonly unknown[] => {
  if (!Array.isArray(value)) throw new TypeError(`${label} must be an array`);
  return value;
};

const integer = (value: unknown, label: string): number => {
  if (!Number.isInteger(value))
    throw new TypeError(`${label} must be an integer`);
  return value as number;
};

const reference = (value: unknown, label: string): EvidenceReference => {
  const item = record(value, label);
  return {
    path: string(item.path, `${label}.path`),
    needle: string(item.needle, `${label}.needle`),
  };
};

const finding = (value: unknown, index: number): FindingEvidence => {
  const item = record(value, `findings[${index}]`);
  return {
    id: string(item.id, `findings[${index}].id`),
    resolved: item.resolved === true,
    owner: string(item.owner, `findings[${index}].owner`),
    implementation: string(
      item.implementation,
      `findings[${index}].implementation`,
    ),
    spec: string(item.spec, `findings[${index}].spec`),
    tests: array(item.tests, `findings[${index}].tests`).map((entry, offset) =>
      reference(entry, `findings[${index}].tests[${offset}]`),
    ),
    probes: array(item.probes, `findings[${index}].probes`).map(
      (entry, offset) =>
        reference(entry, `findings[${index}].probes[${offset}]`),
    ),
    commands: array(item.commands, `findings[${index}].commands`).map(
      (entry, offset) =>
        string(entry, `findings[${index}].commands[${offset}]`),
    ),
  };
};

export const parseManifest = (value: unknown): EvidenceManifest => {
  const item = record(value, "manifest");
  return {
    version: item.version === 1 ? 1 : 0,
    expectedIds: array(item.expectedIds, "manifest.expectedIds").map(
      (entry, index) => string(entry, `manifest.expectedIds[${index}]`),
    ),
    findings: array(item.findings, "manifest.findings").map(finding),
  };
};

export const parseResults = (value: unknown): EvidenceResults => {
  const item = record(value, "results");
  return {
    version: item.version === 2 ? 2 : 0,
    generatedAt: string(item.generatedAt, "results.generatedAt"),
    commands: array(item.commands, "results.commands").map((entry, index) => {
      const command = record(entry, `results.commands[${index}]`);
      return {
        command: string(command.command, `results.commands[${index}].command`),
        exitCode: integer(
          command.exitCode,
          `results.commands[${index}].exitCode`,
        ),
        sourceDigest: string(
          command.sourceDigest,
          `results.commands[${index}].sourceDigest`,
        ),
        summary: string(command.summary, `results.commands[${index}].summary`),
      };
    }),
  };
};
