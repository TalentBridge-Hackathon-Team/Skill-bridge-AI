import StatusBadge from '../components/StatusBadge';
import { ArrowRight, Clock, ShieldCheck, Info, ChevronRight } from 'lucide-react';
import type { MatchReport, FeasibilityAssessment } from '../types';

interface SkillGapPageProps {
  setActiveTab: (tab: string) => void;
}

export default function SkillGapPage({ setActiveTab }: SkillGapPageProps) {
  // Traceable match reports according to Blueprint Section 7
  const matchResults: MatchReport[] = [
    {
      skill: 'Django REST Framework',
      status: 'Demonstrated',
      priority: 'Low',
      reason: 'Verified project evidence found: E-Commerce Order Management API repository.',
      action: 'Ready to showcase in technical interview questions and portfolio.',
      effort_hours_estimate: 0
    },
    {
      skill: 'API Testing',
      status: 'Unverified',
      priority: 'High',
      reason: 'Mandatory role requirement. No automated test suite or verified test artifact in profile.',
      action: 'Complete the controlled 10-point REST API Testing Assessment.',
      effort_hours_estimate: 6
    },
    {
      skill: 'PostgreSQL',
      status: 'Self-reported',
      priority: 'High',
      reason: 'Listed in profile skills, but no verified repository or SQL schema evidence linked.',
      action: 'Link a project repository featuring relational queries or data migrations.',
      effort_hours_estimate: 8
    },
    {
      skill: 'Authentication & Security',
      status: 'Unverified',
      priority: 'Medium',
      reason: 'Required by backend posting. Token authentication scenarios not demonstrated.',
      action: 'Review JWT expiration and authorization rejection test cases.',
      effort_hours_estimate: 4
    }
  ];

  // Feasibility assessment (Section 7: 14 days, 14 hrs/week = 28 hrs available; 18h skill tasks + 4h app prep = 22h total plan effort)
  const feasibility: FeasibilityAssessment = {
    available_hours: 28,
    estimated_plan_effort_hours: 22,
    days_remaining: 14,
    study_hours_per_day: 2,
    feasibility_band: 'Likely feasible',
    interpretation: 'Estimated prioritized effort (22 hrs) is comfortably below available study capacity (28 hrs).',
    assumptions: [
      '14 days remaining before application closing date',
      'Assumes 2.0 hours/day (14 hours/week) sustained study capacity',
      'Includes 4 hours for CV tailoring and application preparation checklist'
    ],
    suggested_scope: 'Focus first on the High-priority API Testing assessment and linking PostgreSQL evidence.'
  };

  const getFeasibilityColor = (band: string) => {
    switch (band) {
      case 'Likely feasible':
        return 'text-emerald-400 bg-emerald-950/30 border-emerald-500/40';
      case 'Tight / uncertain':
        return 'text-amber-400 bg-amber-950/30 border-amber-500/40';
      case 'Not feasible as scoped':
        return 'text-rose-400 bg-rose-950/30 border-rose-500/40';
      default:
        return 'text-slate-400 bg-slate-900 border-slate-700';
    }
  };

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex justify-between items-center flex-wrap gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Skill Gap Matching & Feasibility Report</h1>
          <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 mt-1">
            Feature 5, 6 & 8 (Member 3 & 4) — Deterministic matching against evidence statuses and time-budget validation.
          </p>
        </div>

        <button
          onClick={() => setActiveTab('roadmap')}
          className="flex items-center gap-2 rounded-xl bg-slate-900 dark:bg-white px-4 py-2 text-xs font-semibold text-white dark:text-slate-900 hover:bg-slate-800 dark:hover:bg-slate-100 transition-colors shadow-xs"
        >
          View Actionable Roadmap <ArrowRight className="w-3.5 h-3.5" />
        </button>
      </div>

      {/* Deadline Feasibility Assessment Card */}
      <div className="rounded-2xl border border-slate-200/90 dark:border-slate-800/80 bg-white dark:bg-[#0e131f] p-6 space-y-4 shadow-xs">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-100 dark:border-slate-800/80">
          <div className="flex items-center gap-2.5">
            <Clock className="w-5 h-5 text-indigo-500" />
            <div>
              <h2 className="text-base font-semibold text-slate-900 dark:text-white">Deadline Feasibility Assessment</h2>
              <span className="text-xs text-slate-500 dark:text-slate-400">Calculated for 14-day target application window</span>
            </div>
          </div>

          <div className={`px-3 py-1 rounded-full text-xs font-bold border ${getFeasibilityColor(feasibility.feasibility_band)} flex items-center gap-1.5`}>
            <ShieldCheck className="w-4 h-4" />
            {feasibility.feasibility_band}
          </div>
        </div>

        {/* Calculation Details */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="rounded-xl bg-slate-50 dark:bg-slate-950/60 p-4 border border-slate-200/80 dark:border-slate-800/80">
            <span className="text-[11px] font-semibold text-slate-500 dark:text-slate-400 block mb-1">Available Study Time</span>
            <div className="text-2xl font-bold text-slate-900 dark:text-white">
              {feasibility.available_hours} <span className="text-xs font-normal text-slate-500 dark:text-slate-400">hrs</span>
            </div>
            <p className="text-[11px] text-slate-400 mt-1">14 days × 2.0 hrs/day</p>
          </div>

          <div className="rounded-xl bg-slate-50 dark:bg-slate-950/60 p-4 border border-slate-200/80 dark:border-slate-800/80">
            <span className="text-[11px] font-semibold text-slate-500 dark:text-slate-400 block mb-1">Estimated Plan Effort</span>
            <div className="text-2xl font-bold text-slate-900 dark:text-indigo-300">
              {feasibility.estimated_plan_effort_hours} <span className="text-xs font-normal text-slate-500 dark:text-slate-400">hrs</span>
            </div>
            <p className="text-[11px] text-slate-400 mt-1">18h gap tasks + 4h app prep</p>
          </div>

          <div className="rounded-xl bg-slate-50 dark:bg-slate-950/60 p-4 border border-slate-200/80 dark:border-slate-800/80">
            <span className="text-[11px] font-semibold text-slate-500 dark:text-slate-400 block mb-1">Time Buffer / Margin</span>
            <div className="text-2xl font-bold text-emerald-600 dark:text-emerald-400">
              +{feasibility.available_hours - feasibility.estimated_plan_effort_hours} <span className="text-xs font-normal text-slate-500 dark:text-slate-400">hrs</span>
            </div>
            <p className="text-[11px] text-slate-400 mt-1">Comfortable margin for revisions</p>
          </div>
        </div>

        {/* Interpretation & Assumptions */}
        <div className="space-y-2 text-xs text-slate-600 dark:text-slate-300 pt-1">
          <p className="leading-relaxed">
            <strong className="text-slate-900 dark:text-white">Analysis:</strong> {feasibility.interpretation}
          </p>
          <div className="text-[11px] text-slate-500 dark:text-slate-400 space-y-0.5">
            {feasibility.assumptions.map((asm, idx) => (
              <div key={idx} className="flex items-center gap-1.5">
                <ChevronRight className="w-3 h-3 text-indigo-500 shrink-0" />
                <span>{asm}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Critical Limitation Disclaimer */}
        <div className="flex items-start gap-2.5 p-3 rounded-xl bg-slate-50 dark:bg-slate-950/80 border border-slate-200/80 dark:border-slate-800 text-xs text-slate-600 dark:text-slate-400">
          <Info className="w-4 h-4 text-cyan-600 dark:text-cyan-400 shrink-0 mt-0.5" />
          <p>
            <strong className="text-slate-800 dark:text-slate-200">Important Limitation:</strong> Feasibility estimates predict whether a selected improvement plan may fit the available time. They do not predict hiring outcomes, guarantee mastery, or decide whether you should apply.
          </p>
        </div>
      </div>

      {/* Traceable Match Results Table */}
      <div className="space-y-3">
        <div className="flex justify-between items-center text-xs font-semibold text-slate-500 dark:text-slate-400 px-1">
          <span>Target Requirement & Status</span>
          <span>Matching Rationale & Recommended Action</span>
        </div>

        {matchResults.map((item, index) => (
          <div
            key={index}
            className="rounded-2xl border border-slate-200/90 dark:border-slate-800/80 bg-white dark:bg-[#0e131f] p-5 grid grid-cols-1 md:grid-cols-3 gap-4 items-center hover:border-slate-300 dark:hover:border-slate-700 transition-colors shadow-xs"
          >
            {/* Skill & Status */}
            <div>
              <div className="flex items-center gap-2 mb-1.5">
                <StatusBadge status={item.status} />
                <span className={`text-[11px] font-semibold ${
                  item.priority === 'High' ? 'text-rose-500' : item.priority === 'Medium' ? 'text-amber-500' : 'text-slate-500'
                }`}>
                  {item.priority} Priority
                </span>
                {item.effort_hours_estimate !== undefined && item.effort_hours_estimate > 0 && (
                  <span className="text-[10px] text-slate-500 dark:text-slate-400 bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded-md border border-slate-200/60 dark:border-slate-700/60">
                    ~{item.effort_hours_estimate} hrs
                  </span>
                )}
              </div>
              <h3 className="text-base font-semibold text-slate-900 dark:text-white">{item.skill}</h3>
            </div>

            {/* Rationale */}
            <div className="rounded-xl bg-slate-50 dark:bg-slate-950/70 p-3 border border-slate-200/80 dark:border-slate-800/80">
              <span className="text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider block mb-1">
                Deterministic Rationale
              </span>
              <p className="text-xs text-slate-700 dark:text-slate-300 leading-relaxed">{item.reason}</p>
            </div>

            {/* Action */}
            <div className="flex flex-col items-start gap-2">
              <span className="text-[10px] font-bold text-indigo-600 dark:text-cyan-400 uppercase tracking-wider">
                Recommended Action
              </span>
              <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed">{item.action}</p>

              {item.skill === 'API Testing' && (
                <button
                  onClick={() => setActiveTab('assessment')}
                  className="inline-flex items-center gap-1.5 rounded-xl bg-slate-900 dark:bg-white px-3 py-1.5 text-xs font-semibold text-white dark:text-slate-900 hover:bg-slate-800 dark:hover:bg-slate-100 transition-colors shadow-xs"
                >
                  Start Assessment <ArrowRight className="w-3.5 h-3.5" />
                </button>
              )}

              {item.skill === 'PostgreSQL' && (
                <button
                  onClick={() => setActiveTab('profile')}
                  className="inline-flex items-center gap-1.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-3 py-1.5 text-xs font-semibold text-slate-800 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors"
                >
                  Link Repository Evidence
                </button>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
