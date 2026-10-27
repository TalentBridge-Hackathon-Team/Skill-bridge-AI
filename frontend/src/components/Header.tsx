import { useState, useRef, useEffect } from 'react';
import { Search, Moon, Sun, Bell, X, FileText, Code2, Target, ArrowRight, LogIn } from 'lucide-react';
import { useTheme } from '../context/ThemeContext';
import { useAuth } from '../context/AuthContext';
import { skillGapService } from '../services/skillGapService';

interface HeaderProps {
  title: string;
  userName?: string;
  setActiveTab?: (tab: string) => void;
  onOpenAuth?: (intendedTab?: string) => void;
}

interface SearchItem {
  id: string;
  title: string;
  description: string;
  category: 'page' | 'skill' | 'role';
  targetTab: string;
  actionPayload?: string;
}

const SEARCH_ITEMS: SearchItem[] = [
  // Pages
  { id: 'p_overview', title: 'Overview & Metrics', description: 'ATS score, JD match summary, and learning roadmap', category: 'page', targetTab: 'dashboard' },
  { id: 'p_profile', title: 'Profile & Evidence', description: 'Upload resume, GitHub links, and manage verified skills', category: 'page', targetTab: 'profile' },
  { id: 'p_analysis', title: 'Job & Goal Analysis', description: 'Extract requirements from job descriptions or set career goals', category: 'page', targetTab: 'analysis' },
  { id: 'p_gaps', title: 'Skill Gap Report', description: 'Traceable evidence match matrix and timeline feasibility', category: 'page', targetTab: 'gaps' },
  { id: 'p_assessment', title: 'Practical Tasks & Assessments', description: 'Hands-on coding challenges and rubric evaluation', category: 'page', targetTab: 'assessment' },
  { id: 'p_roadmap', title: 'Learner Roadmap & Pacing', description: 'Sequenced daily milestones and curated documentation', category: 'page', targetTab: 'roadmap' },

  // Core Skills
  { id: 's_python', title: 'Python', description: 'Backend language • Practical assessment & rubric', category: 'skill', targetTab: 'assessment', actionPayload: 'Python' },
  { id: 's_django', title: 'Django REST Framework', description: 'Web framework • API design & serialization', category: 'skill', targetTab: 'assessment', actionPayload: 'Django REST Framework' },
  { id: 's_postgres', title: 'PostgreSQL', description: 'Database • Schema design, indexing & queries', category: 'skill', targetTab: 'assessment', actionPayload: 'PostgreSQL' },
  { id: 's_docker', title: 'Docker', description: 'DevOps • Containerization & multi-stage builds', category: 'skill', targetTab: 'assessment', actionPayload: 'Docker' },
  { id: 's_ts', title: 'TypeScript', description: 'Frontend / Full Stack language • Type-safe APIs', category: 'skill', targetTab: 'assessment', actionPayload: 'TypeScript' },
  { id: 's_react', title: 'React', description: 'Frontend framework • Component state architectures', category: 'skill', targetTab: 'assessment', actionPayload: 'React' },
  { id: 's_testing', title: 'API Testing', description: 'Quality assurance • Vitest / Pytest integration', category: 'skill', targetTab: 'assessment', actionPayload: 'API Testing' },
  { id: 's_auth', title: 'Authentication & Security', description: 'Security • JWT authentication & token rotation', category: 'skill', targetTab: 'assessment', actionPayload: 'Authentication & Security' },
  { id: 's_graphql', title: 'GraphQL', description: 'API architecture • Queries, mutations & Apollo', category: 'skill', targetTab: 'assessment', actionPayload: 'GraphQL' },
  { id: 's_aws', title: 'AWS Core Services', description: 'Cloud infrastructure • S3, EC2, IAM & RDS', category: 'skill', targetTab: 'assessment', actionPayload: 'AWS Core Services' },
  { id: 's_terraform', title: 'Terraform', description: 'Infrastructure as Code • Declarative provisioning', category: 'skill', targetTab: 'assessment', actionPayload: 'Terraform' },

  // Target Roles
  { id: 'r_fullstack', title: 'Full stack Engineer', description: 'Target Role (JD Match) • React, Node, TypeScript & Postgres', category: 'role', targetTab: 'gaps', actionPayload: 'Full stack Engineer' },
  { id: 'r_junior_be', title: 'Junior Backend Developer', description: 'Target Role (JD Match) • Python, DRF & PostgreSQL', category: 'role', targetTab: 'gaps', actionPayload: 'role_junior_backend' },
  { id: 'r_frontend', title: 'Frontend Developer', description: 'Career Goal • React, Next.js & modern UI state', category: 'role', targetTab: 'gaps', actionPayload: 'Frontend Developer' },
  { id: 'r_devops', title: 'DevOps / Cloud Engineer', description: 'Career Goal • Docker, AWS, CI/CD & Terraform', category: 'role', targetTab: 'gaps', actionPayload: 'DevOps / Cloud Engineer' },
  { id: 'r_aiml', title: 'AI & Machine Learning Engineer', description: 'Career Goal • PyTorch, embeddings & LLM RAG pipelines', category: 'role', targetTab: 'gaps', actionPayload: 'AI & Machine Learning Engineer' }
];

