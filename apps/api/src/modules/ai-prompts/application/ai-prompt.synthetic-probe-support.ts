import { ReportAssistantProviderError } from "../../search/index.js";

export type SyntheticCheck = Readonly<{
  code: string;
  status: "passed" | "failed" | "inconclusive";
  passedCount: number;
  failedCount: number;
}>;

export const syntheticCheck = async (
  code: string,
  action: () => Promise<void> | void,
): Promise<SyntheticCheck> => {
  try {
    await action();
    return { code, status: "passed", passedCount: 1, failedCount: 0 };
  } catch (error) {
    return {
      code,
      status:
        error instanceof ReportAssistantProviderError && error.retryable
          ? "inconclusive"
          : "failed",
      passedCount: 0,
      failedCount: 1,
    };
  }
};

export const runSyntheticChecks = (
  actions: readonly (() => Promise<SyntheticCheck>)[],
): Promise<readonly SyntheticCheck[]> =>
  actions.reduce<Promise<readonly SyntheticCheck[]>>(
    async (pending, action) => [...(await pending), await action()],
    Promise.resolve([]),
  );
