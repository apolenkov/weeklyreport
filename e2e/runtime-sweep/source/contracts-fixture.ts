const SOURCE_SHA_LENGTH = 40;
const DIGEST_LENGTH = 64;

export const manifest = {
  campaignId: "campaign",
  sourceSha: "a".repeat(SOURCE_SHA_LENGTH),
  sourceTree: "b".repeat(SOURCE_SHA_LENGTH),
  treeDigest: "b".repeat(DIGEST_LENGTH),
  browser: "chromium",
  viewport: { browser: "chromium", width: 1440, height: 900 },
  roles: ["lead", "head", "admin", "viewer"],
  routes: [
    {
      role: "lead",
      catalogRoute: "/lead",
      resolvedRoute: "/lead",
      landingRoute: "/lead",
      networkPolicy: null,
    },
    {
      role: "head",
      catalogRoute: "/head",
      resolvedRoute: "/head",
      landingRoute: "/head",
      networkPolicy: null,
    },
    {
      role: "admin",
      catalogRoute: "/admin",
      resolvedRoute: "/admin",
      landingRoute: "/admin",
      networkPolicy: null,
    },
    {
      role: "viewer",
      catalogRoute: "/reports",
      resolvedRoute: "/reports",
      landingRoute: "/reports",
      networkPolicy: null,
    },
  ],
  profiles: ["minimal", "demo", "full", "stress"],
  seedProfiles: ["minimal", "demo", "full", "stress"].map((profile) => ({
    profile,
    definition: {
      purpose: "fixture",
      capabilities: ["canonical-identities"],
      stableIds: { activeReport: "report" },
      counts: {
        users: { min: 1, max: 1 },
        projects: { min: 1, max: 1 },
        reports: { min: 1, max: 1 },
        sections: { min: 1, max: 1 },
        items: { min: 1, max: 1 },
      },
    },
    digest: "f".repeat(DIGEST_LENGTH),
  })),
  stateKinds: ["nominal", "boundary", "lifecycle", "permission", "fault"],
  actions: [
    {
      controlKey: "open",
      operation: "click",
      safety: "read-only",
      transition: "open",
    },
  ],
  toolVersions: { node: "26.0.0" },
  catalogDigest: "c".repeat(DIGEST_LENGTH),
  domainSpecDigest: "d".repeat(DIGEST_LENGTH),
  matrixDeclaration: {
    generatorSeed: "fixture",
    axes: {
      role: ["lead"],
      route: ["/lead"],
      profileCapability: ["canonical-identities"],
      lifecycle: ["open"],
      submission: ["draft"],
      ownershipDensity: ["single"],
      permission: ["allowed"],
      fault: ["none"],
      controlTransition: ["none"],
    },
    constraints: [],
  },
  matrixDigest: "e".repeat(DIGEST_LENGTH),
  exclusions: [
    {
      id: "firefox",
      scope: "browser",
      target: "firefox",
      reason: "fixture",
    },
    { id: "webkit", scope: "browser", target: "webkit", reason: "fixture" },
    {
      id: "mobile",
      scope: "viewport",
      target: "mobile",
      reason: "fixture",
    },
    {
      id: "tablet",
      scope: "viewport",
      target: "tablet",
      reason: "fixture",
    },
  ],
};
