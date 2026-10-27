import { useState, useEffect, useCallback, useRef } from 'react';
import {
  ArrowRight,
  Share2,
  Plus,
  RefreshCw,
  AlertCircle,
  Sparkles
} from 'lucide-react';
import RoleSelector from '../components/skill-gap/RoleSelector';
import GapOverviewCards from '../components/skill-gap/GapOverviewCards';
import FeasibilityBanner from '../components/skill-gap/FeasibilityBanner';
import SkillComparisonTable from '../components/skill-gap/SkillComparisonTable';
import SkillDetailModal from '../components/skill-gap/SkillDetailModal';
import LinkEvidenceModal from '../components/skill-gap/LinkEvidenceModal';
import EvidenceMatrixModal from '../components/skill-gap/EvidenceMatrixModal';
import CustomCareerGoalModal from '../components/skill-gap/CustomCareerGoalModal';
import { useAuth } from '../context/AuthContext';
import {
  skillGapService,
  type SkillGapAnalysisResponse
} from '../services/skillGapService';
import { calculateFeasibility, type TraceableMatchResult } from '../utils/skillGapCalculations';
import type { TargetRoleOption } from '../services/mockSkillGapData';
import type { SkillEvidence } from '../types';

interface SkillGapPageProps {
  setActiveTab: (tab: string) => void;
}

