import type { Cookie, Page } from "@playwright/test";
import { type Mock, vi } from "vitest";

import type { RuntimeDatabaseSnapshot } from "../../support/state-oracle.ts";
import type {
  OwnershipStateMutation,
  ReportStateMutation,
  RuntimeMutationSentinel,
  RuntimeStateDatabase,
  RuntimeStateTransaction,
  SectionStateMutation,
} from "../../support/state-preparation.ts";

const NO_SNAPSHOT = "Test database has no prepared snapshot";

export const hiddenMutationSentinel = [
  {
    id: "hidden-mutation",
    userId: "lead-1",
    role: "lead",
    procedure: "reports.hiddenMutation",
    targetId: "report-1",
    status: "success",
    reason: null,
    ip: null,
    correlationId: "hidden-mutation-correlation",
    durationMs: 1,
    createdAt: "2026-08-13T00:00:00.000Z",
  },
] as const satisfies RuntimeMutationSentinel;

export type PreflightRuntimeSetupTestMocks = Readonly<{
  readonly reseed: Mock;
  readonly login: Mock;
  readonly clearStorage: Mock;
  readonly drain: Mock;
  readonly createDatabase: Mock;
}>;

export type PreflightRuntimeSetupTestHarness = Readonly<{
  readonly database: RuntimeStateDatabase;
  readonly pageContext: {
    readonly clearCookies: Mock;
    readonly cookies: Mock;
    readonly addCookies: Mock;
  };
  readonly reset: () => void;
  readonly setSectionVersion: (version: number) => void;
  readonly setOwners: (owners: readonly string[]) => void;
  readonly setAssignmentStage: (stageId: string) => void;
  readonly setMutationSentinel: (sentinel: RuntimeMutationSentinel) => void;
  readonly preparationWrites: number;
  readonly getPage: () => Readonly<{
    readonly page: Page;
    readonly setUrl: (url: string) => void;
  }>;
}>;

interface MutableHarnessState {
  currentSnapshot: RuntimeDatabaseSnapshot | undefined;
  activeCookies: readonly Cookie[];
  mutationSentinel: RuntimeMutationSentinel;
  preparationWrites: number;
}

interface TransactionChanges {
  report: ReportStateMutation | undefined;
  section: SectionStateMutation | undefined;
  ownership: OwnershipStateMutation | undefined;
}

const createHarnessState = (): MutableHarnessState => ({
  currentSnapshot: undefined,
  activeCookies: [],
  mutationSentinel: [],
  preparationWrites: 0,
});

const createDatabase = (state: MutableHarnessState): RuntimeStateDatabase => ({
  transaction: (work) => {
    const changes: TransactionChanges = {
      report: undefined,
      section: undefined,
      ownership: undefined,
    };
    const transaction: RuntimeStateTransaction = {
      updateReport: (mutation) => {
        changes.report = mutation;
        state.preparationWrites += 1;
        return Promise.resolve();
      },
      updateSection: (mutation) => {
        changes.section = mutation;
        return Promise.resolve();
      },
      replaceOwnership: (mutation) => {
        changes.ownership = mutation;
        return Promise.resolve();
      },
      readSnapshot: (targets, permission) => {
        if (
          changes.report !== undefined &&
          changes.section !== undefined &&
          changes.ownership !== undefined
        ) {
          state.currentSnapshot = {
            report: {
              status: changes.report.status,
              periodState: changes.report.periodState,
              periodStatus: changes.report.periodStatus,
              archived: changes.report.archived,
            },
            section: { ...changes.section.state, version: 1 },
            ownership: {
              targetOwnerId: targets.ownerId,
              owners: changes.ownership.assignments.map(({ userId }) => userId),
              assignments: changes.ownership.assignments.map(
                ({ stageId, userId }) => ({
                  id: `assignment-${stageId}`,
                  stageId,
                  userId,
                }),
              ),
            },
            permission: {
              actorId: permission.actorId,
              actorRole: permission.actorId === null ? null : "lead",
              authenticated: permission.actorId !== null,
              allowed: permission.boundary === "allowed",
              ownsTarget: permission.actorId === targets.ownerId,
            },
          };
        }
        if (state.currentSnapshot === undefined) throw new Error(NO_SNAPSHOT);
        return Promise.resolve(state.currentSnapshot);
      },
      readMutationSentinel: () => Promise.resolve(state.mutationSentinel),
      readViewerGroupAccess: () => Promise.resolve([]),
      removeViewerGroupAccess: () => Promise.resolve(0),
    };
    return work(transaction);
  },
});

