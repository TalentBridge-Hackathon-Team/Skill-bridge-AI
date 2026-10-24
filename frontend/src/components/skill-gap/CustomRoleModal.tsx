import { useState } from 'react';
import { X, Sparkles, Briefcase, Target, Calendar, Clock, Loader2, ArrowRight } from 'lucide-react';

interface CustomRoleModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (data: {
    role_title: string;
    mode: 'job_specific' | 'goal_based';
    job_text: string;
    days_remaining: number;
    study_hours_per_week: number;
  }) => Promise<void>;
  initialMode?: 'job_specific' | 'goal_based';
}

const PRESET_TEMPLATES = [
  {
    title: 'Senior Frontend Engineer',
    mode: 'job_specific' as const,
    days: 21,
    hours: 15,
    text: `Seeking a Senior Frontend Engineer to build modern, responsive web experiences.
Requirements:
- Deep expertise in React 18/19, TypeScript, and modern component state management.
- Proficiency in Next.js App Router, SSR, and ISR architectures.
- Styling mastery with TailwindCSS and responsive CSS design.
- Rigorous automated testing with Vitest, Jest, and Playwright.
- Strong collaboration with REST APIs and GraphQL backends.`
  },
  {
    title: 'DevOps & Site Reliability Engineer',
    mode: 'job_specific' as const,
    days: 30,
    hours: 12,
    text: `Looking for a DevOps & SRE to automate our cloud infrastructure.
Requirements:
- Hands-on administration of AWS cloud services (EC2, S3, RDS, Lambda, IAM).
- Containerization with Docker and Kubernetes orchestration.
- Infrastructure as Code provisioning using Terraform.
- Automated CI/CD pipelines with GitHub Actions or GitLab CI.
- Linux systems administration and shell scripting.`
  },
  {
    title: 'Career Transition to AI Engineer',
    mode: 'goal_based' as const,
    days: 60,
    hours: 15,
    text: `Goal-Based Career Milestone: Transition from traditional software engineering into AI Engineering.
Target Competencies:
- Advanced Python programming for model pipelines.
- Machine Learning fundamentals and deep learning with PyTorch.
- Vector database indexing and semantic search with pgvector Cosine Distance.
- Retrieval-Augmented Generation (RAG) architecture with LLMs and LangChain.
- High-performance asynchronous API endpoints using FastAPI.`
  }
];

