import type { ServerLogRecord } from "../../evidence/evidence-types.ts";

export type LogCount = Readonly<{
  readonly correlationId: string;
  readonly level: ServerLogRecord["level"];
  readonly count: number;
}>;

export type RuntimeLokiEvidence = Readonly<{
  readonly counts: readonly LogCount[];
  readonly shutdownMarkers: number;
}>;

export const countKey = (
  record: Pick<LogCount, "correlationId" | "level">,
): string => `${record.correlationId}\u0000${record.level}`;

export const countsFor = (
  records: readonly ServerLogRecord[],
): readonly LogCount[] =>
  Object.entries(
    records.reduce<Readonly<Record<string, number>>>(
      (counts, record) => ({
        ...counts,
        [countKey(record)]: (counts[countKey(record)] ?? 0) + 1,
      }),
      {},
    ),
  )
    .map(([key, count]) => {
      const [correlationId, level] = key.split("\u0000");
      if (
        !correlationId ||
        !["debug", "info", "warn", "error"].includes(level ?? "")
      )
        throw new Error("Runtime profile log count key is invalid");
      return {
        correlationId,
        level: level as ServerLogRecord["level"],
        count,
      };
    })
    .toSorted((left, right) => countKey(left).localeCompare(countKey(right)));

export const discrepanciesFor = (
  expected: readonly LogCount[],
  actual: readonly LogCount[],
): readonly string[] => {
  const actualByKey = new Map(actual.map((count) => [countKey(count), count]));
  const expectedByKey = new Map(
    expected.map((count) => [countKey(count), count]),
  );
  return [
    ...expected.flatMap((count) => {
      const observed = actualByKey.get(countKey(count))?.count ?? 0;
      return observed === count.count
        ? []
        : [
            `missing Loki count correlation=${count.correlationId} level=${count.level} expected=${String(count.count)} actual=${String(observed)}`,
          ];
    }),
    ...actual.flatMap((count) =>
      expectedByKey.has(countKey(count))
        ? []
        : [
            `unexpected Loki count correlation=${count.correlationId} level=${count.level} actual=${String(count.count)}`,
          ],
    ),
  ];
};
