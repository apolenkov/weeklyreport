const REDIS_RECREATION_ENV = "RUNTIME_SWEEP_REDIS_RECREATE";
const REDIS_RECREATION_VALUE = "true";

export type RuntimeLaneRedisRecreationAuthorization = Readonly<{
  readonly source: typeof REDIS_RECREATION_ENV;
  readonly value: typeof REDIS_RECREATION_VALUE;
}>;

const validCapabilities = new WeakSet<object>();

const authorizationError = (): Error =>
  new Error(
    "Runtime lane Redis mutation requires RUNTIME_SWEEP_REDIS_RECREATE=true",
  );

export const requireRuntimeLaneRedisRecreationAuthorization =
  (): RuntimeLaneRedisRecreationAuthorization => {
    if (process.env[REDIS_RECREATION_ENV] !== REDIS_RECREATION_VALUE)
      throw authorizationError();
    const capability = Object.freeze({
      source: REDIS_RECREATION_ENV,
      value: REDIS_RECREATION_VALUE,
    });
    validCapabilities.add(capability);
    return capability;
  };

export const consumeRuntimeLaneRedisRecreationAuthorization = (
  authorization: RuntimeLaneRedisRecreationAuthorization | undefined,
): void => {
  const environmentAuthorized =
    process.env[REDIS_RECREATION_ENV] === REDIS_RECREATION_VALUE;
  const capabilityAuthorized =
    authorization !== undefined && validCapabilities.has(authorization);
  if (authorization !== undefined) validCapabilities.delete(authorization);
  if (!environmentAuthorized || !capabilityAuthorized)
    throw authorizationError();
};
