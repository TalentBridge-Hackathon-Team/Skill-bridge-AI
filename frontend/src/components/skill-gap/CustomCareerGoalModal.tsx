import { useState, useMemo, useEffect } from 'react';
import { X, Sparkles, Target, Calendar, Clock, Loader2, ArrowRight, AlertTriangle, ShieldAlert } from 'lucide-react';

import { evaluateInputSafetyAndDomain } from '../../utils/domainGuard';

interface CustomCareerGoalModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (data: {
    role_title: string;
    goal_description: string;
    days_remaining: number;
    study_hours_per_week: number;
  }) => Promise<void>;
}

const GOAL_INSPIRATIONS = [
  {
    title: 'AI & Machine Learning Engineer',
    days: 60,
    hours: 15,
    description: 'Transition from general software engineering to AI Engineering. Focus on Python model pipelines, deep learning with PyTorch, vector embeddings with pgvector, and Retrieval-Augmented Generation (RAG) architectures with LLMs.'
  },
  {
    title: 'Cloud & DevOps Solutions Architect',
    days: 45,
    hours: 14,
    description: 'Transition into Cloud & Infrastructure Architecture. Focus on hands-on AWS administration, Docker containerization, Kubernetes cluster orchestration, Terraform Infrastructure as Code, and automated CI/CD pipelines.'
  },
  {
    title: 'Full Stack Engineering Mastery',
    days: 30,
    hours: 12,
    description: 'Expand from backend development into full stack engineering. Focus on modern React 19, TypeScript component state architectures, Next.js App Router, TailwindCSS design systems, and automated end-to-end testing.'
  },
  {
    title: 'High-Throughput Systems Engineer',
    days: 60,
    hours: 10,
    description: 'Advance into distributed systems and platform engineering. Focus on Go and Rust microservices, high-performance PostgreSQL query optimization, Redis caching layers, and asynchronous event streaming with Apache Kafka.'
  }
];

