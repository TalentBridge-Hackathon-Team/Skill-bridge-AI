import { useState, useEffect } from 'react';
import type { FormEvent, ChangeEvent } from 'react';
import {
  Plus, ExternalLink, Save, Upload, FileText,
  CheckCircle2, Cloud, Zap, Trash2, AlertCircle, X
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { api } from '../services/api';
import type { UserProfile, SkillEvidence, ResumeUploadResponse, ProjectDescription } from '../types';

// ---------------------------------------------------------------------------
// Mock fixture used when backend is unavailable
// ---------------------------------------------------------------------------
const MOCK_PROFILE: UserProfile = {
  user_id: 'demo_user',
  name: 'Alex Morgan',
  target_role: 'Junior Backend Developer',  // demo user intentionally has a role for showcase
  education: 'B.Sc. in Computer Science',
  experience_level: 'Entry Level',
  skills: ['Python', 'Django REST Framework', 'PostgreSQL', 'Git'],
  professional_background:
    'Two years of freelance web development, building REST APIs for small e-commerce clients using Django and FastAPI.',
  project_descriptions: [
    {
      project_id: 'proj_001',
      title: 'E-Commerce Order Management API',
      description: 'Full CRUD REST API with JWT auth and PostgreSQL backend.',
      link: 'https://github.com/[username]/order-api-django',
      skills_demonstrated: ['Django REST Framework', 'PostgreSQL', 'JWT'],
    },
  ],
  target_date: '2026-12-31',
  study_capacity_hours_per_week: 14,
  resume_file: null,
};

const MOCK_EVIDENCE: SkillEvidence[] = [
  {
    id: 'evi_001',
    skill_name: 'Django REST Framework',
    title: 'E-Commerce Order Management API',
    reference: 'https://github.com/[username]/order-api-django',
    review_status: 'verified',
  },
];

// ---------------------------------------------------------------------------
// Validation helpers
// ---------------------------------------------------------------------------
function validateProfile(p: UserProfile): Record<string, string> {
  const errors: Record<string, string> = {};
  if (!p.name.trim()) errors.name = 'Name is required.';
  if (!p.target_role.trim()) errors.target_role = 'Please enter your target role before saving.';
  const skills = typeof p.skills === 'string' ? p.skills : p.skills.join(', ');
  if (!skills.trim()) errors.skills = 'At least one skill is required.';
  if (p.study_capacity_hours_per_week !== undefined) {
    const h = Number(p.study_capacity_hours_per_week);
    if (isNaN(h) || h < 1 || h > 168) errors.study_capacity_hours_per_week = 'Enter hours between 1 and 168.';
  }
  return errors;
}

function validateProject(p: Partial<ProjectDescription>): Record<string, string> {
  const errors: Record<string, string> = {};
  if (!p.title?.trim()) errors.title = 'Title is required.';
  if (p.link && !/^https?:\/\/.+/.test(p.link)) errors.link = 'Must be a valid URL starting with http(s)://';
  return errors;
}

// ---------------------------------------------------------------------------
// Empty project template
// ---------------------------------------------------------------------------
const emptyProject = (): ProjectDescription => ({
  project_id: `proj_${Date.now()}`,
  title: '',
  description: '',
  link: '',
  skills_demonstrated: [],
});

interface ProfilePageProps {
  setActiveTab?: (tab: string) => void;
}

export default function ProfilePage({ setActiveTab: _setActiveTab }: ProfilePageProps) {
  const { user, isLoading: authLoading } = useAuth();
  // Only treat as demo if auth has finished loading and there is genuinely no real user
  const currentUserId = !authLoading && user ? String(user.id) : 'demo_user';
  const isDemo = authLoading || !user || currentUserId === 'demo_user' || user.username === 'demo';

  const [profile, setProfile] = useState<UserProfile>(() => {
    if (!isDemo) {
      return {
        user_id: currentUserId,
        name: user?.full_name || user?.username || '',
        target_role: '',
        education: '',
        experience_level: '',
        skills: [],
        professional_background: '',
        project_descriptions: [],
        target_date: '',
        study_capacity_hours_per_week: 14,
        resume_file: null,
      };
    }
    return {
      ...MOCK_PROFILE,
      user_id: currentUserId,
      name: user?.full_name || user?.username || MOCK_PROFILE.name,
    };
  });
  const [evidenceList, setEvidenceList] = useState<SkillEvidence[]>(isDemo ? MOCK_EVIDENCE : []);

  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');
  const [saveMessage, setSaveMessage] = useState('');

  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadMessage, setUploadMessage] = useState('');
  const [uploadResult, setUploadResult] = useState<ResumeUploadResponse | null>(null);

  // Project form state
  const [showProjectForm, setShowProjectForm] = useState(false);
  const [editingProject, setEditingProject] = useState<ProjectDescription>(emptyProject());
  const [projectErrors, setProjectErrors] = useState<Record<string, string>>({});
  const [projectSkillInput, setProjectSkillInput] = useState('');

  // Evidence form state
  const [showEvidenceForm, setShowEvidenceForm] = useState(false);
  const [newEvidence, setNewEvidence] = useState({ skill_name: '', title: '', reference: '', evidence_type: 'self_reported' });
  const [evidenceSaving, setEvidenceSaving] = useState(false);

  const handleAddEvidence = async () => {
    if (!newEvidence.skill_name.trim() || !newEvidence.title.trim()) return;
    setEvidenceSaving(true);
    try {
      const created = await api.addEvidence({ ...newEvidence, user_id: currentUserId });
      if (created) setEvidenceList(prev => [...prev, created]);
      setNewEvidence({ skill_name: '', title: '', reference: '', evidence_type: 'self_reported' });
      setShowEvidenceForm(false);
    } catch {
      // keep form open so user can retry
    } finally {
      setEvidenceSaving(false);
    }
  };

  // Load from backend on mount or when user changes
  useEffect(() => {
    if (authLoading || !user) return; // wait for auth before fetching
    api.getProfile(currentUserId)
      .then((data) => {
        if (data) {
          const mergedData: UserProfile = {
            ...data,
            // Never show a stale demo name for a real user
            name: (data.name && !['Demo User', 'Demo Learner', 'Alex Morgan', ''].includes(data.name))
              ? data.name
              : (user?.full_name || user?.username || data.name || ''),
            // Never show the preset role — if DB has it, treat as unset
            target_role: (data.target_role === 'Junior Backend Developer' && !isDemo)
              ? ''
              : (data.target_role || ''),
            user_id: currentUserId,
          };
          setProfile(mergedData);
          if (data.evidence?.length) setEvidenceList(data.evidence);
        }
      })
      .catch(() => {
        if (user) {
          setProfile((prev) => ({
            ...prev,
            user_id: currentUserId,
            name: user.full_name || user.username || prev.name,
          }));
        }
      });
  }, [currentUserId, user, authLoading]);

  // -------------------------------------------------------------------------
  // Profile save
  // -------------------------------------------------------------------------
  const handleSaveProfile = async () => {
    const errors = validateProfile(profile);
    if (Object.keys(errors).length) {
      setFieldErrors(errors);
      return;
    }
    setFieldErrors({});
    setSaveStatus('saving');
    try {
      const payload: Partial<UserProfile> = {
        ...profile,
        user_id: currentUserId,
        study_capacity_hours_per_week: Number(profile.study_capacity_hours_per_week) || 10,
      };
      if (typeof payload.resume_file === 'string' || payload.resume_file === null) {
        delete (payload as any).resume_file;
      }
      delete (payload as any).evidence;

      const saved = await api.updateProfile(payload);
      setProfile({
        ...saved,
        user_id: currentUserId,
      });
      setSaveStatus('saved');
      setSaveMessage('Profile saved successfully.');
    } catch (err: unknown) {
      console.error('Failed to update profile:', err);
      const msg = err instanceof Error ? err.message : 'Please check required fields.';
      setSaveStatus('error');
      setSaveMessage(`Save failed (${msg}) — changes are stored locally.`);
    }
    setTimeout(() => setSaveStatus('idle'), 4000);
  };

  // -------------------------------------------------------------------------
  // Resume upload
  // -------------------------------------------------------------------------
  const handleResumeUpload = async (e: FormEvent) => {
    e.preventDefault();
    if (!selectedFile) return;
    setIsUploading(true);
    setUploadMessage('');
    setUploadResult(null);
    try {
      const res = await api.uploadResume(selectedFile, currentUserId);
      setUploadResult(res);
      setUploadMessage(res.message || `Uploaded: ${selectedFile.name}`);
      if (res.profile) {
        setProfile(res.profile);
        if (res.profile.evidence?.length) setEvidenceList(res.profile.evidence);
      }
    } catch (err) {
      setUploadMessage(`Upload failed: ${err instanceof Error ? err.message : 'Unknown error'}`);
    } finally {
      setIsUploading(false);
    }
  };

  // -------------------------------------------------------------------------
  // Project management
  // -------------------------------------------------------------------------
  const openAddProject = () => {
    setEditingProject(emptyProject());
    setProjectErrors({});
    setProjectSkillInput('');
    setShowProjectForm(true);
  };

  const openEditProject = (proj: ProjectDescription) => {
    setEditingProject({ ...proj });
    setProjectErrors({});
    setProjectSkillInput('');
    setShowProjectForm(true);
  };

  const handleSaveProject = () => {
    const errors = validateProject(editingProject);
    if (Object.keys(errors).length) {
      setProjectErrors(errors);
      return;
    }
    const existing = profile.project_descriptions ?? [];
    const idx = existing.findIndex((p) => p.project_id === editingProject.project_id);
    const updated = idx >= 0
      ? existing.map((p: ProjectDescription) => p.project_id === editingProject.project_id ? editingProject : p)
      : [...existing, editingProject];
    setProfile({ ...profile, project_descriptions: updated });
    setShowProjectForm(false);
  };

  const handleDeleteProject = (projectId: string) => {
    setProfile({
      ...profile,
      project_descriptions: (profile.project_descriptions ?? []).filter((p) => p.project_id !== projectId),
    });
  };

  const addProjectSkill = () => {
    const s = projectSkillInput.trim();
    if (!s) return;
    const current = editingProject.skills_demonstrated ?? [];
    if (!current.includes(s)) {
      setEditingProject({ ...editingProject, skills_demonstrated: [...current, s] });
    }
    setProjectSkillInput('');
  };

  const removeProjectSkill = (skill: string) => {
    setEditingProject({
      ...editingProject,
      skills_demonstrated: (editingProject.skills_demonstrated ?? []).filter((s: string) => s !== skill),
    });
  };

  // -------------------------------------------------------------------------
  // Field change helper
  // -------------------------------------------------------------------------
  const field = (key: keyof UserProfile) => (e: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    setProfile({ ...profile, [key]: e.target.value });
    if (fieldErrors[key]) setFieldErrors({ ...fieldErrors, [key]: '' });
  };

  const inputCls = (err?: string) =>
    `w-full rounded-xl border ${err ? 'border-red-400 dark:border-red-500' : 'border-slate-300 dark:border-slate-700'} bg-slate-50 dark:bg-slate-950 px-3 py-2 text-xs text-slate-900 dark:text-white focus:outline-none focus:border-slate-500`;

  // -------------------------------------------------------------------------
  // Render
  // -------------------------------------------------------------------------
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Learner Career Profile & Evidence</h1>
        <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 mt-1">
          Manage your profile, self-reported skills, project evidence, and goal parameters.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

        {/* ---------------------------------------------------------------- */}
        {/* Left column: profile form + CV upload                            */}
        {/* ---------------------------------------------------------------- */}
        <div className="lg:col-span-1 space-y-6">

          {/* Profile form */}
          <div className="rounded-2xl border border-slate-200/90 dark:border-slate-800/80 bg-white dark:bg-[#0e131f] p-6 space-y-4 shadow-xs">
            <div className="flex items-center gap-3 pb-3 border-b border-slate-100 dark:border-slate-800/80">
              <div className="w-12 h-12 rounded-full bg-slate-900 dark:bg-slate-100 text-white dark:text-slate-900 flex items-center justify-center font-bold text-sm">
                {profile.name?.charAt(0).toUpperCase() ?? 'U'}
              </div>
              <div>
                <h2 className="text-base font-semibold text-slate-900 dark:text-white">{profile.name}</h2>
                <p className="text-xs text-slate-500 dark:text-slate-400">{profile.target_role}</p>
              </div>
            </div>

            <div className="space-y-3">
              {/* Name */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">Full Name *</label>
                <input type="text" className={inputCls(fieldErrors.name)} value={profile.name} onChange={field('name')} />
                {fieldErrors.name && <p className="text-[11px] text-red-500 mt-0.5">{fieldErrors.name}</p>}
              </div>

              {/* Target role */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">Target Role *</label>
                <input type="text" className={inputCls(fieldErrors.target_role)} value={profile.target_role} placeholder="e.g. Backend Developer, Data Engineer…" onChange={field('target_role')} />
                {fieldErrors.target_role && <p className="text-[11px] text-red-500 mt-0.5">{fieldErrors.target_role}</p>}
              </div>

              {/* Education */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">Education</label>
                <input type="text" className={inputCls()} value={profile.education} onChange={field('education')} />
              </div>

              {/* Self-reported skills */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">Self-reported Skills * <span className="font-normal text-slate-400">(comma-separated)</span></label>
                <textarea
                  rows={2}
                  className={inputCls(fieldErrors.skills)}
                  value={typeof profile.skills === 'string' ? profile.skills : profile.skills.join(', ')}
                  onChange={field('skills')}
                />
                {fieldErrors.skills && <p className="text-[11px] text-red-500 mt-0.5">{fieldErrors.skills}</p>}
              </div>

              {/* Professional background */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">Professional Background</label>
                <textarea
                  rows={3}
                  className={inputCls()}
                  placeholder="Brief summary of work history and relevant experience…"
                  value={profile.professional_background ?? ''}
                  onChange={field('professional_background')}
                />
              </div>



              {/* Save button */}
              <button
                type="button"
                onClick={handleSaveProfile}
                disabled={saveStatus === 'saving'}
                className="w-full flex items-center justify-center gap-2 rounded-xl bg-slate-900 dark:bg-white px-4 py-2 text-xs font-semibold text-white dark:text-slate-900 hover:bg-slate-800 dark:hover:bg-slate-100 disabled:opacity-50 transition-colors"
              >
                <Save className="w-3.5 h-3.5" />
                {saveStatus === 'saving' ? 'Saving…' : 'Save Profile'}
              </button>

              {saveMessage && (
                <p className={`text-[11px] text-center ${saveStatus === 'error' ? 'text-red-500' : 'text-emerald-600 dark:text-emerald-400'}`}>
                  {saveMessage}
                </p>
              )}
            </div>
          </div>

          {/* CV Upload */}
          <div className="rounded-2xl border border-slate-200/90 dark:border-slate-800/80 bg-white dark:bg-[#0e131f] p-6 space-y-4 shadow-xs">
            <div className="flex items-center gap-2 text-sm font-semibold text-slate-900 dark:text-white">
              <FileText className="w-4 h-4 text-slate-600 dark:text-slate-300" /> Upload CV / Resume
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Upload your resume (.pdf, .docx, or .txt) to automatically extract your skills, experience, and projects.
            </p>
            <form onSubmit={handleResumeUpload} className="space-y-3">
              {!selectedFile ? (
                <input
                  type="file"
                  accept=".pdf,.docx,.txt"
                  onChange={(e) => setSelectedFile(e.target.files?.[0] ?? null)}
                  className="block w-full text-xs text-slate-500 file:mr-3 file:py-1.5 file:px-3 file:rounded-lg file:border-0 file:text-xs file:font-semibold file:bg-slate-100 dark:file:bg-slate-800 file:text-slate-800 dark:file:text-slate-200 cursor-pointer"
                />
              ) : (
                <div className="flex items-center justify-between p-3 rounded-xl border border-indigo-200 dark:border-indigo-800 bg-indigo-50/50 dark:bg-indigo-950/30 text-xs">
                  <div className="flex items-center gap-2 truncate text-slate-800 dark:text-slate-200">
                    <FileText className="w-4 h-4 text-indigo-500 shrink-0" />
                    <span className="font-semibold truncate">{selectedFile.name}</span>
                    <span className="text-[10px] text-slate-400 shrink-0">
                      ({(selectedFile.size / 1024).toFixed(1)} KB)
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      setSelectedFile(null);
                      setUploadMessage('');
                    }}
                    className="flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-semibold text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/40 border border-rose-200 dark:border-rose-800 transition-colors ml-2 shrink-0"
                    title="Cancel and remove selected file"
                  >
                    <X className="w-3.5 h-3.5" />
                    <span>Cancel</span>
                  </button>
                </div>
              )}

              <div className="flex items-center gap-2">
                <button
                  type="submit"
                  disabled={!selectedFile || isUploading}
                  className="flex-1 flex items-center justify-center gap-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-900 dark:bg-white text-white dark:text-slate-900 px-4 py-2 text-xs font-semibold disabled:opacity-50 transition-colors hover:bg-slate-800 dark:hover:bg-slate-100"
                >
                  <Upload className="w-3.5 h-3.5" />
                  {isUploading ? 'Uploading…' : 'Upload & Parse CV'}
                </button>
                {selectedFile && (
                  <button
                    type="button"
                    onClick={() => {
                      setSelectedFile(null);
                      setUploadMessage('');
                    }}
                    disabled={isUploading}
                    className="px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 text-xs font-semibold text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                  >
                    Cancel
                  </button>
                )}
              </div>

              {uploadMessage && (
                <div className="text-xs bg-slate-100 dark:bg-slate-900 p-2.5 rounded-lg border border-slate-200 dark:border-slate-800">
                  {uploadMessage}
                </div>
              )}

              {uploadResult?.s3?.success && (
                <div className="rounded-xl border border-emerald-500/30 bg-emerald-50 dark:bg-emerald-950/20 p-3 space-y-2 text-xs">
                  <div className="flex items-center gap-1.5 font-semibold text-emerald-600 dark:text-emerald-400">
                    <CheckCircle2 className="w-4 h-4" /> Cloud Pipeline Activated
                  </div>
                  <div className="space-y-1 text-[11px] text-slate-600 dark:text-slate-300 pt-1 border-t border-emerald-200 dark:border-emerald-900/40">
                    <div className="flex items-start gap-1.5">
                      <Cloud className="w-3.5 h-3.5 text-cyan-500 shrink-0 mt-0.5" />
                      <span className="font-mono text-cyan-600 dark:text-cyan-300 break-all">{uploadResult.s3.s3_url}</span>
                    </div>
                    {uploadResult.sqs?.success && (
                      <div className="flex items-start gap-1.5">
                        <Zap className="w-3.5 h-3.5 text-amber-500 shrink-0 mt-0.5" />
                        <span className="font-mono text-amber-600 dark:text-amber-300">{uploadResult.sqs.message_id}</span>
                      </div>
                    )}
                  </div>
                  <p className="text-slate-600 dark:text-slate-300 text-[11px] leading-relaxed">
                    Your skills and background are saved to your profile and ready for job matching.
                  </p>
                </div>
              )}
            </form>
          </div>
        </div>

        {/* ---------------------------------------------------------------- */}
        {/* Right column: project evidence + skill evidence list             */}
        {/* ---------------------------------------------------------------- */}
        <div className="lg:col-span-2 space-y-6">

          {/* Project descriptions */}
          <div className="rounded-2xl border border-slate-200/90 dark:border-slate-800/80 bg-white dark:bg-[#0e131f] p-6 space-y-4 shadow-xs">
            <div className="flex justify-between items-center pb-3 border-b border-slate-100 dark:border-slate-800/80">
              <div>
                <h2 className="text-base font-semibold text-slate-900 dark:text-white">Project Evidence</h2>
                <p className="text-xs text-slate-500 dark:text-slate-400">Repositories, live demos, or artifacts that prove demonstrated skills.</p>
              </div>
              <button
                type="button"
                onClick={openAddProject}
                className="flex items-center gap-1.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/80 px-3 py-1.5 text-xs font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800"
              >
                <Plus className="w-3.5 h-3.5" /> Add Project
              </button>
            </div>

            {/* Inline project form */}
            {showProjectForm && (
              <div className="rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900/60 p-4 space-y-3">
                <div className="flex justify-between items-center">
                  <span className="text-xs font-semibold text-slate-800 dark:text-slate-200">
                    {editingProject.project_id && (profile.project_descriptions ?? []).some(p => p.project_id === editingProject.project_id)
                      ? 'Edit Project' : 'New Project'}
                  </span>
                  <button type="button" onClick={() => setShowProjectForm(false)} className="text-slate-400 hover:text-slate-600">
                    <X className="w-4 h-4" />
                  </button>
                </div>

                <div>
                  <label className="block text-[11px] font-semibold text-slate-600 dark:text-slate-400 mb-1">Title *</label>
                  <input
                    type="text"
                    className={inputCls(projectErrors.title)}
                    value={editingProject.title}
                    onChange={(e) => { setEditingProject({ ...editingProject, title: e.target.value }); setProjectErrors({ ...projectErrors, title: '' }); }}
                  />
                  {projectErrors.title && <p className="text-[11px] text-red-500 mt-0.5">{projectErrors.title}</p>}
                </div>

                <div>
                  <label className="block text-[11px] font-semibold text-slate-600 dark:text-slate-400 mb-1">Description</label>
                  <textarea
                    rows={2}
                    className={inputCls()}
                    value={editingProject.description ?? ''}
                    onChange={(e) => setEditingProject({ ...editingProject, description: e.target.value })}
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-semibold text-slate-600 dark:text-slate-400 mb-1">Link / URL</label>
                  <input
                    type="url"
                    className={inputCls(projectErrors.link)}
                    placeholder="https://github.com/..."
                    value={editingProject.link ?? ''}
                    onChange={(e) => { setEditingProject({ ...editingProject, link: e.target.value }); setProjectErrors({ ...projectErrors, link: '' }); }}
                  />
                  {projectErrors.link && <p className="text-[11px] text-red-500 mt-0.5">{projectErrors.link}</p>}
                </div>

                <div>
                  <label className="block text-[11px] font-semibold text-slate-600 dark:text-slate-400 mb-1">Skills Demonstrated</label>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      className="flex-1 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 px-2.5 py-1.5 text-xs text-slate-900 dark:text-white focus:outline-none"
                      placeholder="Type a skill and press Add"
                      value={projectSkillInput}
                      onChange={(e) => setProjectSkillInput(e.target.value)}
                      onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addProjectSkill(); } }}
                    />
                    <button type="button" onClick={addProjectSkill} className="rounded-lg bg-slate-200 dark:bg-slate-700 px-3 py-1.5 text-xs font-semibold text-slate-800 dark:text-slate-200">
                      Add
                    </button>
                  </div>
                  <div className="flex flex-wrap gap-1.5 mt-2">
                    {(editingProject.skills_demonstrated ?? []).map((s) => (
                      <span key={s} className="flex items-center gap-1 rounded-full bg-slate-100 dark:bg-slate-800 px-2 py-0.5 text-[11px] text-slate-700 dark:text-slate-300">
                        {s}
                        <button type="button" onClick={() => removeProjectSkill(s)} className="text-slate-400 hover:text-red-500">
                          <X className="w-3 h-3" />
                        </button>
                      </span>
                    ))}
                  </div>
                </div>

                <div className="flex gap-2 pt-1">
                  <button
                    type="button"
                    onClick={handleSaveProject}
                    className="flex-1 rounded-xl bg-slate-900 dark:bg-white px-3 py-2 text-xs font-semibold text-white dark:text-slate-900 hover:bg-slate-800 dark:hover:bg-slate-100"
                  >
                    Save Project
                  </button>
                  <button
                    type="button"
                    onClick={() => setShowProjectForm(false)}
                    className="rounded-xl border border-slate-300 dark:border-slate-700 px-3 py-2 text-xs font-semibold text-slate-600 dark:text-slate-300"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            )}

            {/* Project list */}
            <div className="space-y-3">
              {(profile.project_descriptions ?? []).length === 0 && !showProjectForm && (
                <p className="text-xs text-slate-400 dark:text-slate-500 py-4 text-center">No projects yet. Click "Add Project" to log your first one.</p>
              )}
              {(profile.project_descriptions ?? []).map((proj) => (
                <div
                  key={proj.project_id}
                  className="flex items-start justify-between gap-3 rounded-xl border border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/40 p-3"
                >
                  <div className="min-w-0 space-y-1">
                    <p className="text-xs font-semibold text-slate-900 dark:text-white truncate">{proj.title}</p>
                    {proj.description && (
                      <p className="text-[11px] text-slate-500 dark:text-slate-400 line-clamp-2">{proj.description}</p>
                    )}
                    {proj.link && (
                      <a
                        href={proj.link}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex items-center gap-1 text-[11px] text-blue-500 hover:underline"
                      >
                        <ExternalLink className="w-3 h-3" /> {proj.link}
                      </a>
                    )}
                    {(proj.skills_demonstrated ?? []).length > 0 && (
                      <div className="flex flex-wrap gap-1 pt-1">
                        {proj.skills_demonstrated!.map((s) => (
                          <span key={s} className="rounded-full bg-slate-200 dark:bg-slate-800 px-2 py-0.5 text-[10px] text-slate-600 dark:text-slate-300">{s}</span>
                        ))}
                      </div>
                    )}
                  </div>
                  <div className="flex gap-1 shrink-0">
                    <button
                      type="button"
                      onClick={() => openEditProject(proj)}
                      className="rounded-lg border border-slate-200 dark:border-slate-700 p-1.5 text-slate-500 hover:text-slate-800 dark:hover:text-white"
                    >
                      <Save className="w-3.5 h-3.5" />
                    </button>
                    <button
                      type="button"
                      onClick={() => handleDeleteProject(proj.project_id!)}
                      className="rounded-lg border border-red-200 dark:border-red-900/40 p-1.5 text-red-400 hover:text-red-600"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Skill evidence list */}
          <div className="rounded-2xl border border-slate-200/90 dark:border-slate-800/80 bg-white dark:bg-[#0e131f] p-6 space-y-4 shadow-xs">
            <div className="flex justify-between items-center pb-3 border-b border-slate-100 dark:border-slate-800/80">
              <div>
                <h2 className="text-base font-semibold text-slate-900 dark:text-white">Skill Evidence Records</h2>
                <p className="text-xs text-slate-500 dark:text-slate-400">Verified or self-reported evidence linked to specific skills.</p>
              </div>
              <button
                type="button"
                onClick={() => setShowEvidenceForm(v => !v)}
                className="flex items-center gap-1.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/80 px-3 py-1.5 text-xs font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800"
              >
                <Plus className="w-3.5 h-3.5" /> Add Evidence
              </button>
            </div>

            {/* Inline evidence entry form */}
            {showEvidenceForm && (
              <div className="rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900/60 p-4 space-y-3">
                <input
                  type="text"
                  placeholder="Skill name *"
                  value={newEvidence.skill_name}
                  onChange={e => setNewEvidence(p => ({ ...p, skill_name: e.target.value }))}
                  className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 px-3 py-1.5 text-xs text-slate-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-indigo-500"
                />
                <input
                  type="text"
                  placeholder="Title / project name *"
                  value={newEvidence.title}
                  onChange={e => setNewEvidence(p => ({ ...p, title: e.target.value }))}
                  className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 px-3 py-1.5 text-xs text-slate-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-indigo-500"
                />
                <input
                  type="url"
                  placeholder="Reference URL (optional)"
                  value={newEvidence.reference}
                  onChange={e => setNewEvidence(p => ({ ...p, reference: e.target.value }))}
                  className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 px-3 py-1.5 text-xs text-slate-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-indigo-500"
                />
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={handleAddEvidence}
                    disabled={evidenceSaving || !newEvidence.skill_name.trim() || !newEvidence.title.trim()}
                    className="px-4 py-1.5 rounded-lg bg-slate-900 dark:bg-white text-white dark:text-slate-900 text-xs font-bold disabled:opacity-50 hover:bg-slate-700 dark:hover:bg-slate-100 transition-colors"
                  >
                    {evidenceSaving ? 'Saving…' : 'Save'}
                  </button>
                  <button
                    type="button"
                    onClick={() => { setShowEvidenceForm(false); setNewEvidence({ skill_name: '', title: '', reference: '', evidence_type: 'self_reported' }); }}
                    className="px-4 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 text-xs font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            )}

            <div className="space-y-2">
              {evidenceList.length === 0 && (
                <p className="text-xs text-slate-400 dark:text-slate-500 py-4 text-center">No evidence records yet. Upload a CV or add evidence manually.</p>
              )}
              {evidenceList.map((item, idx) => (
                <div
                  key={item.evidence_id ?? item.id ?? idx}
                  className="flex items-start justify-between gap-3 rounded-xl border border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/40 p-3"
                >
                  <div className="min-w-0 space-y-0.5">
                    <p className="text-xs font-semibold text-slate-900 dark:text-white truncate">{item.title}</p>
                    <p className="text-[11px] text-slate-500 dark:text-slate-400">{item.skill_name}</p>
                    {item.reference && (
                      <a
                        href={item.reference}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex items-center gap-1 text-[11px] text-blue-500 hover:underline"
                      >
                        <ExternalLink className="w-3 h-3" /> {item.reference}
                      </a>
                    )}
                  </div>
                  <span className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-semibold ${
                    (item.review_status ?? item.status) === 'verified'
                      ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400'
                      : (item.review_status ?? item.status) === 'needs_improvement'
                        ? 'bg-red-100 text-red-600 dark:bg-red-900/30 dark:text-red-400'
                        : 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400'
                  }`}>
                    {item.review_status ?? item.status ?? 'unverified'}
                  </span>
                </div>
              ))}
            </div>
          </div>

        </div>
      </div>

      {/* Validation summary banner */}
      {Object.keys(fieldErrors).length > 0 && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 flex items-center gap-2 rounded-xl bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-800 px-4 py-2.5 shadow-lg text-xs text-red-700 dark:text-red-400">
          <AlertCircle className="w-4 h-4 shrink-0" />
          Please fix the highlighted fields before saving.
        </div>
      )}
    </div>
  );
}
