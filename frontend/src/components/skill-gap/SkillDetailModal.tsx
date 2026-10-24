import { useEffect } from 'react';
import {
  X,
  ExternalLink,
  BookOpen,
  CheckCircle2,
  AlertTriangle,
  Clock,
  ArrowRight,
  ShieldCheck,
  HelpCircle,
  FileText,
  Calculator,
  TrendingDown
} from 'lucide-react';
import StatusBadge from '../StatusBadge';
import type { TraceableMatchResult } from '../../utils/skillGapCalculations';

interface SkillDetailModalProps {
  item: TraceableMatchResult | null;
  onClose: () => void;
  onOpenLinkModal: (skillName: string) => void;
  onNavigateTab: (tab: string) => void;
}

export default function SkillDetailModal({
  item,
  onClose,
  onOpenLinkModal,
  onNavigateTab
}: SkillDetailModalProps) {
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  if (!item) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-200"
      role="dialog"
      aria-modal="true"
      aria-labelledby="modal-title"
    >
      <div
        className="w-full max-w-2xl max-h-[90vh] overflow-y-auto rounded-3xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#0e131f] shadow-2xl p-6 space-y-6"
        onClick={e => e.stopPropagation()}
      >
        {/* Modal Header */}
        <div className="flex items-start justify-between gap-4 pb-4 border-b border-slate-100 dark:border-slate-800">
          <div>
            <div className="flex items-center gap-2 mb-2 flex-wrap">
              <StatusBadge status={item.status} />
              <span
                className={`text-[11px] font-bold px-2 py-0.5 rounded-md ${
                  item.priority === 'High'
                    ? 'text-rose-600 bg-rose-50 dark:bg-rose-950/40 border border-rose-200/60 dark:border-rose-800/60'
                    : item.priority === 'Medium'
                    ? 'text-amber-600 bg-amber-50 dark:bg-amber-950/40 border border-amber-200/60 dark:border-amber-800/60'
                    : 'text-slate-600 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800'
                }`}
              >
                {item.priority} Priority
              </span>
              <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded-md">
                {item.importance}
              </span>
              <span className="text-xs text-slate-400 capitalize">
                Category: {item.category}
              </span>
            </div>

            <h2 id="modal-title" className="text-xl sm:text-2xl font-extrabold text-slate-900 dark:text-white">
              {item.skill_name}
            </h2>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded-xl text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
            aria-label="Close dialog"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* 1. Job Description Source Excerpt */}
        {item.source_excerpt && (
          <div className="rounded-2xl bg-indigo-50/60 dark:bg-indigo-950/20 border border-indigo-100 dark:border-indigo-900/40 p-4 space-y-1">
            <span className="text-[10px] font-bold text-indigo-700 dark:text-cyan-400 uppercase tracking-wider flex items-center gap-1.5">
              <BookOpen className="w-3.5 h-3.5" />
              Target Job Posting Excerpt
            </span>
            <p className="text-xs text-slate-700 dark:text-slate-300 italic leading-relaxed">
              "{item.source_excerpt}"
            </p>
          </div>
        )}

        {/* 2. Match Rationale & Remediation Effort */}
        <div className="rounded-2xl bg-slate-50 dark:bg-slate-950/70 border border-slate-200/80 dark:border-slate-800/80 p-4 space-y-3">
          <div>
            <span className="text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
              <ShieldCheck className="w-3.5 h-3.5 text-indigo-500" />
              Match Rationale
            </span>
            <p className="text-xs text-slate-800 dark:text-slate-200 font-medium leading-relaxed mt-1">
              {item.reason}
            </p>
          </div>

          {/* Remediation effort */}
          <div className="rounded-xl bg-white dark:bg-[#121826] border border-slate-200/90 dark:border-slate-800/80 p-3.5 space-y-1.5">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                <Clock className="w-3.5 h-3.5 text-indigo-500" />
                Remediation effort
              </span>
              <span className="text-xs font-bold text-indigo-600 dark:text-cyan-400 bg-indigo-50 dark:bg-indigo-950/60 px-2.5 py-1 rounded-lg border border-indigo-200/60 dark:border-indigo-800/60">
                {item.effort_hours_estimate > 0 ? `~${item.effort_hours_estimate} hrs` : '0 hrs (Demonstrated)'}
              </span>
            </div>

            <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
              {item.status === 'Demonstrated'
                ? 'Requirement is already demonstrated through your verified evidence or assessment.'
                : item.effort_breakdown?.explanation ||
                  `Estimated ~${item.effort_hours_estimate} hours of focused preparation to build demonstrable evidence.`}
            </p>
          </div>
        </div>

        {/* 3. Supporting Evidence Records */}
        <div className="space-y-3">
          <div className="flex justify-between items-center">
            <h3 className="text-xs font-bold text-slate-900 dark:text-white uppercase tracking-wider flex items-center gap-1.5">
              <FileText className="w-3.5 h-3.5 text-indigo-500" />
              Connected Learner Evidence ({item.supporting_evidence.length})
            </h3>
            <button
              type="button"
              onClick={() => {
                onClose();
                onOpenLinkModal(item.skill_name);
              }}
              className="text-xs font-semibold text-indigo-600 dark:text-cyan-400 hover:underline"
            >
              + Link New Evidence
            </button>
          </div>

          {item.supporting_evidence.length > 0 ? (
            <div className="space-y-2.5">
              {item.supporting_evidence.map((ev, idx) => (
                <div
                  key={ev.id || idx}
                  className="rounded-xl border border-slate-200/80 dark:border-slate-800 bg-white dark:bg-[#121826] p-3.5 text-xs space-y-2"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-slate-900 dark:text-white">{ev.title}</span>
                        <span
                          className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${
                            ev.review_status === 'verified'
                              ? 'text-emerald-500 bg-emerald-500/10'
                              : ev.review_status === 'needs_improvement'
                              ? 'text-rose-500 bg-rose-500/10'
                              : 'text-amber-500 bg-amber-500/10'
                          }`}
                        >
                          {ev.review_status || 'unverified'}
                        </span>
                      </div>
                      <span className="text-[10px] text-slate-400 capitalize">
                        Type: {ev.evidence_type?.replace('_', ' ') || 'project artifact'}
                      </span>
                    </div>

                    {ev.reference && (
                      <a
                        href={ev.reference}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex items-center gap-1 text-[11px] font-semibold text-indigo-600 dark:text-cyan-400 hover:underline shrink-0"
                      >
                        View Artifact <ExternalLink className="w-3 h-3" />
                      </a>
                    )}
                  </div>

                  {ev.description && (
                    <p className="text-slate-600 dark:text-slate-400 leading-relaxed text-[11px]">
                      {ev.description}
                    </p>
                  )}
                </div>
              ))}
            </div>
          ) : (
            <div className="rounded-xl border border-dashed border-slate-200 dark:border-slate-800 p-4 text-center text-xs text-slate-500 dark:text-slate-400 space-y-1">
              <HelpCircle className="w-5 h-5 mx-auto text-slate-400" />
              <p className="font-semibold text-slate-700 dark:text-slate-300">
                No supporting evidence linked yet
              </p>
              <p className="text-[11px]">
                {item.status === 'Self-reported'
                  ? 'You claimed this skill in your profile, but have not linked a repository or test proof.'
                  : 'Neither a project repository nor a standardized assessment is linked to this requirement.'}
              </p>
            </div>
          )}
        </div>

        {/* 4. Recommended Action & Workflow Links */}
        <div className="rounded-2xl bg-slate-50 dark:bg-slate-950/70 border border-slate-200/80 dark:border-slate-800/80 p-4 space-y-3">
          <span className="text-[10px] font-bold text-indigo-600 dark:text-cyan-400 uppercase tracking-wider">
            Recommended Remediation Workflow
          </span>
          <p className="text-xs text-slate-700 dark:text-slate-300 leading-relaxed">
            {item.recommended_action}
          </p>

          <div className="flex flex-wrap gap-2 pt-1">
            {item.status !== 'Demonstrated' && (
              <>
                <button
                  type="button"
                  onClick={() => {
                    onClose();
                    onOpenLinkModal(item.skill_name);
                  }}
                  className="inline-flex items-center gap-1.5 rounded-xl bg-slate-900 dark:bg-white px-3.5 py-2 text-xs font-semibold text-white dark:text-slate-900 hover:bg-slate-800 dark:hover:bg-slate-100 transition-colors shadow-xs"
                >
                  Link Project Evidence <ArrowRight className="w-3.5 h-3.5" />
                </button>

                <button
                  type="button"
                  onClick={() => {
                    onClose();
                    onNavigateTab('assessment');
                  }}
                  className="inline-flex items-center gap-1.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-3.5 py-2 text-xs font-semibold text-slate-800 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors"
                >
                  Take 10-Point Assessment
                </button>
              </>
            )}

            <button
              type="button"
              onClick={() => {
                onClose();
                onNavigateTab('roadmap');
              }}
              className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-transparent px-3 py-2 text-xs font-semibold text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white transition-colors"
            >
              View in Roadmap
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
