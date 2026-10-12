# Design

## Context

See proposal.md and external c4776-scope-red-plan.md. The Git-base renderer recognizes only h1–h3; the transferred Pi patch adds h4–h6 but repeats identical rendering blocks and lacks genuine old-product RED and a change artifact.

## Goals / Non-Goals

Complete the existing heading preservation contract with two scoped source/test files. Do not broaden the Markdown grammar or change provider, retrieval, answer validation, UI/data policy or accessibility claims.

## Decisions

Retain longest-prefix parser recognition and native tag types through h6. Preserve the existing special h1/h2 class treatments. After those cases, use the recognized h3–h6 tag as one dynamic native Heading with the existing h3 class treatment. This removes repeated render blocks without a new helper API or component abstraction.

Convert the existing heading/list regression to public Chat cases for h4, h5 and h6: accepted shared response → mocked mutation → live assistant store/dialog/content → renderer. h1/h2/h3 and two semantic bullets are controls. Exact Git-base producer plus the extended test must fail for missing original heading levels; corrected producer must pass the same command. Record direct exits without a tail pipeline.

## Risks / Trade-offs

DOM heading semantics do not establish native screen-reader or narrow-viewport acceptance; Root owns those checks. Existing untrusted answer handling remains React text rendering. No runtime/schema/dependency change or database migration is needed. Lifecycle, authorization and report persistence are untouched. Rollback restores the two scoped files together; historical Pi artifacts remain external evidence.
