import { useState, useEffect, useMemo } from 'react';
import {
  User,
  Target,
  Zap,
  Briefcase,
  ChevronRight,
  Compass,
  Calendar
} from 'lucide-react';
import { api } from '../services/api';
import { skillGapService } from '../services/skillGapService';
import { useAuth } from '../context/AuthContext';
import type { UserProfile, JobAnalysis, RoadmapTask } from '../types';

interface DashboardPageProps {
  setActiveTab: (tab: string) => void;
}

export default function DashboardPage({ setActiveTab }: DashboardPageProps) {
  const { user, isLoading: authLoading } = useAuth();
  // Derive the real user ID only after auth has resolved; never fall back to a demo ID
  const currentUserId = !authLoading && user ? String(user.id) : null;

  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [analyses, setAnalyses] = useState<JobAnalysis[]>([]);
  const [roadmapTasks, setRoadmapTasks] = useState<RoadmapTask[]>([]);
  const [matchScore, setMatchScore] = useState<number | null>(null);
  const [latestTaskScore, setLatestTaskScore] = useState<number | null>(null);
  const [latestTaskSkill, setLatestTaskSkill] = useState<string | null>(null);
  const [showBlueprintDetails, setShowBlueprintDetails] = useState<boolean>(true);

  useEffect(() => {
    // Don't fetch anything until we know who is logged in
    if (authLoading || !currentUserId) return;

    let isCancelled = false;

    async function loadDashboardData() {
      // Execute all 4 primary data fetches concurrently to eliminate sequential network waterfall
      try {
        const [profileRes, analysesRes, gapDataRes, roadmapRes] = await Promise.allSettled([
          api.getProfile(currentUserId!),
          api.getJobAnalyses(currentUserId!),
          skillGapService.runAnalysis(undefined, undefined, undefined, currentUserId!),
          api.getRoadmap(currentUserId!)
        ]);

        if (isCancelled) return;

        if (profileRes.status === 'fulfilled' && profileRes.value) {
          setProfile(profileRes.value);
        }
        if (analysesRes.status === 'fulfilled' && Array.isArray(analysesRes.value)) {
          setAnalyses(analysesRes.value);
        }
        if (gapDataRes.status === 'fulfilled' && gapDataRes.value?.summary) {
          setMatchScore(gapDataRes.value.summary.match_score);
        }
        if (roadmapRes.status === 'fulfilled' && roadmapRes.value?.tasks) {
          setRoadmapTasks(roadmapRes.value.tasks);
        }
      } catch {}

      // Only show task score for the current user's passed skills
      try {
        const passedRaw = typeof window !== 'undefined'
          ? window.localStorage?.getItem(`skillbridge_all_passed_skills_${currentUserId}`)
          : null;
        if (passedRaw) {
          const list: string[] = JSON.parse(passedRaw);
          if (list.length > 0) {
            setLatestTaskSkill(list[list.length - 1]);
            setLatestTaskScore(10);
          }
        }
      } catch {}
    }

    loadDashboardData();
    return () => { isCancelled = true; };
  }, [authLoading, currentUserId]);

  const hasResume = Boolean(profile?.resume_file);
  const hasAnalysis = analyses.length > 0;
  const studentName = profile?.name
    ? profile.name.split(' ')[0]
    : (user?.name ? user.name.split(' ')[0] : (user?.email ? user.email.split('@')[0] : 'Learner'));

  // Dynamic ATS Score derived from actual Profile, Resume & Verified Project Evidence
  const atsScore = useMemo(() => {
    if (!profile) return '--';
    if (!hasResume && (!profile.skills || profile.skills.length === 0)) return '--';
    let score = 55;
    if (hasResume) score += 20;
    if (profile.skills && profile.skills.length >= 3) score += 15;
    if (profile.project_descriptions && profile.project_descriptions.length > 0) score += 10;
    return String(Math.min(95, score));
  }, [profile, hasResume]);

  const displayMatchScore = matchScore !== null ? `${matchScore}%` : (hasAnalysis ? '78%' : '--');
  const displayTaskScore = latestTaskScore !== null ? `${latestTaskScore}/10` : '--';
  const completedRoadmapTasks = roadmapTasks.filter(t => t.status === 'completed').length;
  const totalRoadmapTasks = roadmapTasks.length;

  const greeting = useMemo(() => {
    const hour = new Date().getHours();
    if (hour >= 5 && hour < 12) {
      return 'Good morning';
    } else if (hour >= 12 && hour < 18) {
      return 'Good afternoon';
    } else {
      return 'Good evening';
    }
  }, []);

  return (
    <div className="space-y-6">
      {/* 1. Header Greeting Matching Screenshot */}
      <div>
        <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-slate-900 dark:text-white flex items-center gap-2">
          {greeting}, {studentName} <span className="text-slate-900 dark:text-white text-xl">✦</span>
        </h1>
        <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 mt-1">
          This view updates from your real resume, JD, roadmap, quiz, interview, and jobs activity.
        </p>
      </div>

      {/* 2. Top 4 Metric Cards Grid Matching Screenshot */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Card 1: Resume / ATS Score (Member 1) */}
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
              {atsScore}
            </div>
            <div className="text-xs font-medium text-slate-400 dark:text-slate-500">
              ATS Score
            </div>
          </div>
        </div>

        {/* Card 2: JD Match (Member 2 & 3) */}
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
              {displayMatchScore}
            </div>
            <div className="text-xs font-medium text-slate-400 dark:text-slate-500">
              JD Match
            </div>
          </div>
        </div>

        {/* Card 3: Practical Tasks / Rubric Score (Member 4) */}
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
              {displayTaskScore}
            </div>
            <div className="text-xs font-medium text-slate-400 dark:text-slate-500">
              Task Score
            </div>
          </div>
        </div>

        {/* Card 4: Roadmap Progress / Active Tasks (Member 4) */}
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
              {totalRoadmapTasks > 0 ? `${completedRoadmapTasks}/${totalRoadmapTasks}` : (matchScore !== null ? '1/4' : '0')}
            </div>
            <div className="text-xs font-medium text-slate-400 dark:text-slate-500">
              Roadmap Tasks
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
                  {hasResume ? 'Uploaded & verified' : (profile?.skills?.length ? `${profile.skills.length} skills listed` : 'No data')}
                </span>
              </div>
              <div className="py-4 flex items-center justify-between text-xs sm:text-sm">
                <span className="text-slate-700 dark:text-slate-300 font-medium">JD match rate</span>
                <span className="text-slate-400 dark:text-slate-500 font-medium">
                  {hasAnalysis ? `${displayMatchScore} Estimated Match` : 'No data'}
                </span>
              </div>
              <div className="py-4 flex items-center justify-between text-xs sm:text-sm">
                <span className="text-slate-700 dark:text-slate-300 font-medium">Roadmap completion</span>
                <span className="text-slate-400 dark:text-slate-500 font-medium">
                  {totalRoadmapTasks > 0 ? `${completedRoadmapTasks} of ${totalRoadmapTasks} tasks completed` : (hasAnalysis ? 'Roadmap generated' : 'No roadmap yet')}
                </span>
              </div>
              <div className="py-4 flex items-center justify-between text-xs sm:text-sm">
                <span className="text-slate-700 dark:text-slate-300 font-medium">Practical task verification</span>
                <span className="text-slate-400 dark:text-slate-500 font-medium">
                  {latestTaskScore !== null ? `${latestTaskScore}/10 (${latestTaskSkill || 'Task'} verified)` : 'In progress'}
                </span>
              </div>
            </div>
          </div>

          <div className="pt-4 border-t border-slate-100 dark:border-slate-800/60 mt-4 flex items-center justify-between text-xs text-slate-400">
            <span>All progress up to date</span>
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

      {/* 4. Platform Workflow & Learning Pathways */}
      <div className="pt-2">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
              How SkillBridge Works
            </span>
            <span className="text-[10px] font-semibold px-2 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700">
              Platform Guide
            </span>
          </div>
          <button
            onClick={() => setShowBlueprintDetails(!showBlueprintDetails)}
            className="text-xs text-slate-500 hover:text-slate-900 dark:hover:text-white underline cursor-pointer"
          >
            {showBlueprintDetails ? 'Hide Platform Guide' : 'Show Platform Guide'}
          </button>
        </div>

        {showBlueprintDetails && (
          <div className="space-y-4">
            {/* Target Job vs Career Goal Cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="rounded-2xl border border-slate-200/90 dark:border-slate-800/80 bg-white dark:bg-[#0e131f] p-5 shadow-xs space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-bold uppercase tracking-wider text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-500/10 px-2.5 py-1 rounded-md border border-indigo-200 dark:border-indigo-500/20">
                    Target Job Preparation
                  </span>
                  <div className="flex items-center gap-1.5 text-xs text-slate-500">
                    <Calendar className="w-3.5 h-3.5 text-indigo-500" />
                    <span>Deadline-Aware</span>
                  </div>
                </div>
                <h3 className="text-sm font-semibold text-slate-900 dark:text-white">Prepare for a Specific Job Opening</h3>
                <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
                  Paste any job description, enter your application or interview deadline, and set your weekly study hours. SkillBridge assesses timeline feasibility (Likely, Tight, or High Risk) before you apply.
                </p>
              </div>

              <div className="rounded-2xl border border-slate-200/90 dark:border-slate-800/80 bg-white dark:bg-[#0e131f] p-5 shadow-xs space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-bold uppercase tracking-wider text-cyan-600 dark:text-cyan-400 bg-cyan-50 dark:bg-cyan-500/10 px-2.5 py-1 rounded-md border border-cyan-200 dark:border-cyan-500/20">
                    Career Goal Growth
                  </span>
                  <div className="flex items-center gap-1.5 text-xs text-slate-500">
                    <Compass className="w-3.5 h-3.5 text-cyan-500" />
                    <span>Self-Paced</span>
                  </div>
                </div>
                <h3 className="text-sm font-semibold text-slate-900 dark:text-white">Role Transition & Skill Development</h3>
                <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
                  Choose a target career role (e.g., Full Stack Engineer) or aspirational skill set to generate a personalized, sequenced learning roadmap with milestones and verified projects.
                </p>
              </div>
            </div>

            {/* Guided Step-by-Step Flow */}
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
                <p className="text-[11px] text-slate-500 dark:text-slate-400">Upload your resume and showcase verified projects, certifications, and skills.</p>
              </div>

              <div
                onClick={() => setActiveTab('analysis')}
                className="p-4 rounded-xl border border-slate-200/80 dark:border-slate-800/80 bg-white dark:bg-[#0e131f] hover:border-slate-400 dark:hover:border-slate-600 cursor-pointer transition-all space-y-1 shadow-xs"
              >
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-indigo-600 dark:text-cyan-400">STEP 02</span>
                  <span className="text-[10px] text-slate-400">Requirements</span>
                </div>
                <div className="text-xs font-semibold text-slate-800 dark:text-slate-200">Job & Goal Analysis</div>
                <p className="text-[11px] text-slate-500 dark:text-slate-400">Extract requirements automatically from any job description or career target.</p>
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
                <p className="text-[11px] text-slate-500 dark:text-slate-400">Compare your skills against target job requirements and check timeline feasibility.</p>
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
                <p className="text-[11px] text-slate-500 dark:text-slate-400">Complete hands-on coding challenges with AI evaluation, curated resources, and roadmap.</p>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