const createPageContext = (state: MutableHarnessState) => ({
  clearCookies: vi.fn(() => {
    state.activeCookies = [];
    return Promise.resolve();
  }),
  cookies: vi.fn(() => Promise.resolve(state.activeCookies)),
  addCookies: vi.fn((cookies: readonly Cookie[]) => {
    state.activeCookies = [...cookies];
    return Promise.resolve();
  }),
});

const configureMocks = (
  mocks: PreflightRuntimeSetupTestMocks,
  database: RuntimeStateDatabase,
): void => {
  mocks.createDatabase.mockReturnValue(database);
  mocks.clearStorage.mockImplementation(() => Promise.resolve());
  mocks.drain.mockImplementation(() => Promise.resolve());
  mocks.login.mockImplementation((page: unknown) => {
    const context = (
      page as {
        context: () => {
          addCookies: (cookies: readonly Cookie[]) => Promise<void>;
        };
      }
    ).context();
    return context.addCookies([
      {
        name: "customreport_session",
        value: "session-lead",
        domain: "127.0.0.1",
        path: "/",
        expires: -1,
        httpOnly: true,
        secure: false,
        sameSite: "Lax",
      },
    ]);
  });
};

const setSectionVersion = (
  state: MutableHarnessState,
  version: number,
): void => {
  if (state.currentSnapshot === undefined) throw new Error(NO_SNAPSHOT);
  state.currentSnapshot = {
    ...state.currentSnapshot,
    section: { ...state.currentSnapshot.section, version },
  };
};

const setOwners = (
  state: MutableHarnessState,
  owners: readonly string[],
): void => {
  if (state.currentSnapshot === undefined) throw new Error(NO_SNAPSHOT);
  const assignments = owners.map((userId, index) => {
    const current = state.currentSnapshot?.ownership.assignments[index];
    return {
      id: current?.id ?? `assignment-${index}`,
      stageId: current?.stageId ?? `stage-${index}`,
      userId,
    };
  });
  state.currentSnapshot = {
    ...state.currentSnapshot,
    ownership: { ...state.currentSnapshot.ownership, owners, assignments },
  };
};

const setAssignmentStage = (
  state: MutableHarnessState,
  stageId: string,
): void => {
  if (state.currentSnapshot === undefined) throw new Error(NO_SNAPSHOT);
  const assignment = state.currentSnapshot.ownership.assignments[0];
  if (assignment === undefined)
    throw new Error("Test database has no prepared assignment");
  const assignments = [
    { ...assignment, stageId },
    ...state.currentSnapshot.ownership.assignments.slice(1),
  ];
  state.currentSnapshot = {
    ...state.currentSnapshot,
    ownership: { ...state.currentSnapshot.ownership, assignments },
  };
};

export const createPreflightRuntimeSetupTestHarness = (
  mocks: PreflightRuntimeSetupTestMocks,
): PreflightRuntimeSetupTestHarness => {
  const state = createHarnessState();
  const database = createDatabase(state);
  const pageContext = createPageContext(state);
  configureMocks(mocks, database);
  const reset = (): void => {
    state.currentSnapshot = undefined;
    state.activeCookies = [];
    state.mutationSentinel = [];
    state.preparationWrites = 0;
    mocks.reseed.mockClear();
    mocks.login.mockClear();
    mocks.clearStorage.mockClear();
    mocks.drain.mockClear();
    mocks.createDatabase.mockClear();
  };
  return {
    database,
    pageContext,
    reset,
    setSectionVersion: (version) => setSectionVersion(state, version),
    setOwners: (owners) => setOwners(state, owners),
    setAssignmentStage: (stageId) => setAssignmentStage(state, stageId),
    setMutationSentinel(sentinel) {
      state.mutationSentinel = sentinel;
    },
    get preparationWrites() {
      return state.preparationWrites;
    },
    getPage() {
      const pageState = { url: "http://127.0.0.1:3000/lead/report" };
      const page = {
        context: () => pageContext,
        url: () => pageState.url,
        goto: vi.fn(() => {
          pageState.url = "about:blank";
          return Promise.resolve();
        }),
      } as unknown as Page;
      return {
        page,
        setUrl(nextUrl: string) {
          pageState.url = nextUrl;
        },
      };
    },
  };
};
