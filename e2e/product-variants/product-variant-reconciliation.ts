import { z } from "zod";

const HISTORICAL_VARIANT_COUNT = 86;
const CURRENT_ROLE_ROUTE_COUNT = 51;
const CURRENT_INTENT_COUNT = 163;
const CURRENT_VARIANT_COUNT = 77;
const SOURCE_SHA_PATTERN = /^[0-9a-f]{40}$/u;
const DIGEST_PATTERN = /^[0-9a-f]{64}$/u;
const digestSchema = z.string().regex(DIGEST_PATTERN);
const shaSchema = z.string().regex(SOURCE_SHA_PATTERN);

export const HISTORICAL_RECONCILIATION_VARIANT_IDS = [
  "R01",
  "R08",
  "R09",
  "R10",
  "R11",
  "R12",
  "R13",
  "R14",
  "R15",
  "R16",
  "R17",
  "R19",
  "R22",
  "R23",
  "R24",
  "R36",
  "R37",
  "R42",
  "R46",
  "R47",
  "R48",
  "R50",
  "R56",
  "R57",
  "R65",
  "R68",
  "C03",
  "C10",
  "C14",
  "C50",
  "C51",
  "C52",
  "C53",
  "C54",
  "C55",
  "R02",
  "R20",
  "R21",
  "R25",
  "R26",
  "R28",
  "R39",
  "R55",
  "C01",
  "C04",
  "C05",
  "C07",
  "C09",
  "C11",
  "C12",
  "C15",
  "C16",
  "C19",
  "C21",
  "C24",
  "C25",
  "C27",
  "C32",
  "C42",
  "C45",
  "C47",
  "C56",
  "C57",
  "C64",
  "C66",
  "C67",
  "C68",
  "R30",
  "R38",
  "R41",
  "R43",
  "R51",
  "R52",
  "R58",
  "R61",
  "C20",
  "C23",
  "C29",
  "C34",
  "C36",
  "C48",
  "C63",
  "C65",
  "R53",
  "C39",
  "C69",
] as const;

export const HISTORICAL_RECONCILIATION = {
  status: "PENDING_RECONCILIATION",
  historicalInventory: {
    count: HISTORICAL_VARIANT_COUNT,
    variantIds: HISTORICAL_RECONCILIATION_VARIANT_IDS,
  },
  currentInventory: {
    roleRouteCount: CURRENT_ROLE_ROUTE_COUNT,
    intentCount: CURRENT_INTENT_COUNT,
    variantCount: CURRENT_VARIANT_COUNT,
  },
  source: {
    sourceSha: "765d88da77995d7acea21b9d4977b05d0375d612",
    sourceTree: "961b185a092fdbeba979ee64636d95e3dad79693",
    acceptanceDocument: {
      name: "MVP-VISUAL-ACCEPTANCE.md",
      sha256:
        "6cd78672b6ee8683b0be0ee06c041ee81e62408926dbcd098a258ff86d3256e0",
    },
    atlasArtifact: {
      name: "MVP-ATLAS.json",
      sha256:
        "313756c2a9b7a2a484942d4c02cf7a8bad8c6f78c8c6ae7d34c7aa5902eabf52",
    },
    displayMatrix: {
      name: "DISPLAY-VARIANT-MATRIX.md",
      sha256:
        "0a00dd3561ee72935d705f5d061e7b74cb27a7963d1906ce9d5e3a1f16293720",
    },
    closureEvidence: {
      name: "MVP-DEFERRED-CLOSURE-EVIDENCE.json",
      sha256:
        "64ce56037e69e33cd0537a3026ddcdc6d44309718252f969010a024864da31c9",
    },
  },
  mapping: {
    status: "UNRESOLVED",
    oneToOneMapping: "NOT_ESTABLISHED",
    obligation:
      "Reconcile historical 86 material IDs against the current 77 generated variants before product acceptance.",
  },
} as const;

export const historicalReconciliationSchema = z
  .object({
    status: z.literal("PENDING_RECONCILIATION"),
    historicalInventory: z
      .object({
        count: z.literal(HISTORICAL_VARIANT_COUNT),
        variantIds: z
          .array(z.string().regex(/^[RC]\d{2}$/u))
          .length(HISTORICAL_VARIANT_COUNT)
          .readonly(),
      })
      .strict(),
    currentInventory: z
      .object({
        roleRouteCount: z.literal(CURRENT_ROLE_ROUTE_COUNT),
        intentCount: z.literal(CURRENT_INTENT_COUNT),
        variantCount: z.literal(CURRENT_VARIANT_COUNT),
      })
      .strict(),
    source: z
      .object({
        sourceSha: shaSchema,
        sourceTree: shaSchema,
        acceptanceDocument: z
          .object({
            name: z.literal("MVP-VISUAL-ACCEPTANCE.md"),
            sha256: digestSchema,
          })
          .strict(),
        atlasArtifact: z
          .object({ name: z.literal("MVP-ATLAS.json"), sha256: digestSchema })
          .strict(),
        displayMatrix: z
          .object({
            name: z.literal("DISPLAY-VARIANT-MATRIX.md"),
            sha256: digestSchema,
          })
          .strict(),
        closureEvidence: z
          .object({
            name: z.literal("MVP-DEFERRED-CLOSURE-EVIDENCE.json"),
            sha256: digestSchema,
          })
          .strict(),
      })
      .strict(),
    mapping: z
      .object({
        status: z.literal("UNRESOLVED"),
        oneToOneMapping: z.literal("NOT_ESTABLISHED"),
        obligation: z.literal(
          "Reconcile historical 86 material IDs against the current 77 generated variants before product acceptance.",
        ),
      })
      .strict(),
  })
  .strict();
