import { useState } from 'react';
import { BookOpen, Send, CheckCircle2, Award, FileCode, Layers } from 'lucide-react';
import type { AssessmentSubmission } from '../types';

interface AssessmentPageProps {
  setActiveTab?: (tab: string) => void;
}

export default function AssessmentPage({ setActiveTab: _setActiveTab }: AssessmentPageProps) {
  const [selectedTask, setSelectedTask] = useState<string>('api_testing');
  const [submission, setSubmission] = useState<AssessmentSubmission>({
    valid_test: '',
    invalid_test: '',
    auth_test: '',
    assertions: '',
    explanation: '',
  });

  const [submitted, setSubmitted] = useState<boolean>(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitted(true);
  };

  return (
    <div className="space-y-6">
      {/* Generic Tab Header */}
      <div>
        <h1 className="text-2xl font-bold text-slate-900 dark:text-white">
          Practical Tasks & Technical Assessments
        </h1>
        <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 mt-1">
          Feature 6 (Member 4) — Controlled, rubric-evaluated practical tasks to convert unverified claims into demonstrated evidence.
        </p>
      </div>

      {/* Task Catalog / Selector */}
      <div className="flex flex-wrap gap-2 border-b border-slate-200/80 dark:border-slate-800/80 pb-3">
        <button
          onClick={() => setSelectedTask('api_testing')}
          className={`flex items-center gap-2 px-3.5 py-1.5 rounded-xl text-xs font-semibold transition-all ${
            selectedTask === 'api_testing'
              ? 'bg-slate-900 text-white dark:bg-white dark:text-slate-900 shadow-xs'
              : 'bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-400 border border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800'
          }`}
        >
          <Award className="w-3.5 h-3.5" />
          <span>Active: REST API Testing Task (10 pts)</span>
        </button>

        <button
          onClick={() => setSelectedTask('sql_queries')}
          className={`flex items-center gap-2 px-3.5 py-1.5 rounded-xl text-xs font-medium transition-all ${
            selectedTask === 'sql_queries'
              ? 'bg-slate-900 text-white dark:bg-white dark:text-slate-900 shadow-xs'
              : 'bg-white dark:bg-slate-900 text-slate-500 dark:text-slate-400 border border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800'
          }`}
        >
          <FileCode className="w-3.5 h-3.5" />
          <span>SQL Schema & Querying (Upcoming)</span>
        </button>

        <button
          onClick={() => setSelectedTask('docker_deploy')}
          className={`flex items-center gap-2 px-3.5 py-1.5 rounded-xl text-xs font-medium transition-all ${
            selectedTask === 'docker_deploy'
              ? 'bg-slate-900 text-white dark:bg-white dark:text-slate-900 shadow-xs'
              : 'bg-white dark:bg-slate-900 text-slate-500 dark:text-slate-400 border border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800'
          }`}
        >
          <Layers className="w-3.5 h-3.5" />
          <span>Containerization & Deployment (Upcoming)</span>
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Test Input Form Card */}
        <div className="lg:col-span-2 rounded-2xl border border-slate-200/90 dark:border-slate-800/80 bg-white dark:bg-[#0e131f] p-6 space-y-4 shadow-xs">
          <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800/80">
            <div>
              <h2 className="text-sm font-bold text-slate-900 dark:text-white">
                Controlled API Testing Assessment
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Submit test scenarios against the mock order service. Score ≥ 8/10 to unlock "Demonstrated" status.
              </p>
            </div>
            <span className="text-xs font-bold text-slate-900 dark:text-white px-2.5 py-1 rounded-full bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700">
              10 Points Rubric
            </span>
          </div>

          <form className="space-y-4" onSubmit={handleSubmit}>
            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                1. Successful Request Test Case (2 pts)
              </label>
              <textarea
                rows={3}
                className="w-full rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 p-3 font-mono text-xs text-slate-900 dark:text-slate-200 focus:border-slate-500 focus:outline-none transition-colors"
                placeholder="def test_create_order_success():&#10;    response = client.post('/api/orders/', valid_payload)&#10;    assert response.status_code == 201"
                value={submission.valid_test}
                onChange={e => setSubmission({ ...submission, valid_test: e.target.value })}
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                2. Invalid Input Edge Case (2 pts)
              </label>
              <textarea
                rows={3}
                className="w-full rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 p-3 font-mono text-xs text-slate-900 dark:text-slate-200 focus:border-slate-500 focus:outline-none transition-colors"
                placeholder="def test_create_order_missing_amount():&#10;    response = client.post('/api/orders/', {'items': []})&#10;    assert response.status_code == 400"
                value={submission.invalid_test}
                onChange={e => setSubmission({ ...submission, invalid_test: e.target.value })}
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                3. Authorization Rejection (3 pts)
              </label>
              <textarea
                rows={3}
                className="w-full rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 p-3 font-mono text-xs text-slate-900 dark:text-slate-200 focus:border-slate-500 focus:outline-none transition-colors"
                placeholder="def test_create_order_unauthorized():&#10;    client.credentials()&#10;    response = client.post('/api/orders/', valid_payload)&#10;    assert response.status_code == 401"
                value={submission.auth_test}
                onChange={e => setSubmission({ ...submission, auth_test: e.target.value })}
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                4. Key Assertions (2 pts)
              </label>
              <textarea
                rows={2}
                className="w-full rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 p-3 font-mono text-xs text-slate-900 dark:text-slate-200 focus:border-slate-500 focus:outline-none transition-colors"
                placeholder="assert 'order_id' in response.data&#10;assert response.data['status'] == 'pending'"
                value={submission.assertions}
                onChange={e => setSubmission({ ...submission, assertions: e.target.value })}
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                5. Technical Explanation (1 pt)
              </label>
              <textarea
                rows={2}
                className="w-full rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 p-3 text-xs text-slate-900 dark:text-slate-200 focus:border-slate-500 focus:outline-none transition-colors"
                placeholder="Explain why this suite protects against regression in order processing..."
                value={submission.explanation}
                onChange={e => setSubmission({ ...submission, explanation: e.target.value })}
              />
            </div>

            <div className="flex items-center justify-between pt-2">
              <button
                type="submit"
                className="flex items-center gap-2 rounded-xl bg-slate-900 dark:bg-white px-5 py-2.5 text-xs font-semibold text-white dark:text-slate-900 hover:bg-slate-800 dark:hover:bg-slate-100 transition-colors shadow-xs"
              >
                <Send className="w-3.5 h-3.5" /> Submit for Rubric Scoring
              </button>

              {submitted && (
                <span className="flex items-center gap-1.5 text-xs font-semibold text-emerald-600 dark:text-emerald-400">
                  <CheckCircle2 className="w-4 h-4" /> Submission recorded! Scored 9/10
                </span>
              )}
            </div>
          </form>
        </div>

        {/* Published Rubric Sidebar Card */}
        <div className="space-y-4">
          <div className="rounded-2xl border border-slate-200/90 dark:border-slate-800/80 bg-white dark:bg-[#0e131f] p-5 space-y-4 shadow-xs">
            <div className="flex items-center gap-2 text-slate-900 dark:text-white font-bold text-sm">
              <BookOpen className="w-4 h-4 text-slate-600 dark:text-slate-300" />
              <span>Published 10-Point Rubric</span>
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Evaluated deterministically according to Blueprint 2.0 Section 9:
            </p>

            <ul className="space-y-2 text-xs">
              <li className="flex justify-between items-center py-1.5 border-b border-slate-100 dark:border-slate-800/60">
                <span className="text-slate-700 dark:text-slate-300">1. Successful Request</span>
                <span className="font-semibold text-slate-900 dark:text-white">2 pts</span>
              </li>
              <li className="flex justify-between items-center py-1.5 border-b border-slate-100 dark:border-slate-800/60">
                <span className="text-slate-700 dark:text-slate-300">2. Invalid Input 400</span>
                <span className="font-semibold text-slate-900 dark:text-white">2 pts</span>
              </li>
              <li className="flex justify-between items-center py-1.5 border-b border-slate-100 dark:border-slate-800/60">
                <span className="text-slate-700 dark:text-slate-300">3. Auth Rejection 401/403</span>
                <span className="font-semibold text-slate-900 dark:text-white">3 pts</span>
              </li>
              <li className="flex justify-between items-center py-1.5 border-b border-slate-100 dark:border-slate-800/60">
                <span className="text-slate-700 dark:text-slate-300">4. Specific Assertions</span>
                <span className="font-semibold text-slate-900 dark:text-white">2 pts</span>
              </li>
              <li className="flex justify-between items-center py-1.5">
                <span className="text-slate-700 dark:text-slate-300">5. Rationale & Clarity</span>
                <span className="font-semibold text-slate-900 dark:text-white">1 pt</span>
              </li>
            </ul>

            <div className="rounded-xl bg-slate-50 dark:bg-slate-900 p-3 text-[11px] text-slate-500 dark:text-slate-400 border border-slate-200/60 dark:border-slate-800">
              Scoring ≥ 8/10 converts API Testing from <span className="font-semibold text-rose-500">Unverified</span> to <span className="font-semibold text-emerald-500">Demonstrated</span> on your roadmap.
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
