/**
 * SkillBridge AI — Authentication Context
 * Provides login, register, logout, and current-user state to the whole app.
 *
 * Tokens are stored in localStorage so the session survives a page refresh.
 * The access token is attached to every API request in api.ts via getAccessToken().
 */

import {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  type ReactNode,
} from 'react';
import type { AuthUser, AuthResponse, LoginPayload, RegisterPayload } from '../types';
import { skillGapService } from '../services/skillGapService';

// ── Token storage keys ────────────────────────────────────────────────────────
const ACCESS_KEY = 'sb_access';
const REFRESH_KEY = 'sb_refresh';

const API_BASE = (import.meta as any).env?.VITE_API_BASE_URL || 'http://127.0.0.1:8000/api';

// ── Context shape ─────────────────────────────────────────────────────────────
interface AuthContextType {
  user: AuthUser | null;
  isAuthenticated: boolean;
  isLoading: boolean;          // true while checking stored token on startup
  sessionExpired: boolean;     // true when JWT expired or 401 received
  clearSessionExpired: () => void;
  login: (payload: LoginPayload) => Promise<void>;
  register: (payload: RegisterPayload) => Promise<void>;
  logout: () => Promise<void>;
  getAccessToken: () => string | null;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

// ── Raw fetch helpers (can't use api.ts here to avoid circular dependency) ────

async function authPost<T>(endpoint: string, body: object): Promise<T> {
  let res: Response;
  try {
    res = await fetch(`${API_BASE}${endpoint}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
  } catch {
    throw new Error('Unable to connect to the authentication server. Please check your connection.');
  }

  const rawText = await res.text();
  let data: any = null;
  try {
    data = rawText ? JSON.parse(rawText) : {};
  } catch {
    if (!res.ok) {
      if (res.status === 500) {
        throw new Error('Server encountered a temporary error. Please try again shortly.');
      }
      if (res.status === 502 || res.status === 503 || res.status === 504) {
        throw new Error('Authentication service is temporarily unavailable. Please try again in a moment.');
      }
      throw new Error(`Authentication request failed (HTTP ${res.status}).`);
    }
    throw new Error('Received an invalid response format from server.');
  }

  if (!res.ok) {
    if (typeof data === 'string') {
      throw new Error(data);
    }
    if (data && typeof data === 'object') {
      if (data.detail && typeof data.detail === 'string') {
        throw new Error(data.detail);
      }
      if (data.error && typeof data.error === 'string') {
        throw new Error(data.error);
      }
      if (data.message && typeof data.message === 'string') {
        throw new Error(data.message);
      }
      const messages: string[] = [];
      for (const key of Object.keys(data)) {
        const val = data[key];
        if (Array.isArray(val)) messages.push(...val);
        else if (typeof val === 'string') messages.push(val);
      }
      if (messages.length > 0) {
        throw new Error(messages.join(' '));
      }
    }
    throw new Error(`Request failed (${res.status})`);
  }
  return data as T;
}

async function authGet<T>(endpoint: string, accessToken: string): Promise<T> {
  let res: Response;
  try {
    res = await fetch(`${API_BASE}${endpoint}`, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
  } catch {
    throw new Error('Network error verifying authentication session.');
  }
  if (!res.ok) throw new Error(`Request failed (${res.status})`);
  const rawText = await res.text();
  try {
    return rawText ? JSON.parse(rawText) as T : {} as T;
  } catch {
    throw new Error('Received an invalid response format from server.');
  }
}

// ── Provider ─────────────────────────────────────────────────────────────────

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [sessionExpired, setSessionExpired] = useState(false);

  const clearSessionExpired = useCallback(() => {
    setSessionExpired(false);
  }, []);

  // Listen for 401 session expiration events
  useEffect(() => {
    const handleExpired = () => {
      setSessionExpired(true);
      setUser(null);
      localStorage.removeItem(ACCESS_KEY);
      localStorage.removeItem(REFRESH_KEY);
      localStorage.removeItem('skillbridge_auth_user_id');
      localStorage.removeItem('skillbridge_auth_user');
      try {
        const keys = Object.keys(localStorage);
        for (const k of keys) {
          if (
            k.startsWith('skillbridge_cached_') ||
            k.startsWith('sb_cache_') ||
            k.startsWith('skillbridge_all_passed_skills') ||
            k.startsWith('skillbridge_passed_assessment_') ||
            k.startsWith('skillbridge_verified_project_')
          ) {
            localStorage.removeItem(k);
          }
        }
        localStorage.removeItem('skillbridge_selected_role');
        localStorage.removeItem('skillbridge_selected_practice_project');
        if (typeof window !== 'undefined' && window.sessionStorage) {
          window.sessionStorage.clear();
        }
      } catch {}
    };
    window.addEventListener('skillbridge_session_expired', handleExpired);
    return () => window.removeEventListener('skillbridge_session_expired', handleExpired);
  }, []);

  // On mount: if we have a stored access token, verify it by calling /me/
  useEffect(() => {
    const token = localStorage.getItem(ACCESS_KEY);
    if (!token) {
      setIsLoading(false);
      return;
    }
    authGet<AuthUser>('/auth/me/', token)
      .then((u) => {
        // On every page load where we verify the token, sweep any previous-user stale data.
        // This handles users who had stale localStorage from before this fix was deployed.
        const userId = String(u.id);
        try {
          const keys = Object.keys(localStorage);
          for (const k of keys) {
            if (
              k.startsWith('skillbridge_passed_assessment_') ||
              k.startsWith('skillbridge_verified_project_') ||
              k.startsWith('skillbridge_all_passed_skills') ||
              k.startsWith('skillbridge_cached_') ||
              k.startsWith('sb_cache_')
            ) {
              // Only remove if the key is NOT scoped to this user's ID
              if (!k.includes(`_${userId}`)) {
                localStorage.removeItem(k);
              }
            }
          }
          // Remove flat (non-scoped) role/project selection keys
          localStorage.removeItem('skillbridge_selected_role');
          localStorage.removeItem('skillbridge_selected_practice_project');
        } catch {}
        // Clear the in-memory selected role so it doesn't bleed to the next user
        skillGapService.clearSession();
        setUser(u);
        setSessionExpired(false);
        localStorage.setItem('skillbridge_auth_user_id', userId);
        localStorage.setItem('skillbridge_auth_user', JSON.stringify(u));
      })
      .catch(() => {
        // Token expired or invalid — clear storage silently and flag expired
        localStorage.removeItem(ACCESS_KEY);
        localStorage.removeItem(REFRESH_KEY);
        localStorage.removeItem('skillbridge_auth_user_id');
        localStorage.removeItem('skillbridge_auth_user');
        setSessionExpired(true);
      })
      .finally(() => setIsLoading(false));
  }, []);

  const storeTokens = (resp: AuthResponse) => {
    // Clear any stale previous-user data before setting the new user's session
    try {
      const keys = Object.keys(localStorage);
      for (const k of keys) {
        if (
          k.startsWith('skillbridge_cached_') ||
          k.startsWith('sb_cache_') ||
          k.startsWith('skillbridge_budget_') ||
          k.startsWith('skillbridge_all_passed_skills') ||
          k.startsWith('skillbridge_passed_assessment_') ||
          k.startsWith('skillbridge_verified_project_')
        ) {
          localStorage.removeItem(k);
        }
      }
      localStorage.removeItem('skillbridge_selected_role');
      localStorage.removeItem('skillbridge_selected_practice_project');
    } catch {}
    skillGapService.clearSession();

    localStorage.setItem(ACCESS_KEY, resp.access);
    localStorage.setItem(REFRESH_KEY, resp.refresh);
    localStorage.setItem('skillbridge_auth_user_id', String(resp.user.id));
    localStorage.setItem('skillbridge_auth_user', JSON.stringify(resp.user));
    setUser(resp.user);
    setSessionExpired(false);
  };

  const login = useCallback(async (payload: LoginPayload) => {
    const resp = await authPost<AuthResponse>('/auth/login/', payload);
    storeTokens(resp);
  }, []);

  const register = useCallback(async (payload: RegisterPayload) => {
    const resp = await authPost<AuthResponse>('/auth/register/', payload);
    storeTokens(resp);
  }, []);

  const logout = useCallback(async () => {
    const refresh = localStorage.getItem(REFRESH_KEY);
    const access = localStorage.getItem(ACCESS_KEY);
    // Best-effort blacklist — don't block UI on failure
    if (refresh && access) {
      fetch(`${API_BASE}/auth/logout/`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${access}`,
        },
        body: JSON.stringify({ refresh }),
      }).catch(() => {});
    }
    localStorage.removeItem(ACCESS_KEY);
    localStorage.removeItem(REFRESH_KEY);
    localStorage.removeItem('skillbridge_auth_user_id');
    localStorage.removeItem('skillbridge_auth_user');
    try {
      // Clear all user-session data so the next user gets a clean slate
      const keys = Object.keys(localStorage);
      for (const k of keys) {
        if (
          k.startsWith('skillbridge_cached_') ||
          k.startsWith('sb_cache_') ||
          k.startsWith('skillbridge_budget_') ||
          k.startsWith('skillbridge_all_passed_skills') ||
          k.startsWith('skillbridge_passed_assessment_') ||
          k.startsWith('skillbridge_verified_project_')
        ) {
          localStorage.removeItem(k);
        }
      }
      // These flat (non-prefixed) keys hold role/project selections that belong to the previous user
      localStorage.removeItem('skillbridge_selected_role');
      localStorage.removeItem('skillbridge_selected_practice_project');
      if (typeof window !== 'undefined' && window.sessionStorage) {
        window.sessionStorage.clear();
      }
    } catch {}
    skillGapService.clearSession();
    setUser(null);
  }, []);

  const getAccessToken = useCallback((): string | null => {
    return localStorage.getItem(ACCESS_KEY);
  }, []);

  return (
    <AuthContext.Provider
      value={{
        user,
        isAuthenticated: user !== null,
        isLoading,
        sessionExpired,
        clearSessionExpired,
        login,
        register,
        logout,
        getAccessToken,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

// ── Hook ─────────────────────────────────────────────────────────────────────

export function useAuth(): AuthContextType {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    return {
      user: null,
      isAuthenticated: false,
      isLoading: false,
      sessionExpired: false,
      clearSessionExpired: () => {},
      login: async () => {},
      register: async () => {},
      logout: async () => {},
      getAccessToken: () => null,
    };
  }
  return ctx;
}
