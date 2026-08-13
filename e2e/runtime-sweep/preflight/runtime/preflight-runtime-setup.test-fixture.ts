import type { Cookie, Page } from "@playwright/test";
import { type Mock, vi } from "vitest";

import type { RuntimeDatabaseSnapshot } from "../../support/state-oracle.ts";
import type {
  OwnershipStateMutation,
  ReportStateMutation,
  RuntimeStateDatabase,
  RuntimeStateTransaction,
  SectionStateMutation,
} from "../../support/state-preparation.ts";

const NO_SNAPSHOT = "Test database has no prepared snapshot";

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
  readonly preparationWrites: number;
  readonly getPage: () => Readonly<{
    readonly page: Page;
    readonly setUrl: (url: string) => void;
  }>;
}>;

interface MutableHarnessState {
  currentSnapshot: RuntimeDatabaseSnapshot | undefined;
  activeCookies: readonly Cookie[];
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
      readMutationSentinel: () => Promise.resolve([]),
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
    setSectionVersion(version) {
      if (state.currentSnapshot === undefined) throw new Error(NO_SNAPSHOT);
      state.currentSnapshot = {
        ...state.currentSnapshot,
        section: { ...state.currentSnapshot.section, version },
      };
    },
    setOwners(owners) {
      if (state.currentSnapshot === undefined) throw new Error(NO_SNAPSHOT);
      state.currentSnapshot = {
        ...state.currentSnapshot,
        ownership: { ...state.currentSnapshot.ownership, owners },
      };
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
