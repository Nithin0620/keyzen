'use client';

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { apiClient } from '@/lib/api/client';
import { ApiError } from '@/lib/api/errors';

export interface UserProfile {
  id: string;
  email: string;
  name?: string;
  status?: string;
  createdAt?: string;
}

export interface WorkspaceSummary {
  id: string;
  name: string;
  slug: string;
  description?: string;
  role?: string;
  ownerId?: string;
}

interface AuthContextType {
  user: UserProfile | null;
  activeWorkspace: WorkspaceSummary | null;
  workspaces: WorkspaceSummary[];
  isLoading: boolean;
  login: (email: string, pass: string) => Promise<void>;
  signup: (email: string, pass: string, name?: string) => Promise<void>;
  logout: () => Promise<void>;
  selectWorkspace: (workspaceId: string) => Promise<void>;
  refreshSession: () => Promise<void>;
  reloadWorkspaces: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | null>(null);

const PUBLIC_PATHS = [
  '/',
  '/auth/login',
  '/auth/signup',
  '/auth/verify',
  '/auth/forgot-password',
  '/auth/reset',
  '/workspaces/invitations',
];

export function AuthProvider({ children }: { children: ReactNode }): ReactNode {
  const [user, setUser] = useState<UserProfile | null>(null);
  const [activeWorkspace, setActiveWorkspace] = useState<WorkspaceSummary | null>(null);
  const [workspaces, setWorkspaces] = useState<WorkspaceSummary[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const router = useRouter();
  const pathname = usePathname();

  const loadWorkspaces = useCallback(async () => {
    try {
      const [listRes, activeRes] = await Promise.all([
        apiClient.get<WorkspaceSummary[]>('/workspaces'),
        apiClient.get<WorkspaceSummary | null>('/workspaces/active').catch(() => null),
      ]);
      setWorkspaces(listRes ?? []);
      setActiveWorkspace(activeRes ?? listRes?.[0] ?? null);
    } catch {
      setWorkspaces([]);
      setActiveWorkspace(null);
    }
  }, []);

  const refreshSession = useCallback(async () => {
    try {
      const profile = await apiClient.get<UserProfile>('/auth/me');
      setUser(profile);
      if (typeof window !== 'undefined') {
        localStorage.setItem('aegis_authenticated', 'true');
      }
      await loadWorkspaces();
    } catch (err) {
      setUser(null);
      setActiveWorkspace(null);
      setWorkspaces([]);
      if (typeof window !== 'undefined') {
        localStorage.removeItem('aegis_authenticated');
      }
      if (err instanceof ApiError && err.status === 401) {
        const isPublic = PUBLIC_PATHS.some((p) => pathname === p || pathname?.startsWith('/auth/'));
        if (!isPublic && pathname) {
          router.push(`/auth/login?redirect=${encodeURIComponent(pathname)}`);
        }
      }
    } finally {
      setIsLoading(false);
    }
  }, [loadWorkspaces, pathname, router]);

  useEffect(() => {
    void refreshSession();
  }, [refreshSession]);

  const login = async (email: string, pass: string): Promise<void> => {
    await apiClient.post<{ user: UserProfile }>('/auth/login', { email, password: pass });
    await refreshSession();
  };

  const signup = async (email: string, pass: string, name?: string): Promise<void> => {
    await apiClient.post('/auth/signup', { email, password: pass, name });
  };

  const logout = async (): Promise<void> => {
    try {
      await apiClient.post('/auth/logout', {});
    } finally {
      setUser(null);
      setActiveWorkspace(null);
      setWorkspaces([]);
      if (typeof window !== 'undefined') {
        localStorage.removeItem('aegis_authenticated');
      }
      router.push('/auth/login');
    }
  };

  const selectWorkspace = async (workspaceId: string): Promise<void> => {
    const updated = await apiClient.post<WorkspaceSummary>(`/workspaces/${workspaceId}/select`, {});
    setActiveWorkspace(updated);
    router.refresh();
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        activeWorkspace,
        workspaces,
        isLoading,
        login,
        signup,
        logout,
        selectWorkspace,
        refreshSession,
        reloadWorkspaces: loadWorkspaces,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextType {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return ctx;
}
