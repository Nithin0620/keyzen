import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import WorkspaceInvitationsPage from './page';

const { mockReplace, mockPost, mockReloadWorkspaces, authState } = vi.hoisted(() => ({
  mockReplace: vi.fn(),
  mockPost: vi.fn(),
  mockReloadWorkspaces: vi.fn(),
  authState: {
    user: null as { id: string; email: string } | null,
    isLoading: false,
  },
}));

vi.mock('next/navigation', () => ({
  useRouter: () => ({ replace: mockReplace }),
}));

vi.mock('@/components/providers/auth-provider', () => ({
  useAuth: () => ({
    user: authState.user,
    isLoading: authState.isLoading,
    reloadWorkspaces: mockReloadWorkspaces,
  }),
}));

vi.mock('@/lib/api/client', () => ({
  apiClient: { post: mockPost },
}));

describe('WorkspaceInvitationsPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    authState.user = null;
    authState.isLoading = false;
    window.history.replaceState(null, '', '/workspaces/invitations#token=invitation-token');
  });

  it('shows the auth screen instead of invitation actions for a signed-out visitor', async () => {
    render(<WorkspaceInvitationsPage />);

    const redirect = encodeURIComponent('/workspaces/invitations#token=invitation-token');
    await waitFor(() => expect(mockReplace).toHaveBeenCalledWith(`/auth/login?redirect=${redirect}`));
    expect(screen.getByRole('link', { name: /sign in to continue/i })).toHaveAttribute(
      'href',
      `/auth/login?redirect=${redirect}`
    );
    expect(screen.queryByRole('button', { name: /accept invitation/i })).toBeNull();
    expect(screen.queryByRole('button', { name: /decline/i })).toBeNull();
    expect(mockPost).not.toHaveBeenCalled();
  });

  it('shows invitation actions only for an authenticated visitor', () => {
    authState.user = { id: 'user-1', email: 'dev@example.com' };

    render(<WorkspaceInvitationsPage />);

    expect(screen.getByRole('button', { name: /accept invitation/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /decline/i })).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: /sign in to continue/i })).toBeNull();
    expect(mockReplace).not.toHaveBeenCalled();
  });

  it('waits for the session check before rendering either state', () => {
    authState.isLoading = true;

    render(<WorkspaceInvitationsPage />);

    expect(screen.getByText(/checking your session/i)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /accept invitation/i })).toBeNull();
    expect(screen.queryByRole('link', { name: /sign in to continue/i })).toBeNull();
    expect(mockReplace).not.toHaveBeenCalled();
  });

  it('does not redirect a visitor whose invitation link has no token', () => {
    window.history.replaceState(null, '', '/workspaces/invitations');

    render(<WorkspaceInvitationsPage />);

    expect(screen.getByText('Invalid Invitation')).toBeInTheDocument();
    expect(mockReplace).not.toHaveBeenCalled();
  });

  it('accepts the invitation once the visitor is authenticated', async () => {
    const user = userEvent.setup();
    authState.user = { id: 'user-1', email: 'dev@example.com' };
    mockPost.mockResolvedValueOnce(undefined);
    mockReloadWorkspaces.mockResolvedValueOnce(undefined);

    render(<WorkspaceInvitationsPage />);
    await user.click(screen.getByRole('button', { name: /accept invitation/i }));

    expect(mockPost).toHaveBeenCalledWith('/workspaces/invitations/accept', { token: 'invitation-token' });
    expect(screen.getByText('Invitation Accepted')).toBeInTheDocument();
  });
});
