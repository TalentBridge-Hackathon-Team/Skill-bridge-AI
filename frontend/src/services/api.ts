/**
 * SkillBridge AI - API Client Scaffold (TypeScript)
 * Connects frontend views to Django REST backend endpoints.
 * Aligned with Blueprint 2.0 (Sections 11 & 12)
 */

import type {
  UserProfile,
  JobAnalysis,
  Requirement,
  MatchReport,
  AssessmentTask,
  RoadmapTask,
  Goal,
  FeasibilityAssessment,
  ApplicationChecklistItem,
  ResumeUploadResponse,
  SkillProfileSummary,
} from '../types';

const API_BASE_URL = (import.meta as any).env?.VITE_API_BASE_URL || 'http://127.0.0.1:8000/api';

/** Returns the stored JWT access token, or null if the user is not logged in. */
function getStoredToken(): string | null {
  return localStorage.getItem('sb_access');
}

async function apiFetch<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
  try {
    const isFormData = options.body instanceof FormData;
    const token = getStoredToken();

    const headers: Record<string, string> = {
      ...(isFormData ? {} : { 'Content-Type': 'application/json' }),
      // Attach Bearer token if one is stored
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...((options.headers as Record<string, string>) || {}),
    };

    const res = await fetch(`${API_BASE_URL}${endpoint}`, {
      headers,
      ...options
    });
    if (!res.ok) {
      throw new Error(`HTTP ${res.status}: ${res.statusText}`);
    }
    return await res.json();
  } catch (err) {
    console.error(`API Error on ${endpoint}:`, err);
    throw err;
  }
}

export const api = {
  // Member 1: Profile, Evidence & CV Upload
  getProfile: (userId: string = 'demo_user'): Promise<UserProfile> =>
    apiFetch<UserProfile>(`/profiles/me/?user_id=${userId}`),

  updateProfile: (data: Partial<UserProfile>): Promise<UserProfile> =>
    apiFetch<UserProfile>('/profiles/me/', { method: 'PUT', body: JSON.stringify(data) }),

  addEvidence: (data: Record<string, unknown>): Promise<unknown> =>
    apiFetch('/profiles/me/evidence/', { method: 'POST', body: JSON.stringify(data) }),

  uploadResume: (file: File, userId: string = 'demo_user'): Promise<ResumeUploadResponse> => {
    const formData = new FormData();
    formData.append('file', file);
    formData.append('user_id', userId);
    return apiFetch<ResumeUploadResponse>('/profiles/me/resume/', { method: 'POST', body: formData });
  },


  // Member 2: Mode A (Job-Specific & Deadline-Aware) and Mode B (Goal-Based)
  getSkillProfiles: (): Promise<SkillProfileSummary[]> =>
    apiFetch<SkillProfileSummary[]>('/skill-profiles/'),

  submitJobAnalysis: (data: FormData | { job_text: string; user_id?: string; deadline_date?: string; days_remaining?: number; study_hours_per_week?: number }): Promise<JobAnalysis> => {
    if (data instanceof FormData) {
      return apiFetch<JobAnalysis>('/job-analyses/', { method: 'POST', body: data });
    }
    return apiFetch<JobAnalysis>('/job-analyses/', { method: 'POST', body: JSON.stringify(data) });
  },

  getJobAnalysis: (id: string): Promise<JobAnalysis> =>
    apiFetch<JobAnalysis>(`/job-analyses/${id}/`),

  updateRequirements: (id: string, requirements: Requirement[]): Promise<{ message: string; analysis_id: string }> =>
    apiFetch(`/job-analyses/${id}/requirements/`, { method: 'PATCH', body: JSON.stringify({ requirements }) }),

  // Blueprint 2.0 Goal-Based Mode (Mode B)
  submitGoal: (data: { user_id?: string; goal_type: string; goal_text: string; days_remaining?: number; study_hours_per_week?: number }): Promise<Goal> =>
    apiFetch<Goal>('/goals/', { method: 'POST', body: JSON.stringify(data) }),

  // Member 3: Skill Matching & Feasibility Engine
  runMatching: (analysisId: string): Promise<{ analysis_id: string; role_title: string; results: MatchReport[]; feasibility?: FeasibilityAssessment }> =>
    apiFetch(`/job-analyses/${analysisId}/match/`, { method: 'POST' }),

  getSkillGaps: (analysisId: string): Promise<{ analysis_id: string; results: MatchReport[]; feasibility?: FeasibilityAssessment }> =>
    apiFetch(`/job-analyses/${analysisId}/gaps/`),

  // Member 4: Assessment, Roadmap, Deadline Feasibility & Application Checklist
  getAssessment: (taskId: string): Promise<AssessmentTask> =>
    apiFetch<AssessmentTask>(`/assessments/${taskId}/`),

  submitAssessment: (taskId: string, submission: Record<string, unknown>): Promise<{ task_id: string; message: string }> =>
    apiFetch(`/assessments/${taskId}/submissions/`, { method: 'POST', body: JSON.stringify({ submission }) }),

  getRoadmap: (userId: string = 'demo_user'): Promise<{ user_id: string; tasks: RoadmapTask[]; checklist?: ApplicationChecklistItem[] }> =>
    apiFetch(`/roadmap/?user_id=${userId}`),

  updateRoadmapTask: (taskId: string, status: string): Promise<RoadmapTask> =>
    apiFetch<RoadmapTask>(`/roadmap/${taskId}/`, { method: 'PATCH', body: JSON.stringify({ status }) })
};
