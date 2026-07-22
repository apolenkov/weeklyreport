import type { Prisma, PrismaClient } from "@prisma/client";

export interface PauseGate {
  readonly paused: Promise<void>;
  readonly release: () => void;
  readonly pause: () => Promise<void>;
}

/** Creates a deterministic two-phase gate for a single intercepted DB call. */
export function createPauseGate(): PauseGate {
  const paused = Promise.withResolvers<void>();
  const released = Promise.withResolvers<void>();
  return {
    paused: paused.promise,
    release: released.resolve,
    pause: async () => {
      paused.resolve();
      await released.promise;
    },
  };
}

/** Pauses immediately before an interactive transaction reaches the database. */
export function pauseBeforeTransaction(
  prisma: PrismaClient,
  pause: () => Promise<void>,
): PrismaClient {
  const transaction = prisma.$transaction.bind(prisma);
  return new Proxy(prisma, {
    get(target, property): unknown {
      if (property === "$transaction") {
        return async (
          callback: (tx: Prisma.TransactionClient) => Promise<unknown>,
          options?: { timeout?: number },
        ) => {
          await pause();
          return transaction(callback, options);
        };
      }
      return Reflect.get(target, property, target) as unknown;
    },
  });
}

/** Pauses immediately before the next ReportSection updateMany statement. */
export function pauseBeforeSectionUpdate(
  prisma: PrismaClient,
  pause: () => Promise<void>,
): PrismaClient {
  const updateMany = prisma.reportSection.updateMany.bind(prisma.reportSection);
  const reportSection = new Proxy(prisma.reportSection, {
    get(target, property): unknown {
      if (property === "updateMany") {
        return async (
          ...args: Parameters<typeof prisma.reportSection.updateMany>
        ) => {
          await pause();
          return updateMany(...args);
        };
      }
      return Reflect.get(target, property, target) as unknown;
    },
  });
  return new Proxy(prisma, {
    get(target, property): unknown {
      if (property === "reportSection") {
        return reportSection;
      }
      return Reflect.get(target, property, target) as unknown;
    },
  });
}
