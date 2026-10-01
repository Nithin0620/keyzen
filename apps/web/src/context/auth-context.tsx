'use client';

import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';
import {
  type AuthUser,
  clearAuth,
  fetchCurrentUser,
  getStoredToken,
  getStoredUser,
  loginWithWorkflow,
  logoutFromWorkflow,
  registerWithWorkflow,
  saveAuth,
} from '@/lib/auth';

interface AuthContextValue {
  user: AuthUser | null;
  token: string | null;
  /** true while the initial token check is running */
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (name: string, email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  // On mount: restore session from localStorage, then verify with workflow /me
  useEffect(() => {
    const storedToken = getStoredToken();
    const storedUser = getStoredUser();

    if (!storedToken) {
      setLoading(false);
      return;
    }

    // Optimistically set stored user while we verify
    if (storedUser) {
      setUser(storedUser);
      setToken(storedToken);
    }

    fetchCurrentUser(storedToken)
      .then((freshUser) => {
        if (freshUser) {
          setUser(freshUser);
          setToken(storedToken);
          saveAuth(storedToken, freshUser);
        } else {
          // Token expired or invalid
          clearAuth();
          setUser(null);
          setToken(null);
        }
      })
      .finally(() => setLoading(false));
  }, []);

  const login = useCallback(async (email: string, password: string) => {
    const { token: newToken, user: newUser } = await loginWithWorkflow({
      email,
      password,
    });
    saveAuth(newToken, newUser);
    setToken(newToken);
    setUser(newUser);
  }, []);

  const register = useCallback(
    async (name: string, email: string, password: string) => {
      const { token: newToken, user: newUser } = await registerWithWorkflow({
        name,
        email,
        password,
      });
      saveAuth(newToken, newUser);
      setToken(newToken);
      setUser(newUser);
    },
    []
  );

  const logout = useCallback(async () => {
    if (token) await logoutFromWorkflow(token);
    clearAuth();
    setUser(null);
    setToken(null);
  }, [token]);

  const value = useMemo(
    () => ({ user, token, loading, login, register, logout }),
    [user, token, loading, login, register, logout]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside <AuthProvider>');
  return ctx;
}
