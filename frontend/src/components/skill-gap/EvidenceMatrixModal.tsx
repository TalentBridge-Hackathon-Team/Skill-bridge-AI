import { useEffect } from 'react';
import {
  X,
  Layers,
  ExternalLink,
  CheckCircle2,
  AlertTriangle,
  FileQuestion,
  HelpCircle,
  Share2,
  FolderGit2
} from 'lucide-react';
import type { SkillEvidence } from '../../types';
import type { EvidenceSkillMap } from '../../utils/skillGapCalculations';

interface EvidenceMatrixModalProps {
  isOpen: boolean;
  onClose: () => void;
  mappedEvidence: EvidenceSkillMap[];
  unmappedEvidence: SkillEvidence[];
  onOpenLinkModal: () => void;
}

export default function EvidenceMatrixModal({
  isOpen,
  onClose,
  mappedEvidence,
  unmappedEvidence,
  onOpenLinkModal
}: EvidenceMatrixModalProps) {
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    if (isOpen) {
      window.addEventListener('keydown', handleKeyDown);
    }
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-200"
      role="dialog"
      aria-modal="true"
      aria-labelledby="matrix-title"
    >
      <div
        className="w-full max-w-3xl max-h-[90vh] overflow-y-auto rounded-3xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#0e131f] shadow-2xl p-6 space-y-6"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-indigo-500/10 text-indigo-600 dark:text-cyan-400">
              <Share2 className="w-5 h-5" />
            </div>
            <div>
              <h2 id="matrix-title" className="text-lg font-bold text-slate-900 dark:text-white">
                Evidence Traceability Matrix
              </h2>
              <span className="text-xs text-slate-500 dark:text-slate-400">
                1-to-many & many-to-1 evidence relationships across portfolio artifacts and target role skills
              </span>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-xl text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
            aria-label="Close dialog"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* 1. Mapped Role Evidence (1-to-many relationships) */}
        <div className="space-y-3">
          <div className="flex justify-between items-center">
            <h3 className="text-xs font-bold text-slate-900 dark:text-white uppercase tracking-wider flex items-center gap-1.5">
              <FolderGit2 className="w-4 h-4 text-emerald-500" />
              Role-Mapped Evidence ({mappedEvidence.length})
            </h3>
            <button
              type="button"
              onClick={() => {
                onClose();
                onOpenLinkModal();
              }}
              className="text-xs font-semibold text-indigo-600 dark:text-cyan-400 hover:underline"
            >
              + Link New Evidence
            </button>
          </div>

          <div className="grid grid-cols-1 gap-3">
            {mappedEvidence.map(({ evidence, supported_skills }, idx) => (
              <div
                key={evidence.id || idx}
                className="rounded-2xl border border-slate-200/80 dark:border-slate-800 bg-slate-50/60 dark:bg-slate-950/60 p-4 space-y-2.5"
              >
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <div>
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-bold text-sm text-slate-900 dark:text-white">
                        {evidence.title}
                      </span>
                      <span
                        className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                          evidence.review_status === 'verified'
                            ? 'text-emerald-500 bg-emerald-500/10 border border-emerald-500/20'
                            : evidence.review_status === 'needs_improvement'
                            ? 'text-rose-500 bg-rose-500/10 border border-rose-500/20'
                            : 'text-amber-500 bg-amber-500/10 border border-amber-500/20'
                        }`}
                      >
                        {evidence.review_status || 'unverified'}
                      </span>
                      <span className="text-[10px] text-slate-400 capitalize">
                        {evidence.evidence_type?.replace('_', ' ') || 'project artifact'}
                      </span>
                    </div>
                  </div>

                  {evidence.reference && (
                    <a
                      href={evidence.reference}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex items-center gap-1 text-xs font-semibold text-indigo-600 dark:text-cyan-400 hover:underline shrink-0"
                    >
                      View Code Artifact <ExternalLink className="w-3 h-3" />
                    </a>
                  )}
                </div>

                {evidence.description && (
                  <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
                    {evidence.description}
                  </p>
                )}

                {/* Supported Skills Pills (1-to-many showcase) */}
                <div className="pt-1.5 border-t border-slate-200/60 dark:border-slate-800/60 flex items-center gap-2 flex-wrap text-xs">
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                    Supports Requirements:
                  </span>
                  {supported_skills.map((skill, sIdx) => (
                    <span
                      key={sIdx}
                      className="px-2.5 py-0.5 rounded-lg bg-indigo-50 dark:bg-cyan-950/40 text-indigo-700 dark:text-cyan-300 border border-indigo-200/60 dark:border-cyan-800/60 font-semibold text-[11px]"
                    >
                      ✓ {skill}
                    </span>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* 2. Unmapped Evidence (Transferable Capabilities) */}
        <div className="space-y-3 pt-2 border-t border-slate-100 dark:border-slate-800">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-xs font-bold text-slate-900 dark:text-white uppercase tracking-wider flex items-center gap-1.5">
                <Layers className="w-4 h-4 text-cyan-500" />
                Additional Portfolio Evidence ({unmappedEvidence.length})
              </h3>
              <span className="text-[11px] text-slate-500 dark:text-slate-400">
                Evidence present in your profile not explicitly requested by this role — demonstrates transferable agility.
              </span>
            </div>
          </div>

          {unmappedEvidence.length > 0 ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {unmappedEvidence.map((ev, idx) => (
                <div
                  key={ev.id || idx}
                  className="rounded-xl border border-slate-200/80 dark:border-slate-800 bg-white dark:bg-[#121826] p-3 text-xs space-y-1.5"
                >
                  <div className="flex items-start justify-between gap-1">
                    <span className="font-bold text-slate-800 dark:text-slate-100">{ev.title}</span>
                    <span className="text-[10px] text-slate-400 bg-slate-100 dark:bg-slate-800 px-1.5 py-0.5 rounded-md">
                      {ev.skill_name}
                    </span>
                  </div>
                  {ev.description && (
                    <p className="text-[11px] text-slate-500 dark:text-slate-400 line-clamp-2">
                      {ev.description}
                    </p>
                  )}
                  {ev.reference && (
                    <a
                      href={ev.reference}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex items-center gap-1 text-[10px] text-indigo-600 dark:text-cyan-400 hover:underline"
                    >
                      Inspect Link <ExternalLink className="w-2.5 h-2.5" />
                    </a>
                  )}
                </div>
              ))}
            </div>
          ) : (
            <div className="text-xs text-slate-400 italic p-3 text-center">
              All portfolio evidence is actively mapped to the selected target role requirements.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
