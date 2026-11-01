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

const API_BASE_URL = (import.meta as any).env?.VITE_API_BASE_URL || '/api';

/** Returns the stored JWT access token, or null if the user is not logged in. */
function getStoredToken(): string | null {
  return localStorage.getItem('sb_access');
}

// ── Silent Token Refresh ──────────────────────────────────────────────────────
// Prevents refresh storms when multiple requests 401 at the same time.
let _refreshPromise: Promise<string | null> | null = null;

async function silentRefresh(): Promise<string | null> {
  if (_refreshPromise) return _refreshPromise;

  _refreshPromise = (async () => {
    const refresh = localStorage.getItem('sb_refresh');
    if (!refresh) return null;
    try {
      const res = await fetch(`${API_BASE_URL}/auth/refresh/`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ refresh }),
      });
      if (!res.ok) {
        // Refresh token itself expired or blacklisted — full session expired
        localStorage.removeItem('sb_access');
        localStorage.removeItem('sb_refresh');
        window.dispatchEvent(new CustomEvent('skillbridge_session_expired'));
        return null;
      }
      const data = await res.json();
      const newAccess: string = data.access;
      if (!newAccess) return null;
      localStorage.setItem('sb_access', newAccess);
      // If token rotation is enabled the backend also sends a new refresh token
      if (data.refresh) {
        localStorage.setItem('sb_refresh', data.refresh);
      }
      return newAccess;
    } catch {
      return null;
    } finally {
      _refreshPromise = null;
    }
  })();

  return _refreshPromise;
}

interface CacheEntry<T> {
  data: T;
  timestamp: number;
}

const apiCache = new Map<string, CacheEntry<any>>();
const CACHE_TTL_MS = 25_000; // 25 seconds fast client-side TTL

export function clearApiCache(prefix?: string): void {
  if (!prefix) {
    apiCache.clear();
    try {
      if (typeof window !== 'undefined' && window.sessionStorage) {
        const keys = Object.keys(window.sessionStorage);
        for (const k of keys) {
          if (k.startsWith('sb_cache_')) window.sessionStorage.removeItem(k);
        }
      }
    } catch {}
  } else {
    for (const key of apiCache.keys()) {
      if (key.includes(prefix)) {
        apiCache.delete(key);
      }
    }
    try {
      if (typeof window !== 'undefined' && window.sessionStorage) {
        const keys = Object.keys(window.sessionStorage);
        for (const k of keys) {
          if (k.startsWith('sb_cache_') && k.includes(prefix)) {
            window.sessionStorage.removeItem(k);
          }
        }
      }
    } catch {}
  }
}

async function apiFetch<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
  // Inner helper that executes one fetch attempt with a given token
  const doFetch = async (accessToken: string | null): Promise<Response> => {
    const isFormData = options.body instanceof FormData;
    const headers: Record<string, string> = {
      ...(isFormData ? {} : { 'Content-Type': 'application/json' }),
      ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
      ...((options.headers as Record<string, string>) || {}),
    };
    return fetch(`${API_BASE_URL}${endpoint}`, { headers, ...options });
  };

  try {
    const method = (options.method || 'GET').toUpperCase();
    const isGet = method === 'GET';
    const token = getStoredToken();
    const cacheKey = `${endpoint}::${token || 'anon'}`;

    // Fast-path: return cached response for GET requests within TTL
    if (isGet) {
      const cached = apiCache.get(cacheKey);
      if (cached && Date.now() - cached.timestamp < CACHE_TTL_MS) {
        return cached.data as T;
      }
      try {
        if (typeof window !== 'undefined' && window.sessionStorage) {
          const raw = window.sessionStorage.getItem(`sb_cache_${cacheKey}`);
          if (raw) {
            const entry = JSON.parse(raw);
            if (Date.now() - entry.timestamp < CACHE_TTL_MS) {
              apiCache.set(cacheKey, entry);
              return entry.data as T;
            }
          }
        }
      } catch {}
    } else {
      // Mutations invalidate cached queries to prevent stale data
      clearApiCache();
    }

    let res = await doFetch(token);

    // ── Silent token refresh on 401 ──────────────────────────────────────────
    // If the access token expired, try to silently get a new one and retry once.
    if (res.status === 401 && localStorage.getItem('sb_refresh')) {
      const newToken = await silentRefresh();
      if (newToken) {
        // Retry the original request with the fresh token
        res = await doFetch(newToken);
      }
    }
    // ────────────────────────────────────────────────────────────────────────

    if (!res.ok) {
      // If still 401 after refresh attempt, the session is truly expired
      if (res.status === 401 && typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('skillbridge_session_expired'));
      }
      let errorDetail = '';
      try {
        const rawErrText = typeof res.text === 'function' ? await res.text() : JSON.stringify(await res.json());
        try {
          const errorJson = JSON.parse(rawErrText);
          if (typeof errorJson === 'string') {
            errorDetail = errorJson;
          } else if (errorJson && typeof errorJson === 'object') {
            errorDetail = errorJson.message || errorJson.error || errorJson.detail || Object.values(errorJson).flat().join(' ');
          }
        } catch {
          if (res.status === 500) {
            errorDetail = 'Server encountered a temporary issue. Please try again shortly.';
          } else if (res.status === 502 || res.status === 503 || res.status === 504) {
            errorDetail = 'Service temporarily unavailable. Please retry in a moment.';
          }
        }
      } catch {}
      throw new Error(errorDetail ? `HTTP ${res.status}: ${errorDetail}` : `HTTP ${res.status}: ${res.statusText}`);
    }

    let data: any = {};
    if (typeof res.text === 'function') {
      const rawSuccessText = await res.text();
      try {
        data = rawSuccessText ? JSON.parse(rawSuccessText) : {};
      } catch {
        throw new Error(`Received non-JSON response from ${endpoint} (HTTP ${res.status})`);
      }
    } else {
      data = await res.json();
    }

    // Cache successful GET responses
    if (isGet) {
      const freshToken = getStoredToken(); // may have been refreshed above
      const freshCacheKey = `${endpoint}::${freshToken || 'anon'}`;
      const entry = { data, timestamp: Date.now() };
      apiCache.set(freshCacheKey, entry);
      try {
        if (typeof window !== 'undefined' && window.sessionStorage) {
          window.sessionStorage.setItem(`sb_cache_${freshCacheKey}`, JSON.stringify(entry));
        }
      } catch {}
    }
    return data;
  } catch (err) {
    console.error(`API Error on ${endpoint}:`, err);
    throw err;
  }
}


export const api = {
  clearCache: clearApiCache,

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
