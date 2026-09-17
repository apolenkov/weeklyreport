import { readFile } from "node:fs/promises";
import { join } from "node:path";

export type ReticleAssertion =
  { location: "success" } | { location: "step"; step: number };

export interface ReticleMapping {
  readonly flow: string;
  readonly assertion: ReticleAssertion;
}

const SAFE_RETICLE_SEGMENT = /^(?!\.{1,2}$)[A-Za-z0-9][A-Za-z0-9._-]*$/u;
const EXPECT_KEYS = new Set([
  "signal",
  "signalData",
  "signalCount",
  "net",
  "console",
  "element",
  "text",
  "state",
]);
const NATIVE_FLOW_STEP_TOOLS = new Set([
  "reticle_act",
  "reticle_act_sequence",
  "reticle_act_and_wait",
]);
const NATIVE_ACTIONS = new Set([
  "click",
  "dblclick",
  "hover",
  "focus",
  "blur",
  "fill",
  "type",
  "clear",
  "select",
  "check",
  "uncheck",
  "submit",
  "press",
  "upload",
  "scrollIntoView",
  "drag",
  "webmcp",
]);

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function hasOnlyKeys(
  value: Record<string, unknown>,
  allowed: ReadonlySet<string>,
): boolean {
  return Object.keys(value).every((key) => allowed.has(key));
}

function nonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.trim() !== "";
}

function validNet(value: unknown): boolean {
  if (
    !isRecord(value) ||
    !hasOnlyKeys(
      value,
      new Set(["method", "urlContains", "status", "count"]),
    ) ||
    Object.keys(value).length === 0
  )
    return false;
  return (
    (value.method === undefined || nonEmptyString(value.method)) &&
    (value.urlContains === undefined || nonEmptyString(value.urlContains)) &&
    (value.status === undefined || typeof value.status === "number") &&
    (value.count === undefined ||
      (Number.isSafeInteger(value.count) && (value.count as number) >= 0))
  );
}

function validConsole(value: unknown): boolean {
  return (
    isRecord(value) &&
    hasOnlyKeys(value, new Set(["level", "absent"])) &&
    Object.keys(value).length > 0 &&
    (value.level === undefined || nonEmptyString(value.level)) &&
    (value.absent === undefined || typeof value.absent === "boolean")
  );
}

function validElement(value: unknown): boolean {
  return (
    isRecord(value) &&
    hasOnlyKeys(value, new Set(["testid", "role", "name"])) &&
    Object.keys(value).length > 0 &&
    (value.testid === undefined || nonEmptyString(value.testid)) &&
    (value.role === undefined || nonEmptyString(value.role)) &&
    (value.name === undefined || typeof value.name === "string")
  );
}

function validText(value: unknown): boolean {
  return (
    isRecord(value) &&
    hasOnlyKeys(value, new Set(["contains", "scope", "absent", "visible"])) &&
    nonEmptyString(value.contains) &&
    (value.scope === undefined || nonEmptyString(value.scope)) &&
    (value.absent === undefined || typeof value.absent === "boolean") &&
    (value.visible === undefined || typeof value.visible === "boolean")
  );
}

function validState(value: unknown): boolean {
  return (
    isRecord(value) &&
    hasOnlyKeys(value, new Set(["store", "path", "equals", "hold"])) &&
    nonEmptyString(value.path) &&
    (value.store === undefined || nonEmptyString(value.store)) &&
    (value.hold === undefined || typeof value.hold === "boolean")
  );
}

function validSignalFields(value: Record<string, unknown>): boolean {
  if (value.signal !== undefined && !nonEmptyString(value.signal)) return false;
  if (value.signalData !== undefined && !isRecord(value.signalData))
    return false;
  return !(
    value.signalCount !== undefined &&
    (!Number.isSafeInteger(value.signalCount) ||
      (value.signalCount as number) < 0)
  );
}

function supportedFlowExpect(value: unknown): value is Record<string, unknown> {
  if (!isRecord(value) || !hasOnlyKeys(value, EXPECT_KEYS)) return false;
  return (
    validSignalFields(value) &&
    (value.net === undefined || validNet(value.net)) &&
    (value.console === undefined || validConsole(value.console)) &&
    (value.element === undefined || validElement(value.element)) &&
    (value.text === undefined || validText(value.text)) &&
    (value.state === undefined || validState(value.state))
  );
}

function nativeFlowAnchor(value: unknown): boolean {
  if (!isRecord(value) || typeof value.kind !== "string") return false;
  if (value.kind === "testid") return nonEmptyString(value.value);
  if (value.kind === "role") return nonEmptyString(value.role);
  if (value.kind === "signal") return nonEmptyString(value.name);
  return value.kind === "component";
}

