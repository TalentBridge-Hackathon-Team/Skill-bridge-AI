import { useState, useRef, useEffect, useMemo, useCallback } from 'react';
import {
  Search, Moon, Sun, Bell, X, FileText, Code2, Target, ArrowRight,
  LogIn, Menu, Briefcase, Zap, ShieldCheck
} from 'lucide-react';
import { useTheme } from '../context/ThemeContext';
import { useAuth } from '../context/AuthContext';
import { skillGapService } from '../services/skillGapService';
import {
  searchGlobal,
  SYSTEM_PAGES,
  CORE_SKILLS_CATALOG,
  buildDynamicUserIndex,
  type GlobalSearchItem,
} from '../services/searchEngine';

interface HeaderProps {
  title: string;
  userName?: string;
  setActiveTab?: (tab: string) => void;
  onOpenAuth?: (intendedTab?: string) => void;
  onToggleMobileMenu?: () => void;
}

export default function Header({
  title,
  userName = 'Student',
  setActiveTab,
  onOpenAuth,
  onToggleMobileMenu,
}: HeaderProps) {
  const { theme, toggleTheme } = useTheme();
  const { user, isAuthenticated } = useAuth();

  const [query, setQuery] = useState('');
  const [isOpen, setIsOpen] = useState(false);
  const [isMobileSearchOpen, setIsMobileSearchOpen] = useState(false);
  const [dynamicPool, setDynamicPool] = useState<GlobalSearchItem[]>([]);

  const containerRef = useRef<HTMLDivElement>(null);
  const mobileSearchRef = useRef<HTMLInputElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Periodically & on user interaction, refresh the live target roles & analyzed skill gaps
  const refreshLiveIndex = useCallback(async () => {
    try {
      const dynamicItems = await buildDynamicUserIndex(user?.id ? String(user.id) : undefined);
      setDynamicPool(dynamicItems);
    } catch {}
  }, [user?.id]);

  useEffect(() => {
    refreshLiveIndex();
  }, [refreshLiveIndex]);

  // Close dropdown on outside click
  useEffect(() => {
    const handleOutsideClick = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleOutsideClick);
    return () => document.removeEventListener('mousedown', handleOutsideClick);
  }, []);

  // Keyboard shortcut: '/' focuses search, 'Escape' closes
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === '/' && document.activeElement !== inputRef.current && document.activeElement !== mobileSearchRef.current) {
        e.preventDefault();
        inputRef.current?.focus();
        setIsOpen(true);
        refreshLiveIndex();
      } else if (e.key === 'Escape') {
        setIsOpen(false);
        setIsMobileSearchOpen(false);
        inputRef.current?.blur();
        mobileSearchRef.current?.blur();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [refreshLiveIndex]);

  // Unified dynamic search index
  const fullSearchPool = useMemo(() => {
    return [...SYSTEM_PAGES, ...dynamicPool, ...CORE_SKILLS_CATALOG];
  }, [dynamicPool]);

  // Filtered results using weighted multi-token relevance scoring
  const filtered = useMemo(() => {
    return searchGlobal(query, fullSearchPool);
  }, [query, fullSearchPool]);

  const trimmed = query.trim();

  const handleSelect = (item: GlobalSearchItem) => {
    if ((item.category === 'skill' || item.category === 'skill_gap') && item.actionPayload) {
      if (typeof window !== 'undefined') {
        window.localStorage.setItem('skillbridge_selected_practice_skill', item.actionPayload);
        window.dispatchEvent(new CustomEvent('skillbridge_select_skill', { detail: { skill: item.actionPayload } }));
      }
      if (setActiveTab) setActiveTab('assessment');
    } else if (item.category === 'role' && item.actionPayload) {
      skillGapService.setSelectedRole(item.actionPayload);
      if (setActiveTab) setActiveTab('gaps');
    } else if (item.category === 'evidence') {
      if (setActiveTab) setActiveTab('profile');
    } else {
      if (setActiveTab) setActiveTab(item.targetTab);
    }

    setQuery('');
    setIsOpen(false);
    setIsMobileSearchOpen(false);
    inputRef.current?.blur();
    mobileSearchRef.current?.blur();
  };

  const renderCategoryIcon = (category: GlobalSearchItem['category']) => {
    switch (category) {
      case 'page':
        return <FileText className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" />;
      case 'role':
        return <Briefcase className="w-3.5 h-3.5 text-purple-600 dark:text-purple-400" />;
      case 'skill_gap':
        return <Zap className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400" />;
      case 'evidence':
        return <ShieldCheck className="w-3.5 h-3.5 text-cyan-600 dark:text-cyan-400" />;
      case 'skill':
      default:
        return <Code2 className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />;
    }
  };

  const getBadgeStyle = (variant?: string) => {
    switch (variant) {
      case 'blue':
        return 'bg-blue-50 dark:bg-blue-950/60 text-blue-700 dark:text-blue-300 border-blue-200/80 dark:border-blue-900/60';
      case 'purple':
        return 'bg-purple-50 dark:bg-purple-950/60 text-purple-700 dark:text-purple-300 border-purple-200/80 dark:border-purple-900/60';
      case 'rose':
        return 'bg-rose-50 dark:bg-rose-950/60 text-rose-700 dark:text-rose-300 border-rose-200/80 dark:border-rose-900/60';
      case 'amber':
        return 'bg-amber-50 dark:bg-amber-950/60 text-amber-700 dark:text-amber-300 border-amber-200/80 dark:border-amber-900/60';
      case 'cyan':
        return 'bg-cyan-50 dark:bg-cyan-950/60 text-cyan-700 dark:text-cyan-300 border-cyan-200/80 dark:border-cyan-900/60';
      case 'emerald':
      default:
        return 'bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 border-emerald-200/80 dark:border-emerald-900/60';
    }
  };

  return (
    <>
      <header className="h-16 px-3.5 sm:px-8 border-b border-slate-200/80 dark:border-slate-800/80 bg-white/80 dark:bg-[#0e131f]/80 backdrop-blur-md flex items-center justify-between sticky top-0 z-40 transition-colors duration-200">
        {/* Left: Mobile Hamburger & Current Page Title */}
        <div className="flex items-center gap-2 sm:gap-2.5 min-w-0">
          <button
            type="button"
            onClick={onToggleMobileMenu}
            className="md:hidden p-2 -ml-1 rounded-xl text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
            aria-label="Open navigation menu"
          >
            <Menu className="w-5 h-5" />
          </button>

          <h2 className="text-sm sm:text-base font-bold text-slate-900 dark:text-white tracking-tight truncate max-w-[150px] xs:max-w-[210px] sm:max-w-none">
            {title}
          </h2>
          <span className="hidden lg:inline-flex items-center text-[10px] font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400 bg-slate-100 dark:bg-slate-800/80 px-2 py-0.5 rounded-md border border-slate-200/80 dark:border-slate-700/60">
            SkillBridge AI
          </span>
        </div>

        {/* Right Controls: Dynamic Global Search, Theme Toggle, Notifications, Auth */}
        <div className="flex items-center gap-2 sm:gap-3">
          {/* Mobile Search Toggle Button */}
          <button
            type="button"
            onClick={() => {
              setIsMobileSearchOpen(!isMobileSearchOpen);
              refreshLiveIndex();
              setTimeout(() => mobileSearchRef.current?.focus(), 120);
            }}
            aria-label="Toggle mobile search"
            className="sm:hidden w-8 h-8 rounded-full border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 flex items-center justify-center text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors shadow-2xs"
          >
            <Search className="w-4 h-4" />
          </button>

          {/* Global Search Pill (Tablet & Desktop) */}
          <div ref={containerRef} className="relative hidden sm:block">
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              ref={inputRef}
              type="text"
              value={query}
              onChange={(e) => {
                setQuery(e.target.value);
                setIsOpen(true);
              }}
              onFocus={() => {
                setIsOpen(true);
                refreshLiveIndex();
              }}
              placeholder="Search anything... (/)"
              className="w-44 md:w-64 pl-8 pr-7 py-1.5 rounded-full text-xs bg-slate-50 dark:bg-slate-900/80 border border-slate-200 dark:border-slate-800 text-slate-800 dark:text-slate-200 placeholder:text-slate-400 focus:outline-none focus:border-indigo-500 dark:focus:border-indigo-500 transition-all shadow-2xs"
            />
            {query && (
              <button
                onClick={() => {
                  setQuery('');
                  setIsOpen(false);
                }}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
              >
                <X className="w-3 h-3" />
              </button>
            )}

            {/* Dynamic Search Dropdown Popover */}
            {isOpen && trimmed && (
              <div className="absolute top-full right-0 mt-2 w-80 sm:w-96 rounded-2xl bg-white dark:bg-[#0e131f] border border-slate-200 dark:border-slate-800 shadow-xl overflow-hidden z-50 animate-in fade-in slide-in-from-top-1 duration-150">
                <div className="p-2 max-h-96 overflow-y-auto space-y-1">
                  {filtered.length > 0 ? (
                    filtered.map((item) => (
                      <div
                        key={item.id}
                        onClick={() => handleSelect(item)}
                        className="group flex items-center justify-between p-2.5 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800/70 cursor-pointer transition-colors"
                      >
                        <div className="flex items-center gap-2.5 min-w-0 flex-1">
                          <div className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 ${
                            item.category === 'page'
                              ? 'bg-blue-50 dark:bg-blue-950/40'
                              : item.category === 'role'
                              ? 'bg-purple-50 dark:bg-purple-950/40'
                              : item.category === 'skill_gap'
                              ? 'bg-amber-50 dark:bg-amber-950/40'
                              : 'bg-emerald-50 dark:bg-emerald-950/40'
                          }`}>
                            {renderCategoryIcon(item.category)}
                          </div>
                          <div className="truncate flex-1">
                            <div className="text-xs font-semibold text-slate-800 dark:text-slate-100 group-hover:text-indigo-600 dark:group-hover:text-indigo-400 truncate">
                              {item.title}
                            </div>
                            <div className="text-[10px] text-slate-400 dark:text-slate-500 truncate">
                              {item.subtitle || item.description}
                            </div>
                          </div>
                        </div>

                        <div className="flex items-center gap-1.5 shrink-0 ml-2">
                          {item.badge && (
                            <span className={`text-[9px] font-bold px-2 py-0.5 rounded-full border ${getBadgeStyle(item.badge.variant)}`}>
                              {item.badge.label}
                            </span>
                          )}
                          <ArrowRight className="w-3.5 h-3.5 text-slate-300 dark:text-slate-600 group-hover:text-indigo-500 group-hover:translate-x-0.5 transition-all shrink-0" />
                        </div>
                      </div>
                    ))
                  ) : (
                    <div className="p-4 text-center text-xs text-slate-400 dark:text-slate-500">
                      No results found for <span className="text-slate-700 dark:text-slate-300 font-medium">"{query}"</span>
                    </div>
                  )}
                </div>

                <div className="px-3 py-2 bg-slate-50 dark:bg-slate-900/40 border-t border-slate-100 dark:border-slate-800/60 text-[10px] text-slate-400 flex items-center justify-between">
                  <span>
                    {filtered.length > 0 ? `${filtered.length} relevant match${filtered.length > 1 ? 'es' : ''}` : 'No matches'} across pages, roles & skills
                  </span>
                  <span className="font-mono text-[9px] bg-slate-200 dark:bg-slate-800 px-1.5 py-0.5 rounded">ESC to close</span>
                </div>
              </div>
            )}
          </div>

          {/* Theme Toggle Button */}
          <button
            onClick={toggleTheme}
            aria-label="Toggle theme"
            title={`Switch to ${theme === 'light' ? 'Dark' : 'Light'} Mode`}
            className="w-8 h-8 rounded-full border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 flex items-center justify-center text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors shadow-xs cursor-pointer"
          >
            {theme === 'light' ? (
              <Moon className="w-4 h-4 text-slate-700" />
            ) : (
              <Sun className="w-4 h-4 text-amber-400" />
            )}
          </button>

          {/* Notifications Icon Button */}
          <button
            aria-label="Notifications"
            className="w-8 h-8 rounded-full border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 flex items-center justify-center text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors shadow-xs cursor-pointer"
          >
            <Bell className="w-4 h-4 text-slate-500 dark:text-slate-400" />
          </button>

          {/* User Avatar Circle or Sign In CTA */}
          {isAuthenticated ? (
            <div
              title={`Logged in as ${userName}`}
              className="w-8 h-8 rounded-full bg-slate-900 dark:bg-slate-100 text-white dark:text-slate-900 flex items-center justify-center text-xs font-bold shadow-xs cursor-default"
            >
              {userName.charAt(0).toUpperCase()}
            </div>
          ) : (
            <button
              onClick={() => onOpenAuth && onOpenAuth()}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold bg-indigo-600 hover:bg-indigo-700 text-white shadow-xs transition-colors cursor-pointer"
            >
              <LogIn className="w-3.5 h-3.5" />
              <span>Sign In</span>
            </button>
          )}
        </div>
      </header>

      {/* Expandable Mobile Search Bar */}
      {isMobileSearchOpen && (
        <div className="sm:hidden px-3.5 py-2.5 bg-white dark:bg-[#0e131f] border-b border-slate-200 dark:border-slate-800 shadow-sm sticky top-16 z-30 animate-in slide-in-from-top-2 duration-150">
          <div className="relative">
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              ref={mobileSearchRef}
              type="text"
              value={query}
              onChange={(e) => {
                setQuery(e.target.value);
                setIsOpen(true);
              }}
              placeholder="Search pages, roles, skills, topics..."
              className="w-full pl-8 pr-7 py-2 rounded-xl text-xs bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-slate-100 placeholder:text-slate-400 focus:outline-none focus:border-indigo-500 shadow-2xs"
            />
            {query ? (
              <button
                onClick={() => {
                  setQuery('');
                  setIsOpen(false);
                }}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            ) : (
              <button
                onClick={() => setIsMobileSearchOpen(false)}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          {/* Mobile Search Results Popover */}
          {isOpen && trimmed && (
            <div className="mt-2 rounded-xl bg-white dark:bg-[#121826] border border-slate-200 dark:border-slate-800 shadow-xl overflow-hidden max-h-72 overflow-y-auto divide-y divide-slate-100 dark:divide-slate-800/60">
              {filtered.length > 0 ? (
                filtered.map((item) => (
                  <div
                    key={item.id}
                    onClick={() => handleSelect(item)}
                    className="flex items-center justify-between p-2.5 hover:bg-slate-50 dark:hover:bg-slate-800/60 cursor-pointer"
                  >
                    <div className="flex items-center gap-2.5 min-w-0 flex-1">
                      <div className={`w-6 h-6 rounded-md flex items-center justify-center shrink-0 ${
                        item.category === 'page'
                          ? 'bg-blue-50 dark:bg-blue-950/40'
                          : item.category === 'role'
                          ? 'bg-purple-50 dark:bg-purple-950/40'
                          : item.category === 'skill_gap'
                          ? 'bg-amber-50 dark:bg-amber-950/40'
                          : 'bg-emerald-50 dark:bg-emerald-950/40'
                      }`}>
                        {renderCategoryIcon(item.category)}
                      </div>
                      <div className="truncate flex-1">
                        <div className="text-xs font-semibold text-slate-800 dark:text-slate-100 truncate">
                          {item.title}
                        </div>
                        <div className="text-[10px] text-slate-400 truncate">
                          {item.subtitle || item.description}
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-1.5 shrink-0 ml-2">
                      {item.badge && (
                        <span className={`text-[9px] font-bold px-2 py-0.5 rounded-full border ${getBadgeStyle(item.badge.variant)}`}>
                          {item.badge.label}
                        </span>
                      )}
                      <ArrowRight className="w-3.5 h-3.5 text-slate-400 shrink-0 ml-1" />
                    </div>
                  </div>
                ))
              ) : (
                <div className="p-3 text-center text-xs text-slate-400">
                  No results for "{query}"
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </>
  );
}
