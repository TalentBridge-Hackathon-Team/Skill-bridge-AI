import { useState } from 'react';
import { ThemeProvider } from './context/ThemeContext';
import Sidebar, { navItems } from './components/Sidebar';
import Header from './components/Header';
import DashboardPage from './pages/DashboardPage';
import ProfilePage from './pages/ProfilePage';
import JobAnalysisPage from './pages/JobAnalysisPage';
import SkillGapPage from './pages/SkillGapPage';
import AssessmentPage from './pages/AssessmentPage';
import RoadmapPage from './pages/RoadmapPage';

function AppContent() {
  const [activeTab, setActiveTab] = useState<string>('dashboard');

  const currentItem = navItems.find(i => i.id === activeTab);
  const activeTitle = currentItem?.shortLabel || currentItem?.label || 'Overview';

  return (
    <div className="min-h-screen flex bg-[#f8f9fa] dark:bg-[#0b0f17] text-slate-800 dark:text-slate-100 font-sans selection:bg-indigo-500/20 antialiased transition-colors duration-200">
      {/* 1. Left Sidebar matching screenshot */}
      <Sidebar
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        userName="Student"
        userRole="Pro plan"
      />

      {/* 2. Main Content Canvas */}
      <div className="flex-1 flex flex-col min-w-0 min-h-screen overflow-x-hidden">
        {/* Top Header with Search, Theme Switcher & Notifications */}
        <Header title={activeTitle} userName="Student" />

        {/* Page Content */}
        <main className="flex-1 p-6 sm:p-8 max-w-7xl w-full mx-auto">
          {activeTab === 'dashboard' && <DashboardPage setActiveTab={setActiveTab} />}
          {activeTab === 'profile' && <ProfilePage setActiveTab={setActiveTab} />}
          {activeTab === 'analysis' && <JobAnalysisPage setActiveTab={setActiveTab} />}
          {activeTab === 'gaps' && <SkillGapPage setActiveTab={setActiveTab} />}
          {activeTab === 'assessment' && <AssessmentPage setActiveTab={setActiveTab} />}
          {activeTab === 'roadmap' && <RoadmapPage setActiveTab={setActiveTab} />}
        </main>

        {/* Subtle Footer */}
        <footer className="border-t border-slate-200/80 dark:border-slate-800/80 bg-white/50 dark:bg-[#0e131f]/50 px-8 py-3 text-xs text-slate-400 dark:text-slate-500 flex items-center justify-between">
          <span>SkillBridge AI • AI Career OS</span>
          <span>Blueprint 2.0 Hackathon Architecture • Light & Dark Themes</span>
        </footer>
      </div>
    </div>
  );
}

export default function App() {
  return (
    <ThemeProvider>
      <AppContent />
    </ThemeProvider>
  );
}