export default function CustomRoleModal({
  isOpen,
  onClose,
  onSubmit,
  initialMode = 'job_specific'
}: CustomRoleModalProps) {
  const [mode, setMode] = useState<'job_specific' | 'goal_based'>(initialMode);
  const [roleTitle, setRoleTitle] = useState('');
  const [jobText, setJobText] = useState('');
  const [daysRemaining, setDaysRemaining] = useState(14);
  const [studyHoursPerWeek, setStudyHoursPerWeek] = useState(14);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleApplyPreset = (preset: typeof PRESET_TEMPLATES[0]) => {
    setRoleTitle(preset.title);
    setMode(preset.mode);
    setDaysRemaining(preset.days);
    setStudyHoursPerWeek(preset.hours);
    setJobText(preset.text);
    setError(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!roleTitle.trim()) {
      setError('Please provide a role or career goal title.');
      return;
    }
    if (!jobText.trim()) {
      setError('Please provide job description text or target goal requirements.');
      return;
    }

    setIsSubmitting(true);
    setError(null);
    try {
      await onSubmit({
        role_title: roleTitle.trim(),
        mode,
        job_text: jobText.trim(),
        days_remaining: daysRemaining,
        study_hours_per_week: studyHoursPerWeek
      });
      onClose();
    } catch (err: any) {
      console.error('Failed to analyze custom role:', err);
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
              <Sparkles className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-900 dark:text-white">
                Analyze Custom Role / Career Target with AI
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                AI extracts requirements, categorizes skills, and matches against your profile in Neon DB.
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
          {/* Mode Switcher */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-2">
              Select Analysis Mode
            </label>
            <div className="grid grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => {
                  setMode('job_specific');
                  if (daysRemaining > 30) setDaysRemaining(14);
                }}
                className={`p-3 rounded-xl border text-left transition-all ${
                  mode === 'job_specific'
                    ? 'border-indigo-500 bg-indigo-50/50 dark:bg-indigo-950/40 text-indigo-950 dark:text-cyan-200 ring-2 ring-indigo-500/20'
                    : 'border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700 text-slate-700 dark:text-slate-300'
                }`}
              >
                <div className="flex items-center gap-2 font-bold text-xs">
                  <Briefcase className="w-4 h-4 text-indigo-500" />
                  <span>Mode A: Job-Specific</span>
                </div>
                <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1 leading-relaxed">
                  Target a specific vacancy with closing application date and study pacing.
                </p>
              </button>

              <button
                type="button"
                onClick={() => {
                  setMode('goal_based');
                  if (daysRemaining <= 14) setDaysRemaining(45);
                }}
                className={`p-3 rounded-xl border text-left transition-all ${
                  mode === 'goal_based'
                    ? 'border-indigo-500 bg-indigo-50/50 dark:bg-indigo-950/40 text-indigo-950 dark:text-cyan-200 ring-2 ring-indigo-500/20'
                    : 'border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700 text-slate-700 dark:text-slate-300'
                }`}
              >
                <div className="flex items-center gap-2 font-bold text-xs">
                  <Target className="w-4 h-4 text-indigo-500" />
                  <span>Mode B: Goal-Based</span>
                </div>
                <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1 leading-relaxed">
                  Broad career transition, milestone competencies, and flexible study horizon.
                </p>
              </button>
            </div>
          </div>

          {/* Preset Quick Fill */}
          <div>
            <div className="text-[11px] font-semibold text-slate-400 dark:text-slate-500 uppercase tracking-wider mb-1.5">
              Quick Templates
            </div>
            <div className="flex flex-wrap gap-2">
              {PRESET_TEMPLATES.map((preset, idx) => (
                <button
                  key={idx}
                  type="button"
                  onClick={() => handleApplyPreset(preset)}
                  className="px-2.5 py-1 text-xs rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900/60 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300 transition-colors"
                >
                  {preset.title}
                </button>
              ))}
            </div>
          </div>

          {/* Role / Goal Title */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
              {mode === 'job_specific' ? 'Target Role Title' : 'Career Goal Title'}
            </label>
            <input
              type="text"
              value={roleTitle}
              onChange={e => setRoleTitle(e.target.value)}
              placeholder={
                mode === 'job_specific'
                  ? 'e.g. Senior Frontend Engineer, Cloud Solutions Architect...'
                  : 'e.g. Transition to Machine Learning Engineer in 2 Months...'
              }
              className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-[#0b0f17] text-slate-900 dark:text-white text-xs placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
            />
          </div>

          {/* Job Description / Goal Text */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
              {mode === 'job_specific' ? 'Job Posting Description & Requirements' : 'Goal Scope & Desired Skills'}
            </label>
            <textarea
              rows={5}
              value={jobText}
              onChange={e => setJobText(e.target.value)}
              placeholder="Paste job posting text, bullet points, or describe the technical skills you need to achieve..."
              className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-[#0b0f17] text-slate-900 dark:text-white text-xs placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 font-mono leading-relaxed"
            />
          </div>

          {/* Timeline & Study Capacity Budget */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 p-4 rounded-xl bg-slate-50/70 dark:bg-slate-950/40 border border-slate-200/80 dark:border-slate-800/80">
            <div>
              <div className="flex justify-between items-center text-xs mb-1.5">
                <span className="font-semibold text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                  <Calendar className="w-3.5 h-3.5 text-indigo-500" />
                  {mode === 'job_specific' ? 'Application Deadline' : 'Goal Target Timeframe'}
                </span>
                <span className="font-bold text-indigo-600 dark:text-cyan-400">{daysRemaining} days</span>
              </div>
              <input
                type="range"
                min={3}
                max={120}
                value={daysRemaining}
                onChange={e => setDaysRemaining(Number(e.target.value))}
                className="w-full accent-indigo-600 dark:accent-cyan-400"
              />
            </div>

            <div>
              <div className="flex justify-between items-center text-xs mb-1.5">
                <span className="font-semibold text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                  <Clock className="w-3.5 h-3.5 text-indigo-500" />
                  Weekly Study Capacity
                </span>
                <span className="font-bold text-indigo-600 dark:text-cyan-400">{studyHoursPerWeek} hrs/wk</span>
              </div>
              <input
                type="range"
                min={2}
                max={40}
                value={studyHoursPerWeek}
                onChange={e => setStudyHoursPerWeek(Number(e.target.value))}
                className="w-full accent-indigo-600 dark:accent-cyan-400"
              />
            </div>
          </div>

          {/* Error Message */}
          {error && (
            <div className="p-3 rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900 text-xs text-rose-700 dark:text-rose-300">
              {error}
            </div>
          )}

          {/* Actions */}
          <div className="flex items-center justify-end gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              disabled={isSubmitting}
              className="px-4 py-2 text-xs font-semibold text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold shadow-md shadow-indigo-500/20 disabled:opacity-60 transition-all"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Analyzing with AI...</span>
                </>
              ) : (
                <>
                  <Sparkles className="w-4 h-4" />
                  <span>Analyze with AI & Match</span>
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
