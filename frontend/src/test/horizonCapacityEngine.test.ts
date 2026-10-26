import { describe, it, expect, beforeEach } from 'vitest';
import {
  calculateHorizonCountdown,
  evaluateAdaptiveCapacity,
  updateDeadlineTimestamp
} from '../utils/horizonCapacityEngine';

describe('Horizon & Capacity Engine', () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  it('initializes persistent deadline timestamp and counts down calendar days', () => {
    const roleId = 'test_role_1';
    const countdown = calculateHorizonCountdown(roleId, 14, false);

    expect(countdown.isCompleted).toBe(false);
    expect(countdown.isExpired).toBe(false);
    expect(countdown.daysRemaining).toBe(14);
    expect(countdown.statusLabel).toContain('14 days left');
  });

  it('marks horizon as completed with 0 days needed when all tasks are complete', () => {
    const roleId = 'test_role_completed';
    const countdown = calculateHorizonCountdown(roleId, 14, true);

    expect(countdown.isCompleted).toBe(true);
    expect(countdown.daysRemaining).toBe(0);
    expect(countdown.statusLabel).toBe('All Tasks Completed! 🎉');
  });

  it('accurately counts down as real days pass towards deadline', () => {
    const roleId = 'test_role_past';
    // Simulate deadline set 3 days in the past (11 days remaining out of 14)
    const futureTarget = Date.now() + (11 * 24 * 60 * 60 * 1000) - 1000;
    window.localStorage.setItem(`skillbridge_deadline_target_${roleId}`, String(futureTarget));

    const countdown = calculateHorizonCountdown(roleId, 14, false);
    expect(countdown.daysRemaining).toBe(11);
    expect(countdown.statusLabel).toContain('11 days left');
  });

  it('recognizes when deadline is reached', () => {
    const roleId = 'test_role_expired';
    // Target date set in past
    window.localStorage.setItem(`skillbridge_deadline_target_${roleId}`, String(Date.now() - 5000));

    const countdown = calculateHorizonCountdown(roleId, 14, false);
    expect(countdown.daysRemaining).toBe(0);
    expect(countdown.isExpired).toBe(true);
    expect(countdown.statusLabel).toBe('Deadline Reached Today');
  });

  it('updates deadline timestamp when user changes days slider', () => {
    const roleId = 'test_role_update';
    updateDeadlineTimestamp(roleId, 21);

    const countdown = calculateHorizonCountdown(roleId, 21, false);
    expect(countdown.daysRemaining).toBe(21);
  });

  it('recognizes capacity shortfall when remaining effort is high over short horizon', () => {
    // 28 hours remaining over 7 days = 4h/day = 28 hrs/week, but user only has 14 hrs/week
    const capacity = evaluateAdaptiveCapacity(28, 7, 14, false);

    expect(capacity.capacityStatus).toBe('increase_needed');
    expect(capacity.recommendedWeeklyHours).toBe(28);
    expect(capacity.recommendedDailyHours).toBe(4);
    expect(capacity.adjustmentDelta).toBe(14);
    expect(capacity.message).toContain('Capacity shortfall');
  });

  it('recognizes when user is ahead of schedule and capacity can be relaxed', () => {
    // 4 hours remaining over 14 days = 0.3h/day = 2 hrs/week, but user planned 14 hrs/week
    const capacity = evaluateAdaptiveCapacity(4, 14, 14, false);

    expect(capacity.capacityStatus).toBe('ahead_of_schedule');
    expect(capacity.message).toContain('Ahead of schedule');
  });

  it('recognizes zero capacity needed when all tasks are complete', () => {
    const capacity = evaluateAdaptiveCapacity(0, 14, 14, true);

    expect(capacity.capacityStatus).toBe('completed');
    expect(capacity.recommendedWeeklyHours).toBe(0);
    expect(capacity.message).toContain('All tasks completed');
  });
});