function nativeFlowStep(value: unknown): value is Record<string, unknown> {
  return (
    isRecord(value) &&
    typeof value.tool === "string" &&
    NATIVE_FLOW_STEP_TOOLS.has(value.tool) &&
    nativeFlowAnchor(value.anchor) &&
    typeof value.action === "string" &&
    NATIVE_ACTIONS.has(value.action) &&
    (value.args === undefined || isRecord(value.args))
  );
}

function consequenceExpect(value: unknown): boolean {
  return (
    supportedFlowExpect(value) &&
    (value.signal !== undefined ||
      value.net !== undefined ||
      value.state !== undefined)
  );
}

function resolveAssertion(
  flow: Record<string, unknown>,
  assertion: ReticleAssertion,
): unknown {
  if (assertion.location === "success") return flow.success;
  if (!Array.isArray(flow.steps)) return;
  const steps: unknown[] = flow.steps;
  const step = steps[assertion.step];
  return isRecord(step) ? step.expect : undefined;
}

export function isSafeReticleSegment(value: string): boolean;
export function isSafeReticleSegment(value: unknown): value is string;
export function isSafeReticleSegment(value: unknown): boolean {
  return typeof value === "string" && SAFE_RETICLE_SEGMENT.test(value);
}

export function isReticleAssertion(value: unknown): value is ReticleAssertion {
  if (!isRecord(value) || typeof value.location !== "string") return false;
  if (value.location === "success") return Object.keys(value).length === 1;
  return (
    value.location === "step" &&
    Object.keys(value).length === 2 &&
    Number.isSafeInteger(value.step) &&
    (value.step as number) >= 0
  );
}

async function readFlow(
  flowsRoot: string,
  flowName: string,
): Promise<Record<string, unknown>> {
  try {
    const parsed = JSON.parse(
      await readFile(join(flowsRoot, `${flowName}.json`), "utf8"),
    ) as unknown;
    if (!isRecord(parsed)) throw new Error("invalid flow");
    return parsed;
  } catch (error) {
    if (isRecord(error) && error.code === "ENOENT") {
      throw new Error(`missing flow: ${flowName}`);
    }
    throw new Error(`invalid flow: ${flowName}`);
  }
}

function validateFlowEnvelope(
  flow: Record<string, unknown>,
  flowName: string,
  expectedProjectId: string,
): unknown[] {
  if (!nonEmptyString(flow.intent))
    throw new Error(`empty intent: ${flowName}`);
  if (!isSafeReticleSegment(flow.projectId)) {
    throw new Error(`missing or invalid flow projectId: ${flowName}`);
  }
  if (flow.projectId !== expectedProjectId) {
    throw new Error(`flow projectId mismatch: ${flowName}`);
  }
  if (!Array.isArray(flow.steps))
    throw new Error(`invalid flow steps: ${flowName}`);
  if (flow.success !== undefined && !supportedFlowExpect(flow.success)) {
    throw new Error(`invalid flow success assertion: ${flowName}`);
  }
  return flow.steps;
}

function validateStepExpectation(
  steps: readonly unknown[],
  assertion: ReticleAssertion,
  flowName: string,
): void {
  if (assertion.location !== "step") return;
  const step = steps[assertion.step];
  if (!isRecord(step)) throw new Error(`invalid flow steps: ${flowName}`);
  if (!nativeFlowStep(step)) throw new Error(`invalid flow steps: ${flowName}`);
  if (step.expect !== undefined && !supportedFlowExpect(step.expect)) {
    throw new Error(`invalid flow steps: ${flowName}`);
  }
}

export async function validateMappedFlow(
  flowsRoot: string,
  mapping: ReticleMapping,
  expectedProjectId: string,
): Promise<void> {
  const flowName: string = mapping.flow;
  if (!isSafeReticleSegment(flowName)) {
    throw new Error(`invalid flow path: ${flowName}`);
  }
  if (!isReticleAssertion(mapping.assertion)) {
    throw new Error(`invalid assertion locator: ${flowName}`);
  }
  const flow = await readFlow(flowsRoot, flowName);
  const steps = validateFlowEnvelope(flow, flowName, expectedProjectId);
  validateStepExpectation(steps, mapping.assertion, flowName);

  const predicate = resolveAssertion(flow, mapping.assertion);
  if (!consequenceExpect(predicate)) {
    const label =
      predicate === undefined
        ? "action-only or missing assertion"
        : "element-presence-only or invalid assertion";
    throw new Error(`${label}: ${flowName}`);
  }
}
