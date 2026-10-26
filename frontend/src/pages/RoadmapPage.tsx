import { useState, useEffect, useMemo } from 'react';
import {
  CheckCircle2,
  Clock,
  ExternalLink,
  BookOpen,
  FileCheck,
  ArrowRight,
  ListChecks,
  Calendar,
  Sparkles,
  RefreshCw,
  Award,
  Target,
  Database,
  Lock,
  Container,
  Cpu,
  Trophy
} from 'lucide-react';
import type { RoadmapTask } from '../types';
import { skillGapService } from '../services/skillGapService';
import type { TargetRoleOption } from '../services/mockSkillGapData';
import type { TraceableMatchResult } from '../utils/skillGapCalculations';
import {
  calculateHorizonCountdown,
  evaluateAdaptiveCapacity,
  updateDeadlineTimestamp
} from '../utils/horizonCapacityEngine';

interface RoadmapPageProps {
  setActiveTab: (tab: string) => void;
}

const getCuratedResourcesForSkill = (skill: string) => {
  const s = skill.toLowerCase();
  if (s.includes('sql') || s.includes('postgres') || s.includes('database')) {
    return [
      { title: 'PostgreSQL Documentation: Queries & Indexing', source: 'postgresql.org', url: 'https://www.postgresql.org/docs/current/queries.html', type: 'docs' as const },
      { title: 'Use The Index, Luke! SQL Guide', source: 'use-the-index-luke.com', url: 'https://use-the-index-luke.com/', type: 'tutorial' as const }
    ];
  }
  if (s.includes('auth') || s.includes('security') || s.includes('jwt')) {
    return [
      { title: 'Simple JWT Documentation for Django REST', source: 'django-rest-framework-simplejwt.readthedocs.io', url: 'https://django-rest-framework-simplejwt.readthedocs.io/en/latest/', type: 'docs' as const },
      { title: 'OWASP Authentication Cheat Sheet', source: 'owasp.org', url: 'https://cheatsheetseries.owasp.org/', type: 'docs' as const }
    ];
  }
  if (s.includes('docker') || s.includes('container') || s.includes('devops')) {
    return [
      { title: 'Docker Official Multi-Stage Build Guide', source: 'docs.docker.com', url: 'https://docs.docker.com/build/building/multi-stage/', type: 'docs' as const },
      { title: 'Docker Security & Non-Root Best Practices', source: 'docker.com', url: 'https://docs.docker.com/engine/security/', type: 'tutorial' as const }
    ];
  }
  if (s.includes('vector') || s.includes('ai') || s.includes('rag')) {
    return [
      { title: 'pgvector Official Repository & Usage Guide', source: 'github.com/pgvector', url: 'https://github.com/pgvector/pgvector', type: 'docs' as const },
      { title: 'RAG Retrieval Optimization Patterns', source: 'python.langchain.com', url: 'https://python.langchain.com/docs/use_cases/question_answering/', type: 'tutorial' as const }
    ];
  }
  if (s.includes('test') || s.includes('api')) {
    return [
      { title: 'Django REST Framework Testing Official Docs', source: 'django-rest-framework.org', url: 'https://www.django-rest-framework.org/api-guide/testing/', type: 'docs' as const },
      { title: 'pytest-django Quickstart Guide', source: 'pytest-django.readthedocs.io', url: 'https://pytest-django.readthedocs.io/en/latest/', type: 'tutorial' as const }
    ];
  }
  return [
    { title: `${skill} Documentation & Best Practices`, source: 'developer.mozilla.org', url: 'https://developer.mozilla.org/', type: 'docs' as const }
  ];
};

const isSkillPassedLocally = (skill: string, passedSkillsSet?: Set<string>): boolean => {
  const norm = skill.toLowerCase().trim();
  if (passedSkillsSet && (passedSkillsSet.has(norm) || Array.from(passedSkillsSet).some(s => norm.includes(s) || s.includes(norm)))) {
    return true;
  }
  try {
    if (typeof window !== 'undefined' && window.localStorage) {
      if (window.localStorage.getItem(`skillbridge_passed_assessment_${skill}`)) return true;
      const allRaw = window.localStorage.getItem('skillbridge_all_passed_skills');
      if (allRaw) {
        const list: string[] = JSON.parse(allRaw);
        if (list.some(s => s.toLowerCase().trim() === norm || norm.includes(s.toLowerCase().trim()) || s.toLowerCase().trim().includes(norm))) {
          return true;
        }
      }
    }
  } catch {}
  return false;
};

const buildTasksFromSkillGaps = (
  gaps: TraceableMatchResult[],
  targetDeadline: number,
  passedSkillsSet?: Set<string>
): RoadmapTask[] => {
  return gaps.map((gap, idx) => {
    const skill = gap.skill_name;
    const isDemonstrated = gap.status === 'Demonstrated' || isSkillPassedLocally(skill, passedSkillsSet);
    const prio = gap.priority || (isDemonstrated ? 'Low' : 'High');
    const effort = gap.effort_hours_estimate || (prio === 'High' ? 8 : (prio === 'Medium' ? 4 : 2));
    
    const milestone = prio === 'High' 
      ? 'Milestone 1: Core Required Competencies' 
      : prio === 'Medium' 
      ? 'Milestone 2: Supporting Technical Depth' 
      : 'Milestone 3: Verification & Edge Polish';
      
    const dueDay = Math.min(targetDeadline, Math.max(3, Math.round((idx + 1) * (targetDeadline / Math.max(1, gaps.length)))));
    const curated_resources = getCuratedResourcesForSkill(skill);

    const customProjectName = typeof window !== 'undefined' && window.localStorage
      ? window.localStorage.getItem(`skillbridge_verified_project_${skill}`)
      : null;

    return {
      id: `tsk_${gap.requirement_id || skill.toLowerCase().replace(/[^a-z0-9]/g, '_')}`,
      title: isDemonstrated 
        ? (customProjectName ? `Verified: ${customProjectName}` : `Verified: ${skill} Practical Deliverable`)
        : `Complete ${skill} Practical Assessment`,
      target: skill,
      target_skill: skill,
      priority: prio,
      status: isDemonstrated ? 'completed' : 'pending',
      action_deliverable: gap.recommended_action || `Build and submit a working project component focusing on ${skill}.`,
      completion_definition: isDemonstrated
        ? (customProjectName ? `Verified Project: ${customProjectName} (10/10 rubric assessment verified).` : `Verified proof on profile: ${gap.evidence_rationale || 'Code artifact verified.'}`)
        : `Score at least 8/10 on the practical rubric to complete this task.`,
      effort_hours_estimate: effort,
      prerequisites: ['Basic Software Engineering', 'Git deliverable setup'],
      expected_evidence: gap.evidence_rationale || `Evaluated submission and feedback for ${skill}.`,
      due_date: `Day ${dueDay} of ${targetDeadline}-day plan`,
      milestone,
      curated_resources
    };
  });
};

