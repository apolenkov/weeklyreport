# Design

## Context

The landing reader is gated by webEnv.authStub. That accessor already folds the configured public toggle with NODE_ENV production refusal. SessionProvider's write effect currently ignores it.

## Goals / Non-Goals

Align the write owner with its sole current reader. Preserve session mapping, query/error/retry behavior and enabled dev resume. Do not add expiry, clear old data, move storage, infer production identity fallback or change authentication policy.

## Decisions

Read webEnv.authStub in the existing write effect guard; introduce no new predicate. Keep writeLastRole and last-role storage helpers unchanged. Existing unit mapping controls use the real QueryClient/transport boundary so this regression observes actual writes rather than an invented Query state.

## Risks / Trade-offs

Previously stored records are left untouched. Native logout/account-switch/shared-device behavior and bundled browser acceptance are not proved by jsdom. The local runtime toggles exercise the actual getter and source producer; they are not a production build.

## Validation

Before source edit, 7 controls passed and 3 negative persistence cases failed. Both production false/true flags wrote a record; dev-disabled also wrote. Controls require authenticated mapping, organization, pending/null, real retry and enabled dev retained hint. Root owns aggregate checks, native lanes and independent review.
