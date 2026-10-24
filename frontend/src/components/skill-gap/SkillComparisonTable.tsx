import { useState, useMemo } from 'react';
import {
  Search,
  Filter,
  ArrowUpDown,
  RotateCcw,
  ArrowRight,
  ExternalLink,
  ShieldCheck,
  FileText,
  AlertTriangle,
  Info,
  ChevronRight
} from 'lucide-react';
import StatusBadge from '../StatusBadge';
import type { TraceableMatchResult } from '../../utils/skillGapCalculations';

interface SkillComparisonTableProps {
  results: TraceableMatchResult[];
  onSelectSkill: (skill: TraceableMatchResult) => void;
  onOpenLinkModal: (skillName: string) => void;
  onNavigateTab: (tab: string) => void;
}

export default function SkillComparisonTable({
  results,
  onSelectSkill,
  onOpenLinkModal,
  onNavigateTab
}: SkillComparisonTableProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [importanceFilter, setImportanceFilter] = useState<string>('all');
  const [priorityFilter, setPriorityFilter] = useState<string>('all');
  const [sortBy, setSortBy] = useState<'priority' | 'effort-desc' | 'effort-asc' | 'name'>('priority');

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
  }, [results, searchQuery, statusFilter, importanceFilter, priorityFilter, sortBy]);

  const resetFilters = () => {
    setSearchQuery('');
    setStatusFilter('all');
    setImportanceFilter('all');
    setPriorityFilter('all');
    setSortBy('priority');
  };

  const hasActiveFilters =
    Boolean(searchQuery) ||
    statusFilter !== 'all' ||
    importanceFilter !== 'all' ||
    priorityFilter !== 'all';

  return (
    <div className="space-y-4">
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
              placeholder="Search skills, categories, or deterministic criteria..."
              className="w-full text-xs rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/60 pl-9 pr-3 py-2 text-slate-800 dark:text-slate-100 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>

          {/* Filter Dropdowns */}
          <div className="flex items-center gap-2 flex-wrap text-xs">
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
                className="flex items-center gap-1 px-2.5 py-2 rounded-xl text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-950/40 transition-colors"
                title="Reset all filters"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                <span>Reset</span>
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
            Deterministic matching adheres to Blueprint 2.0 Sections 7 & 8
          </span>
        </div>
      </div>

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
                  <span
                    className={`text-[11px] font-semibold ${
                      item.priority === 'High'
                        ? 'text-rose-500'
                        : item.priority === 'Medium'
                        ? 'text-amber-500'
                        : 'text-slate-500'
                    }`}
                  >
                    {item.priority} Priority
                  </span>
                  <span className="text-[10px] uppercase font-bold text-slate-400 bg-slate-100 dark:bg-slate-800 px-1.5 py-0.5 rounded-md">
                    {item.importance}
                  </span>
                </div>

                <h3 className="text-base font-bold text-slate-900 dark:text-white group-hover:text-indigo-600 dark:group-hover:text-cyan-400 transition-colors">
                  {item.skill_name}
                </h3>

                <div className="flex items-center gap-2 mt-1 text-[11px] text-slate-400">
                  <span className="capitalize">{item.category}</span>
                  {item.effort_hours_estimate > 0 && (
                    <>
                      <span>•</span>
                      <span>~{item.effort_hours_estimate} hrs effort</span>
                    </>
                  )}
                </div>
              </div>

              {/* Column 2: Deterministic Rationale & Evidence Link (5 cols) */}
              <div className="md:col-span-5 rounded-xl bg-slate-50 dark:bg-slate-950/70 p-3 border border-slate-200/80 dark:border-slate-800/80 space-y-1.5">
                <span className="text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider block">
                  Deterministic Rationale
                </span>
                <p className="text-xs text-slate-700 dark:text-slate-300 leading-relaxed">
                  {item.reason}
                </p>

                {/* Evidence link preview tag */}
                <div className="flex items-center gap-1.5 pt-1 text-[11px] text-slate-500 dark:text-slate-400">
                  <FileText className="w-3 h-3 text-indigo-500 shrink-0" />
                  {item.supporting_evidence.length > 0 ? (
                    <span className="truncate">
                      <strong>{item.supporting_evidence.length} artifact(s)</strong>:{' '}
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
                  )}

                  {(item.status === 'Unverified' || item.status === 'Needs improvement') && (
                    <button
                      type="button"
                      onClick={e => {
                        e.stopPropagation();
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