export default function Header({ title, userName = 'Student', setActiveTab, onOpenAuth }: HeaderProps) {
  const { theme, toggleTheme } = useTheme();
  const { isAuthenticated } = useAuth();

  const [query, setQuery] = useState('');
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

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

  // Keyboard shortcut: '/' focuses search
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === '/' && document.activeElement !== inputRef.current) {
        e.preventDefault();
        inputRef.current?.focus();
        setIsOpen(true);
      } else if (e.key === 'Escape') {
        setIsOpen(false);
        inputRef.current?.blur();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  const trimmed = query.trim().toLowerCase();
  const filtered = trimmed
    ? SEARCH_ITEMS.filter(item =>
        item.title.toLowerCase().includes(trimmed) ||
        item.description.toLowerCase().includes(trimmed)
      )
    : [];

  const handleSelect = (item: SearchItem) => {
    if (item.category === 'skill' && item.actionPayload) {
      if (typeof window !== 'undefined') {
        window.localStorage.setItem('skillbridge_selected_practice_skill', item.actionPayload);
        window.dispatchEvent(new CustomEvent('skillbridge_select_skill', { detail: { skill: item.actionPayload } }));
      }
    } else if (item.category === 'role' && item.actionPayload) {
      skillGapService.setSelectedRole(item.actionPayload);
    }

    if (setActiveTab) {
      setActiveTab(item.targetTab);
    }
    setQuery('');
    setIsOpen(false);
    inputRef.current?.blur();
  };

  return (
    <header className="h-16 px-8 border-b border-slate-200/80 dark:border-slate-800/80 bg-white/80 dark:bg-[#0e131f]/80 backdrop-blur-md flex items-center justify-between sticky top-0 z-40 transition-colors duration-200">
      {/* Title */}
      <div className="flex items-center gap-2.5">
        <h2 className="text-base font-bold text-slate-900 dark:text-white tracking-tight">
          {title}
        </h2>
        <span className="hidden md:inline-flex items-center text-[10px] font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400 bg-slate-100 dark:bg-slate-800/80 px-2 py-0.5 rounded-md border border-slate-200/80 dark:border-slate-700/60">
          SkillBridge AI
        </span>
      </div>

      {/* Right Controls: Functional Search, Theme Toggle, Notifications, Auth/Avatar */}
      <div className="flex items-center gap-3">
        {/* Global Search pill */}
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
            onFocus={() => setIsOpen(true)}
            placeholder="Search anything... (/)"
            className="w-48 md:w-64 pl-8 pr-7 py-1.5 rounded-full text-xs bg-slate-50 dark:bg-slate-900/80 border border-slate-200 dark:border-slate-800 text-slate-800 dark:text-slate-200 placeholder:text-slate-400 focus:outline-none focus:border-indigo-500 dark:focus:border-indigo-500 transition-all shadow-2xs"
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

          {/* Search Dropdown Popover */}
          {isOpen && trimmed && (
            <div className="absolute top-full left-0 mt-2 w-80 sm:w-96 rounded-2xl bg-white dark:bg-[#0e131f] border border-slate-200 dark:border-slate-800 shadow-xl overflow-hidden z-50 animate-in fade-in slide-in-from-top-1 duration-150">
              <div className="p-2 max-h-96 overflow-y-auto space-y-1">
                {filtered.length > 0 ? (
                  filtered.map((item) => (
                    <div
                      key={item.id}
                      onClick={() => handleSelect(item)}
                      className="group flex items-center justify-between p-2.5 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800/70 cursor-pointer transition-colors"
                    >
                      <div className="flex items-center gap-2.5 min-w-0">
                        <div className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 ${
                          item.category === 'page'
                            ? 'bg-blue-50 dark:bg-blue-950/40 text-blue-600 dark:text-blue-400'
                            : item.category === 'skill'
                            ? 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400'
                            : 'bg-purple-50 dark:bg-purple-950/40 text-purple-600 dark:text-purple-400'
                        }`}>
                          {item.category === 'page' && <FileText className="w-3.5 h-3.5" />}
                          {item.category === 'skill' && <Code2 className="w-3.5 h-3.5" />}
                          {item.category === 'role' && <Target className="w-3.5 h-3.5" />}
                        </div>
                        <div className="truncate">
                          <div className="text-xs font-semibold text-slate-800 dark:text-slate-100 group-hover:text-indigo-600 dark:group-hover:text-indigo-400 truncate">
                            {item.title}
                          </div>
                          <div className="text-[10px] text-slate-400 dark:text-slate-500 truncate">
                            {item.description}
                          </div>
                        </div>
                      </div>
                      <ArrowRight className="w-3.5 h-3.5 text-slate-300 dark:text-slate-600 group-hover:text-indigo-500 group-hover:translate-x-0.5 transition-all shrink-0 ml-2" />
                    </div>
                  ))
                ) : (
                  <div className="p-4 text-center text-xs text-slate-400 dark:text-slate-500">
                    No results found for <span className="text-slate-700 dark:text-slate-300 font-medium">"{query}"</span>
                  </div>
                )}
              </div>
              <div className="px-3 py-2 bg-slate-50 dark:bg-slate-900/40 border-t border-slate-100 dark:border-slate-800/60 text-[10px] text-slate-400 flex items-center justify-between">
                <span>Navigate pages, skills, and target roles</span>
                <span className="font-mono text-[9px] bg-slate-200 dark:bg-slate-800 px-1.5 py-0.5 rounded">ESC to close</span>
              </div>
            </div>
          )}
        </div>

        {/* Theme Toggle Button (Light/Dark Mode) */}
        <button
          onClick={toggleTheme}
          aria-label="Toggle theme"
          title={`Switch to ${theme === 'light' ? 'Dark' : 'Light'} Mode`}
          className="w-8 h-8 rounded-full border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 flex items-center justify-center text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors shadow-xs"
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
          className="w-8 h-8 rounded-full border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 flex items-center justify-center text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors shadow-xs"
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
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold bg-indigo-600 hover:bg-indigo-700 text-white shadow-xs transition-colors"
          >
            <LogIn className="w-3.5 h-3.5" />
            <span>Sign In</span>
          </button>
        )}
      </div>
    </header>
  );
}
