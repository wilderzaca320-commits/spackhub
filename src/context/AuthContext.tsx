import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';
import { api, ApiError, AuthResponse } from '../lib/api';
import type { AuthUser } from '../types';

interface RegisterPayload {
  email: string;
  password: string;
  name?: string;
  accountType?: 'individual' | 'corporate';
  company?: string;
}

interface AuthContextValue {
  user: AuthUser | null;
  loading: boolean;
  serverError: string | null;
  login: (email: string, password: string) => Promise<AuthUser>;
  register: (payload: RegisterPayload) => Promise<AuthUser>;
  logout: () => Promise<void>;
  refresh: () => Promise<void>;
  setUser: React.Dispatch<React.SetStateAction<AuthUser | null>>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [serverError, setServerError] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;

    api.auth
      .me()
      .then(({ user: sessionUser }) => {
        if (alive) setUser(sessionUser);
      })
      .catch((error: unknown) => {
        if (!alive) return;
        setUser(null);
        // Un 401 es normal: todavía no hay sesión. Solo avisamos si no hay servidor.
        if (error instanceof ApiError && error.status === 0) {
          setServerError(error.message);
        }
      })
      .finally(() => {
        if (alive) setLoading(false);
      });

    return () => {
      alive = false;
    };
  }, []);

  const refresh = useCallback(async () => {
    try {
      const { user: sessionUser } = await api.auth.me();
      setUser(sessionUser);
    } catch {
      setUser(null);
    }
  }, []);

  const login = useCallback(async (email: string, password: string) => {
    const { user: sessionUser } = await api.auth.login({ email, password });
    setUser(sessionUser);
    setServerError(null);
    return sessionUser;
  }, []);

  const register = useCallback(async (payload: RegisterPayload) => {
    const { user: sessionUser } = await api.auth.register(payload);
    setUser(sessionUser);
    setServerError(null);
    return sessionUser;
  }, []);

  const logout = useCallback(async () => {
    try {
      await api.auth.logout();
    } finally {
      setUser(null);
    }
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({ user, loading, serverError, login, register, logout, refresh, setUser }),
    [user, loading, serverError, login, register, logout, refresh]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth debe usarse dentro de <AuthProvider>.');
  return context;
}

export type { AuthResponse };
