import {
  LayoutGrid,
  User,
  Search,
  TrendingUp,
  CheckSquare,
  Layers,
  Sparkles,
  LogOut,
  LogIn,
  X,
  type LucideIcon
} from 'lucide-react';

export interface NavItem {
  id: string;
  label: string;
  shortLabel?: string;
  icon: LucideIcon;
}

interface SidebarProps {
  activeTab: string;
  setActiveTab: (tab: string) => void;
  userName?: string;
  userRole?: string;
  onLogout?: () => void;
  onOpenAuth?: () => void;
  isAuthenticated?: boolean;
  isMobileOpen?: boolean;
  onCloseMobile?: () => void;
}

export const navItems: NavItem[] = [
  { id: 'dashboard', label: 'Overview', shortLabel: 'Overview', icon: LayoutGrid },
  { id: 'profile', label: 'Profile', shortLabel: 'Profile', icon: User },
  { id: 'analysis', label: 'Job & Goal Analysis', shortLabel: 'JD Matcher', icon: Search },
  { id: 'roadmap', label: 'Roadmap', shortLabel: 'Roadmap', icon: TrendingUp },
  { id: 'assessment', label: 'Practical Tasks', shortLabel: 'Practical Tasks', icon: CheckSquare },
  { id: 'gaps', label: 'Skill Gap Report', shortLabel: 'Skill Gap', icon: Layers },
];

export default function Sidebar({
  activeTab,
  setActiveTab,
  userName = 'Student',
  userRole = 'Pro plan',
  onLogout,
  onOpenAuth,
  isAuthenticated = false,
  isMobileOpen = false,
  onCloseMobile,
}: SidebarProps) {
  const handleItemClick = (id: string) => {
    setActiveTab(id);
    if (onCloseMobile) onCloseMobile();
  };

  const renderContent = (isMobile = false) => (
    <div className="flex flex-col justify-between h-full">
      <div className="space-y-6">
        {/* Brand Header */}
        <div className="flex items-center justify-between px-2 py-1">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-black dark:bg-white flex items-center justify-center text-white dark:text-black shadow-sm">
              <Sparkles className="w-4 h-4 fill-current" />
            </div>
            <div>
              <div className="font-bold text-sm tracking-tight text-slate-900 dark:text-white leading-tight">
                SkillBridge
              </div>
              <div className="text-[11px] font-medium text-slate-400 dark:text-slate-400">
                AI Career OS
              </div>
            </div>
          </div>
          {isMobile && onCloseMobile && (
            <button
              onClick={onCloseMobile}
              className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
              aria-label="Close menu"
            >
              <X className="w-5 h-5" />
            </button>
          )}
        </div>

        {/* Navigation List */}
        <nav className="space-y-1">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = activeTab === item.id;
            return (
              <button
                key={item.id}
                onClick={() => handleItemClick(item.id)}
                className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-xs font-medium transition-all ${
                  isActive
                    ? 'bg-slate-100 dark:bg-slate-800 text-slate-900 dark:text-white font-semibold shadow-xs'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800/50'
                }`}
              >
                <Icon className={`w-4 h-4 shrink-0 ${isActive ? 'text-slate-900 dark:text-white' : 'text-slate-400 dark:text-slate-400'}`} />
                <span className="truncate">{item.shortLabel || item.label}</span>
                <span className="hidden">{item.label}</span>
              </button>
            );
          })}
        </nav>
      </div>

      {/* User Profile Footer */}
      <div className="pt-4 border-t border-slate-100 dark:border-slate-800/60 px-1 space-y-2">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-full bg-slate-900 dark:bg-slate-100 text-white dark:text-slate-900 flex items-center justify-center text-xs font-bold shadow-xs">
            {userName.charAt(0).toUpperCase()}
          </div>
          <div className="truncate">
            <div className="text-xs font-semibold text-slate-900 dark:text-white truncate">
              {userName}
            </div>
            <div className="text-[11px] text-slate-400 dark:text-slate-400">
              {userRole}
            </div>
          </div>
        </div>
        {isAuthenticated ? (
          onLogout && (
            <button
              onClick={() => {
                onLogout();
                if (onCloseMobile) onCloseMobile();
              }}
              className="w-full flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-medium text-slate-500 dark:text-slate-400 hover:text-rose-600 dark:hover:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/30 transition-all cursor-pointer"
            >
              <LogOut className="w-3.5 h-3.5" />
              Sign Out
            </button>
          )
        ) : (
          <button
            onClick={() => {
              if (onOpenAuth) onOpenAuth();
              if (onCloseMobile) onCloseMobile();
            }}
            className="w-full flex items-center justify-center gap-2 px-3 py-2 rounded-xl text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-700 transition-all shadow-xs cursor-pointer"
          >
            <LogIn className="w-3.5 h-3.5" />
            Sign In / Register
          </button>
        )}
      </div>
    </div>
  );

  return (
    <>
      {/* Desktop Persistent Sidebar */}
      <aside className="hidden md:flex w-60 min-h-screen bg-white dark:bg-[#0e131f] border-r border-slate-200/80 dark:border-slate-800/80 flex-col justify-between p-4 select-none shrink-0 transition-colors duration-200">
        {renderContent(false)}
      </aside>

      {/* Mobile Drawer (Visible when isMobileOpen is true) */}
      {isMobileOpen && (
        <div className="fixed inset-0 z-50 md:hidden animate-in fade-in duration-200">
          <div
            className="fixed inset-0 bg-slate-950/60 backdrop-blur-xs transition-opacity"
            onClick={onCloseMobile}
            aria-hidden="true"
          />
          <aside className="fixed inset-y-0 left-0 w-72 max-w-[85vw] bg-white dark:bg-[#0e131f] border-r border-slate-200 dark:border-slate-800 p-5 shadow-2xl flex flex-col justify-between select-none z-10 animate-in slide-in-from-left duration-200">
            {renderContent(true)}
          </aside>
        </div>
      )}
    </>
  );
}
