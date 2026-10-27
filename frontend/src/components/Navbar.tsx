import { Target, User, FileText, Sparkles, Award, Compass, type LucideIcon } from 'lucide-react';

interface NavItem {
  id: string;
  label: string;
  icon: LucideIcon;
}

interface NavbarProps {
  activeTab: string;
  setActiveTab: (tab: string) => void;
}

export default function Navbar({ activeTab, setActiveTab }: NavbarProps) {
  const navItems: NavItem[] = [
    { id: 'dashboard', label: 'Overview', icon: Target },
    { id: 'profile', label: 'Profile & Evidence', icon: User },
    { id: 'analysis', label: 'Job & Goal Analysis', icon: FileText },
    { id: 'gaps', label: 'Skill Gap Report', icon: Sparkles },
    { id: 'assessment', label: 'Practical Tasks', icon: Award },
    { id: 'roadmap', label: 'Roadmap', icon: Compass },
  ];

  return (
    <header className="sticky top-0 z-50 border-b border-slate-800 bg-slate-950/80 backdrop-blur-md px-6 py-3">
      <div className="max-w-7xl mx-auto flex items-center justify-between">
        {/* Brand */}
        <div className="flex items-center gap-3">
          <img
            src="/skillbridge_ai_logo_icon.svg"
            alt="SkillBridge AI Logo"
            className="w-9 h-9 rounded-xl object-contain shadow-lg shadow-indigo-500/20"
          />
          <div>
            <div className="font-bold text-base tracking-tight text-white flex items-center gap-2">
              SkillBridge AI
              <span className="text-[10px] font-semibold uppercase px-2 py-0.5 rounded bg-indigo-500/20 text-indigo-400 border border-indigo-500/30">
                Career Copilot
              </span>
            </div>
            <div className="text-xs text-slate-400">
              Evidence-based & deadline-aware planning
            </div>
          </div>
        </div>

        {/* Navigation Tabs */}
        <nav className="flex items-center gap-1 bg-slate-900/90 p-1.5 rounded-xl border border-slate-800">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = activeTab === item.id;
            return (
              <button
                key={item.id}
                onClick={() => setActiveTab(item.id)}
                className={`flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs font-medium transition-all ${
                  isActive
                    ? 'bg-indigo-600 text-white shadow-sm'
                    : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
                }`}
              >
                <Icon className="w-4 h-4" />
                {item.label}
              </button>
            );
          })}
        </nav>

        {/* AI Engine Badge */}
        <div className="flex items-center gap-2">
          <span className="text-xs font-medium px-2.5 py-1 rounded-md bg-slate-800 text-slate-300 border border-slate-700">
            Gemini & OpenRouter • Active
          </span>
        </div>
      </div>
    </header>
  );
}
