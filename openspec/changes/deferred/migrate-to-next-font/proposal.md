# Migrate to next/font for self-hosted fonts

## Problem

Currently, three Google Font families are imported via `<link>` tags in
`apps/web/src/app/layout.tsx:35`, causing external requests and render
blocking. Font subsetting and self-hosting are left to the browser.

## Solution

Migrate to `next/font` (Geist Sans, Geist Mono, and the third family) with
self-hosted, pre-subsetted variants. This reduces external requests,
improves Core Web Vitals, and allows fine-grained font optimization per
route.

## Non-goals

- Change the visual appearance or font weights.
- Add new fonts.
