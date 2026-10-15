# Proposal

## Why

When embedding preparation fails during an AI provider activation, the audit
event `ai_provider.activation_failed` carries no reason (C0882, TASK-503.13).
The thrown error is dropped, so an operator cannot tell an exception from an
incomplete run. Recording the exception's name or message is unsafe: both are
caller-controlled strings that can hold an endpoint URL or a secret.

## What Changes

- `ai_provider.activation_failed` from the preparation path carries a closed
  `cause`: `preparation_exception` when preparation throws, and
  `preparation_incomplete` when it returns failed or missing vectors.
- Raw exception name, message, stack and cause are never recorded.
- Narrower causes (timeout, authentication, transport) are out of scope: the
  same `try` also covers completion and progress accounting, and no adapter
  contract proves them.

## Capabilities

### Modified Capabilities

- `ai-provider-configuration`: the failed-activation audit records a closed
  preparation cause.

## Impact

`ai-provider.activation-service.ts`, `ai-provider.activation-preparation.ts` and
the owning service test. The audit sink type already accepts string fields.
The cause is an audit category only; this change does not show a reason in the
administrator interface. Advisor input: Astra, 2026-10-15
(`advisor/astra/ANSWER-1743-ttys009.md`).
