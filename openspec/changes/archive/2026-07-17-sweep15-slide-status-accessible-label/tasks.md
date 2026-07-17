## 1. Status presentation model

- [x] 1.1 Define an exhaustive slide product-status map from on-track/at-risk/blocked to distinct compact icons and English accessible labels
- [x] 1.2 Keep the no-status state outside the status map so it cannot receive a false icon or label

## 2. Slide article

- [x] 2.1 Render the shape-distinct icon and accessible status text beside each product name while retaining the existing left stripe
- [x] 2.2 Preserve the collapsed dashed no-status row and ensure it renders no stripe or status icon
- [x] 2.3 Verify the compact mark does not introduce title truncation or a large textual chip at the supported slide width

## 3. Tests

- [x] 3.1 Add render assertions for On Track, At Risk, and Blocked accessible names and distinct icon identities without testing color as the sole signal
- [x] 3.2 Add a no-status regression assertion for the existing English copy and absence of status icon/stripe

## 4. Repo gates

- [x] 4.1 `pnpm --filter @customreport/api db:generate`
- [x] 4.2 `pnpm typecheck`
- [x] 4.3 `pnpm lint`
- [x] 4.4 `pnpm test`
