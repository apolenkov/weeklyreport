# Feedback discriminator

On base `09f26e2c6`, the old discriminator appeared in the shared response
schema and the [closed-ingress requirement](../../specs/authenticated-product-feedback/spec.md).
The legacy Prisma repository listed and updated `weekly-report` rows and mapped
them to the same product. Agentation wrote and scoped sessions to `weekly-report`
and projected that product into inbox responses. Migrations, seeds, fixtures
and end-to-end setup neither wrote nor returned the reserved value.

The response schema now reserves `external-product` for a future contract.
Both existing feedback paths keep their `weekly-report` scope.
