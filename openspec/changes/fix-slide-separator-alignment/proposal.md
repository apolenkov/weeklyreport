# Fix slide separator alignment

## Problem

Product separators (visual dividers between product sections on the status slide
view) render at inconsistent vertical positions, creating a disjointed visual
layout that confuses the user eye flow.

## Solution

Inspect the slide rendering logic and unify separator positioning to a consistent
baseline (either top-aligned with product title or center-aligned per product
group). Apply consistent margin or grid logic across all product groups.

## Non-goals

- Redesign the separator visual style or color.
- Change the product grouping or filtering logic.
- Add new product columns or reorder sections.

## Source

User report: "разделители для каждого продукта, они в разном месте."
Phase 61+ visual polish task.

## Activation trigger

(Active — blocking visual polish.)
