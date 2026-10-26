import { useState, useEffect, useMemo } from 'react';
import type { FormEvent } from 'react';
import {
  X,
  Link2,
  CheckCircle2,
  ShieldCheck,
  FolderGit2,
  Sparkles,
  Loader2,
  AlertCircle,
  AlertTriangle,
  Star,
  Check,
  Cpu,
  Clock
} from 'lucide-react';
import type { SkillEvidence } from '../../types';
import { skillGapService } from '../../services/skillGapService';
import { evaluateInputSafetyAndDomain } from '../../utils/domainGuard';

interface LinkEvidenceModalProps {
  initialSkillName?: string;
  isOpen: boolean;
  onClose: () => void;
  onSubmitEvidence: (evidence: Omit<SkillEvidence, 'id' | 'evidence_id'>) => Promise<void>;
  availableSkills: string[];
}

interface InspectionResult {
  success: boolean;
  skill_name: string;
  evidence_title: string;
  repository_url: string;
  github_verified: boolean;
  github_metadata?: {
    full_name: string;
    stars: number;
    languages: string[];
    has_automated_tests: boolean;
    has_docker: boolean;
    root_files_sample: string[];
  };
  verification_score: number;
  suggested_status: 'verified' | 'needs_improvement' | 'unverified';
  has_automated_tests: boolean;
  detected_technologies: string[];
  strengths: string[];
  recommendations: string[];
  summary_rationale: string;
  evaluation_mode?: 'ai_llm' | 'fallback_heuristic';
  model_used?: string;
}

