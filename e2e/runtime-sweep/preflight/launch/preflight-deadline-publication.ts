export type PublicationCommitGuard = () => void;

export const publishDeadlineBound = async (input: {
  readonly guard?: PublicationCommitGuard;
  readonly publish: (markOwned: () => void) => Promise<void>;
  readonly rollback: () => Promise<void>;
}): Promise<void> => {
  input.guard?.();
  const state = { owned: false };
  try {
    await input.publish(() => {
      state.owned = true;
    });
    input.guard?.();
  } catch (error: unknown) {
    if (!state.owned) throw error;
    try {
      await input.rollback();
    } catch (rollbackError: unknown) {
      throw new AggregateError(
        [error, rollbackError],
        "Deadline-bound publication rollback failed",
      );
    }
    throw error;
  }
};
