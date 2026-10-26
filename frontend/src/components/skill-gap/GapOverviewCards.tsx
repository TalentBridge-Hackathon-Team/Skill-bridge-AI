import { useState } from 'react';
import {
  CheckCircle2,
  FileQuestion,
  AlertTriangle,
  HelpCircle,
  TrendingUp,
  Info,
  Clock,
  Layers
} from 'lucide-react';
import type { SkillGapSummary } from '../../utils/skillGapCalculations';

interface GapOverviewCardsProps {
  summary: SkillGapSummary;
}

export default function GapOverviewCards({ summary }: GapOverviewCardsProps) {
  const [showFormula, setShowFormula] = useState(false);

  // Score color gradient band
  const getScoreColor = (score: number) => {
    if (score >= 80) return 'text-emerald-500 dark:text-emerald-400';
    if (score >= 55) return 'text-amber-500 dark:text-amber-400';
    return 'text-rose-500 dark:text-rose-400';
  };

  const getScoreBg = (score: number) => {
    if (score >= 80) return 'bg-emerald-500';
    if (score >= 55) return 'bg-amber-500';
    return 'bg-rose-500';
  };

  return (
    <div className="space-y-4">
      {/* Overview Metric Grid */}
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-3.5">
        {/* 1. Overall Match Score Card */}
        <div className="col-span-2 rounded-2xl border border-slate-200/90 dark:border-slate-800/80 bg-white dark:bg-[#0e131f] p-4.5 shadow-xs flex flex-col justify-between relative overflow-hidden">
          <div className="flex justify-between items-start">
            <div>
              <div className="flex items-center gap-1.5">
                <span className="text-xs font-semibold text-slate-500 dark:text-slate-400">
                  Target Role Readiness
                </span>
                <button
                  type="button"
                  onClick={() => setShowFormula(!showFormula)}
                  className="text-slate-400 hover:text-indigo-600 dark:hover:text-cyan-400 transition-colors"
                  title="View calculation formula"
                >
                  <Info className="w-3.5 h-3.5" />
                </button>
              </div>
              <div className="flex items-baseline gap-2 mt-1">
                <span className={`text-3xl font-extrabold ${getScoreColor(summary.match_score)}`}>
                  {summary.match_score}%
                </span>
                <span className="text-xs text-slate-400">weighted match</span>
              </div>
            </div>

            <div className="p-2.5 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-100 dark:border-slate-800 text-slate-600 dark:text-slate-300">
              <TrendingUp className="w-5 h-5 text-indigo-500" />
            </div>
          </div>

          {/* Progress Bar */}
          <div className="mt-3">
            <div className="w-full h-2 rounded-full bg-slate-100 dark:bg-slate-800 overflow-hidden">
              <div
                className={`h-full rounded-full transition-all duration-500 ${getScoreBg(summary.match_score)}`}
                style={{ width: `${Math.max(summary.match_score, 4)}%` }}
              />
            </div>
            <div className="flex justify-between items-center text-[10px] text-slate-400 dark:text-slate-500 mt-1">
              <span>{summary.demonstrated_count} demonstrated</span>
              <span>{summary.total_assessed - summary.demonstrated_count} gaps to bridge</span>
            </div>
          </div>
        </div>

        {/* 2. Demonstrated Skills */}
        <div className="rounded-2xl border border-slate-200/90 dark:border-slate-800/80 bg-white dark:bg-[#0e131f] p-4 shadow-xs flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-semibold text-slate-500 dark:text-slate-400">
              Demonstrated
            </span>
            <CheckCircle2 className="w-4 h-4 text-emerald-500" />
          </div>
          <div className="mt-2">
            <div className="text-2xl font-bold text-slate-900 dark:text-white">
              {summary.demonstrated_count}
            </div>
            <span className="text-[10px] text-emerald-600 dark:text-emerald-400 font-medium">
              Verified Evidence
            </span>
          </div>
        </div>

        {/* 3. Self-reported / Missing Evidence */}
        <div className="rounded-2xl border border-slate-200/90 dark:border-slate-800/80 bg-white dark:bg-[#0e131f] p-4 shadow-xs flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-semibold text-slate-500 dark:text-slate-400">
              Self-Reported
            </span>
            <FileQuestion className="w-4 h-4 text-amber-500" />
          </div>
          <div className="mt-2">
            <div className="text-2xl font-bold text-slate-900 dark:text-white">
              {summary.self_reported_count}
            </div>
            <span className="text-[10px] text-amber-600 dark:text-amber-400 font-medium">
              Needs Repo / Proof
            </span>
          </div>
        </div>

        {/* 4. Needs Improvement */}
        <div className="rounded-2xl border border-slate-200/90 dark:border-slate-800/80 bg-white dark:bg-[#0e131f] p-4 shadow-xs flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-semibold text-slate-500 dark:text-slate-400">
              Reinforce
            </span>
            <AlertTriangle className="w-4 h-4 text-rose-500" />
          </div>
          <div className="mt-2">
            <div className="text-2xl font-bold text-slate-900 dark:text-white">
              {summary.needs_improvement_count}
            </div>
            <span className="text-[10px] text-rose-600 dark:text-rose-400 font-medium">
              Needs Code Revision
            </span>
          </div>
        </div>

        {/* 5. Unverified / Missing Skill */}
        <div className="rounded-2xl border border-slate-200/90 dark:border-slate-800/80 bg-white dark:bg-[#0e131f] p-4 shadow-xs flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-semibold text-slate-500 dark:text-slate-400">
              Unverified
            </span>
            <HelpCircle className="w-4 h-4 text-slate-400" />
          </div>
          <div className="mt-2">
            <div className="text-2xl font-bold text-slate-900 dark:text-white">
              {summary.unverified_count}
            </div>
            <span className="text-[10px] text-slate-500 dark:text-slate-400 font-medium">
              No Record / Test
            </span>
          </div>
        </div>
      </div>

      {/* Explanatory Formula & Methodology Drawer */}
      {showFormula && (
        <div className="rounded-2xl border border-indigo-200/80 dark:border-indigo-900/60 bg-indigo-50/50 dark:bg-indigo-950/20 p-4 text-xs text-slate-700 dark:text-slate-300 space-y-2">
          <div className="flex justify-between items-center">
            <div className="flex items-center gap-1.5 font-bold text-indigo-950 dark:text-cyan-300">
              <Layers className="w-4 h-4 text-indigo-500" />
              <span>How Your Match Score Is Calculated</span>
            </div>
            <button
              type="button"
              onClick={() => setShowFormula(false)}
              className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 font-semibold"
            >
              ✕ Close
            </button>
          </div>
          <p className="leading-relaxed text-slate-600 dark:text-slate-300">
            {summary.calculation_explanation}
          </p>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-1">
            <div className="bg-white/80 dark:bg-[#0e131f]/80 p-2 rounded-lg border border-slate-200/60 dark:border-slate-800">
              <span className="text-[10px] text-emerald-600 dark:text-emerald-400 font-bold block">Demonstrated: 100%</span>
              <span className="text-[10px] text-slate-500">Verified code / assessment ≥ 8/10</span>
            </div>
            <div className="bg-white/80 dark:bg-[#0e131f]/80 p-2 rounded-lg border border-slate-200/60 dark:border-slate-800">
              <span className="text-[10px] text-amber-600 dark:text-amber-400 font-bold block">Self-Reported: 50%</span>
              <span className="text-[10px] text-slate-500">Claimed in profile, needs proof</span>
            </div>
            <div className="bg-white/80 dark:bg-[#0e131f]/80 p-2 rounded-lg border border-slate-200/60 dark:border-slate-800">
              <span className="text-[10px] text-rose-600 dark:text-rose-400 font-bold block">Needs Imprv: 25%</span>
              <span className="text-[10px] text-slate-500">Evidence or test below criteria</span>
            </div>
            <div className="bg-white/80 dark:bg-[#0e131f]/80 p-2 rounded-lg border border-slate-200/60 dark:border-slate-800">
              <span className="text-[10px] text-slate-500 font-bold block">Unverified: 0%</span>
              <span className="text-[10px] text-slate-500">No profile claim or evidence</span>
            </div>
          </div>
          <div className="flex items-center gap-2 pt-1 text-[11px] text-slate-500 dark:text-slate-400">
            <Clock className="w-3.5 h-3.5 text-indigo-500 shrink-0" />
            <span>
              Total Estimated Remediation Time to 100%: <strong>~{summary.total_remediation_hours} hours</strong>
            </span>
          </div>
        </div>
      )}
    </div>
  );
}