export default function RoadmapPage({ setActiveTab }: RoadmapPageProps) {
  // Target Role & Skill Gap State (Correlated with Assessment & Job Analysis)
  const [roles, setRoles] = useState<TargetRoleOption[]>([]);
  const [selectedRoleId, setSelectedRoleId] = useState<string>('role_junior_backend');
  const [isLoadingRoadmap, setIsLoadingRoadmap] = useState<boolean>(true);

  // Pacing & Feasibility Controls
  const [deadlineDays, setDeadlineDays] = useState<number>(14);
  const [dailyAvailableHours, setDailyAvailableHours] = useState<number>(2.5);
  const [isRecalculating, setIsRecalculating] = useState<boolean>(false);
  const [recalculatedNotice, setRecalculatedNotice] = useState<string | null>(null);

  // Dynamic Roadmap Tasks generated from real Skill Gaps
  const [tasks, setTasks] = useState<RoadmapTask[]>([]);
  const [passedSkillsState, setPassedSkillsState] = useState<Set<string>>(() => {
    try {
      if (typeof window !== 'undefined' && window.localStorage) {
        const raw = window.localStorage.getItem('skillbridge_all_passed_skills');
        if (raw) {
          const list: string[] = JSON.parse(raw);
          return new Set(list.map(s => s.toLowerCase().trim()));
        }
      }
    } catch {}
    return new Set();
  });
  const [showCompletedList, setShowCompletedList] = useState<boolean>(false);

  const resolveEndpoint = (path: string) => {
    if (typeof window !== 'undefined' && window.location && window.location.origin && !window.location.origin.includes('null')) {
      return `${window.location.origin}${path}`;
    }
    return `http://localhost:8000${path}`;
  };

  const loadRoadmapData = async (roleIdToLoad: string, days: number, dailyHours: number, extraPassed?: Set<string>) => {
    setIsLoadingRoadmap(true);
    try {
      const localPassedList = typeof window !== 'undefined' && typeof window.localStorage?.getItem === 'function'
        ? JSON.parse(window.localStorage.getItem('skillbridge_all_passed_skills') || '[]')
        : [];
      const activePassed = new Set([
        ...Array.from(passedSkillsState),
        ...localPassedList.map((s: string) => s.toLowerCase().trim()),
        ...(extraPassed ? Array.from(extraPassed) : [])
      ]);
      const analysis = await skillGapService.runAnalysis(roleIdToLoad, days, dailyHours * 7);
      if (analysis && analysis.results && analysis.results.length > 0) {
        const derivedTasks = buildTasksFromSkillGaps(analysis.results, days, activePassed);
        setTasks(derivedTasks);
      }

      // In background, cross-check /api/roadmap/ if available
      try {
        fetch(resolveEndpoint(`/api/roadmap/?user_id=usr_demo_001&deadline_days=${days}&daily_available=${dailyHours}`))
          .then(r => r.ok ? r.json() : null)
          .then(roadmapData => {
            if (roadmapData && Array.isArray(roadmapData.tasks)) {
              const backendPassed = new Set(activePassed);
              roadmapData.tasks.forEach((t: any) => {
                if (t.status === 'completed' && t.target_skill) {
                  backendPassed.add(t.target_skill.toLowerCase().trim());
                }
              });
              if (backendPassed.size > activePassed.size && analysis && analysis.results) {
                setPassedSkillsState(backendPassed);
                setTasks(buildTasksFromSkillGaps(analysis.results, days, backendPassed));
              }
            }
          })
          .catch(() => {});
      } catch {}
    } catch (err) {
      console.warn('Could not load real roadmap tasks from skill gaps:', err);
    } finally {
      setIsLoadingRoadmap(false);
    }
  };

  // Load Real Target Roles and Derive Real Roadmap Tasks
  useEffect(() => {
    let isCancelled = false;
    setIsLoadingRoadmap(true);

    skillGapService.getTargetRoles().then(async (loadedRoles) => {
      if (isCancelled) return;
      setRoles(loadedRoles);
      const activeRoleId = (loadedRoles || []).find(r => r.id === skillGapService.getSelectedRoleId())?.id || loadedRoles[0]?.id || 'role_junior_backend';
      setSelectedRoleId(activeRoleId);

      await loadRoadmapData(activeRoleId, deadlineDays, dailyAvailableHours);
    }).catch(err => {
      console.warn('Could not load real target roles:', err);
      setIsLoadingRoadmap(false);
    });

    return () => { isCancelled = true; };
  }, []);

  // Listen for assessment passing events and window focus
  useEffect(() => {
    const handleAssessmentPassed = (e: any) => {
      const passedSkill = e.detail?.skill;
      if (!passedSkill) return;
      const passedSkillNorm = passedSkill.toLowerCase().trim();

      setPassedSkillsState(prev => {
        const next = new Set(prev);
        next.add(passedSkillNorm);
        return next;
      });

      // Immediately mark matching deliverable as completed in current state
      const customProject = e?.detail?.project;
      setTasks(prev => prev.map(t => {
        const tSkill = (t.target_skill || t.target || '').toLowerCase().trim();
        if (tSkill === passedSkillNorm || tSkill.includes(passedSkillNorm) || passedSkillNorm.includes(tSkill)) {
          return {
            ...t,
            status: 'completed',
            title: customProject ? `Verified: ${customProject}` : `Verified: ${t.target_skill || t.target} Practical Deliverable`,
            completion_definition: customProject
              ? `Verified Project: ${customProject} (10/10 rubric assessment verified).`
              : `Verified evidence linked on profile: 10/10 rubric assessment verified.`
          };
        }
        return t;
      }));
    };

    const handleFocus = () => {
      loadRoadmapData(selectedRoleId, deadlineDays, dailyAvailableHours);
    };

    if (typeof window !== 'undefined') {
      window.addEventListener('skillbridge_assessment_passed', handleAssessmentPassed);
      window.addEventListener('focus', handleFocus);
    }

    return () => {
      if (typeof window !== 'undefined') {
        window.removeEventListener('skillbridge_assessment_passed', handleAssessmentPassed);
        window.removeEventListener('focus', handleFocus);
      }
    };
  }, [selectedRoleId, deadlineDays, dailyAvailableHours, passedSkillsState]);

  // Handle switching target role/goal
  const handleRoleChange = async (roleId: string) => {
    setSelectedRoleId(roleId);
    skillGapService.setSelectedRole(roleId);
    await loadRoadmapData(roleId, deadlineDays, dailyAvailableHours);
  };

  // Launch Practical Assessment for a specific skill deliverable
  const handleLaunchAssessment = (skillName?: string) => {
    const targetSkill = skillName || 'PostgreSQL';
    if (typeof window !== 'undefined') {
      const url = new URL(window.location.href);
      url.searchParams.set('tab', 'assessment');
      url.searchParams.set('skill', targetSkill);
      window.history.replaceState({}, '', url.toString());
    }
    setActiveTab('assessment');
  };

  // Dynamic Feasibility & Burn-rate Calculations
  const completedTasks = tasks.filter(t => t.status === 'completed');
  const remainingTasks = tasks.filter(t => t.status !== 'completed');
  const isAllTasksCompleted = tasks.length > 0 && remainingTasks.length === 0;
  const remainingHours = isAllTasksCompleted ? 0 : remainingTasks.reduce((acc, t) => acc + (t.effort_hours_estimate || 0), 0);

  // Horizon Countdown & Adaptive Capacity
  const horizonCountdown = calculateHorizonCountdown(selectedRoleId, deadlineDays, isAllTasksCompleted);
  const effectiveRemainingDays = horizonCountdown.daysRemaining;
  const dailyRequiredPace = isAllTasksCompleted
    ? 0
    : Number((remainingHours / Math.max(1, effectiveRemainingDays)).toFixed(2));
  const adaptiveCapacity = evaluateAdaptiveCapacity(
    remainingHours,
    effectiveRemainingDays,
    Math.round(dailyAvailableHours * 7),
    isAllTasksCompleted
  );

  // Interview Readiness Checklist (Tracks real skills & assessments)
  const automatedChecklist = useMemo(() => {
    const hasDemonstratedSkills = completedTasks.length > 0;
    const hasRepoHygiene = completedTasks.length >= Math.ceil(Math.max(1, tasks.length) / 2);
    const hasRubricPassed = completedTasks.some(t => t.status === 'completed');
    const isSprintPaceFeasible = dailyRequiredPace <= dailyAvailableHours;

    return [
      {
        id: 'chk_1',
        title: 'Demonstrated Skills Verification',
        description: hasDemonstratedSkills
          ? `${completedTasks.length} of ${tasks.length} skill tasks completed with passing scores.`
          : 'Complete practical tasks to verify skills on your profile.',
        completed: hasDemonstratedSkills,
        category: 'cv',
        statusText: hasDemonstratedSkills ? `${completedTasks.length}/${tasks.length} Verified` : 'In Progress'
      },
      {
        id: 'chk_2',
        title: 'Project Portfolio & Deliverables',
        description: hasRepoHygiene
          ? 'Core project deliverables and documentation completed across milestones.'
          : `Complete tasks for core high-priority competencies (${completedTasks.length}/${Math.ceil(Math.max(1, tasks.length) / 2)} completed).`,
        completed: hasRepoHygiene,
        category: 'portfolio',
        statusText: hasRepoHygiene ? 'Ready' : 'In Progress'
      },
      {
        id: 'chk_3',
        title: 'Assessment Benchmarks (Passing Score)',
        description: hasRubricPassed
          ? 'Passing scores recorded on practical assessments for interview review.'
          : 'Score at least 8/10 on the practical rubric for your active target skill.',
        completed: hasRubricPassed,
        category: 'application',
        statusText: hasRubricPassed ? 'Met' : 'In Progress'
      },
      {
        id: 'chk_4',
        title: 'Study Schedule Feasibility',
        description: isSprintPaceFeasible
          ? `Current study pace (${dailyRequiredPace}h/day) is well within your daily goal (${dailyAvailableHours}h/day).`
          : `Recommended pace (${dailyRequiredPace}h/day) exceeds your daily study time (${dailyAvailableHours}h/day). Consider extending your timeframe.`,
        completed: isSprintPaceFeasible,
        category: 'application',
        statusText: isSprintPaceFeasible ? 'On Schedule' : 'Needs Adjustment'
      }
    ];
  }, [completedTasks, tasks, dailyRequiredPace, dailyAvailableHours]);

  // Feasibility Rating
  let feasibilityStatus = 'Optimal / Comfortable';
  let feasibilityBadgeColor = 'bg-emerald-100 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800/60';
  let feasibilityGuidance = 'Pace is very manageable. Extra time available for deep-dive polish and mock interview practice.';

  if (isAllTasksCompleted) {
    feasibilityStatus = 'Goal Achieved! 🎉';
    feasibilityBadgeColor = 'bg-emerald-100 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 border-emerald-300 dark:border-emerald-800/60';
    feasibilityGuidance = 'All roadmap deliverables completed with verified assessments! You are interview-ready.';
  } else if (horizonCountdown.isExpired) {
    feasibilityStatus = 'Deadline Passed';
    feasibilityBadgeColor = 'bg-rose-100 dark:bg-rose-950/60 text-rose-700 dark:text-rose-300 border-rose-300 dark:border-rose-800/60';
    feasibilityGuidance = `Target timeframe has elapsed with ${remainingHours}h remaining. Extend your horizon to replan.`;
  } else if (dailyRequiredPace > dailyAvailableHours * 1.5) {
    feasibilityStatus = 'High Risk / Overloaded';
    feasibilityBadgeColor = 'bg-rose-100 dark:bg-rose-950/60 text-rose-700 dark:text-rose-300 border-rose-200 dark:border-rose-800/60';
    feasibilityGuidance = 'Schedule exceeds daily bandwidth. Consider extending your target deadline by 4 to 7 days.';
  } else if (dailyRequiredPace > dailyAvailableHours * 1.1) {
    feasibilityStatus = 'Tight / Accelerated';
    feasibilityBadgeColor = 'bg-amber-100 dark:bg-amber-950/60 text-amber-700 dark:text-amber-300 border-amber-200 dark:border-amber-800/60';
    feasibilityGuidance = 'Accelerated commitment needed. Focus strictly on High Priority deliverables to stay on track.';
  } else if (dailyRequiredPace > dailyAvailableHours * 0.75) {
    feasibilityStatus = 'On Track';
    feasibilityBadgeColor = 'bg-blue-100 dark:bg-blue-950/60 text-blue-700 dark:text-blue-300 border-blue-200 dark:border-blue-800/60';
    feasibilityGuidance = 'Solid pacing aligned with your target deadline. Maintain your scheduled daily commitment.';
  }

  // Recalculate Roadmap Plan Action
  const handleRecalculatePlan = async () => {
    setIsRecalculating(true);
    setRecalculatedNotice(null);

    try {
      const res = await fetch('/api/roadmap/recalculate/', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          user_id: 'usr_demo_001',
          deadline_days: deadlineDays,
          daily_available_hours: dailyAvailableHours,
          rebalance_priority: true
        })
      });

      if (res.ok) {
        setRecalculatedNotice(`Schedule updated: ${dailyRequiredPace} hrs/day over ${deadlineDays} days.`);
      } else {
        setRecalculatedNotice(`Schedule updated: ${dailyRequiredPace} hrs/day.`);
      }
    } catch {
      setRecalculatedNotice(`Schedule updated: ${dailyRequiredPace} hrs/day.`);
    } finally {
      setIsRecalculating(false);
      setTimeout(() => setRecalculatedNotice(null), 5000);
    }
  };

  // Next Recommended Action: Highest priority remaining task
  const nextRecommendedTask = remainingTasks.sort((a, b) => {
    if (a.priority === 'High' && b.priority !== 'High') return -1;
    if (a.priority !== 'High' && b.priority === 'High') return 1;
    return (a.effort_hours_estimate || 0) - (b.effort_hours_estimate || 0);
  })[0];

  const getSkillIcon = (skill?: string) => {
    const s = (skill || '').toLowerCase();
    if (s.includes('sql') || s.includes('postgres') || s.includes('database')) return Database;
    if (s.includes('auth') || s.includes('security') || s.includes('jwt')) return Lock;
    if (s.includes('docker') || s.includes('container') || s.includes('deploy')) return Container;
    if (s.includes('vector') || s.includes('ai') || s.includes('rag')) return Cpu;
    return Award;
  };

  return (
    <div className="space-y-6">
      {/* Header & Target Role Selector */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-bold text-slate-900 dark:text-white">
              Learner Roadmap & Feasibility Planner
            </h1>
            <span className="text-[11px] font-semibold px-2 py-0.5 rounded-md bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 border border-indigo-200/50 dark:border-indigo-800/50">
              Tailored to Your Target Role
            </span>
          </div>
          <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 mt-1">
            Step-by-step milestones to build your skills and get interview-ready for your target role.
          </p>
        </div>

        {/* Target Job Selector & Overall Progress Badges */}
        <div className="flex flex-wrap items-center gap-3">
          {roles.length > 0 && (
            <div className="flex items-center gap-1.5 p-1 rounded-xl bg-slate-100 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-xs font-semibold">
              <span className="text-[11px] text-slate-400 px-2 font-normal">Target Job:</span>
              <select
                value={selectedRoleId}
                onChange={e => handleRoleChange(e.target.value)}
                className="bg-white dark:bg-slate-800 text-slate-900 dark:text-white rounded-lg px-2.5 py-1 text-xs border border-slate-200 dark:border-slate-700 focus:outline-none font-semibold cursor-pointer"
              >
                {roles.map(r => (
                  <option key={r.id} value={r.id}>
                    {r.role_title} ({r.mode === 'goal_based' ? 'Goal' : 'JD Match'})
                  </option>
                ))}
              </select>
            </div>
          )}

          <div className="text-xs text-slate-600 dark:text-slate-400 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 px-3 py-1.5 rounded-xl font-medium shadow-xs">
            Tasks Completed: <strong className="text-emerald-600 dark:text-emerald-400">{completedTasks.length}/{tasks.length}</strong>
          </div>
          <div className="text-xs text-slate-600 dark:text-slate-400 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 px-3 py-1.5 rounded-xl font-medium shadow-xs">
            Remaining Effort: <strong className="text-indigo-600 dark:text-indigo-400">{remainingHours} hrs</strong>
          </div>
        </div>
      </div>

      {/* DYNAMIC SCHEDULE & STUDY PACING DASHBOARD */}
      <div className="rounded-2xl border border-slate-200/90 dark:border-slate-800/80 bg-white dark:bg-[#0e131f] p-5 shadow-xs space-y-4">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-3 border-b border-slate-100 dark:border-slate-800/80">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-indigo-50 dark:bg-indigo-950 text-indigo-600 dark:text-indigo-400 border border-indigo-200/40 dark:border-indigo-800/40">
              <Calendar className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
                Schedule & Study Pacing
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Adjust your target timeframe or daily study hours to find a pace that works for you.
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            {/* Target Deadline Selector */}
            <div className="flex items-center gap-1 p-1 rounded-xl bg-slate-100 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-xs font-semibold">
              <span className="text-[11px] text-slate-400 px-2 font-normal">
                {isAllTasksCompleted ? 'Target (Completed):' : `Target (${effectiveRemainingDays}d left):`}
              </span>
              {[
                { days: 7, label: '7 Days' },
                { days: 14, label: '14 Days' },
                { days: 21, label: '21 Days' },
                { days: 30, label: '30 Days' },
              ].map(opt => (
                <button
                  key={opt.days}
                  type="button"
                  onClick={() => {
                    updateDeadlineTimestamp(selectedRoleId, opt.days);
                    setDeadlineDays(opt.days);
                  }}
                  className={`px-2.5 py-1 rounded-lg text-xs transition-all ${
                    deadlineDays === opt.days
                      ? 'bg-white dark:bg-slate-800 text-slate-900 dark:text-white shadow-xs'
                      : 'text-slate-500 hover:text-slate-900 dark:hover:text-white'
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>

            {/* Recalculate Button */}
            <button
              type="button"
              onClick={handleRecalculatePlan}
              disabled={isRecalculating}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-900 dark:bg-white text-white dark:text-slate-900 text-xs font-semibold hover:bg-slate-800 dark:hover:bg-slate-100 transition-all shadow-xs disabled:opacity-50"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isRecalculating ? 'animate-spin' : ''}`} />
              <span>Update Schedule</span>
            </button>
          </div>
        </div>

        {/* Adaptive Capacity Recognition Alert */}
        {!isAllTasksCompleted && adaptiveCapacity.capacityStatus === 'increase_needed' && (
          <div className="rounded-xl bg-amber-50 dark:bg-amber-950/60 border border-amber-200/70 dark:border-amber-800/70 px-4 py-2.5 text-xs text-amber-800 dark:text-amber-200 flex flex-col sm:flex-row sm:items-center justify-between gap-2 animate-fadeIn">
            <span className="flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0" />
              <span>{adaptiveCapacity.message}</span>
            </span>
            <button
              type="button"
              onClick={() => setDailyAvailableHours(adaptiveCapacity.recommendedDailyHours)}
              className="px-2.5 py-1 rounded-lg font-bold bg-amber-200 dark:bg-amber-900 text-amber-900 dark:text-amber-100 hover:bg-amber-300 dark:hover:bg-amber-800 transition-colors self-start sm:self-auto cursor-pointer"
            >
              ⚡ Adapt Capacity ({adaptiveCapacity.recommendedDailyHours}h/day)
            </button>
          </div>
        )}

        {/* Recalculated Notification Banner */}
        {recalculatedNotice && (
          <div className="rounded-xl bg-indigo-50 dark:bg-indigo-950/60 border border-indigo-200/60 dark:border-indigo-800/60 px-4 py-2.5 text-xs text-indigo-700 dark:text-indigo-300 flex items-center justify-between animate-fadeIn">
            <span className="flex items-center gap-2">
              <Sparkles className="w-3.5 h-3.5" />
              {recalculatedNotice}
            </span>
            <span className="text-[11px] font-semibold text-indigo-600 dark:text-indigo-400">Schedule Active</span>
          </div>
        )}

        {/* 4 Feasibility Metrics Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          <div className="rounded-xl border border-slate-200/80 dark:border-slate-800 bg-slate-50/60 dark:bg-slate-900/60 p-3 space-y-1">
            <span className="text-[11px] text-slate-400 font-medium">Pacing Status</span>
            <div className="flex items-center gap-2">
              <span className={`text-xs font-bold px-2 py-0.5 rounded-full border ${feasibilityBadgeColor}`}>
                {feasibilityStatus}
              </span>
            </div>
            <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1 line-clamp-1">
              {feasibilityGuidance}
            </p>
          </div>

          <div className="rounded-xl border border-slate-200/80 dark:border-slate-800 bg-slate-50/60 dark:bg-slate-900/60 p-3 space-y-1">
            <span className="text-[11px] text-slate-400 font-medium">Recommended Daily Pace</span>
            <div className="flex items-baseline gap-1.5">
              <span className="text-xl font-bold text-slate-900 dark:text-white">{dailyRequiredPace}</span>
              <span className="text-xs text-slate-500">hrs / day</span>
            </div>
            <p className="text-[11px] text-slate-400">
              {isAllTasksCompleted
                ? 'All deliverables verified'
                : `Based on ${remainingHours}h remaining over ${effectiveRemainingDays} days left`}
            </p>
          </div>

          <div className="rounded-xl border border-slate-200/80 dark:border-slate-800 bg-slate-50/60 dark:bg-slate-900/60 p-3 space-y-1">
            <span className="text-[11px] text-slate-400 font-medium">Daily Study Time</span>
            <div className="flex items-center justify-between">
              <span className="text-xl font-bold text-slate-900 dark:text-white">{dailyAvailableHours}h</span>
              <div className="flex items-center gap-1">
                {[1.5, 2.5, 4.0].map(hrs => (
                  <button
                    key={hrs}
                    type="button"
                    onClick={() => setDailyAvailableHours(hrs)}
                    className={`px-1.5 py-0.5 rounded text-[10px] font-semibold ${dailyAvailableHours === hrs ? 'bg-indigo-600 text-white' : 'bg-slate-200 dark:bg-slate-800 text-slate-600 dark:text-slate-400'}`}
                  >
                    {hrs}h
                  </button>
                ))}
              </div>
            </div>
            <p className="text-[11px] text-slate-400">
              Your planned study time per day
            </p>
          </div>

          <div className="rounded-xl border border-slate-200/80 dark:border-slate-800 bg-slate-50/60 dark:bg-slate-900/60 p-3 space-y-1">
            <span className="text-[11px] text-slate-400 font-medium">Roadmap Progress</span>
            <div className="flex items-baseline gap-1.5">
              <span className="text-xl font-bold text-emerald-600 dark:text-emerald-400">
                {Math.round((completedTasks.length / Math.max(1, tasks.length)) * 100)}%
              </span>
              <span className="text-xs text-slate-500">
                ({completedTasks.length}/{tasks.length} deliverables)
              </span>
            </div>
            <div className="w-full bg-slate-200 dark:bg-slate-800 h-1.5 rounded-full overflow-hidden mt-1">
              <div
                className="bg-emerald-500 h-full rounded-full transition-all duration-500"
                style={{ width: `${(completedTasks.length / Math.max(1, tasks.length)) * 100}%` }}
              />
            </div>
          </div>
        </div>

        {/* Highlighted Next Action Recommendation Correlated with Practical Assessment */}
        {nextRecommendedTask ? (
          <div className="rounded-xl border border-indigo-200/60 dark:border-indigo-900/40 bg-gradient-to-r from-indigo-50/60 to-purple-50/30 dark:from-indigo-950/30 dark:to-purple-950/10 p-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
            <div className="flex items-center gap-2.5">
              <div className="p-1.5 rounded-lg bg-indigo-600 text-white shrink-0">
                <Target className="w-4 h-4" />
              </div>
              <div>
                <span className="font-bold text-indigo-900 dark:text-indigo-200 block">
                  Recommended Next Step:
                </span>
                <span className="text-slate-600 dark:text-slate-300">
                  {nextRecommendedTask.title} (~{nextRecommendedTask.effort_hours_estimate}h) — Target: <strong>{nextRecommendedTask.target_skill}</strong>
                </span>
              </div>
            </div>

            <button
              type="button"
              onClick={() => handleLaunchAssessment(nextRecommendedTask.target_skill || nextRecommendedTask.target)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white font-semibold text-xs transition-colors self-start sm:self-auto shrink-0 shadow-xs"
            >
              <Award className="w-3.5 h-3.5" />
              <span>Launch Practical Assessment</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>
        ) : tasks.length > 0 && completedTasks.length === tasks.length ? (
          <div className="rounded-xl border border-emerald-200/60 dark:border-emerald-900/40 bg-gradient-to-r from-emerald-50/60 to-teal-50/30 dark:from-emerald-950/30 dark:to-teal-950/10 p-3.5 flex items-center justify-between gap-3 text-xs">
            <div className="flex items-center gap-2.5">
              <div className="p-1.5 rounded-lg bg-emerald-600 text-white shrink-0">
                <CheckCircle2 className="w-4 h-4" />
              </div>
              <div>
                <span className="font-bold text-emerald-900 dark:text-emerald-200 block">
                  All Roadmap Practical Deliverables Verified!
                </span>
                <span className="text-slate-600 dark:text-slate-300">
                  You have successfully demonstrated verified evidence for all required competencies (10/10 rubric benchmark met).
                </span>
              </div>
            </div>
            <span className="px-3 py-1.5 rounded-lg bg-emerald-600 text-white font-bold text-xs shrink-0 flex items-center gap-1">
              <Award className="w-3.5 h-3.5" /> Interview Ready
            </span>
          </div>
        ) : null}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Main Column: Sequenced Roadmap Tasks */}
        <div className="lg:col-span-2 space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <BookOpen className="w-4 h-4 text-indigo-500" />
                Your Learning Tasks ({tasks.length})
              </h2>
              <span className="text-[11px] text-slate-400">
                Milestones tailored to your target role and interview preparation
              </span>
            </div>
            <span className="text-xs text-indigo-600 dark:text-cyan-400 font-medium flex items-center gap-1">
              <Sparkles className="w-3.5 h-3.5" />
              Automated System Tracking (marks complete when passing)
            </span>
          </div>

          {isLoadingRoadmap ? (
            <div className="flex items-center justify-center p-8 text-xs text-slate-400 gap-2">
              <RefreshCw className="w-4 h-4 animate-spin text-indigo-500" />
              <span>Loading roadmap milestones...</span>
            </div>
          ) : tasks.length === 0 ? (
            <div className="rounded-2xl border border-slate-200 dark:border-slate-800 p-8 text-center text-xs text-slate-400">
              No tasks found for this role.
            </div>
          ) : tasks.length > 0 && completedTasks.length === tasks.length && !showCompletedList ? (
            /* PROFESSIONAL TASK COMPLETION EXPERIENCE (Inline state replacing task list) */
            <div className="rounded-2xl border border-emerald-500/30 bg-gradient-to-br from-emerald-50/80 via-white to-teal-50/50 dark:from-emerald-950/30 dark:via-[#0e131f] dark:to-teal-950/20 p-8 shadow-xs text-center space-y-6 animate-fadeIn">
              <div className="inline-flex p-4 rounded-2xl bg-gradient-to-tr from-emerald-500 to-teal-500 text-white shadow-md mx-auto">
                <Trophy className="w-10 h-10" />
              </div>
              <div className="space-y-2 max-w-lg mx-auto">
                <span className="text-xs font-bold tracking-wider uppercase px-3 py-1 rounded-full bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800">
                  Plan Complete • All Goals Met
                </span>
                <h3 className="text-2xl font-extrabold text-slate-900 dark:text-white">
                  You're all done! 🎉
                </h3>
                <p className="text-sm text-slate-600 dark:text-slate-300 leading-relaxed">
                  Congratulations! You have finished every task in your learning plan and built verified proof of your competencies. You are well prepared for technical interviews in this role.
                </p>
              </div>

              {/* Summary stats */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 max-w-xl mx-auto pt-2">
                <div className="rounded-xl border border-slate-200/80 dark:border-slate-800 bg-white/80 dark:bg-slate-900/80 p-3.5 space-y-1">
                  <span className="text-[11px] text-slate-400 font-medium">Tasks Completed</span>
                  <div className="text-xl font-bold text-slate-900 dark:text-white">
                    {completedTasks.length} / {tasks.length}
                  </div>
                  <span className="text-[10px] text-emerald-600 dark:text-emerald-400 font-semibold">100% Finished</span>
                </div>
                <div className="rounded-xl border border-slate-200/80 dark:border-slate-800 bg-white/80 dark:bg-slate-900/80 p-3.5 space-y-1">
                  <span className="text-[11px] text-slate-400 font-medium">Skills Verified</span>
                  <div className="text-xl font-bold text-slate-900 dark:text-white">
                    {tasks.map(t => t.target_skill).filter(Boolean).length}
                  </div>
                  <span className="text-[10px] text-indigo-600 dark:text-indigo-400 font-semibold">Evidence on Profile</span>
                </div>
                <div className="rounded-xl border border-slate-200/80 dark:border-slate-800 bg-white/80 dark:bg-slate-900/80 p-3.5 space-y-1">
                  <span className="text-[11px] text-slate-400 font-medium">Interview Readiness</span>
                  <div className="text-xl font-bold text-emerald-600 dark:text-emerald-400 flex items-center justify-center gap-1">
                    <CheckCircle2 className="w-5 h-5 text-emerald-500" />
                    <span>Ready</span>
                  </div>
                  <span className="text-[10px] text-slate-500">Rubric Benchmarks Met</span>
                </div>
              </div>

              {/* Clear Next Steps */}
              <div className="pt-2 flex flex-col sm:flex-row items-center justify-center gap-3">
                <button
                  type="button"
                  onClick={() => setActiveTab('dashboard')}
                  className="w-full sm:w-auto flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl bg-slate-900 dark:bg-white text-white dark:text-slate-900 text-xs font-bold hover:bg-slate-800 dark:hover:bg-slate-100 transition-all shadow-sm cursor-pointer"
                >
                  <span>Go to Dashboard</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </button>
                <button
                  type="button"
                  onClick={() => setActiveTab('gaps')}
                  className="w-full sm:w-auto flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 text-xs font-bold hover:bg-slate-50 dark:hover:bg-slate-700/60 transition-all shadow-xs cursor-pointer"
                >
                  <Target className="w-3.5 h-3.5 text-indigo-500" />
                  <span>Explore Another Target Role</span>
                </button>
                <button
                  type="button"
                  onClick={() => setShowCompletedList(true)}
                  className="w-full sm:w-auto text-xs font-semibold text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white px-3 py-2 transition-colors underline cursor-pointer"
                >
                  Review completed tasks ({tasks.length})
                </button>
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              {tasks.length > 0 && completedTasks.length === tasks.length && showCompletedList && (
                <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900 p-3 flex items-center justify-between text-xs">
                  <span className="text-slate-600 dark:text-slate-300">
                    Viewing all <strong>{completedTasks.length}</strong> completed tasks.
                  </span>
                  <button
                    type="button"
                    onClick={() => setShowCompletedList(false)}
                    className="text-xs font-bold text-indigo-600 dark:text-indigo-400 hover:underline cursor-pointer"
                  >
                    Back to completion summary
                  </button>
                </div>
              )}

              {tasks.map((task) => {
                const isDone = task.status === 'completed';
                const IconComponent = getSkillIcon(task.target_skill || task.target);

                return (
                  <div
                    key={task.id}
                    className={`rounded-2xl border p-5 transition-all space-y-3.5 shadow-xs ${
                      isDone
                        ? 'border-emerald-500/40 bg-emerald-50/40 dark:bg-emerald-950/20'
                        : 'border-slate-200/90 dark:border-slate-800/80 bg-white dark:bg-[#0e131f] hover:border-slate-300 dark:hover:border-slate-700'
                    }`}
                  >
                    {/* Task Header */}
                    <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
                      <div className="flex items-start gap-3">
                        <div
                          className="mt-0.5 p-1 rounded-md shrink-0"
                          title={isDone ? 'Verified Evidence' : 'In progress'}
                        >
                          {isDone ? (
                            <CheckCircle2 className="w-5 h-5 text-emerald-500" />
                          ) : (
                            <Clock className="w-5 h-5 text-slate-400 dark:text-slate-500" />
                          )}
                        </div>

                        <div className="space-y-1">
                          <div className="flex flex-wrap items-center gap-2">
                            <span className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded border ${
                              task.priority === 'High'
                                ? 'bg-rose-500/10 text-rose-600 dark:text-rose-400 border-rose-500/30'
                                : 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/30'
                            }`}>
                              {task.priority} Priority
                            </span>
                            <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-indigo-600 dark:text-indigo-300 bg-indigo-50 dark:bg-indigo-950/60 px-2 py-0.5 rounded border border-indigo-200/50 dark:border-indigo-800/50">
                              <IconComponent className="w-3 h-3 text-indigo-500" />
                              Target: {task.target_skill}
                            </span>
                            {task.effort_hours_estimate && (
                              <span className="flex items-center gap-1 text-[10px] text-slate-500 dark:text-slate-400 bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded">
                                <Clock className="w-3 h-3" /> ~{task.effort_hours_estimate} hrs
                              </span>
                            )}
                            {task.due_date && (
                              <span className="text-[10px] text-cyan-600 dark:text-cyan-400 font-medium">
                                Due: {task.due_date}
                              </span>
                            )}
                            {isDone && (
                              <span className="flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300 border border-emerald-300/40">
                                <Award className="w-3 h-3 text-emerald-500" /> Demonstrated Evidence
                              </span>
                            )}
                          </div>

                          <h3 className={`text-base font-semibold ${isDone ? 'line-through text-slate-400 dark:text-slate-500' : 'text-slate-900 dark:text-white'}`}>
                            {task.title}
                          </h3>
                        </div>
                      </div>

                      {/* Direct Practical Assessment Launch CTA */}
                      <div className="self-end sm:self-auto shrink-0">
                        {!isDone ? (
                          <button
                            type="button"
                            onClick={() => handleLaunchAssessment(task.target_skill || task.target)}
                            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-900 dark:bg-white text-white dark:text-slate-900 text-xs font-semibold hover:bg-slate-800 dark:hover:bg-slate-100 transition-all shadow-xs cursor-pointer"
                          >
                            <Award className="w-3.5 h-3.5 text-indigo-400 dark:text-indigo-600" />
                            <span>Launch Assessment</span>
                            <ArrowRight className="w-3.5 h-3.5" />
                          </button>
                        ) : (
                          <button
                            type="button"
                            onClick={() => handleLaunchAssessment(task.target_skill || task.target)}
                            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 border border-emerald-200/80 dark:border-emerald-800/80 text-xs font-semibold hover:bg-emerald-100 dark:hover:bg-emerald-900/60 transition-all shadow-xs cursor-pointer"
                          >
                            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />
                            <span>Review Rubric</span>
                          </button>
                        )}
                      </div>
                    </div>

                    {/* Concrete Action & Completion Definition */}
                    <div className="rounded-xl bg-slate-50 dark:bg-slate-950/70 p-3 border border-slate-200/60 dark:border-slate-800/80 space-y-2 text-xs">
                      <div>
                        <strong className="text-slate-700 dark:text-slate-300 block mb-0.5 font-semibold">
                          What you'll build:
                        </strong>
                        <p className="text-slate-600 dark:text-slate-300 leading-relaxed">
                          {task.action_deliverable}
                        </p>
                      </div>
                      <div>
                        <strong className="text-slate-500 dark:text-slate-400 block mb-0.5 font-semibold">
                          Success criteria:
                        </strong>
                        <p className="text-slate-500 dark:text-slate-400 italic">
                          {task.completion_definition}
                        </p>
                      </div>
                    </div>

                    {/* Curated Official Resources */}
                    {task.curated_resources && task.curated_resources.length > 0 && (
                      <div className="space-y-1.5 pt-1">
                        <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider block">
                          Curated Official Resources
                        </span>
                        <div className="flex flex-wrap gap-2">
                          {task.curated_resources.map((res, i) => (
                            <a
                              key={i}
                              href={res.url}
                              target="_blank"
                              rel="noreferrer"
                              className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 px-2.5 py-1 text-xs text-indigo-600 dark:text-indigo-400 hover:underline transition-colors"
                            >
                              <ExternalLink className="w-3 h-3" />
                              <span>{res.title}</span>
                              <span className="text-[10px] text-slate-400">({res.source})</span>
                            </a>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Sidebar Column: Interview Readiness Checklist */}
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
              <ListChecks className="w-4 h-4 text-cyan-600 dark:text-cyan-400" />
              Interview Readiness Checklist
            </h2>
            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-50 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400 border border-emerald-200/50 dark:border-emerald-800/50 flex items-center gap-1">
              <CheckCircle2 className="w-3 h-3 text-emerald-500" /> Auto-tracked
            </span>
          </div>

          <div className="rounded-2xl border border-slate-200/90 dark:border-slate-800/80 bg-white dark:bg-[#0e131f] p-5 space-y-4 shadow-xs">
            <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
              Tracks your progress toward meeting role requirements. Updates automatically as you complete each task.
            </p>

            <div className="space-y-2.5">
              {automatedChecklist.map((item) => (
                <div
                  key={item.id}
                  className={`p-3 rounded-xl border transition-all space-y-1.5 ${
                    item.completed
                      ? 'border-emerald-500/30 bg-emerald-50/50 dark:bg-emerald-950/20'
                      : 'border-slate-200/80 dark:border-slate-800 bg-slate-50/60 dark:bg-slate-950/60'
                  }`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      {item.completed ? (
                        <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" />
                      ) : (
                        <Clock className="w-4 h-4 text-amber-500 shrink-0" />
                      )}
                      <span className={`text-xs font-semibold ${item.completed ? 'text-slate-900 dark:text-white' : 'text-slate-700 dark:text-slate-300'}`}>
                        {item.title}
                      </span>
                    </div>

                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full shrink-0 ${
                      item.completed
                        ? 'bg-emerald-100 dark:bg-emerald-900/60 text-emerald-700 dark:text-emerald-300'
                        : 'bg-amber-100 dark:bg-amber-900/60 text-amber-700 dark:text-amber-300'
                    }`}>
                      {item.statusText}
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400 pl-6 leading-normal">
                    {item.description}
                  </p>
                </div>
              ))}
            </div>

            <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-950/80 border border-slate-200/80 dark:border-slate-800 text-[11px] text-slate-500 dark:text-slate-400 flex items-start gap-2">
              <FileCheck className="w-4 h-4 text-indigo-500 shrink-0 mt-0.5" />
              <span>
                Completing practical tasks and maintaining your study schedule automatically updates your readiness status.
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
