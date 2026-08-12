const DRAIN_ACKNOWLEDGEMENT = "runtime-api-idle";

export const awaitRuntimeApiDrain = async (apiUrl: string): Promise<void> => {
  const response = await fetch(`${apiUrl}/health/runtime-drain`);
  if (!response.ok) {
    throw new Error(
      `Runtime API drain failed with HTTP ${String(response.status)}`,
    );
  }
  const body: unknown = await response.json();
  if (
    typeof body !== "object" ||
    body === null ||
    !("acknowledgement" in body) ||
    body.acknowledgement !== DRAIN_ACKNOWLEDGEMENT
  ) {
    throw new Error("Runtime API drain returned an invalid acknowledgement");
  }
};
