import { useState } from 'react';
import {
  Briefcase,
  Target,
  Calendar,
  Clock,
  ChevronDown,
  Check,
  SlidersHorizontal,
  Plus,
  Sparkles,
  ExternalLink,
  ArrowRight
} from 'lucide-react';
import type { TargetRoleOption } from '../../services/mockSkillGapData';
import {
  calculateHorizonCountdown,
  evaluateAdaptiveCapacity,
  updateDeadlineTimestamp
} from '../../utils/horizonCapacityEngine';

interface RoleSelectorProps {
  roles: TargetRoleOption[];
  selectedRoleId: string;
  onSelectRole: (roleId: string) => void;
  daysRemaining: number;
  studyHoursPerWeek: number;
  onUpdateBudget: (days: number, hoursPerWeek: number) => void;
  activeModeFilter: 'all' | 'job_specific' | 'goal_based';
  onSelectModeFilter: (mode: 'all' | 'job_specific' | 'goal_based') => void;
  onOpenCustomGoalModal: () => void;
  onNavigateToJDMatcher: () => void;
  isAllCompleted?: boolean;
  remainingEffortHours?: number;
}

export default function RoleSelector({
  roles,
  selectedRoleId,
  onSelectRole,
  daysRemaining,
  studyHoursPerWeek,
  onUpdateBudget,
  activeModeFilter,
  onSelectModeFilter,
  onOpenCustomGoalModal,
  onNavigateToJDMatcher,
  isAllCompleted = false,
  remainingEffortHours = 10
}: RoleSelectorProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [showBudgetControls, setShowBudgetControls] = useState(false);

  // Filter roles strictly based on activeModeFilter
  const filteredRoles =
    activeModeFilter === 'all'
      ? roles
      : roles.filter(r => r.mode === activeModeFilter);

  // Find the selected role within filtered roles, or fallback
  const selectedRole =
    filteredRoles.find(r => r.id === selectedRoleId) ||
    roles.find(r => r.id === selectedRoleId) ||
    filteredRoles[0];

  const modeACount = roles.filter(r => r.mode === 'job_specific').length;
  const modeBCount = roles.filter(r => r.mode === 'goal_based').length;

  return (
    <div className="rounded-2xl border border-slate-200/90 dark:border-slate-800/80 bg-white dark:bg-[#0e131f] p-5 shadow-xs transition-all">
      {/* Top Mode Filter Bar (Mode A vs Mode B) */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3 mb-4 gap-3">
        <div className="flex items-center gap-1 p-1 bg-slate-100/80 dark:bg-slate-900/90 rounded-xl border border-slate-200/60 dark:border-slate-800/60">
          <button
            type="button"
            onClick={() => onSelectModeFilter('all')}
            className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-all ${
              activeModeFilter === 'all'
                ? 'bg-white dark:bg-[#121826] text-indigo-600 dark:text-cyan-400 shadow-xs'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            All Targets ({roles.length})
          </button>

          <button
            type="button"
            onClick={() => onSelectModeFilter('job_specific')}
            className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg transition-all ${
              activeModeFilter === 'job_specific'
                ? 'bg-white dark:bg-[#121826] text-indigo-600 dark:text-cyan-400 shadow-xs'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            <Briefcase className="w-3.5 h-3.5" />
            <span>Mode A: Job-Specific</span>
            <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-indigo-50 dark:bg-cyan-950/60 text-indigo-600 dark:text-cyan-400">
              {modeACount}
            </span>
          </button>

          <button
            type="button"
            onClick={() => onSelectModeFilter('goal_based')}
            className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg transition-all ${
              activeModeFilter === 'goal_based'
                ? 'bg-white dark:bg-[#121826] text-indigo-600 dark:text-cyan-400 shadow-xs'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            <Target className="w-3.5 h-3.5" />
            <span>Mode B: Goal-Based</span>
            <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-indigo-50 dark:bg-cyan-950/60 text-indigo-600 dark:text-cyan-400">
              {modeBCount}
            </span>
          </button>
        </div>

        {/* Mode-Specific Action Button */}
        {activeModeFilter === 'job_specific' ? (
          <button
            type="button"
            onClick={onNavigateToJDMatcher}
            className="flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-semibold rounded-xl bg-indigo-50 dark:bg-indigo-950/50 text-indigo-600 dark:text-indigo-300 border border-indigo-200/80 dark:border-indigo-800/80 hover:bg-indigo-100 dark:hover:bg-indigo-900/40 transition-colors shadow-2xs"
            title="Paste or upload a new vacancy in Member 2's JD Matcher"
          >
            <Briefcase className="w-3.5 h-3.5 text-indigo-500" />
            <span>+ Analyze New Vacancy in JD Matcher</span>
            <ArrowRight className="w-3 h-3 ml-0.5" />
          </button>
        ) : (
          <button
            type="button"
            onClick={onOpenCustomGoalModal}
            className="flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-semibold rounded-xl bg-cyan-50 dark:bg-cyan-950/50 text-cyan-700 dark:text-cyan-300 border border-cyan-200/80 dark:border-cyan-800/80 hover:bg-cyan-100 dark:hover:bg-cyan-900/40 transition-colors shadow-2xs"
            title="Describe your custom career goal and learning aspirations"
          >
            <Sparkles className="w-3.5 h-3.5 text-amber-500" />
            <span>+ Set Custom Career Goal</span>
          </button>
        )}
      </div>

      {/* Role Details & Selector */}
      {selectedRole ? (
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          {/* Role Identity & Dropdown */}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1.5 flex-wrap">
              <span className={`text-[11px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-md border ${
                selectedRole.mode === 'job_specific'
                  ? 'text-indigo-600 dark:text-cyan-400 bg-indigo-50 dark:bg-cyan-950/40 border-indigo-200/60 dark:border-cyan-800/60'
                  : 'text-cyan-600 dark:text-cyan-300 bg-cyan-50 dark:bg-cyan-950/40 border-cyan-200/60 dark:border-cyan-800/60'
              }`}>
                {selectedRole.mode === 'job_specific'
                  ? 'Mode A: Job-Specific • Extracted via JD Matcher'
                  : 'Mode B: Goal-Based • Career Transition Milestone'}
              </span>
              <span className="text-xs text-slate-500 dark:text-slate-400">
                • {selectedRole.department}
              </span>
            </div>

            <div className="relative inline-block text-left w-full sm:w-auto">
              <button
                type="button"
                onClick={() => setIsOpen(!isOpen)}
                className="group flex items-center justify-between sm:justify-start gap-3 text-left w-full sm:w-auto hover:opacity-90 transition-opacity"
                aria-haspopup="listbox"
                aria-expanded={isOpen}
              >
                <div className="flex items-center gap-2.5">
                  <div className={`p-2 rounded-xl ${
                    selectedRole.mode === 'job_specific'
                      ? 'bg-indigo-500/10 text-indigo-600 dark:text-indigo-400'
                      : 'bg-cyan-500/10 text-cyan-600 dark:text-cyan-400'
                  }`}>
                    {selectedRole.mode === 'job_specific' ? (
                      <Briefcase className="w-5 h-5" />
                    ) : (
                      <Target className="w-5 h-5" />
                    )}
                  </div>
                  <div>
                    <h2 className="text-lg sm:text-xl font-bold text-slate-900 dark:text-white flex items-center gap-2">
                      {selectedRole.role_title}
                      <ChevronDown className="w-4 h-4 text-slate-400 group-hover:text-slate-600 dark:group-hover:text-slate-200 transition-transform" />
                    </h2>
                  </div>
                </div>
              </button>

              {/* Dropdown Options */}
              {isOpen && (
                <div
                  className="absolute z-30 mt-2 w-full sm:w-96 rounded-2xl bg-white dark:bg-[#121826] border border-slate-200 dark:border-slate-800 shadow-xl py-2 focus:outline-none"
                  role="listbox"
                >
                  <div className="px-3 py-1.5 text-[11px] font-semibold text-slate-400 dark:text-slate-500 uppercase tracking-wider flex justify-between items-center">
                    <span>
                      {activeModeFilter === 'job_specific'
                        ? 'Extracted Vacancies (from JD Matcher)'
                        : activeModeFilter === 'goal_based'
                        ? 'Career Goals & Milestones'
                        : 'Select Target Role or Goal'}
                    </span>
                    <span className="text-[10px] text-slate-400">
                      {filteredRoles.length} available
                    </span>
                  </div>

                  <div className="max-h-72 overflow-y-auto">
                    {filteredRoles.map(role => (
                      <button
                        key={role.id}
                        type="button"
                        onClick={() => {
                          onSelectRole(role.id);
                          setIsOpen(false);
                        }}
                        className={`w-full px-4 py-2.5 text-left text-xs flex items-center justify-between hover:bg-slate-50 dark:hover:bg-slate-800/70 transition-colors ${
                          role.id === selectedRole.id
                            ? 'bg-indigo-50/50 dark:bg-indigo-950/30 text-indigo-600 dark:text-cyan-300 font-semibold'
                            : 'text-slate-700 dark:text-slate-200'
                        }`}
                        role="option"
                        aria-selected={role.id === selectedRole.id}
                      >
                        <div>
                          <div className="flex items-center gap-1.5 font-semibold">
                            <span>{role.role_title}</span>
                            <span className="text-[9px] px-1.5 py-0.2 rounded-md bg-slate-100 dark:bg-slate-800 text-slate-500">
                              {role.mode === 'job_specific' ? 'Vacancy' : 'Goal'}
                            </span>
                          </div>
                          <div className="text-[11px] text-slate-400 dark:text-slate-400">
                            {role.requirements?.length || 0} requirements • {role.department}
                          </div>
                        </div>
                        {role.id === selectedRole.id && (
                          <Check className="w-4 h-4 text-indigo-600 dark:text-cyan-400 shrink-0 ml-2" />
                        )}
                      </button>
                    ))}
                  </div>

                  <div className="border-t border-slate-100 dark:border-slate-800 pt-1.5 mt-1 px-2">
                    {activeModeFilter === 'job_specific' ? (
                      <button
                        type="button"
                        onClick={() => {
                          setIsOpen(false);
                          onNavigateToJDMatcher();
                        }}
                        className="w-full py-2 px-3 text-xs font-semibold rounded-xl text-indigo-600 dark:text-indigo-400 hover:bg-indigo-50/70 dark:hover:bg-indigo-950/30 flex items-center justify-center gap-1.5 transition-colors"
                      >
                        <ExternalLink className="w-3.5 h-3.5" />
                        <span>Go to JD Matcher to Analyze New Vacancy</span>
                      </button>
                    ) : (
                      <button
                        type="button"
                        onClick={() => {
                          setIsOpen(false);
                          onOpenCustomGoalModal();
                        }}
                        className="w-full py-2 px-3 text-xs font-semibold rounded-xl text-cyan-600 dark:text-cyan-400 hover:bg-cyan-50/70 dark:hover:bg-cyan-950/30 flex items-center justify-center gap-1.5 transition-colors"
                      >
                        <Plus className="w-3.5 h-3.5" />
                        <span>Define New Career Goal & Milestones</span>
                      </button>
                    )}
                  </div>
                </div>
              )}
            </div>

            <p className="text-xs text-slate-600 dark:text-slate-400 mt-1.5 max-w-2xl leading-relaxed">
              {selectedRole.summary}
            </p>
          </div>

          {/* Time Budget & Capacity Controls */}
          {(() => {
            const horizonCountdown = calculateHorizonCountdown(selectedRole.id, daysRemaining, isAllCompleted);
            const effectiveDays = horizonCountdown.daysRemaining;
            const adaptiveCapacity = evaluateAdaptiveCapacity(
              remainingEffortHours,
              effectiveDays,
              studyHoursPerWeek,
              isAllCompleted
            );

            return (
              <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3 pt-3 lg:pt-0 border-t lg:border-t-0 border-slate-100 dark:border-slate-800/80">
                {/* Dynamic Horizon / Deadline Countdown */}
                <div className={`flex items-center gap-2 px-3.5 py-2 rounded-xl border text-xs ${
                  isAllCompleted
                    ? 'bg-emerald-50 dark:bg-emerald-950/60 border-emerald-300 dark:border-emerald-800 text-emerald-700 dark:text-emerald-300'
                    : horizonCountdown.isExpired
                    ? 'bg-rose-50 dark:bg-rose-950/60 border-rose-300 dark:border-rose-800 text-rose-700 dark:text-rose-300'
                    : 'bg-slate-50 dark:bg-slate-900/80 border-slate-200/80 dark:border-slate-800 text-slate-700 dark:text-slate-300'
                }`}>
                  <Calendar className="w-4 h-4 text-indigo-500 shrink-0" />
                  <span>
                    {selectedRole.mode === 'job_specific' ? 'Deadline:' : 'Horizon:'}{' '}
                    {isAllCompleted ? (
                      <strong className="font-bold">Completed! 🎉</strong>
                    ) : horizonCountdown.isExpired ? (
                      <strong className="font-bold">Deadline Reached (0d)</strong>
                    ) : (
                      <>
                        <strong className="text-slate-900 dark:text-white">{effectiveDays}</strong> days left
                      </>
                    )}
                  </span>
                </div>

                {/* Adaptive Study Capacity */}
                <div className={`flex items-center gap-2 px-3.5 py-2 rounded-xl border text-xs ${
                  isAllCompleted
                    ? 'bg-emerald-50 dark:bg-emerald-950/60 border-emerald-300 dark:border-emerald-800 text-emerald-700 dark:text-emerald-300'
                    : adaptiveCapacity.capacityStatus === 'increase_needed'
                    ? 'bg-amber-50 dark:bg-amber-950/60 border-amber-300 dark:border-amber-800 text-amber-800 dark:text-amber-200'
                    : 'bg-slate-50 dark:bg-slate-900/80 border-slate-200/80 dark:border-slate-800 text-slate-700 dark:text-slate-300'
                }`}>
                  <Clock className="w-4 h-4 text-indigo-500 shrink-0" />
                  <span>
                    Capacity:{' '}
                    {isAllCompleted ? (
                      <strong>Fulfilled (0h)</strong>
                    ) : (
                      <>
                        <strong className="text-slate-900 dark:text-white">{studyHoursPerWeek}</strong> hrs/wk
                      </>
                    )}
                  </span>
                  {!isAllCompleted && adaptiveCapacity.capacityStatus === 'increase_needed' && (
                    <button
                      type="button"
                      onClick={() => onUpdateBudget(effectiveDays, adaptiveCapacity.recommendedWeeklyHours)}
                      className="ml-1 text-[10px] font-bold px-1.5 py-0.5 rounded bg-amber-200/80 dark:bg-amber-900 text-amber-900 dark:text-amber-100 hover:bg-amber-300 transition-colors cursor-pointer"
                      title={`Capacity shortfall detected. Click to adjust commitment to ${adaptiveCapacity.recommendedWeeklyHours} hrs/wk (${adaptiveCapacity.recommendedDailyHours}h/day)`}
                    >
                      ⚡ Sync {adaptiveCapacity.recommendedWeeklyHours}h
                    </button>
                  )}
                </div>

                <button
                  type="button"
                  onClick={() => setShowBudgetControls(!showBudgetControls)}
                  className="flex items-center gap-1.5 px-3 py-2 text-xs font-semibold rounded-xl border border-slate-300 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-200 transition-colors cursor-pointer"
                  title="Adjust target deadline and study capacity"
                >
                  <SlidersHorizontal className="w-3.5 h-3.5" />
                  <span>Adjust Time</span>
                </button>
              </div>
            );
          })()}
        </div>
      ) : (
        /* Empty State for the active mode */
        <div className="p-8 text-center border border-dashed border-slate-200 dark:border-slate-800 rounded-2xl bg-slate-50/50 dark:bg-slate-900/30">
          <div className="mx-auto w-10 h-10 rounded-xl bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-slate-500 dark:text-slate-400 mb-3">
            {activeModeFilter === 'job_specific' ? (
              <Briefcase className="w-5 h-5" />
            ) : (
              <Target className="w-5 h-5" />
            )}
          </div>
          <h3 className="text-sm font-bold text-slate-800 dark:text-slate-200 mb-1">
            {activeModeFilter === 'job_specific'
              ? 'No Job Postings Extracted from JD Matcher'
              : 'No Career Goals Defined Yet'}
          </h3>
          <p className="text-xs text-slate-500 dark:text-slate-400 max-w-md mx-auto mb-4">
            {activeModeFilter === 'job_specific'
              ? "Mode A matches your verified skills and evidence against actual job descriptions. Paste a job posting or upload an image in Member 2's JD Matcher."
              : 'Mode B lets you define custom career transition goals, milestone horizons, and learning aspirations.'}
          </p>
          {activeModeFilter === 'job_specific' ? (
            <button
              type="button"
              onClick={onNavigateToJDMatcher}
              className="inline-flex items-center gap-2 px-4 py-2 text-xs font-semibold rounded-xl bg-indigo-600 text-white hover:bg-indigo-700 transition-all shadow-xs"
            >
              <Briefcase className="w-3.5 h-3.5" />
              <span>Open JD Matcher (Member 2)</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          ) : (
            <button
              type="button"
              onClick={onOpenCustomGoalModal}
              className="inline-flex items-center gap-2 px-4 py-2 text-xs font-semibold rounded-xl bg-cyan-600 text-white hover:bg-cyan-700 transition-all shadow-xs"
            >
              <Sparkles className="w-3.5 h-3.5" />
              <span>+ Set Custom Career Goal</span>
            </button>
          )}
        </div>
      )}

      {/* Expandable Time Budget Sliders */}
      {showBudgetControls && selectedRole && (
        <div className="mt-4 pt-4 border-t border-slate-100 dark:border-slate-800 grid grid-cols-1 sm:grid-cols-2 gap-4 bg-slate-50/70 dark:bg-slate-950/40 p-4 rounded-xl">
          <div>
            <div className="flex justify-between items-center text-xs mb-1.5">
              <span className="font-semibold text-slate-700 dark:text-slate-300">
                {selectedRole.mode === 'job_specific' ? 'Target Application Deadline' : 'Goal Target Timeframe'}
              </span>
              <span className="font-bold text-indigo-600 dark:text-cyan-400">{daysRemaining} days</span>
            </div>
            <input
              type="range"
              min={3}
              max={120}
              value={daysRemaining}
              onChange={e => {
                const newD = Number(e.target.value);
                updateDeadlineTimestamp(selectedRole.id, newD);
                onUpdateBudget(newD, studyHoursPerWeek);
              }}
              className="w-full accent-indigo-600 dark:accent-cyan-400 cursor-pointer"
            />
          </div>

          <div>
            <div className="flex justify-between items-center text-xs mb-1.5">
              <span className="font-semibold text-slate-700 dark:text-slate-300">
                Planned Study Commitment
              </span>
              <span className="font-bold text-indigo-600 dark:text-cyan-400">{studyHoursPerWeek} hrs/week</span>
            </div>
            <input
              type="range"
              min={2}
              max={40}
              value={studyHoursPerWeek}
              onChange={e => onUpdateBudget(daysRemaining, Number(e.target.value))}
              className="w-full accent-indigo-600 dark:accent-cyan-400 cursor-pointer"
            />
          </div>
        </div>
      )}
    </div>
  );
}
