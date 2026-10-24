import { useState } from 'react';
import type { FormEvent } from 'react';
import { Sparkles, ArrowRight, Image as ImageIcon, Calendar, Clock, Compass, Briefcase, Plus, Trash2, CheckCircle2 } from 'lucide-react';
import { api } from '../services/api';
import type { Requirement, ProductMode } from '../types';

interface JobAnalysisPageProps {
  setActiveTab: (tab: string) => void;
}

export default function JobAnalysisPage({ setActiveTab }: JobAnalysisPageProps) {
  const [mode, setMode] = useState<ProductMode>('job_specific');

  // Mode A fields (Job-Specific & Deadline-Aware)
  const [jobText, setJobText] = useState<string>('');
  const [jobImage, setJobImage] = useState<File | null>(null);
  const [daysRemaining, setDaysRemaining] = useState<number>(14);
  const [studyHoursPerWeek, setStudyHoursPerWeek] = useState<number>(14);

  // Mode B fields (Goal-Based Career/Skill)
  const [goalText, setGoalText] = useState<string>('Junior Backend Developer / Backend Internship');
  const [goalType, setGoalType] = useState<'career_role' | 'skill_goal'>('career_role');

  const [isExtracting, setIsExtracting] = useState<boolean>(false);

  // Editable requirements (human review - Section 6, F5)
  const [extractedRequirements, setExtractedRequirements] = useState<Requirement[]>([
    { id: 'req_1', skill_name: 'Python', category: 'language', importance: 'required', source_excerpt: 'Proficiency in Python and familiarity with web frameworks' },
    { id: 'req_2', skill_name: 'Django REST Framework', category: 'framework', importance: 'required', source_excerpt: 'Design, build, and maintain robust RESTful APIs in Python' },
    { id: 'req_3', skill_name: 'API Testing', category: 'testing', importance: 'required', source_excerpt: 'Write unit, integration, and end-to-end API tests' },
    { id: 'req_4', skill_name: 'PostgreSQL', category: 'database', importance: 'required', source_excerpt: 'Write and optimize database queries using PostgreSQL' },
  ]);

  const [newSkillName, setNewSkillName] = useState('');
  const [newSkillCategory, setNewSkillCategory] = useState('framework');

  const handleExtract = async (e: FormEvent) => {
    e.preventDefault();
    if (mode === 'job_specific' && !jobText && !jobImage) return;
    if (mode === 'goal_based' && !goalText) return;

    setIsExtracting(true);
    try {
      if (mode === 'job_specific') {
        const formData = new FormData();
        if (jobText) formData.append('job_text', jobText);
        if (jobImage) formData.append('job_image', jobImage);
        formData.append('days_remaining', String(daysRemaining));
        formData.append('study_hours_per_week', String(studyHoursPerWeek));
        formData.append('user_id', 'usr_demo_001');

        await api.submitJobAnalysis(formData);
      } else {
        await api.submitGoal({
          user_id: 'usr_demo_001',
          goal_type: goalType,
          goal_text: goalText,
          days_remaining: daysRemaining,
          study_hours_per_week: studyHoursPerWeek,
        });
      }
    } catch (err) {
      console.error("Analysis error (falling back to prepared sample schema):", err);
    } finally {
      setIsExtracting(false);
    }
  };

  const removeRequirement = (id?: string) => {
    if (!id) return;
    setExtractedRequirements(extractedRequirements.filter(r => r.id !== id));
  };

  const addCustomRequirement = () => {
    if (!newSkillName.trim()) return;
    const newReq: Requirement = {
      id: `req_custom_${Date.now()}`,
      skill_name: newSkillName.trim(),
      category: newSkillCategory,
      importance: 'required',
      source_excerpt: 'Added manually during user requirement review',
      user_confirmed: true
    };
    setExtractedRequirements([...extractedRequirements, newReq]);
    setNewSkillName('');
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Target Requirement Analysis & Feasibility</h1>
          <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 mt-1">
            Choose your career path: deadline-aware target job preparation or self-paced goal-based skill growth.
          </p>
        </div>

        {/* Mode Switcher Tabs */}
        <div className="inline-flex rounded-xl bg-slate-100 dark:bg-slate-900 p-1 border border-slate-200 dark:border-slate-800">
          <button
            type="button"
            onClick={() => setMode('job_specific')}
            className={`flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all ${
              mode === 'job_specific'
                ? 'bg-slate-900 text-white dark:bg-white dark:text-slate-900 shadow-xs'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            <Briefcase className="w-3.5 h-3.5" />
            Mode A: Job Opportunity
          </button>
          <button
            type="button"
            onClick={() => setMode('goal_based')}
            className={`flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all ${
              mode === 'goal_based'
                ? 'bg-slate-900 text-white dark:bg-white dark:text-slate-900 shadow-xs'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            <Compass className="w-3.5 h-3.5" />
            Mode B: Career / Skill Goal
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Left Column: Input Form (Mode A or Mode B) */}
        <div className="rounded-2xl border border-slate-200/90 dark:border-slate-800/80 bg-white dark:bg-[#0e131f] p-6 flex flex-col space-y-4 shadow-xs">
          {mode === 'job_specific' ? (
            <>
              <div className="flex justify-between items-center pb-2 border-b border-slate-100 dark:border-slate-800/80">
                <div className="flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-indigo-500 animate-pulse" />
                  <h2 className="text-sm font-semibold text-slate-900 dark:text-white">Job Description & Deadline Setup</h2>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setJobText("We are seeking a Junior Backend Developer to build and maintain RESTful web APIs using Python, Django REST Framework, and PostgreSQL. Requirements include automated API unit and integration testing, basic SQL query optimization, and clean Git workflows.");
                    setDaysRemaining(14);
                    setStudyHoursPerWeek(14);
                  }}
                  className="text-xs text-indigo-400 hover:underline font-medium"
                >
                  Fill Sample Posting
                </button>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">
                  Paste Raw Job Posting Text
                </label>
                <textarea
                  rows={6}
                  className="w-full rounded-lg border border-slate-700 bg-slate-950 p-3 text-xs font-mono text-slate-200 focus:border-indigo-500 focus:outline-none placeholder:text-slate-600"
                  placeholder="Paste requirements, qualifications, and role responsibilities..."
                  value={jobText}
                  onChange={(e) => setJobText(e.target.value)}
                />
              </div>

              {/* Deadline & Available Hours Controls (Section 4, Step 1-2 & Section 7) */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 p-3.5 rounded-lg border border-indigo-900/40 bg-indigo-950/20">
                <div>
                  <label className="flex items-center gap-1.5 text-xs font-semibold text-indigo-300 mb-1">
                    <Calendar className="w-3.5 h-3.5" /> Application Deadline
                  </label>
                  <div className="flex items-center gap-2">
                    <input
                      type="number"
                      min={1}
                      max={90}
                      value={daysRemaining}
                      onChange={(e) => setDaysRemaining(Number(e.target.value) || 1)}
                      className="w-20 rounded border border-slate-700 bg-slate-950 px-2.5 py-1 text-xs text-white focus:outline-none focus:border-indigo-500"
                    />
                    <span className="text-xs text-slate-400">days remaining</span>
                  </div>
                </div>

                <div>
                  <label className="flex items-center gap-1.5 text-xs font-semibold text-indigo-300 mb-1">
                    <Clock className="w-3.5 h-3.5" /> Weekly Study Capacity
                  </label>
                  <div className="flex items-center gap-2">
                    <input
                      type="number"
                      min={1}
                      max={60}
                      value={studyHoursPerWeek}
                      onChange={(e) => setStudyHoursPerWeek(Number(e.target.value) || 1)}
                      className="w-20 rounded border border-slate-700 bg-slate-950 px-2.5 py-1 text-xs text-white focus:outline-none focus:border-indigo-500"
                    />
                    <span className="text-xs text-slate-400">hours / week</span>
                  </div>
                </div>

                <div className="sm:col-span-2 pt-1 text-[11px] text-slate-400 flex items-center justify-between border-t border-indigo-900/30">
                  <span>Calculated Available Study Time:</span>
                  <span className="font-semibold text-indigo-300">
                    {Math.round(daysRemaining * (studyHoursPerWeek / 7))} total hours
                  </span>
                </div>
              </div>

              {/* Optional Job Screenshot Upload */}
              <div className="rounded-lg border border-dashed border-slate-700 bg-slate-950/50 p-3 space-y-1.5">
                <div className="flex items-center gap-2 text-xs font-semibold text-slate-300">
                  <ImageIcon className="w-3.5 h-3.5 text-cyan-400" /> Optional: Upload Job Screenshot
                </div>
                <input
                  type="file"
                  accept="image/*,.pdf"
                  onChange={(e) => setJobImage(e.target.files ? e.target.files[0] : null)}
                  className="block w-full text-xs text-slate-400 file:mr-3 file:py-1 file:px-2.5 file:rounded-md file:border-0 file:text-[11px] file:font-semibold file:bg-slate-800 file:text-slate-200 hover:file:bg-slate-700"
                />
              </div>
            </>
          ) : (
            <>
              {/* Mode B: Goal-Based Formulation */}
              <div className="flex justify-between items-center">
                <div className="flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-cyan-500 animate-pulse" />
                  <h2 className="text-base font-semibold text-white">Career Goal & Skill Target</h2>
                </div>
                <span className="text-xs text-cyan-400 font-medium">No Job Posting Needed</span>
              </div>

              <div className="space-y-3">
                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1">
                    Goal Type
                  </label>
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={() => setGoalType('career_role')}
                      className={`p-2.5 rounded-lg border text-left text-xs transition-colors ${
                        goalType === 'career_role'
                          ? 'border-cyan-500/50 bg-cyan-950/30 text-white font-medium'
                          : 'border-slate-800 bg-slate-950 text-slate-400'
                      }`}
                    >
                      <div className="font-semibold text-cyan-400">Target Career Role</div>
                      <div className="text-[11px] text-slate-400">E.g., Junior Backend Developer</div>
                    </button>
                    <button
                      type="button"
                      onClick={() => setGoalType('skill_goal')}
                      className={`p-2.5 rounded-lg border text-left text-xs transition-colors ${
                        goalType === 'skill_goal'
                          ? 'border-cyan-500/50 bg-cyan-950/30 text-white font-medium'
                          : 'border-slate-800 bg-slate-950 text-slate-400'
                      }`}
                    >
                      <div className="font-semibold text-cyan-400">Specific Skill Goal</div>
                      <div className="text-[11px] text-slate-400">E.g., Learn SQL & API Testing</div>
                    </button>
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1">
                    Describe your goal or choose the supported hackathon profile
                  </label>
                  <input
                    type="text"
                    value={goalText}
                    onChange={(e) => setGoalText(e.target.value)}
                    className="w-full rounded-lg border border-slate-700 bg-slate-950 p-2.5 text-xs text-slate-200 focus:border-cyan-500 focus:outline-none"
                    placeholder="E.g., Prepare for a Junior Backend Developer role"
                  />
                  <p className="text-[11px] text-slate-400 mt-1">
                    Mapped to the supported MVP role profile (Python, Django REST, PostgreSQL, API Testing).
                  </p>
                </div>

                {/* Study Pace */}
                <div className="p-3.5 rounded-lg border border-cyan-900/40 bg-cyan-950/20 flex items-center justify-between">
                  <div className="space-y-0.5">
                    <span className="text-xs font-semibold text-cyan-300">Planned Learning Pace</span>
                    <p className="text-[11px] text-slate-400">Weekly self-study commitment</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <input
                      type="number"
                      min={1}
                      max={40}
                      value={studyHoursPerWeek}
                      onChange={(e) => setStudyHoursPerWeek(Number(e.target.value) || 1)}
                      className="w-16 rounded border border-slate-700 bg-slate-950 px-2 py-1 text-xs text-white focus:outline-none focus:border-cyan-500 text-center"
                    />
                    <span className="text-xs text-slate-400">hrs/week</span>
                  </div>
                </div>
              </div>
            </>
          )}

          <button
            type="button"
            onClick={handleExtract}
            disabled={isExtracting || (mode === 'job_specific' && !jobText && !jobImage)}
            className={`flex items-center justify-center gap-2 rounded-lg px-4 py-2.5 text-sm font-semibold text-white transition-colors shadow-md disabled:opacity-50 ${
              mode === 'job_specific'
                ? 'bg-indigo-600 hover:bg-indigo-500 shadow-indigo-600/20'
                : 'bg-cyan-600 hover:bg-cyan-500 shadow-cyan-600/20'
            }`}
          >
            <Sparkles className="w-4 h-4" />
            {isExtracting
              ? 'Analyzing with Bedrock & Rule Engine...'
              : mode === 'job_specific'
              ? 'Extract Requirements & Setup Feasibility'
              : 'Map Goal to Target Profile'}
          </button>
        </div>

        {/* Right Column: Extracted Requirements & Human-in-the-loop Review (Section 6, F5) */}
        <div className="rounded-xl border border-slate-800 bg-slate-900/50 p-6 flex flex-col space-y-4">
          <div className="flex justify-between items-center pb-2 border-b border-slate-800">
            <div>
              <h2 className="text-base font-semibold text-white">Target Skills to Match</h2>
              <p className="text-xs text-slate-400">
                Human Review: confirm, edit, or add requirements before running gap matching.
              </p>
            </div>
            <button
              onClick={() => setActiveTab('gaps')}
              className="flex items-center gap-1.5 rounded-lg bg-emerald-600 px-3.5 py-1.5 text-xs font-semibold text-white hover:bg-emerald-500 transition-colors shadow-sm"
            >
              Run Skill Matching <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>

          {/* List of Target Requirements */}
          <div className="space-y-2.5 overflow-y-auto max-h-[340px] pr-1">
            {extractedRequirements.map((req) => (
              <div key={req.id} className="rounded-lg border border-slate-800 bg-slate-950/70 p-3 space-y-1.5 group">
                <div className="flex justify-between items-center">
                  <div className="flex items-center gap-2">
                    <CheckCircle2 className="w-3.5 h-3.5 text-indigo-400" />
                    <span className="text-sm font-semibold text-white">{req.skill_name}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] font-semibold uppercase px-2 py-0.5 rounded bg-indigo-500/10 text-indigo-400 border border-indigo-500/30">
                      {req.importance}
                    </span>
                    <span className="text-[10px] font-medium px-2 py-0.5 rounded bg-slate-800 text-slate-400">
                      {req.category}
                    </span>
                    <button
                      type="button"
                      onClick={() => removeRequirement(req.id)}
                      className="text-slate-500 hover:text-rose-400 transition-colors p-1"
                      title="Remove requirement"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
                <p className="text-xs text-slate-400 italic">"{req.source_excerpt}"</p>
              </div>
            ))}
          </div>

          {/* Add Custom Requirement Box */}
          <div className="p-3 rounded-lg border border-slate-800 bg-slate-950/40 space-y-2">
            <span className="text-[11px] font-semibold text-slate-400 block">Add or Clarify Target Requirement</span>
            <div className="flex gap-2">
              <input
                type="text"
                placeholder="Skill name (e.g. Git, Docker)"
                value={newSkillName}
                onChange={(e) => setNewSkillName(e.target.value)}
                className="flex-1 rounded border border-slate-700 bg-slate-900 px-2.5 py-1 text-xs text-white focus:outline-none focus:border-indigo-500"
              />
              <select
                value={newSkillCategory}
                onChange={(e) => setNewSkillCategory(e.target.value)}
                className="rounded border border-slate-700 bg-slate-900 px-2 py-1 text-xs text-slate-300 focus:outline-none"
              >
                <option value="framework">Framework</option>
                <option value="language">Language</option>
                <option value="database">Database</option>
                <option value="testing">Testing</option>
                <option value="tools">Tools</option>
              </select>
              <button
                type="button"
                onClick={addCustomRequirement}
                className="flex items-center gap-1 rounded bg-slate-800 hover:bg-slate-700 px-2.5 py-1 text-xs font-semibold text-slate-200 transition-colors"
              >
                <Plus className="w-3.5 h-3.5" /> Add
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
