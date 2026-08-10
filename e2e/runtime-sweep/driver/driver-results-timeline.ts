interface DriverTimelineRoute {
  readonly route: string;
  readonly enteredAt: string;
  readonly leftAt: string;
}

interface DriverTimelineAssignment {
  readonly catalogRoute: string;
  readonly resolvedRoute: string;
}

export interface DriverTimelineInput {
  readonly timeline: Readonly<{
    readonly startedAt: string;
    readonly endedAt: string;
    readonly routes: readonly DriverTimelineRoute[];
  }>;
  readonly assignedCells: readonly DriverTimelineAssignment[];
}

type RouteGroup = Readonly<{
  readonly key: string;
  readonly aliases: readonly string[];
}>;

const unique = (values: readonly string[]): readonly string[] =>
  values.filter((value, index) => values.indexOf(value) === index);

const toMillis = (value: string): number | null => {
  const millis = Date.parse(value);
  return Number.isFinite(millis) ? millis : null;
};

const routeGroups = (
  assignedCells: readonly DriverTimelineAssignment[],
): readonly RouteGroup[] => {
  const catalogRoutes = unique(
    assignedCells.map(({ catalogRoute }) => catalogRoute),
  );
  return catalogRoutes.map((key) => ({
    key,
    aliases: unique(
      assignedCells
        .filter((cell) => cell.catalogRoute === key)
        .flatMap(({ catalogRoute, resolvedRoute }) => [
          catalogRoute,
          resolvedRoute,
        ]),
    ),
  }));
};

const intervalIssues = (
  route: DriverTimelineRoute,
  index: number,
  start: number | null,
  end: number | null,
): readonly string[] => {
  const entered = toMillis(route.enteredAt);
  const left = toMillis(route.leftAt);
  return [
    ...(entered === null
      ? [`driver timeline route ${index} enteredAt is not parseable`]
      : []),
    ...(left === null
      ? [`driver timeline route ${index} leftAt is not parseable`]
      : []),
    ...(entered !== null && left !== null && entered > left
      ? [`driver timeline route ${index} enteredAt is after leftAt`]
      : []),
    ...(start !== null && entered !== null && entered < start
      ? [`driver timeline route ${index} starts before report`]
      : []),
    ...(end !== null && left !== null && left > end
      ? [`driver timeline route ${index} ends after report`]
      : []),
  ];
};

const routeIdentityIssues = (
  routes: readonly DriverTimelineRoute[],
  groups: readonly RouteGroup[],
): readonly string[] => {
  const matches = routes.map((route, index) => ({
    index,
    route: route.route,
    groups: groups.filter((group) => group.aliases.includes(route.route)),
  }));
  const matchedKeys = matches.flatMap(({ groups: matched }) =>
    matched.length === 1 ? [matched[0]?.key ?? ""] : [],
  );
  const duplicateKeys = unique(
    matchedKeys.filter((key, index) => matchedKeys.indexOf(key) !== index),
  );
  return [
    ...matches.flatMap(({ index, route, groups: matched }) =>
      matched.length === 0
        ? [`driver timeline route ${index} is unknown: ${route}`]
        : matched.length > 1
          ? [`driver timeline route ${index} is ambiguous: ${route}`]
          : [],
    ),
    ...duplicateKeys.map((key) => `duplicate driver timeline route ${key}`),
    ...groups
      .filter(({ key }) => !matchedKeys.includes(key))
      .map(({ key }) => `missing driver timeline route ${key}`),
  ];
};

const routeSequenceIssues = (
  routes: readonly DriverTimelineRoute[],
): readonly string[] =>
  routes.slice(1).flatMap((route, index) => {
    const previous = routes[index];
    if (!previous) return [];
    const previousEntered = toMillis(previous.enteredAt);
    const previousLeft = toMillis(previous.leftAt);
    const entered = toMillis(route.enteredAt);
    if (previousEntered === null || previousLeft === null || entered === null)
      return [];
    return [
      ...(entered < previousEntered
        ? [`driver timeline route ${index + 1} is out of order`]
        : []),
      ...(entered < previousLeft
        ? [`driver timeline routes ${index} and ${index + 1} overlap`]
        : []),
    ];
  });

export const driverTimelineIssues = (
  input: DriverTimelineInput,
): readonly string[] => {
  const start = toMillis(input.timeline.startedAt);
  const end = toMillis(input.timeline.endedAt);
  const groups = routeGroups(input.assignedCells);
  return [
    ...(start === null ? ["driver timeline startedAt is not parseable"] : []),
    ...(end === null ? ["driver timeline endedAt is not parseable"] : []),
    ...(start !== null && end !== null && start > end
      ? ["driver timeline endedAt is before startedAt"]
      : []),
    ...input.timeline.routes.flatMap((route, index) =>
      intervalIssues(route, index, start, end),
    ),
    ...routeSequenceIssues(input.timeline.routes),
    ...routeIdentityIssues(input.timeline.routes, groups),
  ];
};
