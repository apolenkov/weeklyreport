import { readdirSync } from "node:fs";
import path from "node:path";

import { parseDocument } from "yaml";

type PlainObject = Readonly<Record<string, unknown>>;

type WorkflowParseResult =
  | Readonly<{ ok: true; workflow: PlainObject }>
  | Readonly<{ findings: readonly string[]; ok: false }>;

const WORKFLOW_FILE = /[.](?:yaml|yml)$/u;
const CHECKOUT_ACTION = "actions/checkout@";
const SAFE_PERMISSION = new Set(["none", "read"]);

const asObject = (value: unknown): PlainObject | undefined =>
  typeof value === "object" && value !== null && !Array.isArray(value)
    ? (value as PlainObject)
    : undefined;

const yamlFindings = (
  errors: readonly Readonly<{ message: string }>[],
  warnings: readonly Readonly<{ message: string }>[],
): readonly string[] =>
  [...errors, ...warnings].map(
    ({ message }) => `workflow YAML is invalid: ${message}`,
  );

const parseWorkflow = (source: string): WorkflowParseResult => {
  const document = parseDocument(source, {
    prettyErrors: false,
    uniqueKeys: true,
  });
  const findings = yamlFindings(document.errors, document.warnings);
  if (findings.length > 0) {
    return { findings, ok: false };
  }
  try {
    const workflow = asObject(document.toJS({ maxAliasCount: 0 }));
    return workflow
      ? { ok: true, workflow }
      : { findings: ["workflow YAML root must be a mapping"], ok: false };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return {
      findings: [`workflow YAML cannot be resolved safely: ${message}`],
      ok: false,
    };
  }
};

const unsafePermissionEntries = (
  permissions: PlainObject,
): readonly (readonly [string, unknown])[] =>
  Object.entries(permissions).filter(
    ([, value]) => typeof value !== "string" || !SAFE_PERMISSION.has(value),
  );

const topLevelPermissionFindings = (
  workflow: PlainObject,
): readonly string[] => {
  const value = workflow.permissions;
  const permissions = asObject(value);
  const baselineFindings =
    permissions?.contents === "read"
      ? []
      : ["top-level permissions must declare contents: read"];
  const hasExplicitSafePermissions =
    permissions === undefined
      ? false
      : unsafePermissionEntries(permissions).length === 0;
  const broadFindings =
    value !== undefined && !hasExplicitSafePermissions
      ? ["top-level permissions grant a broad scope"]
      : [];
  return [...baselineFindings, ...broadFindings];
};

const jobPermissionFindings = (jobs: PlainObject): readonly string[] =>
  Object.entries(jobs).flatMap(([jobName, value]) => {
    const job = asObject(value);
    if (job?.permissions === undefined) {
      return [];
    }
    const permissions = asObject(job.permissions);
    const permissionEntries = permissions
      ? unsafePermissionEntries(permissions)
      : undefined;
    return permissionEntries?.length === 0
      ? []
      : [
          `job ${jobName}: job-level permissions must use explicit non-write scopes`,
        ];
  });

const checkoutFindings = (jobs: PlainObject): readonly string[] =>
  Object.entries(jobs).flatMap(([jobName, value]) => {
    const steps = asObject(value)?.steps;
    return Array.isArray(steps)
      ? steps.flatMap((step, index) => {
          const parsedStep = asObject(step);
          if (
            typeof parsedStep?.uses !== "string" ||
            !parsedStep.uses.toLowerCase().startsWith(CHECKOUT_ACTION)
          ) {
            return [];
          }
          const inputs = asObject(parsedStep.with);
          return inputs?.["persist-credentials"] === false
            ? []
            : [
                `job ${jobName} step ${String(index + 1)}: checkout must set persist-credentials: false`,
              ];
        })
      : [];
  });

const policyFindings = (workflow: PlainObject): readonly string[] => {
  const jobs = asObject(workflow.jobs);
  return jobs
    ? [
        ...topLevelPermissionFindings(workflow),
        ...jobPermissionFindings(jobs),
        ...checkoutFindings(jobs),
      ]
    : [
        ...topLevelPermissionFindings(workflow),
        "workflow jobs must be a mapping",
      ];
};

export const workflowHygieneFindings = (source: string): readonly string[] => {
  const result = parseWorkflow(source);
  return result.ok ? policyFindings(result.workflow) : result.findings;
};

export const workflowFiles = (): readonly string[] => {
  const directory = path.resolve(".github/workflows");
  return readdirSync(directory)
    .filter((file) => WORKFLOW_FILE.test(file))
    .toSorted((left, right) => left.localeCompare(right))
    .map((file) => path.join(directory, file));
};
