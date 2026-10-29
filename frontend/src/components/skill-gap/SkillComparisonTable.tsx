import { useState, useMemo } from 'react';
import {
  Search,
  RotateCcw,
  ArrowRight,
  FileText,
  Info,
  Plus,
  Trash2,
  Zap
} from 'lucide-react';
import StatusBadge from '../StatusBadge';
import type { TraceableMatchResult } from '../../utils/skillGapCalculations';
import { skillGapService } from '../../services/skillGapService';

interface SkillComparisonTableProps {
  results: TraceableMatchResult[];
  onSelectSkill: (skill: TraceableMatchResult) => void;
  onOpenLinkModal: (skillName: string) => void;
  onNavigateTab: (tab: string) => void;
  targetRoleId?: string;
  daysRemaining?: number;
  studyHoursPerWeek?: number;
  onUpdateRequirementPriority?: (requirementId: string, newPriority: 'High' | 'Medium' | 'Low') => Promise<void>;
  onRemoveRequirement?: (requirementId: string) => Promise<void>;
  onAddRequirement?: (req: {
    skill_name: string;
    category: string;
    importance: 'required' | 'preferred';
    priority: 'High' | 'Medium' | 'Low';
  }) => Promise<void>;
}

export default function SkillComparisonTable({
  results,
  onSelectSkill,
  onOpenLinkModal,
  onNavigateTab,
  targetRoleId,
  daysRemaining,
  studyHoursPerWeek: _studyHoursPerWeek,
  onUpdateRequirementPriority: _onUpdateRequirementPriority,
  onRemoveRequirement,
  onAddRequirement
}: SkillComparisonTableProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [importanceFilter, setImportanceFilter] = useState<string>('all');
  const [priorityFilter, setPriorityFilter] = useState<string>('all');
  const [scopeFilter, setScopeFilter] = useState<'all' | 'sprint' | 'deferred'>('all');
  const [sortBy, setSortBy] = useState<'priority' | 'effort-desc' | 'effort-asc' | 'name'>('priority');

  const hasSprintScoping = useMemo(() => results.some(r => r.is_deferred || r.in_sprint_scope), [results]);
  const sprintCount = useMemo(() => results.filter(r => r.in_sprint_scope).length, [results]);
  const deferredCount = useMemo(() => results.filter(r => r.is_deferred).length, [results]);

  // Add Requirement state
  const [isAddingReq, setIsAddingReq] = useState(false);
  const [newSkillName, setNewSkillName] = useState('');
  const [newCategory, setNewCategory] = useState('framework');
  const [newImportance, setNewImportance] = useState<'required' | 'preferred'>('required');
  const [isSubmittingNewReq, setIsSubmittingNewReq] = useState(false);

  const handleAddNewRequirement = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newSkillName.trim() || !onAddRequirement) return;
    setIsSubmittingNewReq(true);
    try {
      const calculatedPriority: 'High' | 'Medium' | 'Low' = newImportance === 'required' ? 'High' : 'Medium';
      await onAddRequirement({
        skill_name: newSkillName.trim(),
        category: newCategory,
        importance: newImportance,
        priority: calculatedPriority
      });
      setNewSkillName('');
      setIsAddingReq(false);
    } finally {
      setIsSubmittingNewReq(false);
    }
  };

  const filteredResults = useMemo(() => {
    let items = [...results];

    // Search query filter
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      items = items.filter(
        item =>
          item.skill_name.toLowerCase().includes(q) ||
          item.category.toLowerCase().includes(q) ||
          item.reason.toLowerCase().includes(q)
      );
    }

    // Status filter
    if (statusFilter !== 'all') {
      items = items.filter(item => item.status === statusFilter);
    }

    // Importance filter
    if (importanceFilter !== 'all') {
      items = items.filter(item => item.importance === importanceFilter);
    }

    // Priority filter
    if (priorityFilter !== 'all') {
      items = items.filter(item => item.priority === priorityFilter);
    }

    // Scope filter (Sprint vs Deferred)
    if (scopeFilter === 'sprint') {
      items = items.filter(item => item.in_sprint_scope);
    } else if (scopeFilter === 'deferred') {
      items = items.filter(item => item.is_deferred);
    }

    // Sorting
    const priorityWeights: Record<string, number> = { High: 3, Medium: 2, Low: 1 };

    items.sort((a, b) => {
      switch (sortBy) {
        case 'priority':
          return (priorityWeights[b.priority] || 0) - (priorityWeights[a.priority] || 0);
        case 'effort-desc':
          return b.effort_hours_estimate - a.effort_hours_estimate;
        case 'effort-asc':
          return a.effort_hours_estimate - b.effort_hours_estimate;
        case 'name':
          return a.skill_name.localeCompare(b.skill_name);
        default:
          return 0;
      }
    });

    return items;
  }, [results, searchQuery, statusFilter, importanceFilter, priorityFilter, scopeFilter, sortBy]);

  const resetFilters = () => {
    setSearchQuery('');
    setStatusFilter('all');
    setImportanceFilter('all');
    setPriorityFilter('all');
    setScopeFilter('all');
    setSortBy('priority');
  };

  const hasActiveFilters =
    Boolean(searchQuery) ||
    statusFilter !== 'all' ||
    importanceFilter !== 'all' ||
    priorityFilter !== 'all' ||
    scopeFilter !== 'all';

  return (
    <div className="space-y-4">
      {/* Tight Timeline Priority Calibration Notice */}
      {daysRemaining !== undefined && daysRemaining <= 7 && (
        <div className="rounded-2xl border border-amber-200 dark:border-amber-800/80 bg-amber-50/70 dark:bg-amber-950/30 p-3.5 flex items-center justify-between flex-wrap gap-2 text-xs text-amber-900 dark:text-amber-200">
          <div className="flex items-center gap-2">
            <Zap className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0" />
            <span>
              <strong>Accelerated Timeline ({daysRemaining} days remaining)</strong>: The AI mentor has scoped your sprint to core must-haves to keep preparation focused and achievable. Secondary topics are deferred to Phase 2.
            </span>
          </div>
          {hasSprintScoping && (
            <button
              type="button"
              onClick={() => setScopeFilter(scopeFilter === 'sprint' ? 'all' : 'sprint')}
              className={`px-2.5 py-1 rounded-lg text-[11px] font-semibold transition-colors cursor-pointer ${
                scopeFilter === 'sprint'
                  ? 'bg-amber-600 text-white'
                  : 'bg-white dark:bg-slate-900 border border-amber-300 dark:border-amber-700 text-amber-800 dark:text-amber-300 hover:bg-amber-100 dark:hover:bg-amber-900/40'
              }`}
            >
              {scopeFilter === 'sprint' ? '✓ Showing Sprint Scope' : 'Filter Current Sprint Only'}
            </button>
          )}
        </div>
      )}

      {/* Search, Filter & Sort Controls */}
      <div className="rounded-2xl border border-slate-200/90 dark:border-slate-800/80 bg-white dark:bg-[#0e131f] p-4 shadow-xs space-y-3">
        <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3">
          {/* Search Input */}
          <div className="relative flex-1">
            <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-3" />
            <input
              type="text"
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              placeholder="Search skills, topics, or categories..."
              className="w-full text-xs rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/60 pl-9 pr-3 py-2 text-slate-800 dark:text-slate-100 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>

          {/* Filter Dropdowns & Add Requirement Button */}
          <div className="flex items-center gap-2 flex-wrap text-xs">
            {/* Scope Filter (Sprint vs Deferred) */}
            {hasSprintScoping && (
              <select
                value={scopeFilter}
                onChange={e => setScopeFilter(e.target.value as any)}
                className="rounded-xl border border-indigo-200 dark:border-indigo-800 bg-indigo-50/50 dark:bg-indigo-950/40 px-2.5 py-2 font-semibold text-indigo-700 dark:text-cyan-300 focus:outline-none focus:ring-2 focus:ring-indigo-500"
              >
                <option value="all">Scope: All Requirements ({results.length})</option>
                <option value="sprint">⚡ Current Sprint ({sprintCount})</option>
                <option value="deferred">💤 Deferred to Phase 2 ({deferredCount})</option>
              </select>
            )}

            {/* Status Filter */}
            <select
              value={statusFilter}
              onChange={e => setStatusFilter(e.target.value)}
              className="rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/60 px-2.5 py-2 text-slate-700 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500"
            >
              <option value="all">All Statuses</option>
              <option value="Demonstrated">Demonstrated</option>
              <option value="Self-reported">Self-reported</option>
              <option value="Needs improvement">Needs improvement</option>
              <option value="Unverified">Unverified</option>
            </select>

            {/* Importance Filter */}
            <select
              value={importanceFilter}
              onChange={e => setImportanceFilter(e.target.value)}
              className="rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/60 px-2.5 py-2 text-slate-700 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500"
            >
              <option value="all">All Importance</option>
              <option value="required">Required</option>
              <option value="preferred">Preferred</option>
            </select>

            {/* Priority Filter */}
            <select
              value={priorityFilter}
              onChange={e => setPriorityFilter(e.target.value)}
              className="rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/60 px-2.5 py-2 text-slate-700 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500"
            >
              <option value="all">All Priorities</option>
              <option value="High">High Priority</option>
              <option value="Medium">Medium Priority</option>
              <option value="Low">Low Priority</option>
            </select>

            {/* Sort Filter */}
            <select
              value={sortBy}
              onChange={e => setSortBy(e.target.value as any)}
              className="rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/60 px-2.5 py-2 text-slate-700 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500"
            >
              <option value="priority">Sort: Priority</option>
              <option value="effort-desc">Sort: Effort (High → Low)</option>
              <option value="effort-asc">Sort: Effort (Low → High)</option>
              <option value="name">Sort: Name (A-Z)</option>
            </select>

            {/* Reset Filter Button */}
            {hasActiveFilters && (
              <button
                type="button"
                onClick={resetFilters}
                className="flex items-center gap-1 px-2.5 py-2 rounded-xl text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-950/40 transition-colors cursor-pointer"
                title="Reset all filters"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                <span>Reset</span>
              </button>
            )}

            {/* Add Requirement Toggle */}
            {onAddRequirement && (
              <button
                type="button"
                onClick={() => setIsAddingReq(!isAddingReq)}
                className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-indigo-50 dark:bg-indigo-950/50 border border-indigo-200 dark:border-indigo-800 text-indigo-700 dark:text-indigo-300 hover:bg-indigo-100 dark:hover:bg-indigo-900/60 font-semibold text-xs transition-colors shadow-xs cursor-pointer"
                title="Add custom topic or requirement to this role"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Add Requirement</span>
              </button>
            )}
          </div>
        </div>

        {/* Filter Results Summary */}
        <div className="flex justify-between items-center text-[11px] text-slate-400 dark:text-slate-500 pt-1 border-t border-slate-100 dark:border-slate-800/60">
          <span>
            Showing <strong>{filteredResults.length}</strong> of {results.length} evaluated requirements
          </span>
          <span className="italic">
            AI Skill Match Analysis
          </span>
        </div>
      </div>

      {/* Inline Add Requirement Form */}
      {isAddingReq && (
        <form
          onSubmit={handleAddNewRequirement}
          className="rounded-2xl border border-indigo-200 dark:border-indigo-900/60 bg-indigo-50/40 dark:bg-[#101424] p-4 shadow-sm space-y-3 animate-in fade-in duration-200"
        >
          <div className="flex items-center justify-between pb-2 border-b border-indigo-100 dark:border-slate-800">
            <div className="flex items-center gap-2">
              <Plus className="w-4 h-4 text-indigo-600 dark:text-cyan-400" />
              <h4 className="text-xs font-bold text-slate-900 dark:text-white uppercase tracking-wider">
                Add Target Requirement / Topic
              </h4>
            </div>
            <button
              type="button"
              onClick={() => setIsAddingReq(false)}
              className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 text-xs cursor-pointer"
            >
              Cancel
            </button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3 text-xs">
            <div className="md:col-span-2">
              <label className="block text-[11px] font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Skill / Topic Name *
              </label>
              <input
                type="text"
                value={newSkillName}
                onChange={e => setNewSkillName(e.target.value)}
                placeholder="e.g. Docker, GraphQL, Kubernetes, Redis..."
                className="w-full rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 py-2 text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                required
                autoFocus
              />
            </div>

            <div>
              <label className="block text-[11px] font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Category
              </label>
              <select
                value={newCategory}
                onChange={e => setNewCategory(e.target.value)}
                className="w-full rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 px-2.5 py-2 text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-indigo-500"
              >
                <option value="framework">Framework</option>
                <option value="language">Language</option>
                <option value="library">Library</option>
                <option value="database">Database</option>
                <option value="tool">Tool / DevOps</option>
                <option value="concept">Concept / Architecture</option>
                <option value="soft_skill">Soft Skill</option>
              </select>
            </div>

            <div>
              <label className="block text-[11px] font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Importance
              </label>
              <select
                value={newImportance}
                onChange={e => setNewImportance(e.target.value as any)}
                className="w-full rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 px-2.5 py-2 text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-indigo-500"
              >
                <option value="required">Required (Core must-have)</option>
                <option value="preferred">Preferred (Nice-to-have)</option>
              </select>
            </div>

            <div className="flex flex-col justify-center">
              <span className="block text-[11px] font-semibold text-slate-700 dark:text-slate-300 mb-1">
                AI Priority
              </span>
              <div className="h-[38px] flex items-center px-3 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 text-xs text-slate-600 dark:text-slate-300">
                {newImportance === 'required' ? '⚡ High (Core Requirement)' : '🔹 Medium (Preferred Skill)'}
              </div>
            </div>

            <div className="flex items-end gap-2 md:col-span-3 pt-1">
              <button
                type="submit"
                disabled={isSubmittingNewReq || !newSkillName.trim()}
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-slate-900 dark:bg-white text-white dark:text-slate-900 hover:bg-slate-800 dark:hover:bg-slate-100 font-semibold text-xs shadow-xs disabled:opacity-50 transition-colors cursor-pointer"
              >
                {isSubmittingNewReq ? 'Adding Requirement...' : '+ Add to Requirements'}
              </button>
              <button
                type="button"
                onClick={() => setIsAddingReq(false)}
                className="px-3 py-2 rounded-xl text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800 text-xs font-medium cursor-pointer"
              >
                Cancel
              </button>
            </div>
          </div>
        </form>
      )}

      {/* Results Table / Cards */}
      {filteredResults.length > 0 ? (
        <div className="space-y-3">
          {filteredResults.map(item => (
            <div
              key={item.requirement_id}
              onClick={() => onSelectSkill(item)}
              className="rounded-2xl border border-slate-200/90 dark:border-slate-800/80 bg-white dark:bg-[#0e131f] p-5 grid grid-cols-1 md:grid-cols-12 gap-4 items-center hover:border-indigo-300 dark:hover:border-slate-700 cursor-pointer transition-all shadow-xs group"
            >
              {/* Column 1: Skill & Metadata (4 cols) */}
              <div className="md:col-span-4">
                <div className="flex items-center gap-2 mb-1.5 flex-wrap">
                  <StatusBadge status={item.status} />

                  {/* Authoritative AI-Calculated Priority Badge */}
                  <span
                    className={`inline-flex items-center gap-1.5 text-[11px] font-semibold px-2 py-0.5 rounded-lg border ${
                      item.priority === 'High'
                        ? 'text-rose-600 dark:text-rose-400 bg-rose-50 dark:bg-rose-950/40 border-rose-200/80 dark:border-rose-900/60'
                        : item.priority === 'Medium'
                        ? 'text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/40 border-amber-200/80 dark:border-amber-900/60'
                        : 'text-slate-600 dark:text-slate-400 bg-slate-100 dark:bg-slate-800/60 border-slate-200 dark:border-slate-700'
                    }`}
                    title={
                      daysRemaining && daysRemaining <= 7
                        ? `AI calibrated: ${item.priority} Priority based on your 7-day timeline and ${item.importance} importance`
                        : `AI calculated: ${item.priority} Priority based on gap severity and ${item.importance} importance`
                    }
                  >
                    <span
                      className={`w-1.5 h-1.5 rounded-full ${
                        item.priority === 'High'
                          ? 'bg-rose-500'
                          : item.priority === 'Medium'
                          ? 'bg-amber-500'
                          : 'bg-slate-400'
                      }`}
                    />
                    {item.priority} Priority
                  </span>

                  <span className="text-[10px] uppercase font-bold text-slate-400 bg-slate-100 dark:bg-slate-800 px-1.5 py-0.5 rounded-md">
                    {item.importance}
                  </span>

                  {/* Dynamic Sprint Scoping Badge */}
                  {item.is_deferred ? (
                    <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-amber-700 dark:text-amber-300 bg-amber-50 dark:bg-amber-950/60 px-2 py-0.5 rounded-md border border-amber-200/80 dark:border-amber-900/60">
                      <span>💤</span> Deferred to Phase 2
                    </span>
                  ) : item.in_sprint_scope ? (
                    <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-indigo-700 dark:text-cyan-300 bg-indigo-50 dark:bg-cyan-950/40 px-2 py-0.5 rounded-md border border-indigo-200/70 dark:border-cyan-800/60">
                      <Zap className="w-3 h-3 text-indigo-500 dark:text-cyan-400" /> In Current Sprint
                    </span>
                  ) : null}

                  {/* Remove Requirement Button */}
                  {onRemoveRequirement && (
                    <button
                      type="button"
                      onClick={e => {
                        e.stopPropagation();
                        if (window.confirm(`Remove "${item.skill_name}" from target requirements?`)) {
                          onRemoveRequirement(item.requirement_id);
                        }
                      }}
                      className="p-1 rounded-md text-slate-300 dark:text-slate-600 hover:text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-950/40 transition-colors ml-auto md:ml-0 cursor-pointer"
                      title={`Remove "${item.skill_name}" requirement`}
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>

                <h3 className="text-base font-bold text-slate-900 dark:text-white group-hover:text-indigo-600 dark:group-hover:text-cyan-400 transition-colors">
                  {item.skill_name}
                </h3>

                <div className="flex items-center gap-2 mt-1 text-[11px] text-slate-400">
                  <span className="capitalize">{item.category}</span>
                  {item.effort_hours_estimate > 0 && (
                    <>
                      <span>•</span>
                      <span className={item.is_deferred ? 'line-through text-slate-400 dark:text-slate-500' : ''}>
                        ~{item.effort_hours_estimate} hrs effort
                      </span>
                      {item.is_deferred && (
                        <span className="text-[10px] font-semibold text-amber-600 dark:text-amber-400">
                          (Deferred from sprint)
                        </span>
                      )}
                    </>
                  )}
                </div>
              </div>

              {/* Column 2: Explanation & Evidence (5 cols) */}
              <div className="md:col-span-5 rounded-xl bg-slate-50 dark:bg-slate-950/70 p-3 border border-slate-200/80 dark:border-slate-800/80 space-y-1.5">
                <span className="text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider block">
                  Match Explanation & Evidence
                </span>
                <p className="text-xs text-slate-700 dark:text-slate-300 leading-relaxed">
                  {item.reason}
                </p>

                {/* Evidence link preview tag */}
                <div className="flex items-center gap-1.5 pt-1 text-[11px] text-slate-500 dark:text-slate-400">
                  <FileText className="w-3 h-3 text-indigo-500 shrink-0" />
                  {item.supporting_evidence.length > 0 ? (
                    <span className="truncate">
                      <strong>{item.supporting_evidence.length} project(s)</strong>:{' '}
                      {item.supporting_evidence.map(e => e.title).join(', ')}
                    </span>
                  ) : (
                    <span className="italic text-slate-400">No project evidence linked</span>
                  )}
                </div>
              </div>

              {/* Column 3: Recommended Action & Button (3 cols) */}
              <div className="md:col-span-3 flex flex-col items-start gap-2">
                <span className="text-[10px] font-bold text-indigo-600 dark:text-cyan-400 uppercase tracking-wider">
                  Recommended Action
                </span>
                <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed line-clamp-2">
                  {item.recommended_action}
                </p>

                <div className="flex items-center gap-2 mt-1">
                  {item.status === 'Self-reported' && (
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <button
                        type="button"
                        onClick={e => {
                          e.stopPropagation();
                          onOpenLinkModal(item.skill_name);
                        }}
                        className="inline-flex items-center gap-1 rounded-xl bg-slate-900 dark:bg-white px-3 py-1.5 text-xs font-semibold text-white dark:text-slate-900 hover:bg-slate-800 dark:hover:bg-slate-100 transition-colors shadow-xs"
                      >
                        Link Repo Evidence
                      </button>

                      <button
                        type="button"
                        onClick={e => {
                          e.stopPropagation();
                          if (typeof window !== 'undefined') {
                            const url = new URL(window.location.href);
                            url.searchParams.set('tab', 'assessment');
                            url.searchParams.set('skill', item.skill_name);
                            if (targetRoleId) url.searchParams.set('role', targetRoleId);
                            window.history.replaceState({}, '', url.toString());
                          }
                          if (targetRoleId) skillGapService.setSelectedRole(targetRoleId);
                          onNavigateTab('assessment');
                        }}
                        className="inline-flex items-center gap-1 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-2.5 py-1.5 text-xs font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors shadow-xs"
                      >
                        Take Assessment <ArrowRight className="w-3 h-3" />
                      </button>
                    </div>
                  )}

                  {(item.status === 'Unverified' || item.status === 'Needs improvement') && (
                    <button
                      type="button"
                      onClick={e => {
                        e.stopPropagation();
                        if (typeof window !== 'undefined') {
                          const url = new URL(window.location.href);
                          url.searchParams.set('tab', 'assessment');
                          url.searchParams.set('skill', item.skill_name);
                          if (targetRoleId) url.searchParams.set('role', targetRoleId);
                          window.history.replaceState({}, '', url.toString());
                          // Notify AssessmentPage to re-read URL params
                          window.dispatchEvent(new CustomEvent('skillbridge_navigate_assessment'));
                        }
                        if (targetRoleId) skillGapService.setSelectedRole(targetRoleId);
                        onNavigateTab('assessment');
                      }}
                      className="inline-flex items-center gap-1 rounded-xl bg-slate-900 dark:bg-white px-3 py-1.5 text-xs font-semibold text-white dark:text-slate-900 hover:bg-slate-800 dark:hover:bg-slate-100 transition-colors shadow-xs"
                    >
                      Start Assessment <ArrowRight className="w-3 h-3" />
                    </button>
                  )}

                  {item.status === 'Demonstrated' && (
                    <span className="inline-flex items-center gap-1 text-xs font-semibold text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/40 px-2.5 py-1 rounded-lg border border-emerald-200/60 dark:border-emerald-800/60">
                      ✓ Interview Ready
                    </span>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      ) : (
        /* Empty State */
        <div className="rounded-2xl border border-dashed border-slate-300 dark:border-slate-800 p-8 text-center bg-white dark:bg-[#0e131f] space-y-3">
          <Info className="w-8 h-8 mx-auto text-slate-400" />
          <h3 className="text-sm font-bold text-slate-800 dark:text-slate-200">
            No matching requirements found
          </h3>
          <p className="text-xs text-slate-500 max-w-sm mx-auto">
            {hasActiveFilters
              ? 'No skills match your current search and filter criteria. Try resetting filters to see all evaluated requirements.'
              : 'This target role currently has no requirements defined.'}
          </p>
          {hasActiveFilters && (
            <button
              type="button"
              onClick={resetFilters}
              className="px-4 py-2 text-xs font-semibold rounded-xl bg-slate-900 dark:bg-white text-white dark:text-slate-900 hover:opacity-90 transition-opacity"
            >
              Clear All Filters
            </button>
          )}
        </div>
      )}
    </div>
  );
}
