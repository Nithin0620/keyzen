import { render, screen } from '@testing-library/react';
import { within } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import WorkspaceMembersPage from './page';

const { mockUseQuery, authState, params } = vi.hoisted(() => ({
  mockUseQuery: vi.fn(),
  authState: {
    user: { id: 'user-1', email: 'self@example.com' },
    workspaces: [{ id: 'ws-1', role: 'MEMBER' as string }],
  },
  params: { workspaceId: 'ws-1' },
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

const owner = {
  userId: 'user-owner',
  email: 'owner@example.com',
  role: 'OWNER',
  joinedAt: '2024-01-15T00:00:00.000Z',
};

const member = {
  userId: 'user-2',
  email: 'member@example.com',
  role: 'MEMBER',
  joinedAt: undefined,
};

const projectMembers = [
  {
    userId: 'user-1',
    email: 'self@example.com',
    role: 'DEVELOPER',
    customPermissions: [],
  },
  {
    userId: 'user-2',
    email: 'member@example.com',
    role: 'VIEWER',
    customPermissions: ['secrets.read'],
  },
];

describe('WorkspaceMembersPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    authState.workspaces = [{ id: 'ws-1', role: 'MEMBER' }];
    mockUseQuery.mockImplementation(({ queryKey }: { queryKey: unknown[] }) => {
      const result =
        queryKey[0] === 'workspace-invitations'
          ? []
          : queryKey[0] === 'workspace-projects'
            ? [{ id: 'proj-1', name: 'Payments' }]
            : queryKey[0] === 'project-members'
              ? projectMembers
              : [owner, member];
      return { data: result, isLoading: false, isError: false, refetch: vi.fn() };
    });
  });

  it('hides owner and admin actions from workspace members', () => {
    render(<WorkspaceMembersPage params={Promise.resolve(params)} />);

    expect(screen.queryByRole('button', { name: /invite member/i })).toBeNull();
    expect(screen.queryByRole('button', { name: /make owner/i })).toBeNull();
    expect(mockUseQuery).toHaveBeenCalledWith(
      expect.objectContaining({
        queryKey: ['workspace-invitations', 'ws-1'],
        enabled: false,
      })
    );
  });

  it('shows member management controls to workspace owners', () => {
    authState.workspaces = [{ id: 'ws-1', role: 'OWNER' }];

    render(<WorkspaceMembersPage params={Promise.resolve(params)} />);

    expect(screen.getByRole('button', { name: /invite member/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /make owner/i })).toBeInTheDocument();
  });

  it('shows project-wise RBAC in the workspace access screen', () => {
    render(<WorkspaceMembersPage params={Promise.resolve(params)} />);

    expect(screen.getByText(/project-wise access control/i)).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: /project access/i })).toBeInTheDocument();
    expect(screen.getByText('2 members')).toBeInTheDocument();
  });

  it('renders a placeholder instead of Invalid Date for missing join dates', () => {
    render(<WorkspaceMembersPage params={Promise.resolve(params)} />);

    const section = screen.getByRole('heading', { name: 'Active Members' }).parentElement;
    expect(section).not.toBeNull();
    const row = within(section!).getByText('member@example.com').closest('tr');
    expect(row).not.toBeNull();
    expect(within(row!).getByText('—')).toBeInTheDocument();
    expect(screen.queryByText(/invalid date/i)).toBeNull();
  });
});
