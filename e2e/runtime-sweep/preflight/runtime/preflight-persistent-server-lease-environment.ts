import {
  PREFLIGHT_SERVER_LEASE_ATTEMPT_ENV,
  PREFLIGHT_SERVER_LEASE_CAMPAIGN_ENV,
  PREFLIGHT_SERVER_LEASE_ENV,
  PREFLIGHT_SERVER_LEASE_SHA_ENV,
  PREFLIGHT_SERVER_LEASE_SOURCE_TREE_ENV,
} from "./preflight-persistent-server-lease-contract.ts";

export const PREFLIGHT_REVEAL_CONTINUATION_ATTEMPT_ENV =
  "RUNTIME_SWEEP_PREFLIGHT_REVEAL_CONTINUATION_ATTEMPT_ID" as const;

export type PersistentServerLeaseEnvironment = Readonly<{
  readonly path: string;
  readonly digest: string;
  readonly sourceTree: string;
  readonly campaignId: string;
  readonly attemptId: string;
}>;

const LEASE_ENV_KEYS: ReadonlySet<string> = new Set([
  PREFLIGHT_SERVER_LEASE_ENV,
  PREFLIGHT_SERVER_LEASE_SHA_ENV,
  PREFLIGHT_SERVER_LEASE_SOURCE_TREE_ENV,
  PREFLIGHT_SERVER_LEASE_CAMPAIGN_ENV,
  PREFLIGHT_SERVER_LEASE_ATTEMPT_ENV,
]);

export const persistentServerLeaseEnvironmentState = (
  environment: NodeJS.ProcessEnv,
): PersistentServerLeaseEnvironment | undefined => {
  const values = {
    path: environment[PREFLIGHT_SERVER_LEASE_ENV]?.trim(),
    digest: environment[PREFLIGHT_SERVER_LEASE_SHA_ENV]?.trim(),
    sourceTree: environment[PREFLIGHT_SERVER_LEASE_SOURCE_TREE_ENV]?.trim(),
    campaignId: environment[PREFLIGHT_SERVER_LEASE_CAMPAIGN_ENV]?.trim(),
    attemptId: environment[PREFLIGHT_SERVER_LEASE_ATTEMPT_ENV]?.trim(),
  };
  const hasAnyValue = Object.values(values).some(
    (value) => value !== undefined,
  );
  if (!hasAnyValue) return undefined;
  if (
    Object.values(values).some((value) => value === undefined || value === "")
  )
    throw new Error(
      "Persistent preflight server lease requires all path, SHA256, source tree, campaign, and attempt fields",
    );
  return values as PersistentServerLeaseEnvironment;
};

export const assertPersistentServerLeaseAttemptBinding = (input: {
  readonly leaseAttemptId: string | undefined;
  readonly activeAttemptId: string | undefined;
  readonly childAttemptId: string | undefined;
}): void => {
  const { leaseAttemptId, activeAttemptId, childAttemptId } = input;
  if (
    leaseAttemptId === undefined ||
    activeAttemptId === undefined ||
    childAttemptId === undefined ||
    leaseAttemptId === "" ||
    activeAttemptId === "" ||
    childAttemptId === "" ||
    leaseAttemptId !== activeAttemptId ||
    activeAttemptId !== childAttemptId
  )
    throw new Error(
      "Persistent preflight server lease attempt identity mismatch",
    );
};

export const withoutLeaseEnvironment = (
  environment: NodeJS.ProcessEnv,
): NodeJS.ProcessEnv =>
  Object.fromEntries(
    Object.entries(environment).filter(([key]) => !LEASE_ENV_KEYS.has(key)),
  );
