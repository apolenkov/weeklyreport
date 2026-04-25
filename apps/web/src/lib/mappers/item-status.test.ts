import { describe, expect, it } from 'vitest';

import {
  deriveItemStatus,
  itemStatusToWorkflow,
  workflowToItemStatus,
} from './item-status';

describe('workflowToItemStatus', () => {
  it("maps 'done' to 'completed'", () => {
    expect(workflowToItemStatus('done')).toBe('completed');
  });

  it("maps 'in_progress' to 'in-progress'", () => {
    expect(workflowToItemStatus('in_progress')).toBe('in-progress');
  });

  it("maps 'blocked' to 'blocked'", () => {
    expect(workflowToItemStatus('blocked')).toBe('blocked');
  });
});

describe('itemStatusToWorkflow', () => {
  it("maps 'completed' to 'done'", () => {
    expect(itemStatusToWorkflow('completed')).toBe('done');
  });

  it("maps 'in-progress' to 'in_progress'", () => {
    expect(itemStatusToWorkflow('in-progress')).toBe('in_progress');
  });

  it("maps 'blocked' to 'blocked'", () => {
    expect(itemStatusToWorkflow('blocked')).toBe('blocked');
  });
});

describe('deriveItemStatus', () => {
  it("returns 'completed' for current item with workflowStatus 'done'", () => {
    expect(
      deriveItemStatus({ workflowStatus: 'done', type: 'current' }),
    ).toBe('completed');
  });

  it("returns 'in-progress' for next item with workflowStatus 'in_progress'", () => {
    expect(
      deriveItemStatus({ workflowStatus: 'in_progress', type: 'next' }),
    ).toBe('in-progress');
  });

  it("computes 'planned' for a next-week item with no workflowStatus", () => {
    expect(
      deriveItemStatus({ workflowStatus: null, type: 'next' }),
    ).toBe('planned');
  });

  it("returns 'blocked' for next-week item with explicit 'blocked' workflowStatus (overrides type)", () => {
    expect(
      deriveItemStatus({ workflowStatus: 'blocked', type: 'next' }),
    ).toBe('blocked');
  });

  it("returns 'in-progress' for current-week item with no workflowStatus", () => {
    expect(
      deriveItemStatus({ workflowStatus: null, type: 'current' }),
    ).toBe('in-progress');
  });

  it("returns 'completed' for next-week item with workflowStatus 'done'", () => {
    expect(
      deriveItemStatus({ workflowStatus: 'done', type: 'next' }),
    ).toBe('completed');
  });
});
