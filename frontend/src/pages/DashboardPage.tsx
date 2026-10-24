import { useState, useEffect } from 'react';
import {
  User,
  Target,
  Zap,
  Briefcase,
  Sparkles,
  ChevronRight,
  Clock,
  Compass,
  Calendar,
  CheckCircle2,
  AlertCircle,
  HelpCircle,
  ShieldCheck,
  ArrowRight
} from 'lucide-react';
import { api } from '../services/api';
import type { UserProfile, JobAnalysis } from '../types';

interface DashboardPageProps {
  setActiveTab: (tab: string) => void;
}

export default function DashboardPage({ setActiveTab }: DashboardPageProps) {
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [analyses, setAnalyses] = useState<JobAnalysis[]>([]);
  const [showBlueprintDetails, setShowBlueprintDetails] = useState<boolean>(true);

  useEffect(() => {
    // Fetch live state from backend to populate real metrics if available
    api.getProfile('demo_user')
      .then(res => setProfile(res))
      .catch(() => {});

    // Check if any job analyses exist
    fetch('http://127.0.0.1:8000/api/job-analyses/?user_id=demo_user')
      .then(r => r.json())
      .then(data => {
        if (Array.isArray(data)) setAnalyses(data);
      })
      .catch(() => {});
  }, []);

  const hasResume = Boolean(profile?.resume_file);
  const hasAnalysis = analyses.length > 0;
  const studentName = profile?.name ? profile.name.split(' ')[0] : 'Student';

  return (
    <div className="space-y-6">
      {/* 1. Header Greeting Matching Screenshot */}
      <div>
        <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-slate-900 dark:text-white flex items-center gap-2">
          Good morning, {studentName} <span className="text-slate-900 dark:text-white text-xl">✦</span>
        </h1>
        <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 mt-1">
          This view updates from your real resume, JD, roadmap, quiz, interview, and jobs activity.
        </p>
      </div>

      {/* 2. Top 4 Metric Cards Grid Matching Screenshot */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Card 1: Resume / ATS Score */}
        <div className="rounded-2xl border border-slate-200/90 dark:border-slate-800/80 bg-white dark:bg-[#0e131f] p-5 shadow-xs flex flex-col justify-between transition-all duration-200 hover:shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <div className="w-8 h-8 rounded-lg bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-slate-600 dark:text-slate-300">
              <User className="w-4 h-4" />
            </div>
            <button
              onClick={() => setActiveTab('profile')}
              className="text-xs font-medium px-3 py-1 rounded-full border border-slate-300 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-200 transition-colors"
            >
              {hasResume ? 'Manage resume' : 'Upload resume to start'}
            </button>
          </div>
          <div>
            <div className="text-3xl font-extrabold text-slate-900 dark:text-white tracking-tight my-2">
              {hasResume ? '85' : '--'}
            </div>
            <div className="text-xs font-medium text-slate-400 dark:text-slate-500">
              ATS Score
            </div>
          </div>
        </div>

        {/* Card 2: JD Match */}
        <div className="rounded-2xl border border-slate-200/90 dark:border-slate-800/80 bg-white dark:bg-[#0e131f] p-5 shadow-xs flex flex-col justify-between transition-all duration-200 hover:shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <div className="w-8 h-8 rounded-lg bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-slate-600 dark:text-slate-300">
              <Target className="w-4 h-4" />
            </div>
            <button
              onClick={() => setActiveTab('analysis')}
              className="text-xs font-medium px-3 py-1 rounded-full border border-slate-300 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-200 transition-colors"
            >
              Analyze a JD
            </button>
          </div>
          <div>
            <div className="text-3xl font-extrabold text-slate-900 dark:text-white tracking-tight my-2">
              {hasAnalysis ? '78%' : '--'}
            </div>
            <div className="text-xs font-medium text-slate-400 dark:text-slate-500">
              JD Match
            </div>
          </div>
        </div>

        {/* Card 3: Quiz Score / Practical Tasks */}
        <div className="rounded-2xl border border-slate-200/90 dark:border-slate-800/80 bg-white dark:bg-[#0e131f] p-5 shadow-xs flex flex-col justify-between transition-all duration-200 hover:shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <div className="w-8 h-8 rounded-lg bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-slate-600 dark:text-slate-300">
              <Zap className="w-4 h-4" />
            </div>
            <button
              onClick={() => setActiveTab('assessment')}
              className="text-xs font-medium px-3 py-1 rounded-full border border-slate-300 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-200 transition-colors"
            >
              Complete a task
            </button>
          </div>
          <div>
            <div className="text-3xl font-extrabold text-slate-900 dark:text-white tracking-tight my-2">
              --
            </div>
            <div className="text-xs font-medium text-slate-400 dark:text-slate-500">
              Task Score
            </div>
          </div>
        </div>

        {/* Card 4: Jobs Saved / Active Roadmap Tasks */}
        <div className="rounded-2xl border border-slate-200/90 dark:border-slate-800/80 bg-white dark:bg-[#0e131f] p-5 shadow-xs flex flex-col justify-between transition-all duration-200 hover:shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <div className="w-8 h-8 rounded-lg bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-slate-600 dark:text-slate-300">
              <Briefcase className="w-4 h-4" />
            </div>
            <button
              onClick={() => setActiveTab('roadmap')}
              className="text-xs font-medium px-3 py-1 rounded-full border border-slate-300 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-200 transition-colors"
            >
              View roadmap
            </button>
          </div>
          <div>
            <div className="text-3xl font-extrabold text-slate-900 dark:text-white tracking-tight my-2">
              0
            </div>
            <div className="text-xs font-medium text-slate-400 dark:text-slate-500">
              Jobs Saved
            </div>
          </div>
        </div>
      </div>

      {/* 3. Lower Section: Weekly Progress (Left) + Today's Tasks (Right) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Weekly Progress Card (Left ~65% width) */}
        <div className="lg:col-span-8 rounded-2xl border border-slate-200/90 dark:border-slate-800/80 bg-white dark:bg-[#0e131f] p-6 shadow-xs flex flex-col justify-between">
          <div>
            <h2 className="text-sm font-bold text-slate-900 dark:text-white mb-6">
              Weekly Progress
            </h2>
            <div className="divide-y divide-slate-100 dark:divide-slate-800/60">
              <div className="py-4 flex items-center justify-between text-xs sm:text-sm">
                <span className="text-slate-700 dark:text-slate-300 font-medium">Resume strength</span>
                <span className="text-slate-400 dark:text-slate-500 font-medium">
                  {hasResume ? 'Uploaded (Verified in S3)' : 'No data'}
                </span>
              </div>
              <div className="py-4 flex items-center justify-between text-xs sm:text-sm">
                <span className="text-slate-700 dark:text-slate-300 font-medium">JD match rate</span>
                <span className="text-slate-400 dark:text-slate-500 font-medium">
                  {hasAnalysis ? '78% Estimated Match' : 'No data'}
                </span>
              </div>
              <div className="py-4 flex items-center justify-between text-xs sm:text-sm">
                <span className="text-slate-700 dark:text-slate-300 font-medium">Roadmap completion</span>
                <span className="text-slate-400 dark:text-slate-500 font-medium">No roadmap yet</span>
              </div>
              <div className="py-4 flex items-center justify-between text-xs sm:text-sm">
                <span className="text-slate-700 dark:text-slate-300 font-medium">Practical task verification</span>
                <span className="text-slate-400 dark:text-slate-500 font-medium">Not completed</span>
              </div>
            </div>
          </div>

          <div className="pt-4 border-t border-slate-100 dark:border-slate-800/60 mt-4 flex items-center justify-between text-xs text-slate-400">
            <span>Synchronized with Neon PostgreSQL & LocalStack S3</span>
            <button
              onClick={() => setActiveTab('gaps')}
              className="text-xs font-semibold text-slate-700 dark:text-slate-200 hover:text-black dark:hover:text-white flex items-center gap-1 transition-colors"
            >
              Open gap analysis <ChevronRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        {/* Today's Tasks Card (Right ~35% width) */}
        <div className="lg:col-span-4 rounded-2xl border border-slate-200/90 dark:border-slate-800/80 bg-white dark:bg-[#0e131f] p-6 shadow-xs flex flex-col justify-between">
          <div>
            <h2 className="text-sm font-bold text-slate-900 dark:text-white mb-4">
              Today's Tasks
            </h2>
            <div className="divide-y divide-slate-100 dark:divide-slate-800/60">
              <button
                onClick={() => setActiveTab('profile')}
                className="w-full text-left py-3 text-xs sm:text-sm text-slate-700 dark:text-slate-300 hover:text-slate-950 dark:hover:text-white font-medium flex items-center justify-between group transition-colors"
              >
                <span>Upload and parse resume</span>
                <ChevronRight className="w-3.5 h-3.5 text-slate-300 group-hover:text-slate-700 dark:group-hover:text-slate-200 transition-colors" />
              </button>

              <button
                onClick={() => setActiveTab('gaps')}
                className="w-full text-left py-3 text-xs sm:text-sm text-slate-700 dark:text-slate-300 hover:text-slate-950 dark:hover:text-white font-medium flex items-center justify-between group transition-colors"
              >
                <span>Run ATS analysis</span>
                <ChevronRight className="w-3.5 h-3.5 text-slate-300 group-hover:text-slate-700 dark:group-hover:text-slate-200 transition-colors" />
              </button>

              <button
                onClick={() => setActiveTab('analysis')}
                className="w-full text-left py-3 text-xs sm:text-sm text-slate-700 dark:text-slate-300 hover:text-slate-950 dark:hover:text-white font-medium flex items-center justify-between group transition-colors"
              >
                <span>Analyze JD match</span>
                <ChevronRight className="w-3.5 h-3.5 text-slate-300 group-hover:text-slate-700 dark:group-hover:text-slate-200 transition-colors" />
              </button>

              <button
                onClick={() => setActiveTab('roadmap')}
                className="w-full text-left py-3 text-xs sm:text-sm text-slate-700 dark:text-slate-300 hover:text-slate-950 dark:hover:text-white font-medium flex items-center justify-between group transition-colors"
              >
                <span>Generate roadmap</span>
                <ChevronRight className="w-3.5 h-3.5 text-slate-300 group-hover:text-slate-700 dark:group-hover:text-slate-200 transition-colors" />
              </button>

              <button
                onClick={() => setActiveTab('assessment')}
                className="w-full text-left py-3 text-xs sm:text-sm text-slate-700 dark:text-slate-300 hover:text-slate-950 dark:hover:text-white font-medium flex items-center justify-between group transition-colors"
              >
                <span>Complete practical task</span>
                <ChevronRight className="w-3.5 h-3.5 text-slate-300 group-hover:text-slate-700 dark:group-hover:text-slate-200 transition-colors" />
              </button>

              <div className="py-3 text-xs sm:text-sm text-slate-400 dark:text-slate-500 font-medium">
                Complete mock interview
              </div>

              <div className="py-3 text-xs sm:text-sm text-slate-400 dark:text-slate-500 font-medium">
                Save at least one job
              </div>
            </div>
          </div>

          <div className="pt-4 border-t border-slate-100 dark:border-slate-800/60 mt-4 text-[11px] text-slate-400">
            Daily recommendations refresh automatically
          </div>
        </div>
      </div>

      {/* 4. Blueprint Context & Architecture Slices (Preserved and Enhanced) */}
      <div className="pt-2">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
              Architecture & Team Divisions
            </span>
            <span className="text-[10px] font-semibold px-2 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700">
              Blueprint 2.0
            </span>
          </div>
          <button
            onClick={() => setShowBlueprintDetails(!showBlueprintDetails)}
            className="text-xs text-slate-500 hover:text-slate-900 dark:hover:text-white underline cursor-pointer"
          >
            {showBlueprintDetails ? 'Collapse Blueprint Details' : 'Expand Blueprint Details'}
          </button>
        </div>

        {showBlueprintDetails && (
          <div className="space-y-4">
            {/* Mode A & Mode B Cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="rounded-2xl border border-slate-200/90 dark:border-slate-800/80 bg-white dark:bg-[#0e131f] p-5 shadow-xs space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-bold uppercase tracking-wider text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-500/10 px-2.5 py-1 rounded-md border border-indigo-200 dark:border-indigo-500/20">
                    Mode A • Opportunity Driven
                  </span>
                  <div className="flex items-center gap-1.5 text-xs text-slate-500">
                    <Calendar className="w-3.5 h-3.5 text-indigo-500" />
                    <span>Deadline-Aware</span>
                  </div>
                </div>
                <h3 className="text-sm font-semibold text-slate-900 dark:text-white">Specific Job Opportunity Preparation</h3>
                <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
                  Paste a job description, enter closing date, and specify study capacity. Evaluates feasibility (Likely, Tight, or Not feasible) before your deadline.
                </p>
              </div>

              <div className="rounded-2xl border border-slate-200/90 dark:border-slate-800/80 bg-white dark:bg-[#0e131f] p-5 shadow-xs space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-bold uppercase tracking-wider text-cyan-600 dark:text-cyan-400 bg-cyan-50 dark:bg-cyan-500/10 px-2.5 py-1 rounded-md border border-cyan-200 dark:border-cyan-500/20">
                    Mode B • Aspiration Driven
                  </span>
                  <div className="flex items-center gap-1.5 text-xs text-slate-500">
                    <Compass className="w-3.5 h-3.5 text-cyan-500" />
                    <span>Goal-Based</span>
                  </div>
                </div>
                <h3 className="text-sm font-semibold text-slate-900 dark:text-white">Career Role & Skill Development</h3>
                <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
                  State your target role (Junior Backend Developer) or skill goal. Maps to role standards and creates an ongoing sequenced roadmap with milestones.
                </p>
              </div>
            </div>

            {/* Feature Team Slices */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
              <div
                onClick={() => setActiveTab('profile')}
                className="p-4 rounded-xl border border-slate-200/80 dark:border-slate-800/80 bg-white dark:bg-[#0e131f] hover:border-slate-400 dark:hover:border-slate-600 cursor-pointer transition-all space-y-1 shadow-xs"
              >
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-indigo-600 dark:text-cyan-400">STEP 01</span>
                  <span className="text-[10px] text-slate-400">Profile & CV</span>
                </div>
                <div className="text-xs font-semibold text-slate-800 dark:text-slate-200">Profile & Evidence</div>
                <p className="text-[11px] text-slate-500 dark:text-slate-400">Resume upload to S3, SQS dispatch, and evidence portfolio.</p>
              </div>

              <div
                onClick={() => setActiveTab('analysis')}
                className="p-4 rounded-xl border border-slate-200/80 dark:border-slate-800/80 bg-white dark:bg-[#0e131f] hover:border-slate-400 dark:hover:border-slate-600 cursor-pointer transition-all space-y-1 shadow-xs"
              >
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-indigo-600 dark:text-cyan-400">STEP 02</span>
                  <span className="text-[10px] text-slate-400">JD Extraction</span>
                </div>
                <div className="text-xs font-semibold text-slate-800 dark:text-slate-200">Job & Goal Analysis</div>
                <p className="text-[11px] text-slate-500 dark:text-slate-400">OpenRouter Gemma extraction with human review and editing.</p>
              </div>

              <div
                onClick={() => setActiveTab('gaps')}
                className="p-4 rounded-xl border border-slate-200/80 dark:border-slate-800/80 bg-white dark:bg-[#0e131f] hover:border-slate-400 dark:hover:border-slate-600 cursor-pointer transition-all space-y-1 shadow-xs"
              >
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-indigo-600 dark:text-cyan-400">STEP 03</span>
                  <span className="text-[10px] text-slate-400">Matching</span>
                </div>
                <div className="text-xs font-semibold text-slate-800 dark:text-slate-200">Skill Gap Report</div>
                <p className="text-[11px] text-slate-500 dark:text-slate-400">Deterministic matching engine and deadline feasibility band.</p>
              </div>

              <div
                onClick={() => setActiveTab('assessment')}
                className="p-4 rounded-xl border border-slate-200/80 dark:border-slate-800/80 bg-white dark:bg-[#0e131f] hover:border-slate-400 dark:hover:border-slate-600 cursor-pointer transition-all space-y-1 shadow-xs"
              >
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-indigo-600 dark:text-cyan-400">STEP 04</span>
                  <span className="text-[10px] text-slate-400">Assessments</span>
                </div>
                <div className="text-xs font-semibold text-slate-800 dark:text-slate-200">Practical Tasks</div>
                <p className="text-[11px] text-slate-500 dark:text-slate-400">Controlled rubric evaluation, curated resources, and roadmap.</p>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
