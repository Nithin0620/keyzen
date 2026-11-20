import { render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import ProjectMembersPage from './page';

const { mockUseQuery, authState, params } = vi.hoisted(() => ({
  mockUseQuery: vi.fn(),
  authState: {
    user: { id: 'user-1', email: 'self@example.com' },
  },
  params: { workspaceId: 'ws-1', projectId: 'proj-1' },
}));

vi.mock('react', async (importOriginal) => {
  const actual = await importOriginal<typeof import('react')>();
  return { ...actual, use: () => params };
});

vi.mock('@tanstack/react-query', () => ({
  useQuery: (args: unknown) => mockUseQuery(args),
}));

vi.mock('@/components/providers/auth-provider', () => ({
  useAuth: () => authState,
}));

vi.mock('@/lib/api/client', () => ({
  apiClient: { get: vi.fn(), post: vi.fn(), patch: vi.fn(), delete: vi.fn() },
}));

const self = {
  userId: 'user-1',
  email: 'self@example.com',
  role: 'DEVELOPER',
  customPermissions: [],
};

const owner = {
  userId: 'user-owner',
  email: 'owner@example.com',
  role: 'OWNER',
  customPermissions: [],
};

const other = {
  userId: 'user-2',
  email: 'member@example.com',
  role: 'VIEWER',
  customPermissions: ['secrets.read'],
};

describe('ProjectMembersPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUseQuery.mockReturnValue({
      data: [self, owner, other],
      isLoading: false,
      isError: false,
      refetch: vi.fn(),
    });
  });

  it('is read-only for project members without management permissions', () => {
    render(<ProjectMembersPage params={Promise.resolve(params)} />);

    expect(screen.getByRole('heading', { name: /project access/i })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /add member/i })).toBeNull();
    expect(screen.queryByRole('button', { name: /edit access/i })).toBeNull();
  });

  it('shows management actions for project admins', () => {
    mockUseQuery.mockReturnValue({
      data: [{ ...self, role: 'ADMIN' }, owner, other],
      isLoading: false,
      isError: false,
      refetch: vi.fn(),
    });

    render(<ProjectMembersPage params={Promise.resolve(params)} />);

    expect(screen.getByRole('button', { name: /add member/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /edit access/i })).toBeInTheDocument();
  });

  it('shows management actions for an explicit members.invite grant', () => {
    mockUseQuery.mockReturnValue({
      data: [{ ...self, customPermissions: ['members.invite'] }, owner, other],
      isLoading: false,
      isError: false,
      refetch: vi.fn(),
    });

    render(<ProjectMembersPage params={Promise.resolve(params)} />);

    expect(screen.getByRole('button', { name: /add member/i })).toBeInTheDocument();
  });
});