export default function SkillGapPage({ setActiveTab }: SkillGapPageProps) {
  const { user } = useAuth();
  const currentUserId = user ? String(user.id) : 'demo_user';

  const [roles, setRoles] = useState<TargetRoleOption[]>([]);
  const [selectedRoleId, setSelectedRoleId] = useState<string>('job_15f49367');
  const [activeModeFilter, setActiveModeFilter] = useState<'all' | 'job_specific' | 'goal_based'>('all');
  const [analysis, setAnalysis] = useState<SkillGapAnalysisResponse | null>(null);
  const [daysRemaining, setDaysRemaining] = useState<number>(14);
  const [studyHoursPerWeek, setStudyHoursPerWeek] = useState<number>(14);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  // Modals & Drawers
  const [selectedSkill, setSelectedSkill] = useState<TraceableMatchResult | null>(null);
  const [isLinkModalOpen, setIsLinkModalOpen] = useState<boolean>(false);
  const [linkTargetSkill, setLinkTargetSkill] = useState<string>('');
  const [isMatrixModalOpen, setIsMatrixModalOpen] = useState<boolean>(false);
  const [isCustomGoalModalOpen, setIsCustomGoalModalOpen] = useState<boolean>(false);

  // User notification toast
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3500);
  };

  const loadAnalysis = useCallback(async (
    roleId?: string,
    customDays?: number,
    customHours?: number,
    silent: boolean = false
  ) => {
    if (!silent) setIsLoading(true);
    setError(null);
    try {
      const data = await skillGapService.runAnalysis(roleId, customDays, customHours, currentUserId);
      setAnalysis(data);
      if (data.role) {
        setSelectedRoleId(data.role.id);
        if (customDays !== undefined) setDaysRemaining(customDays);
        else setDaysRemaining(data.role.days_remaining);

        if (customHours !== undefined) setStudyHoursPerWeek(customHours);
        else setStudyHoursPerWeek(data.role.study_hours_per_week);
      }
    } catch (err: any) {
      console.error('Failed to run skill gap analysis:', err);
      setError(err.message || 'Failed to analyze skill gaps');
    } finally {
      if (!silent) setIsLoading(false);
    }
  }, [currentUserId]);

  // Load roles on mount and auto-select active role from Neon DB
  useEffect(() => {
    let isCancelled = false;

    skillGapService.getTargetRoles(currentUserId).then(loadedRoles => {
      if (isCancelled) return;
      setRoles(loadedRoles);
      const activeId = skillGapService.getSelectedRoleId() || (loadedRoles && loadedRoles[0]?.id) || 'job_15f49367';
      const targetRole = (loadedRoles || []).find(r => r.id === activeId) || (loadedRoles && loadedRoles[0]);
      if (targetRole) {
        setSelectedRoleId(targetRole.id);
        setDaysRemaining(targetRole.days_remaining);
        setStudyHoursPerWeek(targetRole.study_hours_per_week);
        loadAnalysis(targetRole.id, targetRole.days_remaining, targetRole.study_hours_per_week);
      } else {
        loadAnalysis('job_15f49367');
      }
    }).catch(err => {
      if (isCancelled) return;
      setError(err.message || 'Failed to connect to backend service');
      setIsLoading(false);
    });

    return () => {
      isCancelled = true;
    };
  }, [loadAnalysis, currentUserId]);

  // Synchronize when an assessment is passed
  useEffect(() => {
    const handlePassed = (e: any) => {
      const skill = e.detail?.skill;
      if (skill) {
        loadAnalysis(selectedRoleId, daysRemaining, studyHoursPerWeek);
      }
    };
    if (typeof window !== 'undefined') {
      window.addEventListener('skillbridge_assessment_passed', handlePassed);
    }
    return () => {
      if (typeof window !== 'undefined') {
        window.removeEventListener('skillbridge_assessment_passed', handlePassed);
      }
    };
  }, [selectedRoleId, daysRemaining, studyHoursPerWeek, loadAnalysis]);

  const handleModeFilterChange = (newMode: 'all' | 'job_specific' | 'goal_based') => {
    setActiveModeFilter(newMode);
    const currentRole = roles.find(r => r.id === selectedRoleId);
    if (newMode !== 'all' && currentRole && currentRole.mode !== newMode) {
      const matchingRole = roles.find(r => r.mode === newMode);
      if (matchingRole) {
        handleRoleChange(matchingRole.id);
      }
    }
  };

  const handleCreateCustomGoal = async (data: {
    role_title: string;
    goal_description: string;
    days_remaining: number;
    study_hours_per_week: number;
  }) => {
    setIsCustomGoalModalOpen(false);
    setIsLoading(true);
    setError(null);
    try {
      const newRole = await skillGapService.createCustomGoal(data);
      const updatedRoles = await skillGapService.getTargetRoles();
      setRoles(updatedRoles);
      const matched = updatedRoles.find(r => r.id === newRole.id || (r.role_title === newRole.role_title && r.mode === 'goal_based'));
      const targetId = matched ? matched.id : newRole.id;
      setSelectedRoleId(targetId);
      setActiveModeFilter('goal_based');
      setDaysRemaining(newRole.days_remaining);
      setStudyHoursPerWeek(newRole.study_hours_per_week);
      await loadAnalysis(targetId, newRole.days_remaining, newRole.study_hours_per_week);
      showToast(`Career goal "${newRole.role_title}" created! AI identified ${newRole.requirements?.length || 0} milestone competencies.`);
    } catch (err: any) {
      console.error('Failed to create custom goal:', err);
      setError(err.message || 'Failed to create and analyze custom goal');
      setIsLoading(false);
    }
  };

  const handleRoleChange = (roleId: string) => {
    setSelectedRoleId(roleId);
    skillGapService.setSelectedRole(roleId);
    const targetRole = roles.find(r => r.id === roleId);
    if (targetRole) {
      setDaysRemaining(targetRole.days_remaining);
      setStudyHoursPerWeek(targetRole.study_hours_per_week);
      loadAnalysis(roleId, targetRole.days_remaining, targetRole.study_hours_per_week);
      showToast(`Switched target role to "${targetRole.role_title}"`);
    }
  };

  const budgetDebounceRef = useRef<NodeJS.Timeout | null>(null);

  const handleUpdateBudget = (newDays: number, newHours: number) => {
    setDaysRemaining(newDays);
    setStudyHoursPerWeek(newHours);

    // Optimistically update feasibility metrics immediately for silky-smooth slider UX
    if (analysis?.feasibility && analysis.results) {
      const dailyHours = Math.round((newHours / 7.0) * 10) / 10;
      const newFeasibility = calculateFeasibility(newDays, dailyHours, analysis.results);
      const deferredSet = new Set(newFeasibility.deferred_skills || []);

      const updatedResults = analysis.results.map(r => ({
        ...r,
        is_deferred: deferredSet.has(r.skill_name),
        in_sprint_scope: r.status !== 'Demonstrated' && !deferredSet.has(r.skill_name)
      }));

      setAnalysis(prev => prev ? ({
        ...prev,
        feasibility: newFeasibility,
        results: updatedResults
      }) : prev);
    }

    if (budgetDebounceRef.current) {
      clearTimeout(budgetDebounceRef.current);
    }
    budgetDebounceRef.current = setTimeout(() => {
      loadAnalysis(selectedRoleId, newDays, newHours, true);
    }, 250);
  };

  const handleOpenLinkModal = (skillName?: string) => {
    setLinkTargetSkill(skillName || (analysis?.results[0]?.skill_name || ''));
    setIsLinkModalOpen(true);
  };

  const handleSubmitEvidence = async (
    evidenceData: Omit<SkillEvidence, 'id' | 'evidence_id'>
  ) => {
    await skillGapService.linkEvidence(evidenceData);
    await loadAnalysis(selectedRoleId, daysRemaining, studyHoursPerWeek);
    showToast(`Added evidence for ${evidenceData.skill_name}.`);
  };

  const handleUpdateRequirementPriority = async (requirementId: string, newPriority: 'High' | 'Medium' | 'Low') => {
    if (!analysis?.role?.id) return;
    const currentReqs = analysis.role.requirements || [];
    const updated = currentReqs.map(r => {
      const isMatch =
        r.id === requirementId ||
        (r as any).requirement_id === requirementId ||
        r.skill_name.toLowerCase() === requirementId.toLowerCase();
      return isMatch ? { ...r, priority: newPriority } : r;
    });
    try {
      await skillGapService.updateRequirements(analysis.role.id, updated);
      await loadAnalysis(analysis.role.id, daysRemaining, studyHoursPerWeek);
      showToast(`Priority updated to ${newPriority}.`);
    } catch (err: any) {
      showToast(err?.message || 'Failed to update requirement priority');
    }
  };

  const handleRemoveRequirement = async (requirementId: string) => {
    if (!analysis?.role?.id) return;
    const currentReqs = analysis.role.requirements || [];
    const updated = currentReqs.filter(r => {
      const isMatch =
        r.id === requirementId ||
        (r as any).requirement_id === requirementId ||
        r.skill_name.toLowerCase() === requirementId.toLowerCase();
      return !isMatch;
    });
    try {
      await skillGapService.updateRequirements(analysis.role.id, updated);
      await loadAnalysis(analysis.role.id, daysRemaining, studyHoursPerWeek);
      showToast('Requirement removed.');
    } catch (err: any) {
      showToast(err?.message || 'Failed to remove requirement');
    }
  };

  const handleAddRequirement = async (req: {
    skill_name: string;
    category: string;
    importance: 'required' | 'preferred';
    priority: 'High' | 'Medium' | 'Low';
  }) => {
    if (!analysis?.role?.id) return;
    const currentReqs = analysis.role.requirements || [];
    const updated = [
      ...currentReqs,
      {
        id: `req_${Date.now()}`,
        skill_name: req.skill_name,
        category: req.category,
        importance: req.importance,
        priority: req.priority,
        source_excerpt: 'Custom user competency'
      }
    ];
    try {
      await skillGapService.updateRequirements(analysis.role.id, updated);
      await loadAnalysis(analysis.role.id, daysRemaining, studyHoursPerWeek);
      showToast(`Added "${req.skill_name}".`);
    } catch (err: any) {
      showToast(err?.message || 'Failed to add requirement');
    }
  };

  const handleRefresh = async () => {
    try {
      setIsLoading(true);
      const updatedRoles = await skillGapService.getTargetRoles();
      setRoles(updatedRoles);
      await loadAnalysis(selectedRoleId, daysRemaining, studyHoursPerWeek);
      showToast('Analysis & feasibility metrics refreshed.');
    } catch (err: any) {
      showToast(err?.message || 'Failed to refresh analysis');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      {/* Toast Notification */}
      {toastMessage && (
        <div className="fixed bottom-6 right-6 z-50 bg-slate-900 dark:bg-white text-white dark:text-slate-900 px-4 py-2.5 rounded-2xl shadow-xl text-xs font-semibold flex items-center gap-2 border border-slate-700 dark:border-slate-200 animate-in slide-in-from-bottom-2">
          <Sparkles className="w-4 h-4 text-amber-400 dark:text-indigo-600" />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* Page Header */}
      <div className="flex justify-between items-start flex-wrap gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white">
            Skill Gap & Evidence Matching
          </h1>
          <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 mt-1 max-w-3xl leading-relaxed">
            Transparent requirement-to-profile matching, verified evidence tracking, gap priorities, and deadline feasibility.
          </p>
        </div>

        {/* Action Header Buttons */}
        <div className="flex items-center gap-2 flex-wrap">
          <button
            type="button"
            onClick={() => setIsMatrixModalOpen(true)}
            className="flex items-center gap-1.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-[#0e131f] px-3.5 py-2 text-xs font-semibold text-slate-800 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800/80 transition-colors shadow-xs"
          >
            <Share2 className="w-3.5 h-3.5 text-indigo-500" />
            <span>Evidence Matrix</span>
          </button>

          <button
            type="button"
            onClick={() => handleOpenLinkModal()}
            className="flex items-center gap-1.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-[#0e131f] px-3.5 py-2 text-xs font-semibold text-slate-800 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800/80 transition-colors shadow-xs"
          >
            <Plus className="w-3.5 h-3.5 text-indigo-500" />
            <span>Link Evidence</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('roadmap')}
            className="flex items-center gap-2 rounded-xl bg-slate-900 dark:bg-white px-4 py-2 text-xs font-semibold text-white dark:text-slate-900 hover:bg-slate-800 dark:hover:bg-slate-100 transition-colors shadow-xs"
          >
            View Roadmap <ArrowRight className="w-3.5 h-3.5" />
          </button>

          <button
            type="button"
            onClick={handleRefresh}
            disabled={isLoading}
            title="Refresh analysis & recalculate feasibility"
            className="p-2 rounded-xl text-slate-400 hover:text-indigo-600 dark:hover:text-indigo-400 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin text-indigo-500' : ''}`} />
          </button>
        </div>
      </div>

      {/* Target Role Selector with Mode A vs Mode B Filter */}
      {roles.length > 0 && (
        <RoleSelector
          roles={roles}
          selectedRoleId={selectedRoleId}
          onSelectRole={handleRoleChange}
          daysRemaining={daysRemaining}
          studyHoursPerWeek={studyHoursPerWeek}
          onUpdateBudget={handleUpdateBudget}
          activeModeFilter={activeModeFilter}
          onSelectModeFilter={handleModeFilterChange}
          onOpenCustomGoalModal={() => setIsCustomGoalModalOpen(true)}
          onNavigateToJDMatcher={() => setActiveTab('analysis')}
          isAllCompleted={Boolean(
            analysis?.results &&
            analysis.results.length > 0 &&
            analysis.results.every(r => r.status === 'Demonstrated')
          )}
          remainingEffortHours={
            analysis?.results
              ? analysis.results.filter(r => r.status !== 'Demonstrated').reduce((acc, r) => acc + (r.effort_hours_estimate || 0), 0)
              : 0
          }
        />
      )}

      {/* Loading & Error States */}
      {isLoading && (
        <div className="p-8 text-center bg-white dark:bg-[#0e131f] rounded-2xl border border-slate-200 dark:border-slate-800">
          <RefreshCw className="w-6 h-6 animate-spin text-indigo-500 mx-auto mb-2" />
          <span className="text-xs text-slate-500">Analyzing your skills and requirements...</span>
        </div>
      )}

      {error && (
        <div className="p-4 rounded-2xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900 text-xs text-rose-700 dark:text-rose-300 flex items-center gap-3">
          <AlertCircle className="w-5 h-5 shrink-0" />
          <div className="flex-1">
            <strong className="block">Analysis Error</strong>
            <span>{error}</span>
          </div>
          <button
            type="button"
            onClick={() => loadAnalysis(selectedRoleId, daysRemaining, studyHoursPerWeek)}
            className="px-3 py-1.5 rounded-xl bg-rose-600 text-white font-semibold hover:bg-rose-700"
          >
            Retry
          </button>
        </div>
      )}

      {/* Main Analysis Body */}
      {!isLoading && analysis && (
        <div className="space-y-6">
          {/* Overview Metrics Cards & Score */}
          <GapOverviewCards summary={analysis.summary} />

          {/* Deadline Feasibility Assessment Card */}
          <FeasibilityBanner feasibility={analysis.feasibility} />

          {/* Traceable Skills Comparison Table with Filter/Sort */}
          <SkillComparisonTable
            results={analysis.results}
            onSelectSkill={item => setSelectedSkill(item)}
            onOpenLinkModal={skillName => handleOpenLinkModal(skillName)}
            onNavigateTab={setActiveTab}
            targetRoleId={selectedRoleId}
            daysRemaining={daysRemaining}
            studyHoursPerWeek={studyHoursPerWeek}
            onUpdateRequirementPriority={handleUpdateRequirementPriority}
            onRemoveRequirement={handleRemoveRequirement}
            onAddRequirement={handleAddRequirement}
          />
        </div>
      )}

      {/* Skill Detail Deep-Dive Modal */}
      <SkillDetailModal
        item={selectedSkill}
        onClose={() => setSelectedSkill(null)}
        onOpenLinkModal={skillName => handleOpenLinkModal(skillName)}
        onNavigateTab={setActiveTab}
        userExperienceLevel={analysis?.profile?.experience_level || 'Entry Level'}
        targetRoleTitle={analysis?.role?.role_title || 'AI & Machine Learning Engineer'}
        targetRoleId={selectedRoleId}
        userId={analysis?.profile?.user_id || 'usr_demo_001'}
        feasibility={analysis?.feasibility}
      />

      {/* Link Evidence Modal */}
      <LinkEvidenceModal
        initialSkillName={linkTargetSkill}
        isOpen={isLinkModalOpen}
        onClose={() => setIsLinkModalOpen(false)}
        onSubmitEvidence={handleSubmitEvidence}
        availableSkills={
          analysis?.role?.requirements?.map(r => r.skill_name) || [
            'Python',
            'Django REST Framework',
            'PostgreSQL',
            'API Testing',
            'Authentication & Security',
            'Docker'
          ]
        }
      />

      {/* Evidence Traceability Matrix Modal */}
      <EvidenceMatrixModal
        isOpen={isMatrixModalOpen}
        onClose={() => setIsMatrixModalOpen(false)}
        mappedEvidence={analysis?.evidence_mapping?.mapped_evidence || []}
        unmappedEvidence={analysis?.evidence_mapping?.unmapped_evidence || []}
        onOpenLinkModal={() => handleOpenLinkModal()}
      />

      {/* Custom Career Goal Creation Modal */}
      <CustomCareerGoalModal
        isOpen={isCustomGoalModalOpen}
        onClose={() => setIsCustomGoalModalOpen(false)}
        onSubmit={handleCreateCustomGoal}
      />
    </div>
  );
}
