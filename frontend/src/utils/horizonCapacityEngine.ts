/**
 * Horizon & Capacity Engine for SkillBridge AI
 *
 * Handles:
 * 1. Horizon Countdown: Counts down calendar days towards the target deadline,
 *    and recognizes when all tasks are completed (halting countdown at goal achievement).
 * 2. Adaptive Capacity: Recognizes when available study capacity needs to change based on
 *    remaining effort vs remaining days, providing adaptive suggestions.
 */

export interface GoalTimelineState {
  initialDays: number;
  daysRemaining: number;
  deadlineTimestamp: number;
  isCompleted: boolean;
  isExpired: boolean;
  statusLabel: string;
}

export interface AdaptiveCapacityState {
  currentWeeklyHours: number;
  recommendedWeeklyHours: number;
  recommendedDailyHours: number;
  capacityStatus: 'completed' | 'optimal' | 'increase_needed' | 'ahead_of_schedule' | 'deadline_passed';
  message: string;
  adjustmentDelta: number; // Positive if increase needed, negative if user is ahead
}

/**
 * Get or initialize persistent deadline timestamp for a given goal/role.
 * Recomputes dynamically when initialDays changes (e.g., from 14 to 16 or 30 days).
 */
export function getOrCreateDeadlineTimestamp(roleId: string, initialDays: number): number {
  const targetKey = `skillbridge_deadline_target_${roleId}`;
  const daysKey = `skillbridge_deadline_days_${roleId}`;
  const now = Date.now();

  try {
    if (typeof window !== 'undefined' && window.localStorage) {
      const storedDays = window.localStorage.getItem(daysKey);
      const storedTarget = window.localStorage.getItem(targetKey);

      if (storedTarget) {
        const parsedTarget = parseInt(storedTarget, 10);
        const parsedDays = storedDays !== null ? parseInt(storedDays, 10) : initialDays;

        // If the configured base days have not changed, retain the target timestamp (even if elapsed/expired)
        if (parsedDays === initialDays && !isNaN(parsedTarget)) {
          return parsedTarget;
        }
      }

      // If initialDays changed (e.g. 14 -> 16) or no target exists, sync to new deadline
      const newTarget = now + initialDays * 24 * 60 * 60 * 1000;
      window.localStorage.setItem(targetKey, String(newTarget));
      window.localStorage.setItem(daysKey, String(initialDays));
      return newTarget;
    }
  } catch {}

  return now + initialDays * 24 * 60 * 60 * 1000;
}

/**
 * Resets or updates the deadline timestamp when user manually modifies the days
 */
export function updateDeadlineTimestamp(roleId: string, newDays: number): number {
  const targetKey = `skillbridge_deadline_target_${roleId}`;
  const daysKey = `skillbridge_deadline_days_${roleId}`;
  const newTarget = Date.now() + newDays * 24 * 60 * 60 * 1000;

  try {
    if (typeof window !== 'undefined' && window.localStorage) {
      window.localStorage.setItem(targetKey, String(newTarget));
      window.localStorage.setItem(daysKey, String(newDays));
    }
  } catch {}

  return newTarget;
}

/**
 * Calculates current countdown state towards deadline, taking task completion into account.
 */
export function calculateHorizonCountdown(
  roleId: string,
  baseDays: number,
  isAllTasksCompleted: boolean
): GoalTimelineState {
  if (isAllTasksCompleted) {
    return {
      initialDays: baseDays,
      daysRemaining: 0,
      deadlineTimestamp: Date.now(),
      isCompleted: true,
      isExpired: false,
      statusLabel: 'All Tasks Completed! 🎉'
    };
  }

  const deadlineTimestamp = getOrCreateDeadlineTimestamp(roleId, baseDays);
  const msRemaining = deadlineTimestamp - Date.now();
  const calculatedDays = Math.max(0, Math.ceil(msRemaining / (24 * 60 * 60 * 1000)));

  const isExpired = calculatedDays === 0;
  const statusLabel = isExpired
    ? 'Deadline Reached Today'
    : `${calculatedDays} day${calculatedDays === 1 ? '' : 's'} left`;

  return {
    initialDays: baseDays,
    daysRemaining: calculatedDays,
    deadlineTimestamp,
    isCompleted: false,
    isExpired,
    statusLabel
  };
}

/**
 * Evaluates study capacity and recognizes when capacity needs to change.
 */
export function evaluateAdaptiveCapacity(
  remainingEffortHours: number,
  daysRemaining: number,
  currentWeeklyHours: number,
  isAllTasksCompleted: boolean
): AdaptiveCapacityState {
  if (isAllTasksCompleted || remainingEffortHours <= 0) {
    return {
      currentWeeklyHours,
      recommendedWeeklyHours: 0,
      recommendedDailyHours: 0,
      capacityStatus: 'completed',
      message: 'All tasks completed! No additional study capacity required.',
      adjustmentDelta: -currentWeeklyHours
    };
  }

  if (daysRemaining <= 0) {
    return {
      currentWeeklyHours,
      recommendedWeeklyHours: currentWeeklyHours,
      recommendedDailyHours: Math.round((currentWeeklyHours / 7) * 10) / 10,
      capacityStatus: 'deadline_passed',
      message: `Deadline reached with ${remainingEffortHours} hrs remaining. Extend timeframe to rebalance study capacity.`,
      adjustmentDelta: 0
    };
  }

  const effectiveDays = Math.max(1, daysRemaining);
  const recommendedDaily = Number((remainingEffortHours / effectiveDays).toFixed(1));
  const recommendedWeekly = Math.max(2, Math.round(recommendedDaily * 7));
  const delta = recommendedWeekly - currentWeeklyHours;

  if (delta > 3) {
    // Capacity shortfall
    return {
      currentWeeklyHours,
      recommendedWeeklyHours: recommendedWeekly,
      recommendedDailyHours: recommendedDaily,
      capacityStatus: 'increase_needed',
      message: `Capacity shortfall: With ${daysRemaining}d left and ${remainingEffortHours}h remaining, recommended study is ${recommendedWeekly} hrs/wk (${recommendedDaily}h/day).`,
      adjustmentDelta: delta
    };
  }

  if (delta < -4 && remainingEffortHours < 12) {
    // User is well ahead of schedule
    return {
      currentWeeklyHours,
      recommendedWeeklyHours: recommendedWeekly,
      recommendedDailyHours: recommendedDaily,
      capacityStatus: 'ahead_of_schedule',
      message: `Ahead of schedule: Only ${remainingEffortHours}h needed over ${daysRemaining}d (~${recommendedWeekly} hrs/wk).`,
      adjustmentDelta: delta
    };
  }

  return {
    currentWeeklyHours,
    recommendedWeeklyHours: recommendedWeekly,
    recommendedDailyHours: recommendedDaily,
    capacityStatus: 'optimal',
    message: `Pacing is on track: ${currentWeeklyHours} hrs/wk comfortably accommodates the remaining ${remainingEffortHours}h.`,
    adjustmentDelta: 0
  };
}
