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
  const res = await fetch(`${API_BASE}${endpoint}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  const data = await res.json();
  if (!res.ok) {
    // Flatten DRF error dicts into a single readable message
    const messages: string[] = [];
    for (const key of Object.keys(data)) {
      const val = data[key];
      if (Array.isArray(val)) messages.push(...val);
      else if (typeof val === 'string') messages.push(val);
    }
    throw new Error(messages.join(' ') || `Request failed (${res.status})`);
  }
  return data as T;
}

async function authGet<T>(endpoint: string, accessToken: string): Promise<T> {
  const res = await fetch(`${API_BASE}${endpoint}`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!res.ok) throw new Error(`Request failed (${res.status})`);
  return res.json() as Promise<T>;
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
        setUser(u);
        setSessionExpired(false);
        localStorage.setItem('skillbridge_auth_user_id', String(u.id));
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
