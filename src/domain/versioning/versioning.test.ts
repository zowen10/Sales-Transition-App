import { describe, expect, it } from 'vitest';
import { assertPlanVersionTransition, canTransitionPlanVersion, isPlanVersionEditable, isPlanVersionLocked } from './stateMachine';
import { buildChildVersionDraft, compareScenarios, nextVersionNumber, versionsToUnrecommend } from './service';
import type { PlanVersionSummary } from './types';

describe('plan version state machine', () => {
  it('follows the required lifecycle', () => {
    expect(canTransitionPlanVersion('DRAFT', 'IN_PROGRESS')).toBe(true);
    expect(canTransitionPlanVersion('IN_PROGRESS', 'READY_FOR_REVIEW')).toBe(true);
    expect(canTransitionPlanVersion('READY_FOR_REVIEW', 'CHANGES_REQUESTED')).toBe(true);
    expect(canTransitionPlanVersion('CHANGES_REQUESTED', 'IN_PROGRESS')).toBe(true);
    expect(canTransitionPlanVersion('READY_FOR_REVIEW', 'APPROVED')).toBe(true);
    expect(canTransitionPlanVersion('APPROVED', 'SUPERSEDED')).toBe(true);
    expect(canTransitionPlanVersion('SUPERSEDED', 'ARCHIVED')).toBe(true);
  });

  it('rejects illegal transitions, e.g. draft straight to approved', () => {
    expect(canTransitionPlanVersion('DRAFT', 'APPROVED')).toBe(false);
    expect(() => assertPlanVersionTransition('DRAFT', 'APPROVED')).toThrow();
  });

  it('rejects transitions out of a terminal Archived state', () => {
    expect(canTransitionPlanVersion('ARCHIVED', 'DRAFT')).toBe(false);
  });

  it('locks approved, superseded, and archived versions', () => {
    expect(isPlanVersionLocked('APPROVED')).toBe(true);
    expect(isPlanVersionLocked('SUPERSEDED')).toBe(true);
    expect(isPlanVersionLocked('ARCHIVED')).toBe(true);
    expect(isPlanVersionEditable('APPROVED')).toBe(false);
    expect(isPlanVersionEditable('IN_PROGRESS')).toBe(true);
  });
});

describe('scenario cloning and comparison', () => {
  it('computes the next version number from existing versions', () => {
    expect(nextVersionNumber([])).toBe(1);
    expect(nextVersionNumber([1, 2, 4])).toBe(5);
  });

  it('builds a child draft linked to its parent, never mutating the parent', () => {
    const draft = buildChildVersionDraft({ id: 'pv1', transitionId: 't1' }, [1], 'Accelerated schedule');
    expect(draft).toEqual({
      transitionId: 't1',
      parentVersionId: 'pv1',
      versionNumber: 2,
      scenarioName: 'Accelerated schedule',
      status: 'DRAFT',
    });
  });

  it('computes deltas and surfaces newly introduced risks', () => {
    const parent: PlanVersionSummary = {
      id: 'pv1',
      transitionId: 't1',
      versionNumber: 1,
      parentVersionId: null,
      scenarioName: 'Baseline',
      status: 'DRAFT',
      recommended: true,
      totalHours: 5416,
      totalInvestment: 1326920,
      calendarWeeks: 28,
      peakWeeklyBurnHours: 250,
      risks: [{ id: 'r1', description: 'Client SME availability is unconfirmed.' }],
      createdAt: '2027-01-01T00:00:00.000Z',
    };
    const scenario: PlanVersionSummary = {
      ...parent,
      id: 'pv2',
      versionNumber: 2,
      parentVersionId: 'pv1',
      scenarioName: 'Accelerated schedule',
      recommended: false,
      totalHours: 5800,
      totalInvestment: 1421000,
      calendarWeeks: 22,
      peakWeeklyBurnHours: 310,
      risks: [
        { id: 'r1', description: 'Client SME availability is unconfirmed.' },
        { id: 'r2', description: 'Compressed schedule increases integration testing risk.' },
      ],
      createdAt: '2027-01-05T00:00:00.000Z',
    };

    const comparison = compareScenarios(parent, scenario, { designWeeks: { from: 9, to: 6 } }, 'jane@example.com');
    expect(comparison.hoursDelta).toBe(384);
    expect(comparison.investmentDelta).toBe(94080);
    expect(comparison.scheduleDeltaWeeks).toBe(-6);
    expect(comparison.peakWeeklyBurnDelta).toBe(60);
    expect(comparison.newOrChangedRisks).toEqual(['Compressed schedule increases integration testing risk.']);
  });

  it('ensures only one plan version is recommended at a time', () => {
    const versions = [
      { id: 'pv1', recommended: true },
      { id: 'pv2', recommended: false },
      { id: 'pv3', recommended: true },
    ];
    expect(versionsToUnrecommend(versions, 'pv2')).toEqual(expect.arrayContaining(['pv1', 'pv3']));
    expect(versionsToUnrecommend(versions, 'pv1')).toEqual(['pv3']);
  });
});