export default function CustomCareerGoalModal({
  isOpen,
  onClose,
  onSubmit
}: CustomCareerGoalModalProps) {
  const [roleTitle, setRoleTitle] = useState('');
  const [goalDescription, setGoalDescription] = useState('');
  const [daysRemaining, setDaysRemaining] = useState(45);
  const [studyHoursPerWeek, setStudyHoursPerWeek] = useState(14);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    if (isOpen) {
      window.addEventListener('keydown', handleKeyDown);
    }
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  const liveCheck = useMemo(() => {
    const res = evaluateInputSafetyAndDomain(goalDescription, roleTitle);
    if (res.type === 'security') {
      return {
        type: 'security' as const,
        message: res.message!
      };
    }
    if (res.type === 'domain') {
      return {
        type: 'domain' as const,
        domainName: res.detectedDomain!,
        alternatives: res.alternatives || [],
        message: res.message!
      };
    }
    return null;
  }, [roleTitle, goalDescription]);

  if (!isOpen) return null;

  const handleApplyInspiration = (inspiration: typeof GOAL_INSPIRATIONS[0]) => {
    setRoleTitle(inspiration.title);
    setGoalDescription(inspiration.description);
    setDaysRemaining(inspiration.days);
    setStudyHoursPerWeek(inspiration.hours);
    setError(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!roleTitle.trim()) {
      setError('Please provide a target role or career milestone title.');
      return;
    }
    if (!goalDescription.trim()) {
      setError('Please describe what you want to achieve or learn in this career milestone.');
      return;
    }

    if (liveCheck?.type === 'security') {
      setError(liveCheck.message);
      return;
    }

    if (liveCheck?.type === 'domain') {
      setError(liveCheck.message);
      return;
    }

    setIsSubmitting(true);
    setError(null);
    try {
      await onSubmit({
        role_title: roleTitle.trim(),
        goal_description: goalDescription.trim(),
        days_remaining: daysRemaining,
        study_hours_per_week: studyHoursPerWeek
      });
      onClose();
    } catch (err: any) {
      console.error('Failed to create career goal:', err);
      setError(err.message || 'AI extraction failed. Please verify connection.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-200">
      <div className="bg-white dark:bg-[#121826] rounded-2xl border border-slate-200 dark:border-slate-800 shadow-2xl max-w-2xl w-full max-h-[92vh] overflow-y-auto">
        {/* Modal Header */}
        <div className="sticky top-0 bg-white/95 dark:bg-[#121826]/95 backdrop-blur-xs p-5 border-b border-slate-100 dark:border-slate-800/80 flex items-center justify-between z-10">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-indigo-500/10 text-indigo-600 dark:text-cyan-400">
              <Target className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-bold uppercase tracking-wider text-cyan-600 dark:text-cyan-400 bg-cyan-50 dark:bg-cyan-950/50 px-2 py-0.5 rounded-md border border-cyan-200 dark:border-cyan-800">
                  Mode B: Goal-Based
                </span>
                <h2 className="text-base font-bold text-slate-900 dark:text-white">
                  Define Custom Career Goal & Milestones
                </h2>
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                Describe your target role and learning aspirations. AI identifies the core competencies for your milestone.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-5">
          {error && (
            <div className="p-3 text-xs rounded-xl bg-rose-50 dark:bg-rose-950/40 text-rose-600 dark:text-rose-400 border border-rose-200 dark:border-rose-900">
              {error}
            </div>
          )}

          {/* Live Domain In-Development Notification */}
          {liveCheck?.type === 'domain' && (
            <div className="p-3.5 rounded-xl bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800/80 text-xs text-amber-800 dark:text-amber-200 space-y-2 animate-in fade-in duration-150">
              <div className="flex items-center gap-2 font-bold">
                <AlertTriangle className="w-4 h-4 text-amber-500 shrink-0" />
                <span>Domain In Active Development ({liveCheck.domainName})</span>
              </div>
              <p className="text-[11px] leading-relaxed text-amber-700 dark:text-amber-300">
                {liveCheck.message}
              </p>
              {liveCheck.alternatives && (
                <div className="pt-1">
                  <span className="text-[10px] uppercase font-bold text-amber-600 dark:text-amber-400 block mb-1">
                    Try these tech-adjacent specializations:
                  </span>
                  <div className="flex flex-wrap gap-1.5">
                    {liveCheck.alternatives.map((alt, aIdx) => (
                      <button
                        key={aIdx}
                        type="button"
                        onClick={() => {
                          setRoleTitle(alt);
                          setGoalDescription(`Build production competence for ${alt}. Focus on modern programming, system architecture, and verifiable portfolio evidence.`);
                          setError(null);
                        }}
                        className="text-[11px] px-2 py-0.5 rounded-lg bg-white dark:bg-slate-800 text-amber-900 dark:text-amber-100 border border-amber-300 dark:border-amber-700 hover:border-amber-500 transition-colors font-medium cursor-pointer"
                      >
                        +{alt}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Live Security & Verification Guardrail Alert */}
          {liveCheck?.type === 'security' && (
            <div className="p-3.5 rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800/80 text-xs text-rose-800 dark:text-rose-200 space-y-1.5 animate-in fade-in duration-150">
              <div className="flex items-center gap-2 font-bold">
                <ShieldAlert className="w-4 h-4 text-rose-500 shrink-0" />
                <span>Verification Guardrail</span>
              </div>
              <p className="text-[11px] leading-relaxed text-rose-700 dark:text-rose-300">
                {liveCheck.message}
              </p>
            </div>
          )}

          {/* Quick Inspirations */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
              Goal Inspirations & Presets
            </label>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {GOAL_INSPIRATIONS.map((item, idx) => (
                <button
                  key={idx}
                  type="button"
                  onClick={() => handleApplyInspiration(item)}
                  className="text-left p-2.5 rounded-xl border border-slate-200 dark:border-slate-800 hover:border-indigo-400 dark:hover:border-cyan-500 bg-slate-50/60 dark:bg-slate-900/60 hover:bg-indigo-50/30 dark:hover:bg-cyan-950/30 transition-all text-xs group"
                >
                  <div className="font-semibold text-slate-800 dark:text-slate-200 group-hover:text-indigo-600 dark:group-hover:text-cyan-400 flex items-center justify-between">
                    <span>{item.title}</span>
                    <span className="text-[10px] text-slate-400 font-normal">
                      {item.days}d • {item.hours}h/wk
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400 line-clamp-1 mt-0.5">
                    {item.description}
                  </p>
                </button>
              ))}
            </div>
          </div>

          {/* Target Role Title */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
              Target Role / Goal Title <span className="text-rose-500">*</span>
            </label>
            <input
              type="text"
              required
              placeholder="e.g. AI & Machine Learning Engineer, Cloud Solutions Architect, Full Stack Developer"
              value={roleTitle}
              onChange={e => setRoleTitle(e.target.value)}
              className="w-full px-3.5 py-2.5 text-xs rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#0e131f] text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all"
            />
          </div>

          {/* Goal Description & Aspirations */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
              Describe Your Career Goal & Aspirations <span className="text-rose-500">*</span>
            </label>
            <p className="text-[11px] text-slate-500 dark:text-slate-400 mb-2">
              Explain what you want to achieve or focus on in this career milestone. (No need to paste a corporate job posting — describe your personal growth direction in your own words).
            </p>
            <textarea
              required
              rows={4}
              placeholder="e.g., I am currently a Junior Backend developer and want to transition to an AI Engineer over the next 2 months. I want to build production skills in Python, PyTorch deep learning, vector search with pgvector, and Retrieval-Augmented Generation (RAG) with FastAPI."
              value={goalDescription}
              onChange={e => setGoalDescription(e.target.value)}
              className="w-full px-3.5 py-2.5 text-xs rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#0e131f] text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 font-mono transition-all"
            />
          </div>

          {/* Planning Horizon & Study Capacity Sliders */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 p-4 rounded-xl bg-slate-50/80 dark:bg-slate-900/60 border border-slate-200/80 dark:border-slate-800/80">
            <div>
              <div className="flex items-center justify-between text-xs font-semibold text-slate-700 dark:text-slate-300 mb-2">
                <span className="flex items-center gap-1.5">
                  <Calendar className="w-3.5 h-3.5 text-indigo-500" />
                  Milestone Horizon
                </span>
                <span className="font-bold text-indigo-600 dark:text-cyan-400">
                  {daysRemaining} days
                </span>
              </div>
              <input
                type="range"
                min={15}
                max={180}
                step={5}
                value={daysRemaining}
                onChange={e => setDaysRemaining(parseInt(e.target.value))}
                className="w-full h-1.5 bg-slate-200 dark:bg-slate-700 rounded-lg appearance-none cursor-pointer accent-indigo-600 dark:accent-cyan-400"
              />
              <div className="flex justify-between text-[10px] text-slate-400 mt-1">
                <span>15d (Sprint)</span>
                <span>60d (Quarter)</span>
                <span>180d (Horizon)</span>
              </div>
            </div>

            <div>
              <div className="flex items-center justify-between text-xs font-semibold text-slate-700 dark:text-slate-300 mb-2">
                <span className="flex items-center gap-1.5">
                  <Clock className="w-3.5 h-3.5 text-indigo-500" />
                  Weekly Study Capacity
                </span>
                <span className="font-bold text-indigo-600 dark:text-cyan-400">
                  {studyHoursPerWeek} hrs/wk
                </span>
              </div>
              <input
                type="range"
                min={5}
                max={30}
                step={1}
                value={studyHoursPerWeek}
                onChange={e => setStudyHoursPerWeek(parseInt(e.target.value))}
                className="w-full h-1.5 bg-slate-200 dark:bg-slate-700 rounded-lg appearance-none cursor-pointer accent-indigo-600 dark:accent-cyan-400"
              />
              <div className="flex justify-between text-[10px] text-slate-400 mt-1">
                <span>5 hrs (Part-time)</span>
                <span>15 hrs (Focused)</span>
                <span>30 hrs (Intensive)</span>
              </div>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex items-center justify-end gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              disabled={isSubmitting}
              className="px-4 py-2 text-xs font-semibold rounded-xl text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="flex items-center gap-2 px-5 py-2.5 text-xs font-semibold rounded-xl bg-indigo-600 hover:bg-indigo-700 dark:bg-indigo-600 dark:hover:bg-indigo-500 text-white transition-all shadow-md hover:shadow-indigo-500/25 disabled:opacity-50"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Analyzing Competencies with AI...</span>
                </>
              ) : (
                <>
                  <Sparkles className="w-4 h-4" />
                  <span>Analyze Goal Competencies & Match Skills</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
