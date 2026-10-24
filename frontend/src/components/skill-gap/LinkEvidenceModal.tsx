import { useState, useEffect } from 'react';
import type { FormEvent } from 'react';
import { X, Link2, CheckCircle2, ShieldCheck, FolderGit2 } from 'lucide-react';
import type { SkillEvidence } from '../../types';

interface LinkEvidenceModalProps {
  initialSkillName?: string;
  isOpen: boolean;
  onClose: () => void;
  onSubmitEvidence: (evidence: Omit<SkillEvidence, 'id' | 'evidence_id'>) => Promise<void>;
  availableSkills: string[];
}

export default function LinkEvidenceModal({
  initialSkillName,
  isOpen,
  onClose,
  onSubmitEvidence,
  availableSkills
}: LinkEvidenceModalProps) {
  const [skillName, setSkillName] = useState(initialSkillName || '');
  const [title, setTitle] = useState('');
  const [reference, setReference] = useState('');
  const [evidenceType, setEvidenceType] = useState<'project' | 'self_reported' | 'assessment'>('project');
  const [reviewStatus, setReviewStatus] = useState<'verified' | 'unverified' | 'needs_improvement'>('verified');
  const [description, setDescription] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [successMessage, setSuccessMessage] = useState('');

  useEffect(() => {
    if (initialSkillName) {
      setSkillName(initialSkillName);
    }
  }, [initialSkillName]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    if (isOpen) {
      window.addEventListener('keydown', handleKeyDown);
    }
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!skillName || !title) return;

    setIsSubmitting(true);
    try {
      await onSubmitEvidence({
        skill_name: skillName,
        title,
        reference,
        evidence_type: evidenceType,
        review_status: reviewStatus,
        description
      });
      setSuccessMessage(`Successfully linked evidence for ${skillName}!`);
      setTimeout(() => {
        setSuccessMessage('');
        setIsSubmitting(false);
        onClose();
      }, 1000);
    } catch {
      setIsSubmitting(false);
    }
  };

  const fillQuickPreset = (preset: {
    title: string;
    ref: string;
    desc: string;
    type: 'project' | 'self_reported' | 'assessment';
    status: 'verified' | 'unverified' | 'needs_improvement';
  }) => {
    setTitle(preset.title);
    setReference(preset.ref);
    setDescription(preset.desc);
    setEvidenceType(preset.type);
    setReviewStatus(preset.status);
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-200"
      role="dialog"
      aria-modal="true"
      aria-labelledby="link-evidence-title"
    >
      <div
        className="w-full max-w-xl max-h-[90vh] overflow-y-auto rounded-3xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#0e131f] shadow-2xl p-6 space-y-5"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-indigo-500/10 text-indigo-600 dark:text-cyan-400">
              <Link2 className="w-5 h-5" />
            </div>
            <div>
              <h2 id="link-evidence-title" className="text-lg font-bold text-slate-900 dark:text-white">
                Link Supporting Evidence
              </h2>
              <span className="text-xs text-slate-500 dark:text-slate-400">
                Connect code repositories, tests, or certificates to verify target requirements
              </span>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-xl text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
            aria-label="Close dialog"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Quick Demo Presets */}
        <div className="p-3 rounded-2xl bg-slate-50 dark:bg-slate-950/70 border border-slate-200/80 dark:border-slate-800/80 space-y-2">
          <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">
            Quick Fill Presets (Test Live Deterministic Matching):
          </span>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() =>
                fillQuickPreset({
                  title: 'PostgreSQL Relational Schema & Query Optimization',
                  ref: 'https://github.com/alex-morgan/postgres-store-schema',
                  desc: 'Production schema with foreign keys, composite indexes, B-tree search, and ACID transaction tests.',
                  type: 'project',
                  status: 'verified'
                })
              }
              className="text-[11px] font-semibold px-2.5 py-1 rounded-lg bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 hover:border-indigo-400 transition-colors"
            >
              + Verified PostgreSQL Repo
            </button>
            <button
              type="button"
              onClick={() =>
                fillQuickPreset({
                  title: 'REST API Pytest & Postman Automated Test Suite',
                  ref: 'https://github.com/alex-morgan/api-test-suite',
                  desc: 'End-to-end integration test runner validating 40+ endpoints, status codes, and schema validation.',
                  type: 'project',
                  status: 'verified'
                })
              }
              className="text-[11px] font-semibold px-2.5 py-1 rounded-lg bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 hover:border-indigo-400 transition-colors"
            >
              + Verified API Test Suite
            </button>
          </div>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Skill Selector */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
              Target Skill Requirement *
            </label>
            <select
              value={skillName}
              onChange={e => setSkillName(e.target.value)}
              className="w-full text-xs rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 p-2.5 text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-indigo-500"
              required
            >
              <option value="">Select a skill requirement...</option>
              {availableSkills.map((s, idx) => (
                <option key={idx} value={s}>
                  {s}
                </option>
              ))}
            </select>
          </div>

          {/* Evidence Title */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
              Evidence Title / Project Name *
            </label>
            <input
              type="text"
              value={title}
              onChange={e => setTitle(e.target.value)}
              placeholder="e.g. Order Processing Relational Database Schema"
              className="w-full text-xs rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 p-2.5 text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-indigo-500"
              required
            />
          </div>

          {/* Reference URL */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
              Artifact Reference URL (GitHub Repository, PR, or Cert)
            </label>
            <div className="relative">
              <input
                type="url"
                value={reference}
                onChange={e => setReference(e.target.value)}
                placeholder="https://github.com/username/project"
                className="w-full text-xs rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 p-2.5 text-slate-800 dark:text-slate-100 pl-8 focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
              <FolderGit2 className="w-4 h-4 text-slate-400 absolute left-2.5 top-3" />
            </div>
          </div>

          {/* Evidence Type & Review Status */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Evidence Type
              </label>
              <select
                value={evidenceType}
                onChange={e => setEvidenceType(e.target.value as any)}
                className="w-full text-xs rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 p-2.5 text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-indigo-500"
              >
                <option value="project">Project Repository / Code</option>
                <option value="assessment">Verified Assessment</option>
                <option value="self_reported">Self-Reported Claim</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Review Status
              </label>
              <select
                value={reviewStatus}
                onChange={e => setReviewStatus(e.target.value as any)}
                className="w-full text-xs rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 p-2.5 text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-indigo-500"
              >
                <option value="verified">Verified (Demonstrated)</option>
                <option value="unverified">Unverified (Pending Review)</option>
                <option value="needs_improvement">Needs Improvement</option>
              </select>
            </div>
          </div>

          {/* Description */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
              Description & Verification Notes
            </label>
            <textarea
              rows={2}
              value={description}
              onChange={e => setDescription(e.target.value)}
              placeholder="Describe how this project demonstrates mastery of the skill..."
              className="w-full text-xs rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 p-2.5 text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>

          {/* Success Message Banner */}
          {successMessage && (
            <div className="p-3 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200/80 dark:border-emerald-800/80 text-xs text-emerald-700 dark:text-emerald-300 flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" />
              <span>{successMessage}</span>
            </div>
          )}

          {/* Submit Actions */}
          <div className="flex justify-end gap-2.5 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs font-semibold rounded-xl border border-slate-300 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300 transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting || !title || !skillName}
              className="px-5 py-2 text-xs font-semibold rounded-xl bg-slate-900 dark:bg-white text-white dark:text-slate-900 hover:bg-slate-800 dark:hover:bg-slate-100 disabled:opacity-50 transition-colors shadow-xs flex items-center gap-1.5"
            >
              <ShieldCheck className="w-3.5 h-3.5" />
              <span>{isSubmitting ? 'Linking Evidence...' : 'Save & Recalculate Match'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
