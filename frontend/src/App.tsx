import { useState } from 'react';
import { ThemeProvider } from './context/ThemeContext';
import { AuthProvider, useAuth } from './context/AuthContext';
import Sidebar, { navItems } from './components/Sidebar';
import Header from './components/Header';
import LoginPage from './pages/LoginPage';
import RegisterPage from './pages/RegisterPage';
import DashboardPage from './pages/DashboardPage';
import ProfilePage from './pages/ProfilePage';
import JobAnalysisPage from './pages/JobAnalysisPage';
import SkillGapPage from './pages/SkillGapPage';
import AssessmentPage from './pages/AssessmentPage';
import RoadmapPage from './pages/RoadmapPage';

function AppContent() {
  const [activeTab, setActiveTab] = useState<string>(() => {
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      const tabParam = params.get('tab');
      if (tabParam) return tabParam;
      const hash = window.location.hash.replace('#', '');
      if (hash) return hash;
    }
    return 'dashboard';
  });

  const handleTabChange = (tab: string) => {
    setActiveTab(tab);
    if (typeof window !== 'undefined') {
      const url = new URL(window.location.href);
      url.searchParams.set('tab', tab);
      window.history.replaceState({}, '', url.toString());
    }
  };
// ── Auth gate — shows Login/Register when user is not authenticated ───────────

function AuthGate() {
  const [authScreen, setAuthScreen] = useState<'login' | 'register'>('login');

  if (authScreen === 'login') {
    return <LoginPage onSwitchToRegister={() => setAuthScreen('register')} />;
  }
  return <RegisterPage onSwitchToLogin={() => setAuthScreen('login')} />;
}

// ── Main app shell — only rendered when authenticated ─────────────────────────

function AppShell() {
  const [activeTab, setActiveTab] = useState<string>('dashboard');
  const { user, logout } = useAuth();

  const currentItem = navItems.find(i => i.id === activeTab);
  const activeTitle = currentItem?.shortLabel || currentItem?.label || 'Overview';
  const displayName = user?.full_name || user?.username || 'Student';

  return (
    <div className="min-h-screen flex bg-[#f8f9fa] dark:bg-[#0b0f17] text-slate-800 dark:text-slate-100 font-sans selection:bg-indigo-500/20 antialiased transition-colors duration-200">
      <Sidebar
        activeTab={activeTab}
        setActiveTab={handleTabChange}
        userName="Student"
        userRole="Pro plan"
        setActiveTab={setActiveTab}
        userName={displayName}
        userRole="SkillBridge AI"
        onLogout={logout}
      />

      <div className="flex-1 flex flex-col min-w-0 min-h-screen overflow-x-hidden">
        <Header title={activeTitle} userName={displayName} />

        <main className="flex-1 p-6 sm:p-8 max-w-7xl w-full mx-auto">
          {activeTab === 'dashboard' && <DashboardPage setActiveTab={handleTabChange} />}
          {activeTab === 'profile' && <ProfilePage setActiveTab={handleTabChange} />}
          {activeTab === 'analysis' && <JobAnalysisPage setActiveTab={handleTabChange} />}
          {activeTab === 'gaps' && <SkillGapPage setActiveTab={handleTabChange} />}
          {activeTab === 'assessment' && <AssessmentPage setActiveTab={handleTabChange} />}
          {activeTab === 'roadmap' && <RoadmapPage setActiveTab={handleTabChange} />}
          {activeTab === 'dashboard'  && <DashboardPage setActiveTab={setActiveTab} />}
          {activeTab === 'profile'    && <ProfilePage setActiveTab={setActiveTab} />}
          {activeTab === 'analysis'   && <JobAnalysisPage setActiveTab={setActiveTab} />}
          {activeTab === 'gaps'       && <SkillGapPage setActiveTab={setActiveTab} />}
          {activeTab === 'assessment' && <AssessmentPage setActiveTab={setActiveTab} />}
          {activeTab === 'roadmap'    && <RoadmapPage setActiveTab={setActiveTab} />}
        </main>

        <footer className="border-t border-slate-200/80 dark:border-slate-800/80 bg-white/50 dark:bg-[#0e131f]/50 px-8 py-3 text-xs text-slate-400 dark:text-slate-500 flex items-center justify-between">
          <span>SkillBridge AI • AI Career OS</span>
          <span>Evidence-based & deadline-aware planning</span>
        </footer>
      </div>
    </div>
  );
}

// ── Root — decides which shell to show ────────────────────────────────────────

function AppContent() {
  const { isAuthenticated, isLoading } = useAuth();

  // Brief loading state while checking stored token on startup
  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#f8f9fa] dark:bg-[#0b0f17]">
        <div className="flex flex-col items-center gap-3 text-slate-400">
          <div className="w-8 h-8 border-2 border-slate-300 border-t-slate-700 rounded-full animate-spin" />
          <span className="text-xs">Loading SkillBridge AI...</span>
        </div>
      </div>
    );
  }

  return isAuthenticated ? <AppShell /> : <AuthGate />;
}

export default function App() {
  return (
    <ThemeProvider>
      <AuthProvider>
        <AppContent />
      </AuthProvider>
    </ThemeProvider>
  );
}
