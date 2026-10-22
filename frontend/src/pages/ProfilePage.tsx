import { useState, useEffect } from 'react';
import type { FormEvent } from 'react';
import { Plus, ExternalLink, Save, Upload, FileText, CheckCircle2, Cloud, Zap } from 'lucide-react';
import { api } from '../services/api';
import type { UserProfile, SkillEvidence, ResumeUploadResponse } from '../types';

interface ProfilePageProps {
  setActiveTab?: (tab: string) => void;
}

export default function ProfilePage({ setActiveTab: _setActiveTab }: ProfilePageProps) {
  const [profile, setProfile] = useState<UserProfile>({
    user_id: 'demo_user',
    name: 'Demo Learner',
    target_role: 'Junior Backend Developer',
    education: 'B.Sc. in Computer Science',
    skills: 'Python, Django REST Framework, PostgreSQL, Git',
    resume_file: null
  });

  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [isUploading, setIsUploading] = useState<boolean>(false);
  const [uploadMessage, setUploadMessage] = useState<string>('');
  const [uploadResult, setUploadResult] = useState<ResumeUploadResponse | null>(null);

  const [evidenceList, setEvidenceList] = useState<SkillEvidence[]>([
    {
      id: 'evi_001',
      skill_name: 'Django REST Framework',
      title: 'E-Commerce Order Management API',
      reference: 'https://github.com/alex-morgan/order-api-django',
      status: 'verified'
    }
  ]);

  useEffect(() => {
    api.getProfile('demo_user')
      .then((data) => {
        if (data) {
          setProfile(data);
          if (data.evidence && data.evidence.length > 0) {
            setEvidenceList(data.evidence);
          }
        }
      })
      .catch((err) => {
        console.warn('Could not load profile from backend:', err);
      });
  }, []);

  const handleResumeUpload = async (e: FormEvent) => {
    e.preventDefault();
    if (!selectedFile) return;

    setIsUploading(true);
    setUploadMessage('');
    setUploadResult(null);
    try {
      const res = await api.uploadResume(selectedFile, profile.user_id || 'demo_user');
      setUploadResult(res);
      setUploadMessage(res.message || `Uploaded: ${selectedFile.name}`);
      if (res.profile) {
        setProfile(res.profile);
        if (res.profile.evidence && res.profile.evidence.length > 0) {
          setEvidenceList(res.profile.evidence);
        }
      }
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Upload failed';
      setUploadMessage(`Upload failed: ${message}`);
    } finally {
      setIsUploading(false);
    }
  };


  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Learner Career Profile & Evidence</h1>
        <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 mt-1">
          Feature 1 (Member 1) — Manage profile, upload CV/Resume for RAG embedding evidence, and link projects.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Profile Details & CV Upload */}
        <div className="lg:col-span-1 space-y-6">
          <div className="rounded-2xl border border-slate-200/90 dark:border-slate-800/80 bg-white dark:bg-[#0e131f] p-6 space-y-4 shadow-xs">
            <div className="flex items-center gap-3 pb-3 border-b border-slate-100 dark:border-slate-800/80">
              <div className="w-12 h-12 rounded-full bg-slate-900 dark:bg-slate-100 text-white dark:text-slate-900 flex items-center justify-center font-bold text-sm shadow-xs">
                AM
              </div>
              <div>
                <h2 className="text-base font-semibold text-slate-900 dark:text-white">{profile.name}</h2>
                <p className="text-xs text-slate-500 dark:text-slate-400 font-medium">{profile.target_role}</p>
              </div>
            </div>

            <form className="space-y-3" onSubmit={(e) => e.preventDefault()}>
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">Full Name</label>
                <input
                  type="text"
                  className="w-full rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 px-3 py-2 text-xs text-slate-900 dark:text-white focus:border-slate-500 focus:outline-none"
                  value={profile.name}
                  onChange={(e) => setProfile({ ...profile, name: e.target.value })}
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">Target Role</label>
                <input
                  type="text"
                  className="w-full rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 px-3 py-2 text-xs text-slate-900 dark:text-white focus:border-slate-500 focus:outline-none"
                  value={profile.target_role}
                  onChange={(e) => setProfile({ ...profile, target_role: e.target.value })}
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">Education</label>
                <input
                  type="text"
                  className="w-full rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 px-3 py-2 text-xs text-slate-900 dark:text-white focus:border-slate-500 focus:outline-none"
                  value={profile.education}
                  onChange={(e) => setProfile({ ...profile, education: e.target.value })}
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">Self-reported Skills</label>
                <textarea
                  rows={2}
                  className="w-full rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 px-3 py-2 text-xs text-slate-900 dark:text-white focus:border-slate-500 focus:outline-none"
                  value={typeof profile.skills === 'string' ? profile.skills : profile.skills.join(', ')}
                  onChange={(e) => setProfile({ ...profile, skills: e.target.value })}
                />
              </div>

              {/* Goal Context Fields */}
              <div className="grid grid-cols-2 gap-2 pt-2 border-t border-slate-100 dark:border-slate-800/80">
                <div>
                  <label className="block text-[11px] font-semibold text-slate-600 dark:text-slate-400 mb-1">Target Window</label>
                  <input
                    type="text"
                    defaultValue="14 days"
                    className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 px-2.5 py-1.5 text-xs text-slate-900 dark:text-white focus:outline-none"
                    placeholder="e.g. 14 days"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-semibold text-slate-600 dark:text-slate-400 mb-1">Study Capacity</label>
                  <input
                    type="text"
                    defaultValue="14 hrs / week"
                    className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 px-2.5 py-1.5 text-xs text-slate-900 dark:text-white focus:outline-none"
                    placeholder="e.g. 14 hrs/week"
                  />
                </div>
              </div>

              <button
                type="button"
                className="w-full flex items-center justify-center gap-2 rounded-xl bg-slate-900 dark:bg-white px-4 py-2 text-xs font-semibold text-white dark:text-slate-900 hover:bg-slate-800 dark:hover:bg-slate-100 transition-colors shadow-xs"
              >
                <Save className="w-3.5 h-3.5" /> Save Profile
              </button>
            </form>
          </div>

          {/* Resume / CV Upload Section */}
          <div className="rounded-2xl border border-slate-200/90 dark:border-slate-800/80 bg-white dark:bg-[#0e131f] p-6 space-y-4 shadow-xs">
            <div className="flex items-center gap-2 text-sm font-semibold text-slate-900 dark:text-white">
              <FileText className="w-4 h-4 text-slate-600 dark:text-slate-300" /> Upload CV / Resume (RAG Evidence)
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Upload your CV (.pdf, .docx, .txt). The system parses and indexes evidence using RAG embeddings.
            </p>

            <form onSubmit={handleResumeUpload} className="space-y-3">
              <input
                type="file"
                accept=".pdf,.docx,.txt"
                onChange={(e) => setSelectedFile(e.target.files ? e.target.files[0] : null)}
                className="block w-full text-xs text-slate-500 file:mr-3 file:py-1.5 file:px-3 file:rounded-lg file:border-0 file:text-xs file:font-semibold file:bg-slate-100 dark:file:bg-slate-800 file:text-slate-800 dark:file:text-slate-200 hover:file:bg-slate-200 dark:hover:file:bg-slate-700"
              />

              <button
                type="submit"
                disabled={!selectedFile || isUploading}
                className="w-full flex items-center justify-center gap-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/80 px-4 py-2 text-xs font-semibold text-slate-800 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 disabled:opacity-50 transition-colors"
              >
                <Upload className="w-3.5 h-3.5" />
                {isUploading ? 'Uploading & Indexing...' : 'Upload & Parse CV'}
              </button>

              {uploadMessage && (
                <div className="text-xs text-slate-800 dark:text-slate-200 bg-slate-100 dark:bg-slate-900 p-2.5 rounded-lg border border-slate-200 dark:border-slate-800">
                  {uploadMessage}
                </div>
              )}

              {uploadResult?.s3?.success && (
                <div className="rounded-xl border border-emerald-500/30 bg-emerald-50 dark:bg-emerald-950/20 p-3 space-y-2 text-xs animate-in fade-in">
                  <div className="flex items-center gap-1.5 font-semibold text-emerald-600 dark:text-emerald-400">
                    <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                    <span>Cloud Pipeline Activated</span>
                  </div>
                  <div className="space-y-1.5 text-slate-600 dark:text-slate-300 pt-1 border-t border-emerald-200 dark:border-emerald-900/40">
                    <div className="flex items-start gap-1.5 text-[11px]">
                      <Cloud className="w-3.5 h-3.5 text-cyan-500 shrink-0 mt-0.5" />
                      <div>
                        <span className="text-slate-400 block text-[10px]">Amazon S3 Storage:</span>
                        <span className="font-mono text-cyan-600 dark:text-cyan-300 break-all">{uploadResult.s3.s3_url}</span>
                      </div>
                    </div>
                    {uploadResult.sqs?.success && (
                      <div className="flex items-start gap-1.5 text-[11px]">
                        <Zap className="w-3.5 h-3.5 text-amber-500 shrink-0 mt-0.5" />
                        <div>
                          <span className="text-slate-400 block text-[10px]">Amazon SQS Queue ➔ Lambda:</span>
                          <span className="font-mono text-amber-600 dark:text-amber-300">{uploadResult.sqs.message_id}</span>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </form>
          </div>
        </div>

        {/* Evidence List */}
        <div className="lg:col-span-2 rounded-2xl border border-slate-200/90 dark:border-slate-800/80 bg-white dark:bg-[#0e131f] p-6 space-y-4 shadow-xs">
          <div className="flex justify-between items-center pb-3 border-b border-slate-100 dark:border-slate-800/80">
            <div>
              <h2 className="text-base font-semibold text-slate-900 dark:text-white">Project Evidence Records</h2>
              <p className="text-xs text-slate-500 dark:text-slate-400">Repositories, CV claims, or artifacts proving demonstrated skill.</p>
            </div>
            <button
              type="button"
              className="flex items-center gap-1.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/80 px-3 py-1.5 text-xs font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800"
            >
              <Plus className="w-3.5 h-3.5" /> Add Evidence Link
            </button>
          </div>

          <div className="space-y-3">
            {evidenceList.map((item, idx) => (
              <div key={item.evidence_id || item.id || `evi-${idx}`} className="rounded-xl border border-slate-200/80 dark:border-slate-800/80 bg-slate-50/70 dark:bg-slate-950/60 p-4 space-y-2">
                <div className="flex justify-between items-start">
                  <div>
                    <span className="text-xs font-bold text-slate-900 dark:text-white uppercase tracking-wide">
                      {item.skill_name}
                    </span>
                    <h3 className="text-sm font-semibold text-slate-800 dark:text-slate-200">{item.title}</h3>
                  </div>
                  <span className="text-[10px] font-semibold uppercase px-2.5 py-0.5 rounded-full bg-emerald-50 dark:bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-500/30">
                    {item.status}
                  </span>
                </div>

                {item.reference && (
                  <a
                    href={item.reference}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-1 text-xs text-indigo-600 dark:text-cyan-400 hover:underline"
                  >
                    <ExternalLink className="w-3.5 h-3.5" /> {item.reference}
                  </a>
                )}
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
