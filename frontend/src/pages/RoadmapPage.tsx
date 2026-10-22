import { useState } from 'react';
import { CheckCircle2, Circle, Clock, ExternalLink, BookOpen, FileCheck, ArrowRight, ListChecks } from 'lucide-react';
import type { RoadmapTask, ApplicationChecklistItem } from '../types';

interface RoadmapPageProps {
  setActiveTab: (tab: string) => void;
}

export default function RoadmapPage({ setActiveTab }: RoadmapPageProps) {
  // Rich Roadmap Tasks adhering to Blueprint 2.0 Section 8
  const [tasks, setTasks] = useState<RoadmapTask[]>([
    {
      id: 'tsk_001',
      title: 'Complete REST API Testing Assessment',
      target: 'API Testing',
      target_skill: 'API Testing',
      priority: 'High',
      status: 'pending',
      action_deliverable: 'Write 3 complete test cases (success 201, invalid input 400, auth rejection 401) and evaluate against the 10-point published rubric.',
      completion_definition: 'Score at least 8/10 on the rubric to convert status from Unverified to Demonstrated.',
      effort_hours_estimate: 6,
      prerequisites: ['Basic Python', 'HTTP status codes familiarity'],
      expected_evidence: 'Rubric score summary and test case assertions.',
      due_date: 'Day 5 of 14-day plan',
      milestone: 'Milestone 1: Core Testing Verification',
      curated_resources: [
        {
          title: 'Django REST Framework Testing Official Docs',
          source: 'django-rest-framework.org',
          url: 'https://www.django-rest-framework.org/api-guide/testing/',
          type: 'docs'
        },
        {
          title: 'pytest-django Quickstart Guide',
          source: 'pytest-django.readthedocs.io',
          url: 'https://pytest-django.readthedocs.io/en/latest/',
          type: 'tutorial'
        }
      ]
    },
    {
      id: 'tsk_002',
      title: 'Connect PostgreSQL Project Repository & Schema Evidence',
      target: 'PostgreSQL',
      target_skill: 'PostgreSQL',
      priority: 'High',
      status: 'pending',
      action_deliverable: 'Link a repository containing relational schema definitions, migrations, and parameterized SQL queries.',
      completion_definition: 'Valid repository URL linked in Profile & Evidence tab with verified status.',
      effort_hours_estimate: 8,
      prerequisites: ['Relational Database Basics'],
      expected_evidence: 'GitHub repository URL with schema.sql or Django models.py migration history.',
      due_date: 'Day 9 of 14-day plan',
      milestone: 'Milestone 2: Database Competency',
      curated_resources: [
        {
          title: 'PostgreSQL Official Documentation: Queries & Indexes',
          source: 'postgresql.org',
          url: 'https://www.postgresql.org/docs/current/queries.html',
          type: 'docs'
        }
      ]
    },
    {
      id: 'tsk_003',
      title: 'Document Authentication & JWT Expiration Edge Cases',
      target: 'Authentication',
      target_skill: 'Authentication & Security',
      priority: 'Medium',
      status: 'pending',
      action_deliverable: 'Create README section demonstrating token refresh, expired token rejection, and role-based permissions.',
      completion_definition: 'Clear markdown documentation with curl/HTTP examples.',
      effort_hours_estimate: 4,
      prerequisites: ['REST API basics'],
      expected_evidence: 'Markdown documentation or snippet in linked repo.',
      due_date: 'Day 12 of 14-day plan',
      milestone: 'Milestone 3: Security & Polish',
      curated_resources: [
        {
          title: 'Simple JWT Documentation for Django REST',
          source: 'django-rest-framework-simplejwt.readthedocs.io',
          url: 'https://django-rest-framework-simplejwt.readthedocs.io/en/latest/',
          type: 'docs'
        }
      ]
    }
  ]);

  // Application-Preparation Checklist (Blueprint Section 6, F12)
  const [checklist, setChecklist] = useState<ApplicationChecklistItem[]>([
    {
      id: 'chk_1',
      title: 'Tailor CV to Highlight Demonstrated Evidence',
      description: 'Ensure CV cites the E-Commerce API and API testing suite prominently rather than listing plain keywords.',
      completed: true,
      category: 'cv'
    },
    {
      id: 'chk_2',
      title: 'GitHub Repository Readme Hygiene',
      description: 'Include clear setup instructions, test execution commands (pytest), and architectural overview.',
      completed: false,
      category: 'portfolio'
    },
    {
      id: 'chk_3',
      title: 'API Rubric Score Documentation',
      description: 'Export or screenshot the 10-point rubric breakdown for the controlled testing assessment.',
      completed: false,
      category: 'application'
    },
    {
      id: 'chk_4',
      title: 'Final Submission Review (Before 14-day Deadline)',
      description: 'Verify cover letter and application links 48 hours prior to deadline to avoid last-minute issues.',
      completed: false,
      category: 'application'
    }
  ]);

  const toggleTask = (id: string | undefined) => {
    if (!id) return;
    setTasks(tasks.map(t =>
      t.id === id ? { ...t, status: t.status === 'completed' ? 'pending' : 'completed' } : t
    ));
  };

  const toggleChecklistItem = (id: string) => {
    setChecklist(checklist.map(item =>
      item.id === id ? { ...item, completed: !item.completed } : item
    ));
  };

  const completedTasksCount = tasks.filter(t => t.status === 'completed').length;
  const completedChecklistCount = checklist.filter(c => c.completed).length;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Learner Roadmap & Progress Plan</h1>
          <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 mt-1">
            Feature 7 & 8 (Member 4) — Sequenced, actionable deliverables with effort estimates and curated resources.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <div className="text-xs text-slate-600 dark:text-slate-400 bg-slate-100 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 px-3 py-1.5 rounded-xl font-medium">
            Tasks Completed: <strong className="text-emerald-600 dark:text-emerald-400">{completedTasksCount}/{tasks.length}</strong>
          </div>
          <div className="text-xs text-slate-600 dark:text-slate-400 bg-slate-100 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 px-3 py-1.5 rounded-xl font-medium">
            Checklist: <strong className="text-indigo-600 dark:text-indigo-400">{completedChecklistCount}/{checklist.length}</strong>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Main Column: Sequenced Roadmap Tasks */}
        <div className="lg:col-span-2 space-y-4">
          <h2 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
            <BookOpen className="w-4 h-4 text-slate-600 dark:text-slate-300" />
            Prioritized Improvement Deliverables
          </h2>

          <div className="space-y-4">
            {tasks.map((task) => {
              const isDone = task.status === 'completed';
              return (
                <div
                  key={task.id}
                  className={`rounded-2xl border p-5 transition-all space-y-3.5 shadow-xs ${
                    isDone
                      ? 'border-emerald-500/30 bg-emerald-50/50 dark:bg-emerald-950/10'
                      : 'border-slate-200/90 dark:border-slate-800/80 bg-white dark:bg-[#0e131f] hover:border-slate-300 dark:hover:border-slate-700'
                  }`}
                >
                  {/* Task Header */}
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex items-start gap-3">
                      <button
                        type="button"
                        onClick={() => toggleTask(task.id)}
                        className={`mt-0.5 p-1 rounded-md transition-colors ${
                          isDone ? 'text-emerald-400' : 'text-slate-500 hover:text-slate-300'
                        }`}
                        title={isDone ? 'Mark as Pending' : 'Mark as Completed'}
                      >
                        {isDone ? <CheckCircle2 className="w-5 h-5" /> : <Circle className="w-5 h-5" />}
                      </button>

                      <div className="space-y-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded border ${
                            task.priority === 'High'
                              ? 'bg-rose-500/10 text-rose-400 border-rose-500/30'
                              : 'bg-amber-500/10 text-amber-400 border-amber-500/30'
                          }`}>
                            {task.priority} Priority
                          </span>
                          <span className="text-[10px] font-semibold text-indigo-300 bg-indigo-500/10 px-2 py-0.5 rounded border border-indigo-500/20">
                            Target: {task.target_skill}
                          </span>
                          {task.effort_hours_estimate && (
                            <span className="flex items-center gap-1 text-[10px] text-slate-400 bg-slate-800 px-2 py-0.5 rounded">
                              <Clock className="w-3 h-3" /> ~{task.effort_hours_estimate} hrs
                            </span>
                          )}
                          {task.due_date && (
                            <span className="text-[10px] text-cyan-400">
                              Due: {task.due_date}
                            </span>
                          )}
                        </div>

                        <h3 className={`text-base font-semibold ${isDone ? 'line-through text-slate-400' : 'text-white'}`}>
                          {task.title}
                        </h3>
                      </div>
                    </div>

                    {task.target === 'API Testing' && !isDone && (
                      <button
                        onClick={() => setActiveTab('assessment')}
                        className="flex items-center gap-1.5 rounded-lg bg-indigo-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-indigo-500 transition-colors shadow-sm shrink-0"
                      >
                        Launch Task <ArrowRight className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>

                  {/* Concrete Action & Completion Definition */}
                  <div className="rounded-lg bg-slate-950/70 p-3 border border-slate-800/80 space-y-2 text-xs">
                    <div>
                      <strong className="text-slate-300 block mb-0.5">Concrete Action & Deliverable:</strong>
                      <p className="text-slate-300 leading-relaxed">{task.action_deliverable}</p>
                    </div>
                    <div>
                      <strong className="text-slate-400 block mb-0.5">Definition of Done:</strong>
                      <p className="text-slate-400 italic">{task.completion_definition}</p>
                    </div>
                  </div>

                  {/* Curated Resources (Section 8 Safeguards) */}
                  {task.curated_resources && task.curated_resources.length > 0 && (
                    <div className="space-y-1.5 pt-1">
                      <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider block">
                        Curated Official Resources
                      </span>
                      <div className="flex flex-wrap gap-2">
                        {task.curated_resources.map((res, i) => (
                          <a
                            key={i}
                            href={res.url}
                            target="_blank"
                            rel="noreferrer"
                            className="inline-flex items-center gap-1.5 rounded-md border border-slate-800 bg-slate-900/90 px-2.5 py-1 text-xs text-indigo-400 hover:text-indigo-300 hover:border-indigo-500/40 transition-colors"
                          >
                            <ExternalLink className="w-3 h-3" />
                            <span>{res.title}</span>
                            <span className="text-[10px] text-slate-500">({res.source})</span>
                          </a>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* Sidebar Column: Application Preparation Checklist (Section 6, F12) */}
        <div className="space-y-4">
          <h2 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
            <ListChecks className="w-4 h-4 text-cyan-600 dark:text-cyan-400" />
            Application Checklist (Mode A)
          </h2>

          <div className="rounded-2xl border border-slate-200/90 dark:border-slate-800/80 bg-white dark:bg-[#0e131f] p-5 space-y-4 shadow-xs">
            <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
              Optional checklist to verify portfolio code, CV claims, and submission integrity before application closing.
            </p>

            <div className="space-y-3">
              {checklist.map((item) => (
                <div
                  key={item.id}
                  onClick={() => toggleChecklistItem(item.id)}
                  className={`p-3 rounded-xl border cursor-pointer transition-colors space-y-1 ${
                    item.completed
                      ? 'border-emerald-500/30 bg-emerald-50/50 dark:bg-emerald-950/20'
                      : 'border-slate-200/80 dark:border-slate-800 bg-slate-50/60 dark:bg-slate-950/60 hover:border-slate-300 dark:hover:border-slate-700'
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={item.completed}
                      onChange={() => {}}
                      className="rounded border-slate-300 dark:border-slate-700 text-slate-900 focus:ring-0 w-3.5 h-3.5"
                    />
                    <span className={`text-xs font-semibold ${item.completed ? 'line-through text-slate-400' : 'text-slate-900 dark:text-white'}`}>
                      {item.title}
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400 pl-5 leading-normal">
                    {item.description}
                  </p>
                </div>
              ))}
            </div>

            <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-950/80 border border-slate-200/80 dark:border-slate-800 text-[11px] text-slate-500 dark:text-slate-400 flex items-start gap-2">
              <FileCheck className="w-4 h-4 text-indigo-500 shrink-0 mt-0.5" />
              <span>
                Not a guarantee of hiring. Provides structured discipline so you submit with confidence.
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
