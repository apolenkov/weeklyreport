# Tasks

- [x] 1. Spec delta for `authenticated-product-feedback` (storage mapping validates domain enums).
- [x] 2. RED unit test `product-feedback.prisma-support.test.ts`: a row with an unknown `type` and a row with an unknown `status` each make `mapFeedback` throw `FeedbackInvalidStatusError`; a valid row maps unchanged.
- [x] 3. Repair: `mapFeedback` validates `type` and `status` with the shared enum schemas before it builds the record.
- [ ] 4. Six repository gates on the reviewed tree and independent review.
