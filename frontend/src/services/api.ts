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
      if (res.status === 401 && typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('skillbridge_session_expired'));
      }
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
  createProfile: (data: Partial<UserProfile>): Promise<UserProfile> =>
    apiFetch<UserProfile>('/profiles/', { method: 'POST', body: JSON.stringify(data) }),

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

  getJobAnalyses: (userId: string = 'usr_demo_001'): Promise<JobAnalysis[]> =>
    apiFetch<JobAnalysis[]>(`/job-analyses/?user_id=${userId}`),

  getJobAnalysis: (id: string): Promise<JobAnalysis> =>
    apiFetch<JobAnalysis>(`/job-analyses/${id}/`),

  updateRequirements: (id: string, requirements: Requirement[]): Promise<{ message: string; analysis_id: string }> =>
    apiFetch(`/job-analyses/${id}/requirements/`, { method: 'PATCH', body: JSON.stringify({ requirements }) }),

  // Blueprint 2.0 Goal-Based Mode (Mode B)
  submitGoal: (data: { user_id?: string; goal_type: string; goal_text: string; days_remaining?: number; study_hours_per_week?: number }): Promise<Goal> =>
    apiFetch<Goal>('/goals/', { method: 'POST', body: JSON.stringify(data) }),

  // Member 3: Skill Matching & Feasibility Engine
  runMatching: (
    analysisId: string,
    userId: string = 'demo_user',
    daysRemaining?: number,
    studyHoursPerWeek?: number
  ): Promise<{ analysis_id: string; role_title: string; results: MatchReport[]; feasibility?: FeasibilityAssessment; summary?: any }> => {
    const params = new URLSearchParams({ user_id: userId });
    if (daysRemaining !== undefined) params.append('days_remaining', String(daysRemaining));
    if (studyHoursPerWeek !== undefined) params.append('study_hours_per_week', String(studyHoursPerWeek));
    return apiFetch(`/job-analyses/${analysisId}/match/?${params.toString()}`, {
      method: 'POST',
      body: JSON.stringify({
        user_id: userId,
        days_remaining: daysRemaining,
        study_hours_per_week: studyHoursPerWeek
      })
    });
  },

  getSkillGaps: (
    analysisId: string,
    daysRemaining?: number,
    studyHoursPerWeek?: number
  ): Promise<{ analysis_id: string; results: MatchReport[]; feasibility?: FeasibilityAssessment; summary?: any }> => {
    const params = new URLSearchParams();
    if (daysRemaining !== undefined) params.append('days_remaining', String(daysRemaining));
    if (studyHoursPerWeek !== undefined) params.append('study_hours_per_week', String(studyHoursPerWeek));
    const qs = params.toString() ? `?${params.toString()}` : '';
    return apiFetch(`/job-analyses/${analysisId}/gaps/${qs}`);
  },

  inspectEvidence: (data: { repository_url: string; skill_name: string; title?: string; description?: string }): Promise<any> =>
    apiFetch('/skill-matching/inspect-evidence/', { method: 'POST', body: JSON.stringify(data) }),

  getRemediationAdvice: (data: {
    skill_name: string;
    category?: string;
    importance?: string;
    remediation_hours?: number;
    effort_breakdown?: any;
    user_id?: string;
    experience_level?: string;
    role_title?: string;
    status?: string;
    feasibility_status?: string;
    days_remaining?: number;
  }): Promise<any> =>
    apiFetch('/skill-matching/remediation-advice/', { method: 'POST', body: JSON.stringify(data) }),


  // Member 4: Assessment, Roadmap, Deadline Feasibility & Application Checklist
  generateSyllabus: (data: {
    skill_name: string;
    target_role?: string;
    project_title?: string;
    target_deliverables?: string[];
    experience_level?: string;
    learning_preference?: string;
  }): Promise<{
    title: string;
    skill_name: string;
    experience_level: string;
    syllabus_steps: Array<{
      step_number: number;
      field_key: 'valid_test' | 'invalid_test' | 'auth_test' | 'assertions' | 'explanation';
      title: string;
      subtitle: string;
      target_file?: string;
      points: number;
      starter_code: string;
    }>;
    rubric: Array<{ id: string; name: string; pts: number; desc: string }>;
    concept_animation: {
      type: string;
      title: string;
      description: string;
      nodes: Array<{ id: string; name: string; detail: string; icon: string; status_text: string }>;
      steps: string[];
    };
  }> =>
    apiFetch('/assessments/generate-syllabus/', { method: 'POST', body: JSON.stringify(data) }),

  getAssessment: (taskId: string): Promise<AssessmentTask> =>
    apiFetch<AssessmentTask>(`/assessments/${taskId}/`),

  submitAssessment: (taskId: string, submission: Record<string, unknown>): Promise<{ task_id: string; message: string }> =>
    apiFetch(`/assessments/${taskId}/submissions/`, { method: 'POST', body: JSON.stringify({ submission }) }),

  getRoadmap: (userId: string = 'demo_user'): Promise<{ user_id: string; tasks: RoadmapTask[]; checklist?: ApplicationChecklistItem[] }> =>
    apiFetch(`/roadmap/?user_id=${userId}`),

  updateRoadmapTask: (taskId: string, status: string): Promise<RoadmapTask> =>
    apiFetch<RoadmapTask>(`/roadmap/${taskId}/`, { method: 'PATCH', body: JSON.stringify({ status }) })
};
