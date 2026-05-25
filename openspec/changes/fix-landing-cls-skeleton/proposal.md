# Fix landing page CLS with role-badge skeleton

## Problem

The landing page jumps (CLS — Cumulative Layout Shift) when the
last-logged-in role badge loads. The page renders without the badge, then
inserts it after the auth context hydrates, causing visible reflow.

## Solution

Add a fixed-height skeleton placeholder for the role badge immediately on
page load. When auth hydrates and the badge value is available, swap the
skeleton for the real badge without layout shift.

## Non-goals

- Change auth hydration timing.
- Redesign the landing page layout.
