/**
 * Keyzen Auth Library
 *
 * Shares authentication with the Workflow project.
 * Login/register calls go to Workflow's REST API (`/api/v1/auth/login` etc.)
 * The returned JWT is signed with the shared NEXTAUTH_SECRET, so both apps
 * can verify each other's tokens without any redirect.
 *
 * Token storage: localStorage key `keyzen_auth_token` + cookie `auth_token`
 * (the cookie is domain-shared under .ssh.net.in in production)
 */

export const WORKFLOW_API_URL =
  process.env.NEXT_PUBLIC_WORKFLOW_API_URL || 'http://localhost:3001';

export const TOKEN_KEY = 'keyzen_auth_token';
export const USER_KEY = 'keyzen_auth_user';

export interface AuthUser {
  id: string;
  email: string;
  name: string | null;
  image: string | null;
}

export interface AuthState {
  user: AuthUser | null;
  token: string | null;
}

// ─── Token persistence (localStorage + cookie) ──────────────────────────────

export function saveAuth(token: string, user: AuthUser): void {
  if (typeof window === 'undefined') return;
  localStorage.setItem(TOKEN_KEY, token);
  localStorage.setItem(USER_KEY, JSON.stringify(user));
  // Also set as a cookie so the middleware can read it server-side.
  // In production the domain should be .ssh.net.in for cross-app sharing.
  const isProduction = window.location.hostname.endsWith('.ssh.net.in');
  const domain = isProduction ? '; Domain=.ssh.net.in' : '';
  document.cookie = `auth_token=${token}; Path=/${domain}; Max-Age=${60 * 60 * 24 * 30}; SameSite=Lax${isProduction ? '; Secure' : ''}`;
}

export function clearAuth(): void {
  if (typeof window === 'undefined') return;
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(USER_KEY);
  const isProduction = window.location.hostname.endsWith('.ssh.net.in');
  const domain = isProduction ? '; Domain=.ssh.net.in' : '';
  document.cookie = `auth_token=; Path=/${domain}; Max-Age=0`;
}

export function getStoredToken(): string | null {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem(TOKEN_KEY);
}

export function getStoredUser(): AuthUser | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = localStorage.getItem(USER_KEY);
    return raw ? (JSON.parse(raw) as AuthUser) : null;
  } catch {
    return null;
  }
}

// ─── API calls to Workflow's REST auth endpoints ─────────────────────────────

export interface LoginPayload {
  email: string;
  password: string;
}

export interface RegisterPayload {
  name: string;
  email: string;
  password: string;
}

export interface AuthResponse {
  token: string;
  user: AuthUser;
}

async function workflowPost<T>(path: string, body: unknown): Promise<T> {
  const res = await fetch(`${WORKFLOW_API_URL}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
    credentials: 'include', // carry cookies for cross-subdomain sharing
  });

  if (!res.ok) {
    let message = res.statusText;
    try {
      const data = (await res.json()) as { error?: string; message?: string };
      message = data.message || data.error || message;
    } catch {
      // ignore
    }
    throw new Error(message);
  }

  return res.json() as Promise<T>;
}

export async function loginWithWorkflow(payload: LoginPayload): Promise<AuthResponse> {
  return workflowPost<AuthResponse>('/api/v1/auth/login', payload);
}

export async function registerWithWorkflow(payload: RegisterPayload): Promise<AuthResponse> {
  return workflowPost<AuthResponse>('/api/v1/auth/register', payload);
}

export async function logoutFromWorkflow(token: string): Promise<void> {
  await fetch(`${WORKFLOW_API_URL}/api/v1/auth/logout`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` },
    credentials: 'include',
  }).catch(() => {
    // best-effort logout on the workflow side
  });
}

export async function fetchCurrentUser(token: string): Promise<AuthUser | null> {
  try {
    const res = await fetch(`${WORKFLOW_API_URL}/api/v1/auth/me`, {
      headers: { Authorization: `Bearer ${token}` },
      credentials: 'include',
    });
    if (!res.ok) return null;
    const data = (await res.json()) as { user: AuthUser };
    return data.user ?? null;
  } catch {
    return null;
  }
}
