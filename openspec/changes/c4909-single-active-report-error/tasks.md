# Tasks

## 1. Contract

- [x] 1.1 One query failure is reported once per composed page (C4909).

## 2. Implementation

- [x] 2.1 Composed-consumer test: a failing `reports.getActive` on the lead status overview logs and toasts once.
- [x] 2.2 Remove the overview's duplicate `reports.getActive` handler; the editor owns it.
- [ ] 2.3 RED/GREEN run, gates and independent review.
