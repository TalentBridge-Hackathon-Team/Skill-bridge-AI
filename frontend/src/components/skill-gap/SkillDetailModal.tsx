import { useEffect, useState } from 'react';
import {
  X,
  ExternalLink,
  BookOpen,
  CheckCircle2,
  Clock,
  ArrowRight,
  ShieldCheck,
  HelpCircle,
  FileText,
  Sparkles,
  Loader2,
  Lightbulb,
  Target,
  Copy,
  Check,
  RotateCcw,
  Play,
  Award
} from 'lucide-react';
import StatusBadge from '../StatusBadge';
import type { TraceableMatchResult } from '../../utils/skillGapCalculations';
import { skillGapService } from '../../services/skillGapService';

interface SkillDetailModalProps {
  item: TraceableMatchResult | null;
  onClose: () => void;
  onOpenLinkModal: (skillName: string) => void;
  onNavigateTab: (tab: string) => void;
  userExperienceLevel?: string;
  targetRoleTitle?: string;
  userId?: string;
  feasibility?: any;
}

export default function SkillDetailModal({
  item,
  onClose,
  onOpenLinkModal,
  onNavigateTab,
  userExperienceLevel = 'Entry Level',
  targetRoleTitle = 'AI & Machine Learning Engineer',
  userId = 'usr_demo_001',
  feasibility
}: SkillDetailModalProps) {
  const [aiAdvice, setAiAdvice] = useState<import('../../types').RemediationAdvice | null>(null);
  const [isLoadingAdvice, setIsLoadingAdvice] = useState(false);
  const [adviceError, setAdviceError] = useState<string | null>(null);
  const [selectedProjectIndex, setSelectedProjectIndex] = useState<number>(0);
  const [copiedIndex, setCopiedIndex] = useState<number | null>(null);
  const [isPersisted, setIsPersisted] = useState<boolean>(false);

  const STORAGE_PREFIX = 'skillbridge_calibrated_advice_';

  const getStorageKey = () => {
    if (!item?.skill_name) return '';
    const skillKey = item.skill_name.toLowerCase().replace(/[^a-z0-9]/g, '_');
    const levelKey = (userExperienceLevel || 'entry').toLowerCase().replace(/[^a-z0-9]/g, '_');
    return `${STORAGE_PREFIX}${skillKey}_${levelKey}`;
  };

  useEffect(() => {
    if (!item?.skill_name) {
      setAiAdvice(null);
      setIsPersisted(false);
      return;
    }

    const key = getStorageKey();
    const cached = localStorage.getItem(key);
    if (cached) {
      try {
        const parsed = JSON.parse(cached);
        setAiAdvice(parsed);
        setIsPersisted(true);
        if (parsed.recommended_track_index !== undefined) {
          setSelectedProjectIndex(parsed.recommended_track_index);
        } else {
          setSelectedProjectIndex(0);
        }
      } catch {
        setAiAdvice(null);
        setIsPersisted(false);
        setSelectedProjectIndex(0);
      }
    } else {
      setAiAdvice(null);
      setIsPersisted(false);
      setSelectedProjectIndex(0);
    }
    setAdviceError(null);
    setIsLoadingAdvice(false);
  }, [item?.skill_name, userExperienceLevel]);

  const fetchAdvice = async () => {
    if (!item) return;
    setIsLoadingAdvice(true);
    setAdviceError(null);
    try {
      const advice = await skillGapService.getRemediationAdvice({
        skill_name: item.skill_name,
        category: item.category,
        importance: item.importance,
        remediation_hours: item.effort_hours_estimate,
        effort_breakdown: item.effort_breakdown,
        user_id: userId,
        experience_level: userExperienceLevel,
        role_title: targetRoleTitle,
        status: item.status,
        feasibility_status: feasibility?.feasibility_status,
        days_remaining: feasibility?.days_remaining
      });
      setAiAdvice(advice);
      if (advice.recommended_track_index !== undefined) {
        setSelectedProjectIndex(advice.recommended_track_index);
      }
      const key = getStorageKey();
      if (key) {
        localStorage.setItem(key, JSON.stringify(advice));
      }
      setIsPersisted(true);
    } catch (err: any) {
      setAdviceError(err?.message || 'Could not generate AI guidance.');
    } finally {
      setIsLoadingAdvice(false);
    }
  };

  const copyProjectPrompt = (option: import('../../types').PracticeProjectOption, index: number) => {
    const text = (
      `Project Title: ${option.title}\n` +
      `Target Skill: ${item?.skill_name}\n` +
      `Track: ${option.track} (${option.level})\n\n` +
      `Architecture Overview:\n${option.description}\n\n` +
      `Engineering Rationale:\n${option.rationale}\n\n` +
      `Key Technologies: ${option.key_tech.join(', ')}\n\n` +
      `Required Artifacts to Deliver:\n` +
      option.target_deliverables.map(d => `- ${d}`).join('\n')
    );
    navigator.clipboard.writeText(text);
    setCopiedIndex(index);
    setTimeout(() => setCopiedIndex(null), 2500);
  };

  const handleStartProject = (opt: import('../../types').PracticeProjectOption, trackIdx: number) => {
    if (!item) return;
    if (typeof window !== 'undefined') {
      const projectPayload = {
        skill_name: item.skill_name,
        track_index: trackIdx,
        track_name: opt.track,
        title: opt.title,
        description: opt.description,
        rationale: opt.rationale,
        key_tech: opt.key_tech || [],
        target_deliverables: opt.target_deliverables || [],
        time_estimate_hours: opt.time_estimate_hours,
        difficulty_tier: opt.difficulty_tier,
        level: opt.level
      };
      try {
        if (window.localStorage) {
          window.localStorage.setItem('skillbridge_selected_practice_project', JSON.stringify(projectPayload));
        }
        const url = new URL(window.location.href);
        url.searchParams.set('tab', 'assessment');
        url.searchParams.set('skill', item.skill_name);
        url.searchParams.set('track', String(trackIdx));
        window.history.replaceState({}, '', url.toString());
      } catch {}
    }
    onClose();
    onNavigateTab('assessment');
  };

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

          {/* AI Remediation Advisor (For skills with effort/gap) */}
          {item.status !== 'Demonstrated' && (
            <div className="pt-1">
              {!aiAdvice && !isLoadingAdvice && (
                <button
                  type="button"
                  onClick={fetchAdvice}
                  className="w-full py-3 px-4 rounded-xl border border-indigo-200 dark:border-indigo-800/80 bg-indigo-50/50 dark:bg-indigo-950/30 text-indigo-700 dark:text-cyan-300 hover:bg-indigo-100/60 dark:hover:bg-indigo-900/40 text-xs font-semibold flex items-center justify-center gap-2.5 transition-all cursor-pointer shadow-xs"
                >
                  <Sparkles className="w-4 h-4 text-amber-500 shrink-0" />
                  <div className="text-left">
                    <span className="block font-bold">Generate Interview & Practice Tasks</span>
                    <span className="text-[11px] font-normal text-slate-500 dark:text-slate-400">
                      Recommended interview questions and project options tailored for your timeline.
                    </span>
                  </div>
                </button>
              )}

              {isLoadingAdvice && (
                <div className="p-4 rounded-xl bg-indigo-50/50 dark:bg-indigo-950/30 border border-indigo-200 dark:border-indigo-800 text-xs text-indigo-700 dark:text-cyan-300 flex items-center justify-center gap-2">
                  <Loader2 className="w-4 h-4 animate-spin text-indigo-500" />
                  <span>Generating interview questions and practice projects for {item.skill_name}...</span>
                </div>
              )}

              {adviceError && (
                <div className="p-3 rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200/80 text-xs text-rose-700 dark:text-rose-300">
                  {adviceError}
                </div>
              )}

              {aiAdvice && (
                <div className="p-4 rounded-2xl bg-gradient-to-br from-indigo-50/60 via-purple-50/30 to-cyan-50/30 dark:from-indigo-950/40 dark:via-slate-900 dark:to-cyan-950/30 border border-indigo-200 dark:border-indigo-800/60 space-y-4 animate-in fade-in duration-200">
                  {/* Advisor Header with Persistence Status & Regenerate Button */}
                  <div className="flex items-center justify-between flex-wrap gap-2 pb-2 border-b border-indigo-100 dark:border-indigo-900/60">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-bold text-indigo-700 dark:text-cyan-400 flex items-center gap-1.5 uppercase tracking-wider">
                        <Sparkles className="w-3.5 h-3.5" />
                        Interview &amp; Practice Plan
                      </span>
                      {isPersisted && (
                        <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-emerald-700 dark:text-emerald-300 bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-200 dark:border-emerald-800 px-2 py-0.5 rounded-full">
                          <CheckCircle2 className="w-3 h-3 text-emerald-500" /> Saved
                        </span>
                      )}
                    </div>
                    
                    <button
                      type="button"
                      onClick={fetchAdvice}
                      disabled={isLoadingAdvice}
                      className="inline-flex items-center gap-1 text-[11px] font-medium text-slate-500 dark:text-slate-400 hover:text-indigo-600 dark:hover:text-cyan-300 transition-colors cursor-pointer"
                      title="Re-run to generate fresh guidance options"
                    >
                      <RotateCcw className="w-3 h-3" />
                      <span>Regenerate</span>
                    </button>
                  </div>

                  {/* Summary Bar */}
                  <div className="flex items-center justify-between flex-wrap gap-2 p-2.5 rounded-xl bg-indigo-100/60 dark:bg-indigo-950/60 border border-indigo-200/80 dark:border-indigo-800/60 text-[11px]">
                    <div className="flex items-center gap-2 text-indigo-900 dark:text-cyan-300 font-medium">
                      <span className="w-2 h-2 rounded-full bg-cyan-500 animate-pulse"></span>
                      <span>Level: <strong className="text-indigo-950 dark:text-white">{aiAdvice.experience_level || userExperienceLevel}</strong></span>
                      <span>•</span>
                      <span>Role: <strong className="text-indigo-950 dark:text-white">{aiAdvice.role_title || targetRoleTitle}</strong></span>
                      <span>•</span>
                      <span>Target Prep Time: <strong className="text-indigo-950 dark:text-white">~{item.effort_hours_estimate} hrs</strong></span>
                    </div>
                  </div>

                  {/* 1. Technical Interview Scenarios */}
                  {aiAdvice.interview_focus_questions?.length > 0 && (
                    <div className="space-y-2">
                      <span className="text-[11px] font-bold text-slate-800 dark:text-slate-200 flex items-center gap-1">
                        <Lightbulb className="w-3.5 h-3.5 text-amber-500" /> Key Interview Questions:
                      </span>
                      <ul className="space-y-1.5 text-xs text-slate-700 dark:text-slate-300 leading-relaxed">
                        {aiAdvice.interview_focus_questions.map((q, idx) => (
                          <li key={idx} className="flex items-start gap-2 bg-white/70 dark:bg-slate-900/60 p-2 rounded-xl border border-slate-200/60 dark:border-slate-800/60">
                            <span className="text-[10px] font-bold text-indigo-600 dark:text-cyan-400 bg-indigo-50 dark:bg-indigo-950 px-1.5 py-0.5 rounded-md mt-0.5">Q{idx + 1}</span>
                            <span className="font-medium text-slate-800 dark:text-slate-200">{q}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {/* 2. Practice Projects (3 Tracks) */}
                  {aiAdvice.practice_project_options && aiAdvice.practice_project_options.length > 0 ? (
                    <div className="space-y-3 pt-1">
                      <div className="flex items-center justify-between flex-wrap gap-1">
                        <span className="text-[11px] font-bold text-slate-900 dark:text-white flex items-center gap-1">
                          <Target className="w-3.5 h-3.5 text-indigo-500" /> Practice Projects (Choose 1):
                        </span>
                        <span className="text-[10px] text-emerald-600 dark:text-emerald-400 font-semibold bg-emerald-50 dark:bg-emerald-950/60 px-2 py-0.5 rounded-md border border-emerald-200/50 dark:border-emerald-800/50">
                          Fits your ~{aiAdvice.remediation_hours || item?.effort_hours_estimate || 8}h timeline
                        </span>
                      </div>

                      {/* Track Selector Tabs */}
                      <div className="flex gap-1.5 p-1 bg-slate-200/60 dark:bg-slate-950/80 rounded-xl overflow-x-auto">
                        {aiAdvice.practice_project_options.map((opt, idx) => {
                          const isSelected = selectedProjectIndex === idx;
                          const isFoundation = opt.difficulty_tier === 'foundation' || idx === 0;
                          const isStretch = opt.difficulty_tier === 'stretch' || idx === 2;
                          const isRecommended = opt.is_recommended || aiAdvice.recommended_track_index === idx;
                          return (
                            <button
                              key={idx}
                              type="button"
                              onClick={() => setSelectedProjectIndex(idx)}
                              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all whitespace-nowrap flex items-center gap-1.5 cursor-pointer ${
                                isSelected
                                  ? 'bg-white dark:bg-slate-800 text-indigo-700 dark:text-cyan-300 shadow-xs ring-1 ring-indigo-500/30'
                                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                              }`}
                            >
                              <span className={`w-4 h-4 rounded-full text-[10px] flex items-center justify-center font-bold ${
                                isFoundation
                                  ? 'bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300'
                                  : isStretch
                                  ? 'bg-amber-100 dark:bg-amber-950 text-amber-700 dark:text-amber-300'
                                  : 'bg-indigo-100 dark:bg-indigo-950 text-indigo-700 dark:text-cyan-300'
                              }`}>
                                {idx + 1}
                              </span>
                              <span>{opt.track}</span>
                              {opt.time_estimate_hours && (
                                <span className="text-[10px] opacity-75 font-normal">~{opt.time_estimate_hours}h</span>
                              )}
                              {isRecommended && (
                                <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-md bg-amber-400 dark:bg-amber-500 text-amber-950 flex items-center gap-0.5 shadow-2xs">
                                  Recommended
                                </span>
                              )}
                            </button>
                          );
                        })}
                      </div>

                      {/* Active Project Card */}
                      {(() => {
                        const activeOpt = aiAdvice.practice_project_options[selectedProjectIndex] || aiAdvice.practice_project_options[0];
                        const isRecommendedActive = activeOpt.is_recommended || aiAdvice.recommended_track_index === selectedProjectIndex;
                        return (
                          <div className="p-3.5 rounded-2xl bg-white dark:bg-[#0b0f17] border border-indigo-200/80 dark:border-indigo-900/80 space-y-3 shadow-xs">
                            <div className="flex items-start justify-between gap-3">
                              <div>
                                <div className="flex items-center gap-2 mb-1 flex-wrap">
                                  <span className="text-[10px] font-bold uppercase tracking-wider text-indigo-600 dark:text-cyan-400 bg-indigo-50 dark:bg-indigo-950 px-2 py-0.5 rounded-md">
                                    {activeOpt.track}
                                  </span>
                                  {isRecommendedActive && (
                                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-amber-400 dark:bg-amber-500 text-amber-950 flex items-center gap-1 shadow-2xs">
                                      Recommended
                                    </span>
                                  )}
                                  <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-md ${
                                    activeOpt.difficulty_tier === 'foundation'
                                      ? 'bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 border border-emerald-200/60 dark:border-emerald-800/60'
                                      : activeOpt.difficulty_tier === 'stretch'
                                      ? 'bg-amber-50 dark:bg-amber-950/60 text-amber-700 dark:text-amber-300 border border-amber-200/60 dark:border-amber-800/60'
                                      : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300'
                                  }`}>
                                    {activeOpt.level}
                                  </span>
                                  {activeOpt.time_estimate_hours && (
                                    <span className="text-[10px] font-semibold text-slate-500 bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded-md">
                                      Est. ~{activeOpt.time_estimate_hours} hrs
                                    </span>
                                  )}
                                  {(() => {
                                    const budget = Math.round(aiAdvice.remediation_hours || item?.effort_hours_estimate || 8);
                                    const hrs = activeOpt.time_estimate_hours;
                                    if (!hrs) return null;
                                    if (hrs < budget) {
                                      return (
                                        <span className="text-[10px] font-semibold text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/50 px-2 py-0.5 rounded-md border border-emerald-200/50">
                                          ~{hrs}h • Fits budget
                                        </span>
                                      );
                                    } else if (hrs === budget) {
                                      return (
                                        <span className="text-[10px] font-semibold text-indigo-600 dark:text-cyan-400 bg-indigo-50 dark:bg-indigo-950/50 px-2 py-0.5 rounded-md border border-indigo-200/50">
                                          ~{budget}h target
                                        </span>
                                      );
                                    } else {
                                      return (
                                        <span className="text-[10px] font-semibold text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/50 px-2 py-0.5 rounded-md border border-amber-200/50">
                                          ~{hrs}h stretch
                                        </span>
                                      );
                                    }
                                  })()}
                                </div>
                                <h4 className="text-sm font-bold text-slate-900 dark:text-white">
                                  {activeOpt.title}
                                </h4>
                              </div>

                              <div className="flex items-center gap-1.5 shrink-0">
                                <button
                                  type="button"
                                  onClick={() => copyProjectPrompt(activeOpt, selectedProjectIndex)}
                                  className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-[11px] font-semibold bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 transition-colors cursor-pointer"
                                  title="Copy project prompt for Claude, ChatGPT, or Cursor"
                                >
                                  {copiedIndex === selectedProjectIndex ? (
                                    <>
                                      <Check className="w-3 h-3 text-emerald-500" />
                                      <span className="text-emerald-600 dark:text-emerald-400">Copied!</span>
                                    </>
                                  ) : (
                                    <>
                                      <Copy className="w-3 h-3" />
                                      <span>Copy Spec</span>
                                    </>
                                  )}
                                </button>

                                <button
                                  type="button"
                                  onClick={() => handleStartProject(activeOpt, selectedProjectIndex)}
                                  className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg text-[11px] font-bold bg-indigo-600 hover:bg-indigo-700 text-white shadow-xs transition-all cursor-pointer"
                                  title="Load this project directly into the Practical Assessment tab"
                                >
                                  <Play className="w-3 h-3 fill-white" />
                                  <span>Start Project</span>
                                  <ArrowRight className="w-3 h-3" />
                                </button>
                              </div>
                            </div>

                            {/* Recommendation Callout Banner */}
                            {isRecommendedActive && (aiAdvice.recommendation_rationale || activeOpt.recommendation_rationale) && (
                              <div className="p-3 rounded-xl bg-amber-500/10 dark:bg-amber-500/15 border border-amber-400/40 text-xs space-y-1">
                                <div className="flex items-center gap-1.5 text-amber-800 dark:text-amber-300 font-bold text-[11px] uppercase tracking-wider">
                                  <Sparkles className="w-3.5 h-3.5 text-amber-500 fill-amber-400" />
                                  <span>Why we recommend this project:</span>
                                </div>
                                <p className="text-xs text-slate-700 dark:text-slate-200 leading-relaxed font-normal">
                                  {aiAdvice.recommendation_rationale || activeOpt.recommendation_rationale}
                                </p>
                              </div>
                            )}

                            {/* Alternative Option Notice with 1-click switch */}
                            {!isRecommendedActive && aiAdvice.recommended_track_index !== undefined && (
                              <div className="flex items-center justify-between p-2.5 rounded-xl bg-slate-100 dark:bg-slate-900/80 border border-slate-200 dark:border-slate-800 text-xs">
                                <span className="text-slate-600 dark:text-slate-300 text-[11px] flex items-center gap-1.5">
                                  <Lightbulb className="w-3.5 h-3.5 text-amber-500 shrink-0" />
                                  <span>
                                    Alternative option • Track {aiAdvice.recommended_track_index + 1} is recommended for your profile.
                                  </span>
                                </span>
                                <button
                                  type="button"
                                  onClick={() => setSelectedProjectIndex(aiAdvice.recommended_track_index!)}
                                  className="text-[11px] font-bold text-indigo-600 dark:text-cyan-400 hover:underline cursor-pointer shrink-0 ml-2"
                                >
                                  Switch to Recommended →
                                </button>
                              </div>
                            )}

                            <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
                              {activeOpt.description}
                            </p>

                            {/* Rationale Callout */}
                            <div className="p-2.5 rounded-xl bg-amber-50/70 dark:bg-amber-950/30 border border-amber-200/70 dark:border-amber-800/60 space-y-0.5">
                              <span className="text-[10px] font-bold text-amber-800 dark:text-amber-300 uppercase tracking-wider flex items-center gap-1">
                                Why this project matters:
                              </span>
                              <p className="text-xs text-amber-900 dark:text-amber-200 leading-relaxed">
                                {activeOpt.rationale}
                              </p>
                            </div>

                            {/* Key Tech Tags */}
                            {activeOpt.key_tech?.length > 0 && (
                              <div className="flex items-center gap-1.5 flex-wrap">
                                <span className="text-[10px] font-semibold text-slate-400">Tech:</span>
                                {activeOpt.key_tech.map((t, tidx) => (
                                  <span
                                    key={tidx}
                                    className="text-[10px] font-medium bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 px-2 py-0.5 rounded-md border border-slate-200 dark:border-slate-700"
                                  >
                                    {t}
                                  </span>
                                ))}
                              </div>
                            )}

                            {/* Target Deliverables Checklist */}
                            {activeOpt.target_deliverables?.length > 0 && (
                              <div className="pt-1 border-t border-slate-100 dark:border-slate-800 space-y-1">
                                <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">
                                  Key deliverables to build:
                                </span>
                                <ul className="space-y-1">
                                  {activeOpt.target_deliverables.map((d, didx) => (
                                    <li key={didx} className="text-xs text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                                      <span className="w-1.5 h-1.5 rounded-full bg-indigo-500 shrink-0"></span>
                                      <span className="font-mono text-[11px]">{d}</span>
                                    </li>
                                  ))}
                                </ul>
                              </div>
                            )}

                            {/* Launch Assessment Action Strip */}
                            <div className="pt-2 flex items-center justify-between border-t border-slate-100 dark:border-slate-800/80">
                              <span className="text-[11px] text-slate-500 dark:text-slate-400 flex items-center gap-1">
                                <Award className="w-3.5 h-3.5 text-indigo-500" />
                                <span>Verify this project to earn 10/10 proof</span>
                              </span>
                              <button
                                type="button"
                                onClick={() => handleStartProject(activeOpt, selectedProjectIndex)}
                                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold bg-gradient-to-r from-indigo-600 to-indigo-700 hover:from-indigo-500 hover:to-indigo-600 text-white shadow-xs transition-all cursor-pointer"
                              >
                                <span>Launch {activeOpt.track} Assessment</span>
                                <ArrowRight className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          </div>
                        );
                      })()}
                    </div>
                  ) : (
                    /* Fallback Single Exercise */
                    aiAdvice.hands_on_project_exercise && (
                      <div className="p-3 rounded-xl bg-white/80 dark:bg-slate-900/80 border border-slate-200/80 dark:border-slate-800 space-y-1">
                        <span className="text-[11px] font-bold text-slate-900 dark:text-white flex items-center gap-1">
                          <Target className="w-3.5 h-3.5 text-indigo-500" /> Practical Build Challenge:
                        </span>
                        <p className="text-xs text-slate-700 dark:text-slate-300 leading-relaxed">
                          {aiAdvice.hands_on_project_exercise}
                        </p>
                      </div>
                    )
                  )}

                  {/* High-level Artifacts */}
                  {aiAdvice.recommended_deliverables?.length > 0 && (
                    <div className="text-[11px] text-slate-500 dark:text-slate-400 pt-1 border-t border-indigo-100 dark:border-indigo-900/40">
                      <span className="font-semibold block mb-0.5">Evaluation checklist:</span>
                      <ul className="list-disc list-inside space-y-0.5 text-[11px]">
                        {aiAdvice.recommended_deliverables.map((d, idx) => (
                          <li key={idx}>{d}</li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
        </div>

        {/* 3. Supporting Evidence Records */}
        <div className="space-y-3">
          <div className="flex justify-between items-center">
            <h3 className="text-xs font-bold text-slate-900 dark:text-white uppercase tracking-wider flex items-center gap-1.5">
              <FileText className="w-3.5 h-3.5 text-indigo-500" />
              Linked Evidence ({item.supporting_evidence.length})
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
                    const activeOpt = aiAdvice?.practice_project_options?.[selectedProjectIndex];
                    if (activeOpt) {
                      handleStartProject(activeOpt, selectedProjectIndex);
                    } else {
                      if (typeof window !== 'undefined') {
                        try {
                          const url = new URL(window.location.href);
                          url.searchParams.set('tab', 'assessment');
                          url.searchParams.set('skill', item.skill_name);
                          window.history.replaceState({}, '', url.toString());
                        } catch {}
                      }
                      onClose();
                      onNavigateTab('assessment');
                    }
                  }}
                  className="inline-flex items-center gap-1.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-3.5 py-2 text-xs font-semibold text-slate-800 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors"
                >
                  <Award className="w-3.5 h-3.5 text-indigo-500" />
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
