interface ClosableResource {
  close(): Promise<void>;
}

async function closeAfterFailure(
  resource: ClosableResource,
  failure: unknown,
): Promise<never> {
  try {
    await resource.close();
  } catch (error) {
    throw new AggregateError(
      [failure, error],
      "Resource use and cleanup both failed",
    );
  }

  throw failure;
}

export async function withOwnedResource<
  Resource extends ClosableResource,
  Result,
>(
  createResource: () => Promise<Resource>,
  runWithResource: (resource: Resource) => Promise<Result>,
): Promise<Result> {
  const resource = await createResource();
  return runWithResource(resource).then(
    async (result) => {
      await resource.close();
      return result;
    },
    (error: unknown) => closeAfterFailure(resource, error),
  );
}
