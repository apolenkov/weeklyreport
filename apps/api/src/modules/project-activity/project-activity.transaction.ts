import { Prisma } from "@prisma/client";

import { PrismaService } from "../../infrastructure/prisma/prisma.service.js";
import {
  ProjectActivityConflictError,
  ProjectActivityDomainError,
  ProjectActivityNotFoundError,
} from "./project-activity.errors.js";

const MAX_SERIALIZABLE_ATTEMPTS = 3;

function isObject(value: unknown): value is Record<PropertyKey, unknown> {
  return typeof value === "object" && value !== null;
}

function isSerializationConflict(error: unknown): boolean {
  if (!isObject(error)) return false;
  if (error.code === "P2034") return true;

  return (
    error.name === "DriverAdapterError" &&
    isObject(error.cause) &&
    error.cause.kind === "TransactionWriteConflict"
  );
}

export async function runProjectActivityTransaction<T>(
  prisma: PrismaService,
  operation: (tx: Prisma.TransactionClient) => Promise<T>,
): Promise<T> {
  const runAttempt = async (
    attempt: number,
    retryingAfterConflict: boolean,
  ): Promise<T> => {
    try {
      return await prisma.$transaction(operation, {
        isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
      });
    } catch (error) {
      if (isSerializationConflict(error)) {
        if (attempt < MAX_SERIALIZABLE_ATTEMPTS) {
          return runAttempt(attempt + 1, true);
        }
        throw new ProjectActivityConflictError(
          "The project activity changed concurrently. Reload and retry.",
          { cause: error },
        );
      }
      if (
        retryingAfterConflict &&
        (error instanceof ProjectActivityDomainError ||
          error instanceof ProjectActivityNotFoundError)
      ) {
        throw new ProjectActivityConflictError(
          "The project activity changed concurrently. Reload and retry.",
          { cause: error },
        );
      }
      throw error;
    }
  };

  return runAttempt(1, false);
}
