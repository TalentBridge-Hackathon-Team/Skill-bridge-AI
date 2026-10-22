import { Search, Moon, Sun, Bell } from 'lucide-react';
import { useTheme } from '../context/ThemeContext';

interface HeaderProps {
  title: string;
  userName?: string;
}

export default function Header({ title, userName = 'Student' }: HeaderProps) {
  const { theme, toggleTheme } = useTheme();

  return (
    <header className="h-16 px-8 border-b border-slate-200/80 dark:border-slate-800/80 bg-white/80 dark:bg-[#0e131f]/80 backdrop-blur-md flex items-center justify-between sticky top-0 z-40 transition-colors duration-200">
      {/* Title matching screenshot */}
      <div className="flex items-center gap-2.5">
        <h2 className="text-base font-bold text-slate-900 dark:text-white tracking-tight">
          {title}
        </h2>
        <span className="hidden md:inline-flex items-center text-[10px] font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400 bg-slate-100 dark:bg-slate-800/80 px-2 py-0.5 rounded-md border border-slate-200/80 dark:border-slate-700/60">
          SkillBridge AI
        </span>
      </div>

      {/* Right Controls: Search, Theme Toggle, Notifications, Avatar */}
      <div className="flex items-center gap-3">
        {/* Search pill */}
        <div className="relative hidden sm:block">
          <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Search anything..."
            className="w-48 md:w-60 pl-8 pr-3 py-1.5 rounded-full text-xs bg-slate-50 dark:bg-slate-900/80 border border-slate-200 dark:border-slate-800 text-slate-800 dark:text-slate-200 placeholder:text-slate-400 focus:outline-none focus:border-slate-400 dark:focus:border-slate-600 transition-all"
          />
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

        {/* User Avatar Circle */}
        <div className="w-8 h-8 rounded-full bg-slate-900 dark:bg-slate-100 text-white dark:text-slate-900 flex items-center justify-center text-xs font-bold shadow-xs">
          {userName.charAt(0).toUpperCase()}
        </div>
      </div>
    </header>
  );
}
