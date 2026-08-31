import { z } from "zod";

import {
  decisionReadModelSchema,
  itemReadModelSchema,
  riskReadModelSchema,
} from "./section-record.schema";

const publishedRecordIdentitySchema = {
  id: z.uuid(),
  stableId: z.uuid(),
};

/** Published item with immutable row and lineage identities. */
export const publishedItemReadModelSchema = itemReadModelSchema
  .unwrap()
  .safeExtend(publishedRecordIdentitySchema)
  .readonly();

/** Published risk with immutable row and lineage identities. */
export const publishedRiskReadModelSchema = riskReadModelSchema
  .unwrap()
  .safeExtend(publishedRecordIdentitySchema)
  .readonly();

/** Published decision with immutable row and lineage identities. */
export const publishedDecisionReadModelSchema = decisionReadModelSchema
  .unwrap()
  .safeExtend(publishedRecordIdentitySchema)
  .readonly();

/** Item record frozen into a publication snapshot. */
export type PublishedItemReadModel = z.infer<
  typeof publishedItemReadModelSchema
>;
/** Risk record frozen into a publication snapshot. */
export type PublishedRiskReadModel = z.infer<
  typeof publishedRiskReadModelSchema
>;
/** Decision record frozen into a publication snapshot. */
export type PublishedDecisionReadModel = z.infer<
  typeof publishedDecisionReadModelSchema
>;