export default function LinkEvidenceModal({
  initialSkillName,
  isOpen,
  onClose,
  onSubmitEvidence,
  availableSkills
}: LinkEvidenceModalProps) {
  const [isCustomSkill, setIsCustomSkill] = useState(
    Boolean(initialSkillName && !availableSkills.includes(initialSkillName))
  );
  const [customSkillInput, setCustomSkillInput] = useState(
    initialSkillName && !availableSkills.includes(initialSkillName) ? initialSkillName : ''
  );
  const [skillName, setSkillName] = useState(initialSkillName || availableSkills[0] || '');
  const [title, setTitle] = useState('');
  const [reference, setReference] = useState('');
  const [evidenceType, setEvidenceType] = useState<'project' | 'self_reported' | 'assessment'>('project');
  const [reviewStatus, setReviewStatus] = useState<'verified' | 'unverified' | 'needs_improvement'>('verified');
  const [description, setDescription] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [successMessage, setSuccessMessage] = useState('');

  // AI Inspection state
  const [isInspecting, setIsInspecting] = useState(false);
  const [inspectionResult, setInspectionResult] = useState<InspectionResult | null>(null);
  const [inspectError, setInspectError] = useState<string | null>(null);

  useEffect(() => {
    if (initialSkillName) {
      if (availableSkills.includes(initialSkillName)) {
        setSkillName(initialSkillName);
        setIsCustomSkill(false);
        setCustomSkillInput('');
      } else {
        setSkillName(initialSkillName);
        setIsCustomSkill(true);
        setCustomSkillInput(initialSkillName);
      }
    } else if (!skillName && availableSkills.length > 0 && !isCustomSkill) {
      setSkillName(availableSkills[0]);
    }
  }, [initialSkillName, availableSkills]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    if (isOpen) {
      window.addEventListener('keydown', handleKeyDown);
    }
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  const effectiveSkillName = (isCustomSkill ? customSkillInput : skillName).trim();

  const liveGuardCheck = useMemo(() => {
    return evaluateInputSafetyAndDomain(`${title} ${description}`, effectiveSkillName);
  }, [title, description, effectiveSkillName]);

  if (!isOpen) return null;

  const handleAiInspect = async () => {
    if (!reference || !effectiveSkillName) {
      setInspectError('Please specify target skill and repository URL before running AI inspection.');
      return;
    }

    setIsInspecting(true);
    setInspectError(null);

    try {
      const result = await skillGapService.inspectEvidence({
        repository_url: reference,
        skill_name: effectiveSkillName,
        title: title || `Implementation of ${effectiveSkillName}`,
        description
      });

      setInspectionResult(result);

      // Auto-set the recommended review status based on AI verification audit
      if (result.suggested_status) {
        setReviewStatus(result.suggested_status);
      }
    } catch (err: any) {
      setInspectError(err?.message || 'Failed to inspect evidence repository. Check network or repository URL.');
    } finally {
      setIsInspecting(false);
    }
  };

  const applyAiSummaryToNotes = () => {
    if (!inspectionResult) return;
    const summary = `${inspectionResult.summary_rationale} Verified Score: ${inspectionResult.verification_score}/100. Technologies: ${inspectionResult.detected_technologies.join(', ')}.`;
    setDescription(summary);
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!effectiveSkillName || !title) return;

    if (liveGuardCheck.type === 'security') {
      setInspectError(liveGuardCheck.message || 'Suspicious input blocked.');
      return;
    }

    setIsSubmitting(true);
    try {
      await onSubmitEvidence({
        skill_name: effectiveSkillName,
        title,
        reference,
        evidence_type: evidenceType,
        review_status: reviewStatus,
        description
      });
      setSuccessMessage(`Successfully linked evidence for ${effectiveSkillName}!`);
      setTimeout(() => {
        setSuccessMessage('');
        setIsSubmitting(false);
        onClose();
      }, 1000);
    } catch (err) {
      console.error('Evidence submission failed in modal:', err);
      setIsSubmitting(false);
    }
  };

  const fillQuickPreset = (preset: {
    title: string;
    ref: string;
    desc: string;
    type: 'project' | 'self_reported' | 'assessment';
    status: 'verified' | 'unverified' | 'needs_improvement';
    skill?: string;
  }) => {
    setTitle(preset.title);
    setReference(preset.ref);
    setDescription(preset.desc);
    setEvidenceType(preset.type);
    setReviewStatus(preset.status);
    if (preset.skill) {
      if (availableSkills.includes(preset.skill)) {
        setSkillName(preset.skill);
        setIsCustomSkill(false);
        setCustomSkillInput('');
      } else {
        setSkillName(preset.skill);
        setIsCustomSkill(true);
        setCustomSkillInput(preset.skill);
      }
    }
    setInspectionResult(null);
    setInspectError(null);
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-200"
      role="dialog"
      aria-modal="true"
      aria-labelledby="link-evidence-title"
    >
      <div
        className="w-full max-w-xl max-h-[90vh] overflow-y-auto rounded-3xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#0e131f] shadow-2xl p-6 space-y-5"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-indigo-500/10 text-indigo-600 dark:text-cyan-400">
              <Link2 className="w-5 h-5" />
            </div>
            <div>
              <h2 id="link-evidence-title" className="text-lg font-bold text-slate-900 dark:text-white">
                Link Supporting Evidence
              </h2>
              <span className="text-xs text-slate-500 dark:text-slate-400">
                Connect code repositories, tests, or certificates to verify target requirements
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

        {/* Quick Demo Presets */}
        <div className="p-3 rounded-2xl bg-slate-50 dark:bg-slate-950/70 border border-slate-200/80 dark:border-slate-800/80 space-y-2">
          <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">
            Quick Fill Presets (Test Live Deterministic Matching & AI Inspection):
          </span>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() =>
                fillQuickPreset({
                  title: 'PostgreSQL Relational Schema & Query Optimization',
                  ref: 'https://github.com/psycopg/psycopg2',
                  desc: 'Production database client with connection pooling, type adapters, and transaction handling.',
                  type: 'project',
                  status: 'verified',
                  skill: 'PostgreSQL'
                })
              }
              className="text-[11px] font-semibold px-2.5 py-1 rounded-lg bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 hover:border-indigo-400 transition-colors cursor-pointer"
            >
              + Verified PostgreSQL Repo
            </button>
            <button
              type="button"
              onClick={() =>
                fillQuickPreset({
                  title: 'REST API Pytest & Integration Test Suite',
                  ref: 'https://github.com/tiangolo/fastapi',
                  desc: 'Modern web framework test suite with automated typing and schema validation.',
                  type: 'project',
                  status: 'verified',
                  skill: 'API Testing'
                })
              }
              className="text-[11px] font-semibold px-2.5 py-1 rounded-lg bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 hover:border-indigo-400 transition-colors cursor-pointer"
            >
              + Verified API Test Suite
            </button>
            <button
              type="button"
              onClick={() =>
                fillQuickPreset({
                  title: 'Docker Microservices Compose Topology',
                  ref: 'https://github.com/docker/awesome-compose',
                  desc: 'Multi-service deployment topology with isolated networks and healthchecks.',
                  type: 'project',
                  status: 'verified',
                  skill: 'Docker'
                })
              }
              className="text-[11px] font-semibold px-2.5 py-1 rounded-lg bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 hover:border-indigo-400 transition-colors cursor-pointer"
            >
              + Custom Docker Repo
            </button>
          </div>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Target Skill Selector (Dropdown or Custom Input) */}
          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300">
                Target Skill Requirement *
              </label>
              <button
                type="button"
                onClick={() => {
                  const nextState = !isCustomSkill;
                  setIsCustomSkill(nextState);
                  if (nextState) {
                    setSkillName(customSkillInput);
                  } else {
                    setSkillName(availableSkills[0] || '');
                  }
                }}
                className="text-[11px] font-semibold text-indigo-600 dark:text-cyan-400 hover:underline cursor-pointer flex items-center gap-1"
              >
                {isCustomSkill ? '← Select from role list' : '+ Enter custom skill'}
              </button>
            </div>

            {!isCustomSkill ? (
              <div className="relative">
                <select
                  value={skillName}
                  onChange={e => {
                    if (e.target.value === '__custom__') {
                      setIsCustomSkill(true);
                      setSkillName('');
                    } else {
                      setSkillName(e.target.value);
                    }
                  }}
                  className="w-full text-xs rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 p-2.5 text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-indigo-500 cursor-pointer"
                  required={!isCustomSkill}
                >
                  <option value="">Select a skill requirement...</option>
                  <optgroup label="Target Role Requirements">
                    {availableSkills.map((s, idx) => (
                      <option key={idx} value={s}>
                        {s}
                      </option>
                    ))}
                  </optgroup>
                  <optgroup label="Other Capabilities">
                    <option value="__custom__">✏️ + Enter custom skill not listed above...</option>
                  </optgroup>
                </select>
              </div>
            ) : (
              <div className="space-y-2 animate-in fade-in duration-150">
                <div className="relative">
                  <input
                    type="text"
                    value={customSkillInput}
                    onChange={e => {
                      setCustomSkillInput(e.target.value);
                      setSkillName(e.target.value);
                    }}
                    placeholder="e.g. Docker, Kubernetes, Redis, TypeScript, CI/CD..."
                    className="w-full text-xs rounded-xl border border-indigo-400 dark:border-indigo-600 bg-indigo-50/30 dark:bg-indigo-950/20 p-2.5 text-slate-900 dark:text-white pl-8 focus:outline-none focus:ring-2 focus:ring-indigo-500 font-medium"
                    required={isCustomSkill}
                    autoFocus
                  />
                  <Sparkles className="w-4 h-4 text-indigo-500 dark:text-cyan-400 absolute left-2.5 top-2.5" />
                </div>

                {/* Popular suggestions quick chips */}
                <div className="flex items-center gap-1.5 flex-wrap">
                  <span className="text-[10px] text-slate-400 font-medium">Quick suggestions:</span>
                  {['Docker', 'TypeScript', 'Kubernetes', 'Redis', 'FastAPI', 'CI/CD'].map((sug, sIdx) => (
                    <button
                      key={sIdx}
                      type="button"
                      onClick={() => {
                        setCustomSkillInput(sug);
                        setSkillName(sug);
                      }}
                      className="text-[10px] px-2 py-0.5 rounded-md bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-indigo-50 hover:text-indigo-600 dark:hover:bg-indigo-950 dark:hover:text-cyan-300 border border-slate-200 dark:border-slate-700 transition-colors cursor-pointer"
                    >
                      +{sug}
                    </button>
                  ))}
                </div>

                <div className="flex items-center justify-between text-[11px] pt-0.5">
                  <span className="text-slate-500 dark:text-slate-400">
                    Custom skill • Added as transferable portfolio evidence.
                  </span>
                  <button
                    type="button"
                    onClick={() => {
                      setIsCustomSkill(false);
                      setCustomSkillInput('');
                      setSkillName(availableSkills[0] || '');
                    }}
                    className="text-indigo-600 dark:text-cyan-400 hover:underline font-medium cursor-pointer"
                  >
                    Switch back to dropdown
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Domain / Safety Feedback Banner */}
          {liveGuardCheck.type === 'domain' && (
            <div className="p-3.5 rounded-2xl bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800 text-xs text-amber-850 dark:text-amber-200 flex items-start gap-2.5 animate-in fade-in duration-200">
              <AlertTriangle className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
              <div>
                <strong className="block font-semibold">Domain In Active Development</strong>
                <p className="mt-0.5 text-[11px] leading-relaxed">
                  {liveGuardCheck.message}
                </p>
                {liveGuardCheck.alternatives && liveGuardCheck.alternatives.length > 0 && (
                  <div className="flex items-center gap-1.5 flex-wrap mt-2">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-amber-700 dark:text-amber-400">
                      Suggested Tech Paths:
                    </span>
                    {liveGuardCheck.alternatives.map((alt, idx) => (
                      <span
                        key={idx}
                        className="text-[10px] px-2 py-0.5 rounded-md bg-white dark:bg-slate-900 border border-amber-300 dark:border-amber-700 text-amber-800 dark:text-amber-300 font-medium"
                      >
                        {alt}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}

          {liveGuardCheck.type === 'security' && (
            <div className="p-3.5 rounded-2xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900 text-xs text-rose-850 dark:text-rose-200 flex items-start gap-2.5 animate-in fade-in duration-200">
              <AlertCircle className="w-4 h-4 text-rose-600 dark:text-rose-400 shrink-0 mt-0.5" />
              <div>
                <strong className="block font-semibold">Security & Verification Guardrail</strong>
                <p className="mt-0.5 text-[11px] leading-relaxed">
                  {liveGuardCheck.message}
                </p>
              </div>
            </div>
          )}

          {/* Evidence Title */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
              Evidence Title / Project Name *
            </label>
            <input
              type="text"
              value={title}
              onChange={e => setTitle(e.target.value)}
              placeholder="e.g. Order Processing Relational Database Schema"
              className="w-full text-xs rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 p-2.5 text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-indigo-500"
              required
            />
          </div>

          {/* Reference URL + AI Inspection Button */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300">
                Artifact Reference URL (GitHub Repository, PR, or Cert)
              </label>
              {reference && reference.includes('github.com') && (
                <span className="text-[10px] text-indigo-500 dark:text-cyan-400 font-semibold flex items-center gap-1">
                  <Sparkles className="w-3 h-3" /> GitHub URL detected
                </span>
              )}
            </div>

            <div className="relative">
              <input
                type="url"
                value={reference}
                onChange={e => setReference(e.target.value)}
                placeholder="https://github.com/username/project"
                className="w-full text-xs rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 p-2.5 text-slate-800 dark:text-slate-100 pl-8 focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
              <FolderGit2 className="w-4 h-4 text-slate-400 absolute left-2.5 top-3" />
            </div>

            {/* AI Repository Inspection Trigger */}
            <div className="flex items-center justify-between pt-1">
              <button
                type="button"
                onClick={handleAiInspect}
                disabled={isInspecting || !reference}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-gradient-to-r from-indigo-600 via-indigo-500 to-cyan-500 hover:from-indigo-700 hover:to-cyan-600 text-white font-semibold text-xs shadow-xs disabled:opacity-50 transition-all cursor-pointer"
              >
                {isInspecting ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    <span>Inspecting GitHub Repository & Code...</span>
                  </>
                ) : (
                  <>
                    <Sparkles className="w-3.5 h-3.5" />
                    <span>✨ AI Inspect & Verify Repository</span>
                  </>
                )}
              </button>

              <span className="text-[10px] text-slate-400">
                Queries GitHub API & OpenRouter AI
              </span>
            </div>

            {inspectError && (
              <div className="p-2.5 rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200/80 dark:border-rose-800/80 text-xs text-rose-700 dark:text-rose-300 flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0 text-rose-500" />
                <span>{inspectError}</span>
              </div>
            )}

            {/* AI Inspection Results Card */}
            {inspectionResult && (
              <div className="p-4 rounded-2xl bg-gradient-to-br from-indigo-50/70 via-slate-50 to-cyan-50/40 dark:from-indigo-950/30 dark:via-slate-900 dark:to-cyan-950/20 border border-indigo-200/80 dark:border-indigo-800/60 space-y-3 animate-in fade-in duration-200">
                {/* Score & GitHub info */}
                <div className="flex items-center justify-between flex-wrap gap-2">
                  <div className="flex items-center gap-2">
                    <span
                      className={`text-xs font-bold px-2.5 py-1 rounded-lg flex items-center gap-1.5 ${
                        inspectionResult.verification_score >= 70
                          ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-800'
                          : inspectionResult.verification_score >= 40
                          ? 'bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300 border border-amber-300 dark:border-amber-800'
                          : 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300 border border-slate-300 dark:border-slate-700'
                      }`}
                    >
                      <Sparkles className="w-3.5 h-3.5" />
                      AI Score: {inspectionResult.verification_score}/100
                    </span>

                    <span className="text-[11px] font-semibold text-slate-600 dark:text-slate-300 capitalize">
                      Status: {inspectionResult.suggested_status.replace('_', ' ')}
                    </span>
                  </div>

                  {inspectionResult.github_verified && (
                    <div className="flex items-center gap-2 text-[11px] text-slate-500 dark:text-slate-400">
                      {inspectionResult.github_metadata?.stars !== undefined && (
                        <span className="flex items-center gap-1">
                          <Star className="w-3 h-3 text-amber-500 fill-amber-500" />
                          {inspectionResult.github_metadata.stars}
                        </span>
                      )}
                      {inspectionResult.has_automated_tests && (
                        <span className="text-emerald-600 dark:text-emerald-400 font-semibold flex items-center gap-1">
                          <Check className="w-3 h-3" /> Tests Detected
                        </span>
                      )}
                    </div>
                  )}
                </div>

                {/* Summary rationale */}
                <p className="text-xs text-slate-700 dark:text-slate-200 leading-relaxed italic">
                  "{inspectionResult.summary_rationale}"
                </p>

                {/* Detected tech chips */}
                {inspectionResult.detected_technologies.length > 0 && (
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider flex items-center gap-1">
                      <Cpu className="w-3 h-3 text-indigo-500" /> Stack (click to target):
                    </span>
                    {inspectionResult.detected_technologies.map((t, idx) => (
                      <button
                        key={idx}
                        type="button"
                        onClick={() => {
                          if (availableSkills.includes(t)) {
                            setSkillName(t);
                            setIsCustomSkill(false);
                            setCustomSkillInput('');
                          } else {
                            setIsCustomSkill(true);
                            setCustomSkillInput(t);
                            setSkillName(t);
                          }
                        }}
                        className="text-[10px] font-semibold px-2 py-0.5 rounded-md bg-white dark:bg-slate-800 hover:bg-indigo-50 dark:hover:bg-indigo-950 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:text-indigo-600 dark:hover:text-cyan-300 transition-colors cursor-pointer"
                        title={`Click to set target skill to "${t}"`}
                      >
                        +{t}
                      </button>
                    ))}
                  </div>
                )}

                {/* Strengths & Recommendations */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-[11px]">
                  {inspectionResult.strengths?.length > 0 && (
                    <div className="space-y-1">
                      <span className="font-bold text-emerald-700 dark:text-emerald-400 block">
                        Verified Strengths:
                      </span>
                      <ul className="list-disc list-inside space-y-0.5 text-slate-600 dark:text-slate-400">
                        {inspectionResult.strengths.slice(0, 2).map((s, idx) => (
                          <li key={idx}>{s}</li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {inspectionResult.recommendations?.length > 0 && (
                    <div className="space-y-1">
                      <span className="font-bold text-amber-700 dark:text-amber-400 block">
                        Suggestions to Level-Up:
                      </span>
                      <ul className="list-disc list-inside space-y-0.5 text-slate-600 dark:text-slate-400">
                        {inspectionResult.recommendations.slice(0, 2).map((r, idx) => (
                          <li key={idx}>{r}</li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>

                {/* Apply summary button */}
                <div className="pt-1 flex justify-end">
                  <button
                    type="button"
                    onClick={applyAiSummaryToNotes}
                    className="text-[11px] font-semibold text-indigo-600 dark:text-cyan-400 hover:underline flex items-center gap-1 cursor-pointer"
                  >
                    <span>Apply AI Summary to Description Notes</span>
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Evidence Type & Review Status */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Evidence Type
              </label>
              <select
                value={evidenceType}
                onChange={e => setEvidenceType(e.target.value as any)}
                className="w-full text-xs rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 p-2.5 text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-indigo-500"
              >
                <option value="project">Project Repository / Code</option>
                <option value="assessment">Verified Assessment</option>
                <option value="self_reported">Self-Reported Claim</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                System Review Status
              </label>
              <div className="w-full text-xs rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/60 p-2.5 flex items-center justify-between">
                <span className={`font-semibold capitalize flex items-center gap-1.5 ${
                  reviewStatus === 'verified'
                    ? 'text-emerald-600 dark:text-emerald-400'
                    : reviewStatus === 'needs_improvement'
                    ? 'text-rose-600 dark:text-rose-400'
                    : 'text-amber-600 dark:text-amber-400'
                }`}>
                  {reviewStatus === 'verified' ? <CheckCircle2 className="w-3.5 h-3.5" /> : <Clock className="w-3.5 h-3.5" />}
                  {reviewStatus.replace('_', ' ')}
                </span>
                <span className="text-[10px] text-slate-400">
                  Verified automatically
                </span>
              </div>
            </div>
          </div>

          {/* Description */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
              Description & Verification Notes
            </label>
            <textarea
              rows={2}
              value={description}
              onChange={e => setDescription(e.target.value)}
              placeholder="Describe how this project demonstrates mastery of the skill..."
              className="w-full text-xs rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 p-2.5 text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>

          {/* Success Message Banner */}
          {successMessage && (
            <div className="p-3 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200/80 dark:border-emerald-800/80 text-xs text-emerald-700 dark:text-emerald-300 flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" />
              <span>{successMessage}</span>
            </div>
          )}

          {/* Submit Actions */}
          <div className="flex justify-end gap-2.5 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs font-semibold rounded-xl border border-slate-300 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300 transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting || !title || !effectiveSkillName}
              className="px-5 py-2 text-xs font-semibold rounded-xl bg-slate-900 dark:bg-white text-white dark:text-slate-900 hover:bg-slate-800 dark:hover:bg-slate-100 disabled:opacity-50 transition-colors shadow-xs flex items-center gap-1.5"
            >
              <ShieldCheck className="w-3.5 h-3.5" />
              <span>{isSubmitting ? 'Linking Evidence...' : 'Save & Recalculate Match'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
