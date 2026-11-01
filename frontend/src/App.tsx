import { useState, useEffect } from 'react';
import { AlertTriangle } from 'lucide-react';
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

function AppShell() {
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

  const { user, isAuthenticated, sessionExpired, clearSessionExpired, logout } = useAuth();

  const [showAuthModal, setShowAuthModal] = useState<boolean>(false);
  const [authScreen, setAuthScreen] = useState<'login' | 'register'>('login');
  const [pendingTab, setPendingTab] = useState<string | null>(null);
  const [authPromptMessage, setAuthPromptMessage] = useState<string | null>(null);
  const [visitedTabs, setVisitedTabs] = useState<Set<string>>(() => new Set([activeTab]));
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState<boolean>(false);

  // Track visited tabs to preserve them in DOM and prevent redundant reloads
  useEffect(() => {
    setVisitedTabs(prev => {
      if (prev.has(activeTab)) return prev;
      const next = new Set(prev);
      next.add(activeTab);
      return next;
    });
  }, [activeTab]);

  // If user becomes authenticated, automatically transition to the pending protected tab
  useEffect(() => {
    if (isAuthenticated) {
      if (pendingTab) {
        setActiveTab(pendingTab);
        setPendingTab(null);
      }
      setShowAuthModal(false);
      setAuthPromptMessage(null);
      clearSessionExpired();
    }
  }, [isAuthenticated, pendingTab, clearSessionExpired]);

  const handleTabChange = (tab: string) => {
    setIsMobileMenuOpen(false);
    // Overview (dashboard) is always accessible
    if (tab === 'dashboard') {
      setActiveTab('dashboard');
      if (typeof window !== 'undefined') {
        const url = new URL(window.location.href);
        url.searchParams.set('tab', 'dashboard');
        window.history.replaceState({}, '', url.toString());
      }
      return;
    }

    // All other tabs require authentication
    if (!isAuthenticated) {
      const current = navItems.find(i => i.id === tab);
      const tabLabel = current?.label || current?.shortLabel || 'this section';
      setPendingTab(tab);
      setAuthPromptMessage(`Please sign in or create an account to access ${tabLabel}.`);
      setShowAuthModal(true);
      return;
    }

    setActiveTab(tab);
    if (typeof window !== 'undefined') {
      const url = new URL(window.location.href);
      url.searchParams.set('tab', tab);
      window.history.replaceState({}, '', url.toString());
    }
  };

  const handleOpenAuth = (intendedTab?: string) => {
    if (intendedTab) setPendingTab(intendedTab);
    setAuthPromptMessage(intendedTab ? `Sign in to access ${intendedTab}` : null);
    setShowAuthModal(true);
  };

  const currentItem = navItems.find(i => i.id === activeTab);
  const activeTitle = currentItem?.shortLabel || currentItem?.label || 'Overview';
  const displayName = user?.full_name || user?.username || 'Guest Learner';

  return (
    <div className="min-h-screen flex bg-[#f8f9fa] dark:bg-[#0b0f17] text-slate-800 dark:text-slate-100 font-sans selection:bg-indigo-500/20 antialiased transition-colors duration-200">
      <Sidebar
        activeTab={activeTab}
        setActiveTab={handleTabChange}
        userName={displayName}
        userRole={isAuthenticated ? 'Verified Learner' : 'Guest'}
        isAuthenticated={isAuthenticated}
        onOpenAuth={() => handleOpenAuth()}
        onLogout={logout}
        isMobileOpen={isMobileMenuOpen}
        onCloseMobile={() => setIsMobileMenuOpen(false)}
      />

      <div className="flex-1 flex flex-col min-w-0 min-h-screen overflow-x-hidden">
        {/* Session expired floating notification */}
        {sessionExpired && !isAuthenticated && (
          <div className="bg-amber-500/10 border-b border-amber-500/20 px-4 sm:px-8 py-2.5 text-xs text-amber-700 dark:text-amber-300 flex items-center justify-between z-50">
            <div className="flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-amber-500 shrink-0" />
              <span className="truncate">Your session has expired. Please sign in to resume.</span>
            </div>
            <button
              onClick={() => {
                setPendingTab(activeTab);
                setAuthPromptMessage('Your session expired. Please sign in to resume.');
                setShowAuthModal(true);
                clearSessionExpired();
              }}
              className="px-3 py-1 bg-amber-500 hover:bg-amber-600 text-slate-950 font-semibold rounded-lg text-xs transition-colors shadow-2xs cursor-pointer shrink-0 ml-2"
            >
              Sign In
            </button>
          </div>
        )}

        <Header
          title={activeTitle}
          userName={displayName}
          setActiveTab={handleTabChange}
          onOpenAuth={handleOpenAuth}
          onToggleMobileMenu={() => setIsMobileMenuOpen(prev => !prev)}
        />

        <main className="flex-1 p-3.5 sm:p-6 lg:p-8 max-w-7xl w-full mx-auto pb-24 md:pb-8">
          <div style={{ display: activeTab === 'dashboard' ? 'block' : 'none' }}>
            {visitedTabs.has('dashboard') && <DashboardPage setActiveTab={handleTabChange} />}
          </div>
          <div style={{ display: activeTab === 'profile' ? 'block' : 'none' }}>
            {visitedTabs.has('profile') && <ProfilePage setActiveTab={handleTabChange} />}
          </div>
          <div style={{ display: activeTab === 'analysis' ? 'block' : 'none' }}>
            {visitedTabs.has('analysis') && <JobAnalysisPage setActiveTab={handleTabChange} />}
          </div>
          <div style={{ display: activeTab === 'gaps' ? 'block' : 'none' }}>
            {visitedTabs.has('gaps') && <SkillGapPage setActiveTab={handleTabChange} />}
          </div>
          <div style={{ display: activeTab === 'assessment' ? 'block' : 'none' }}>
            {visitedTabs.has('assessment') && <AssessmentPage setActiveTab={handleTabChange} />}
          </div>
          <div style={{ display: activeTab === 'roadmap' ? 'block' : 'none' }}>
            {visitedTabs.has('roadmap') && <RoadmapPage setActiveTab={handleTabChange} />}
          </div>
        </main>

        <footer className="border-t border-slate-200/80 dark:border-slate-800/80 bg-white/50 dark:bg-[#0e131f]/50 px-4 sm:px-8 py-3 text-xs text-slate-400 dark:text-slate-500 flex flex-col sm:flex-row items-center justify-between gap-2 text-center sm:text-left mb-16 md:mb-0">
          <span>SkillBridge AI • AI Career OS</span>
          <span>Evidence-based & deadline-aware planning</span>
        </footer>

        {/* Mobile Sticky Bottom Navigation Bar */}
        <nav
          aria-label="Mobile Navigation"
          className="fixed bottom-0 left-0 right-0 z-40 bg-white/95 dark:bg-[#0e131f]/95 backdrop-blur-md border-t border-slate-200/80 dark:border-slate-800/80 px-1 py-1.5 flex items-center justify-around shadow-lg md:hidden"
        >
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = activeTab === item.id;
            return (
              <button
                key={item.id}
                onClick={() => handleTabChange(item.id)}
                className={`flex flex-col items-center justify-center py-1 px-1.5 rounded-xl text-[10px] font-medium transition-all cursor-pointer ${
                  isActive
                    ? 'text-indigo-600 dark:text-cyan-400 font-bold'
                    : 'text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
                }`}
              >
                <Icon className={`w-4 h-4 ${isActive ? 'text-indigo-600 dark:text-cyan-400' : 'text-slate-400'}`} />
                <span className="truncate max-w-[50px] mt-0.5">{item.shortLabel || item.label}</span>
              </button>
            );
          })}
        </nav>
      </div>

      {/* Auth Modal Overlay */}
      {showAuthModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 overflow-y-auto animate-in fade-in duration-150">
          <div className="w-full max-w-sm">
            {authScreen === 'login' ? (
              <LoginPage
                onSwitchToRegister={() => setAuthScreen('register')}
                onClose={() => {
                  setShowAuthModal(false);
                  setPendingTab(null);
                  setAuthPromptMessage(null);
                }}
                promptMessage={authPromptMessage}
              />
            ) : (
              <RegisterPage
                onSwitchToLogin={() => setAuthScreen('login')}
                onClose={() => {
                  setShowAuthModal(false);
                  setPendingTab(null);
                  setAuthPromptMessage(null);
                }}
                promptMessage={authPromptMessage}
              />
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function AppContent() {
  const { isLoading } = useAuth();

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

  return <AppShell />;
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
