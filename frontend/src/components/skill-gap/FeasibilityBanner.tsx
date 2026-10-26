import { Clock, ShieldCheck, ChevronRight, Info, AlertOctagon } from 'lucide-react';
import type { FeasibilityAssessment } from '../../types';

interface FeasibilityBannerProps {
  feasibility: FeasibilityAssessment;
}

export default function FeasibilityBanner({ feasibility }: FeasibilityBannerProps) {
  const getFeasibilityColor = (band: string) => {
    switch (band) {
      case 'Likely feasible':
        return 'text-emerald-500 bg-emerald-500/10 border-emerald-500/20';
      case 'Tight / uncertain':
        return 'text-amber-500 bg-amber-500/10 border-amber-500/20';
      case 'Not feasible as scoped':
        return 'text-rose-500 bg-rose-500/10 border-rose-500/20';
      default:
        return 'text-slate-400 bg-slate-500/10 border-slate-500/20';
    }
  };

  const bufferHours = Math.round(
    (feasibility.available_hours - feasibility.estimated_plan_effort_hours) * 10
  ) / 10;

  return (
    <div className="rounded-2xl border border-slate-200/90 dark:border-slate-800/80 bg-white dark:bg-[#0e131f] p-5 space-y-4 shadow-xs">
      {/* Header with Status Badge */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-100 dark:border-slate-800/80">
        <div className="flex items-center gap-2.5">
          <div className="p-2 rounded-xl bg-indigo-500/10 text-indigo-600 dark:text-cyan-400">
            {feasibility.estimated_plan_effort_hours === 0 ? (
              <ShieldCheck className="w-5 h-5 text-emerald-500" />
            ) : (
              <Clock className="w-5 h-5" />
            )}
          </div>
          <div>
            <h3 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
              Deadline Feasibility Assessment
            </h3>
            <span className="text-xs text-slate-500 dark:text-slate-400">
              {feasibility.estimated_plan_effort_hours === 0
                ? 'All requirements and competencies demonstrated! Ready for application review.'
                : `Validated against target ${feasibility.days_remaining}-day window and planned study commitment`}
            </span>
          </div>
        </div>

        <div
          className={`px-3 py-1.5 rounded-full text-xs font-bold border ${
            feasibility.estimated_plan_effort_hours === 0
              ? 'text-emerald-500 bg-emerald-500/10 border-emerald-500/30'
              : getFeasibilityColor(feasibility.feasibility_band)
          } flex items-center gap-1.5 self-start sm:self-auto`}
        >
          {feasibility.estimated_plan_effort_hours === 0 ? (
            <>
              <ShieldCheck className="w-4 h-4" />
              Goal Completed! 🎉
            </>
          ) : feasibility.feasibility_band === 'Likely feasible' ? (
            <>
              <ShieldCheck className="w-4 h-4" />
              {feasibility.feasibility_band}
            </>
          ) : (
            <>
              <AlertOctagon className="w-4 h-4" />
              {feasibility.feasibility_band}
            </>
          )}
        </div>
      </div>

      {/* Numerical Metrics */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div className="rounded-xl bg-slate-50 dark:bg-slate-950/60 p-3.5 border border-slate-200/80 dark:border-slate-800/80">
          <span className="text-[11px] font-semibold text-slate-500 dark:text-slate-400 block mb-1">
            Available Study Time
          </span>
          <div className="text-2xl font-bold text-slate-900 dark:text-white">
            {feasibility.available_hours} <span className="text-xs font-normal text-slate-400">hrs</span>
          </div>
          <p className="text-[11px] text-slate-400 mt-0.5">
            {feasibility.days_remaining} days × {feasibility.study_hours_per_day} hrs/day
          </p>
        </div>

        <div className="rounded-xl bg-slate-50 dark:bg-slate-950/60 p-3.5 border border-slate-200/80 dark:border-slate-800/80">
          <div className="flex items-center justify-between mb-1">
            <span className="text-[11px] font-semibold text-slate-500 dark:text-slate-400 block">
              Estimated Remediation Effort
            </span>
            {feasibility.is_scoped_down && (
              <span className="text-[10px] font-bold text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/60 px-1.5 py-0.5 rounded-md border border-amber-200/60 dark:border-amber-900/60">
                ⚡ Sprint Scoped
              </span>
            )}
          </div>
          <div className="text-2xl font-bold text-slate-900 dark:text-indigo-300">
            {feasibility.estimated_plan_effort_hours}{' '}
            <span className="text-xs font-normal text-slate-400">hrs</span>
          </div>
          <p className="text-[11px] text-slate-400 mt-0.5">
            {feasibility.is_scoped_down
              ? `Core must-haves only (${feasibility.full_plan_effort_hours}h full scope, saved ${feasibility.deferred_hours}h)`
              : 'Prioritized tasks + 4h app prep'}
          </p>
        </div>

        <div className="rounded-xl bg-slate-50 dark:bg-slate-950/60 p-3.5 border border-slate-200/80 dark:border-slate-800/80">
          <span className="text-[11px] font-semibold text-slate-500 dark:text-slate-400 block mb-1">
            Time Buffer / Margin
          </span>
          <div
            className={`text-2xl font-bold ${
              bufferHours >= 0
                ? 'text-emerald-600 dark:text-emerald-400'
                : 'text-rose-600 dark:text-rose-400'
            }`}
          >
            {bufferHours >= 0 ? `+${bufferHours}` : bufferHours}{' '}
            <span className="text-xs font-normal text-slate-400">hrs</span>
          </div>
          <p className="text-[11px] text-slate-400 mt-0.5">
            {bufferHours >= 0 ? 'Margin for unexpected blockers' : 'Scope exceeds available time'}
          </p>
        </div>
      </div>

      {/* Analytical Interpretation & Recommendations */}
      <div className="space-y-2 pt-1 text-xs text-slate-600 dark:text-slate-300">
        <p className="leading-relaxed">
          <strong className="text-slate-900 dark:text-white">Analysis:</strong> {feasibility.interpretation}
        </p>
        {feasibility.suggested_scope && (
          <p className="leading-relaxed text-indigo-700 dark:text-cyan-300 bg-indigo-50/60 dark:bg-cyan-950/30 p-2.5 rounded-xl border border-indigo-100 dark:border-cyan-900/40">
            <strong>Recommended Scope:</strong> {feasibility.suggested_scope}
          </p>
        )}
        <div className="text-[11px] text-slate-500 dark:text-slate-400 space-y-1 pt-1">
          {feasibility.assumptions.map((asm, idx) => (
            <div key={idx} className="flex items-center gap-1.5">
              <ChevronRight className="w-3 h-3 text-indigo-500 shrink-0" />
              <span>{asm}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Limitation Notice */}
      <div className="flex items-start gap-2.5 p-3 rounded-xl bg-slate-50 dark:bg-slate-950/70 border border-slate-200/80 dark:border-slate-800/80 text-[11px] text-slate-500 dark:text-slate-400">
        <Info className="w-4 h-4 text-cyan-600 dark:text-cyan-400 shrink-0 mt-0.5" />
        <p>
          <strong className="text-slate-700 dark:text-slate-300">Responsible Guidance Note:</strong>{' '}
          Feasibility estimates evaluate whether a prioritized study plan can be completed within your available time window. They do not predict hiring decisions, guarantee job selection, or evaluate subjective interview factors.
        </p>
      </div>
    </div>
  );
}
