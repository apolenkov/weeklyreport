import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import {
  existsSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { delimiter, join, resolve } from "node:path";

import { parse, parseAllDocuments, stringify } from "yaml";

export const chartDirectory = resolve("deploy/helm/weeklyreport");
export const exampleValuesPath = join(
  chartDirectory,
  "values.production.example.yaml",
);

export interface Container {
  readonly name: string;
  readonly image: string;
  readonly command?: readonly string[];
  readonly env?: readonly { readonly name: string; readonly value?: string }[];
  readonly args?: readonly string[];
  readonly securityContext?: Readonly<Record<string, unknown>>;
}

export interface PodSpec {
  readonly containers: readonly Container[];
  readonly initContainers?: readonly Container[];
  readonly automountServiceAccountToken?: boolean;
  readonly enableServiceLinks?: boolean;
  readonly imagePullSecrets?: readonly { readonly name: string }[];
  readonly affinity?: {
    readonly podAffinity?: {
      readonly requiredDuringSchedulingIgnoredDuringExecution?: readonly {
        readonly topologyKey?: string;
        readonly labelSelector?: {
          readonly matchLabels?: Readonly<Record<string, string>>;
        };
      }[];
    };
  };
  readonly securityContext: {
    readonly runAsNonRoot?: boolean;
    readonly runAsUser?: number;
    readonly seccompProfile?: { readonly type: string };
  };
}

interface ManifestSpec {
  readonly replicas?: number;
  readonly strategy?: { readonly type: string };
  readonly ports?: readonly { readonly port: number }[];
  readonly rules?: unknown;
  readonly template?: { readonly spec: PodSpec };
  readonly jobTemplate?: {
    readonly spec: {
      readonly activeDeadlineSeconds?: number;
      readonly template: { readonly spec: PodSpec };
    };
  };
}

export interface Manifest {
  readonly kind: string;
  readonly metadata: { readonly name: string };
  readonly spec: ManifestSpec;
  readonly data?: Readonly<Record<string, string>>;
}

export interface HelmResult {
  readonly status: number | null;
  readonly stdout: string;
  readonly stderr: string;
}

function resolveHelm(): string {
  const executable = (process.env.PATH ?? "")
    .split(delimiter)
    .map((directory) => join(directory, "helm"))
    .find(existsSync);
  // A missing binary fails the gate instead of skipping it.
  assert.ok(executable, "helm is required for the chart gate");
  return executable;
}

/** Runs helm and returns its exit status and output. */
export function helm(args: readonly string[]): HelmResult {
  const result = spawnSync(resolveHelm(), [...args], { encoding: "utf8" });
  return {
    status: result.status,
    stdout: result.stdout,
    stderr: result.stderr,
  };
}

export function loadExampleValues(): Record<string, unknown> {
  return parse(readFileSync(exampleValuesPath, "utf8")) as Record<
    string,
    unknown
  >;
}

/** Writes values to a temporary file for the duration of one callback. */
export function withValuesFile<T>(
  values: Readonly<Record<string, unknown>>,
  run: (path: string) => T,
): T {
  const directory = mkdtempSync(join(tmpdir(), "chart-values-"));
  try {
    const path = join(directory, "values.yaml");
    writeFileSync(path, stringify(values));
    return run(path);
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
}

export function templateArgs(
  valuesPath: string,
  extra: readonly string[] = [],
): readonly string[] {
  return [
    "template",
    "weeklyreport",
    chartDirectory,
    "--namespace",
    "wr",
    "-f",
    valuesPath,
    ...extra,
  ];
}

export function parseManifests(output: string): readonly Manifest[] {
  return parseAllDocuments(output)
    .map((document) => document.toJS() as Manifest | null)
    .filter((document): document is Manifest => document !== null);
}

export function renderExample(extra: readonly string[] = []): {
  readonly manifests: readonly Manifest[];
  readonly raw: string;
} {
  const result = helm(templateArgs(exampleValuesPath, extra));
  assert.equal(result.status, 0, result.stderr);
  return { manifests: parseManifests(result.stdout), raw: result.stdout };
}

export function podSpecOf(manifest: Manifest): PodSpec {
  const pod =
    manifest.spec.template?.spec ??
    manifest.spec.jobTemplate?.spec.template.spec;
  assert.ok(pod, `${manifest.kind}/${manifest.metadata.name} has no pod spec`);
  return pod;
}

/** First container of the named workload's pod. */
export function mainContainer(
  manifests: readonly Manifest[],
  kind: string,
  name: string,
): Container {
  const [container] = podSpecOf(findManifest(manifests, kind, name)).containers;
  assert.ok(container, `${kind}/${name} has no container`);
  return container;
}

export function findManifest(
  manifests: readonly Manifest[],
  kind: string,
  name: string,
): Manifest {
  const found = manifests.find(
    (manifest) => manifest.kind === kind && manifest.metadata.name === name,
  );
  assert.ok(found, `missing ${kind}/${name}`);
  return found;
}
