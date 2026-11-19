'use client';

import { use, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { invitationCreateSchema, type InvitationCreateInput, type WorkspaceRole } from '@aegis/shared';
import { apiClient } from '@/lib/api/client';
import { useAuth } from '@/components/providers/auth-provider';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { ConfirmationDialog } from '@/components/ui/confirmation-dialog';
import { LoadingState } from '@/components/ui/loading-state';
import { ErrorState } from '@/components/ui/error-state';
import {
  UserPlus,
  Mail,
  Trash2,
  Crown,
  Loader2,
  XCircle,
} from 'lucide-react';

export interface WorkspaceMemberView {
  userId: string;
  email: string;
  name?: string;
  role: WorkspaceRole;
  joinedAt: string;
}

export interface WorkspaceInvitationView {
  id: string;
  email: string;
  role: WorkspaceRole;
  status: 'PENDING' | 'ACCEPTED' | 'REVOKED' | 'EXPIRED';
  expiresAt: string;
  createdAt: string;
}

export default function WorkspaceMembersPage({
  params,
}: {
  params: Promise<{ workspaceId: string }>;
}): React.ReactNode {
  const { workspaceId } = use(params);
  const { user } = useAuth();

  const [inviteModalOpen, setInviteModalOpen] = useState(false);
  const [inviteError, setInviteError] = useState<string | null>(null);
  const [inviting, setInviting] = useState(false);

  // Transfer ownership states
  const [transferTargetUser, setTransferTargetUser] = useState<WorkspaceMemberView | null>(null);
  const [transferModalOpen, setTransferModalOpen] = useState(false);

  // Member removal states
  const [removeTargetUser, setRemoveTargetUser] = useState<WorkspaceMemberView | null>(null);
  const [removeModalOpen, setRemoveModalOpen] = useState(false);

  // Member list
  const {
    data: members,
    isLoading: membersLoading,
    isError: membersError,
    refetch: refetchMembers,
  } = useQuery({
    queryKey: ['workspace-members', workspaceId],
    queryFn: () => apiClient.get<WorkspaceMemberView[]>(`/workspaces/${workspaceId}/members`),
  });

  // Invitations list
  const {
    data: invitations,
    isLoading: invitesLoading,
    refetch: refetchInvites,
  } = useQuery({
    queryKey: ['workspace-invitations', workspaceId],
    queryFn: () => apiClient.get<WorkspaceInvitationView[]>(`/workspaces/${workspaceId}/invitations`),
  });

  const {
    register,
    handleSubmit,
    setValue,
    reset,
    formState: { errors },
  } = useForm<InvitationCreateInput>({
    resolver: zodResolver(invitationCreateSchema),
    defaultValues: {
      role: 'MEMBER',
    },
  });

  const handleRoleChange = async (targetUserId: string, newRole: WorkspaceRole): Promise<void> => {
    try {
      await apiClient.patch(`/workspaces/${workspaceId}/members/${targetUserId}`, {
        role: newRole,
      });
      await refetchMembers();
    } catch {
      // Error surfaced
    }
  };

  const handleInvite = async (data: InvitationCreateInput): Promise<void> => {
    setInviteError(null);
    setInviting(true);
    try {
      await apiClient.post(`/workspaces/${workspaceId}/invitations`, data);
      reset();
      setInviteModalOpen(false);
      await refetchInvites();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to send workspace invitation';
      setInviteError(msg);
    } finally {
      setInviting(false);
    }
  };

  const handleRevokeInvite = async (invitationId: string): Promise<void> => {
    await apiClient.post(`/workspaces/${workspaceId}/invitations/${invitationId}/revoke`, {});
    await refetchInvites();
  };

  const handleRemoveMember = async (): Promise<void> => {
    if (!removeTargetUser) return;
    await apiClient.delete(`/workspaces/${workspaceId}/members/${removeTargetUser.userId}`);
    await refetchMembers();
    setRemoveModalOpen(false);
  };

  const handleTransferOwnership = async (confirmationText: string | undefined): Promise<void> => {
    if (!transferTargetUser || !confirmationText) return;
    await apiClient.post(`/workspaces/${workspaceId}/transfer-owner`, {
      userId: transferTargetUser.userId,
      confirmation: confirmationText,
    });
    await refetchMembers();
    setTransferModalOpen(false);
  };

  if (membersLoading || invitesLoading) {
    return <LoadingState message="Loading team members & RBAC..." />;
  }

  if (membersError) {
    return (
      <ErrorState
        title="Failed to load team"
        description="Could not access workspace members. You might lack permissions."
        onRetry={() => void refetchMembers()}
      />
    );
  }

  return (
    <div className="space-y-8">
      {/* Top Header */}
      <div className="flex flex-col gap-4 border-b border-line/20 pb-6 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-light tracking-tight text-ink">
              Team & <span className="font-serif italic text-peri-2">Access Control</span>
            </h1>
            <Badge variant="live">ROLE-BASED RBAC</Badge>
          </div>
          <p className="text-sm text-ink-2">
            Manage workspace roles, invite team members, and audit access permissions.
          </p>
        </div>

        <Button variant="default" onClick={() => setInviteModalOpen(true)}>
          <UserPlus className="mr-2 size-4" /> Invite Member
        </Button>
      </div>

      {/* Invite Member Card Modal Dialog */}
      {inviteModalOpen && (
        <Card className="border-peri/40 shadow-2xl p-6 bg-violet-deep">
          <div className="flex items-center justify-between mb-4 border-b border-line/20 pb-3">
            <div className="flex items-center gap-2">
              <Mail className="size-4 text-peri-2" />
              <h2 className="text-lg font-medium text-ink">Invite Colleague to Workspace</h2>
            </div>
            <Button variant="ghost" size="icon" onClick={() => setInviteModalOpen(false)}>
              <XCircle className="size-4" />
            </Button>
          </div>
          <form onSubmit={handleSubmit(handleInvite)} className="space-y-4">
            {inviteError && (
              <Alert variant="destructive">
                <AlertDescription>{inviteError}</AlertDescription>
              </Alert>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="sm:col-span-2 space-y-2">
                <Label htmlFor="email" className="text-xs font-mono uppercase text-ink-3">
                  Colleague Work Email
                </Label>
                <Input
                  id="email"
                  type="email"
                  placeholder="teammate@company.com"
                  {...register('email')}
                  className="bg-black/20 border-line text-ink"
                />
                {errors.email && (
                  <p className="text-xs text-destructive">{errors.email.message}</p>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="role" className="text-xs font-mono uppercase text-ink-3">
                  Assigned Role
                </Label>
                <Select
                  defaultValue="MEMBER"
                  onValueChange={(val) => setValue('role', val as 'ADMIN' | 'MEMBER' | 'VIEWER')}
                >
                  <SelectTrigger className="bg-black/20 border-line text-ink">
                    <SelectValue placeholder="Role" />
                  </SelectTrigger>
                  <SelectContent className="border-line/40 bg-popover text-ink">
                    <SelectItem value="ADMIN">ADMIN</SelectItem>
                    <SelectItem value="MEMBER">MEMBER</SelectItem>
                    <SelectItem value="VIEWER">VIEWER</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="flex justify-end gap-3 pt-2">
              <Button type="button" variant="ghost" onClick={() => setInviteModalOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={inviting}>
                {inviting ? (
                  <>
                    <Loader2 className="mr-2 size-4 animate-spin" /> Sending Invitation...
                  </>
                ) : (
                  'Send Secure Invitation'
                )}
              </Button>
            </div>
          </form>
        </Card>
      )}

      {/* Members Table */}
      <div className="space-y-4">
        <h2 className="text-lg font-medium text-ink">Active Members</h2>
        <Card className="border-line/40 shadow-2xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left font-mono text-xs">
              <thead className="border-b border-line/20 bg-black/40 text-[11px] tracking-wider uppercase text-ink-3">
                <tr>
                  <th className="py-3 px-6 font-medium">User</th>
                  <th className="py-3 px-6 font-medium">Workspace Role</th>
                  <th className="py-3 px-6 font-medium">Joined Date</th>
                  <th className="py-3 px-6 font-medium text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line/10">
                {members?.map((m) => {
                  const isCurrentUser = m.userId === user?.id;
                  const isOwner = m.role === 'OWNER';

                  return (
                    <tr key={m.userId} className="transition-colors hover:bg-white/[0.02]">
                      <td className="py-4 px-6 align-middle font-sans">
                        <div className="flex items-center gap-3">
                          <div className="flex size-8 items-center justify-center rounded-full bg-peri/20 font-mono text-xs font-semibold text-peri-2 border border-peri/30">
                            {m.name ? m.name[0]?.toUpperCase() : m.email[0]?.toUpperCase()}
                          </div>
                          <div>
                            <div className="flex items-center gap-2">
                              <span className="font-medium text-ink">{m.name || 'Anonymous User'}</span>
                              {isCurrentUser && (
                                <Badge variant="outline" className="font-mono text-[9px]">
                                  YOU
                                </Badge>
                              )}
                            </div>
                            <span className="font-mono text-xs text-ink-3">{m.email}</span>
                          </div>
                        </div>
                      </td>
                      <td className="py-4 px-6 align-middle">
                        {isOwner ? (
                          <div className="flex items-center gap-1.5 text-warning font-semibold">
                            <Crown className="size-3.5" />
                            <span>OWNER</span>
                          </div>
                        ) : (
                          <Select
                            defaultValue={m.role}
                            onValueChange={(val) => void handleRoleChange(m.userId, val as WorkspaceRole)}
                          >
                            <SelectTrigger className="h-8 w-28 bg-black/20 border-line text-ink">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent className="border-line/40 bg-popover text-ink">
                              <SelectItem value="ADMIN">ADMIN</SelectItem>
                              <SelectItem value="MEMBER">MEMBER</SelectItem>
                              <SelectItem value="VIEWER">VIEWER</SelectItem>
                            </SelectContent>
                          </Select>
                        )}
                      </td>
                      <td className="py-4 px-6 align-middle font-sans text-xs text-ink-3">
                        {new Date(m.joinedAt).toLocaleDateString()}
                      </td>
                      <td className="py-4 px-6 align-middle text-right">
                        {!isOwner && (
                          <div className="flex items-center justify-end gap-2">
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-7 px-2 text-xs text-ink-3 hover:text-warning"
                              onClick={() => {
                                setTransferTargetUser(m);
                                setTransferModalOpen(true);
                              }}
                              title="Transfer primary workspace ownership"
                            >
                              <Crown className="mr-1 size-3" /> Make Owner
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="size-7 text-ink-3 hover:text-destructive"
                              onClick={() => {
                                setRemoveTargetUser(m);
                                setRemoveModalOpen(true);
                              }}
                              title="Remove member from workspace"
                            >
                              <Trash2 className="size-3.5" />
                            </Button>
                          </div>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </Card>
      </div>

      {/* Invitations Table */}
      {invitations && invitations.length > 0 && (
        <div className="space-y-4">
          <h2 className="text-lg font-medium text-ink">Pending & Past Invitations</h2>
          <Card className="border-line/40 shadow-2xl overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left font-mono text-xs">
                <thead className="border-b border-line/20 bg-black/40 text-[11px] tracking-wider uppercase text-ink-3">
                  <tr>
                    <th className="py-3 px-6 font-medium">Invited Email</th>
                    <th className="py-3 px-6 font-medium">Role</th>
                    <th className="py-3 px-6 font-medium">Status</th>
                    <th className="py-3 px-6 font-medium">Expires</th>
                    <th className="py-3 px-6 font-medium text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-line/10">
                  {invitations.map((inv) => (
                    <tr key={inv.id} className="transition-colors hover:bg-white/[0.02]">
                      <td className="py-3 px-6 align-middle font-medium text-ink">
                        {inv.email}
                      </td>
                      <td className="py-3 px-6 align-middle">
                        <Badge variant="secondary">{inv.role}</Badge>
                      </td>
                      <td className="py-3 px-6 align-middle">
                        {inv.status === 'PENDING' ? (
                          <Badge variant="live">PENDING</Badge>
                        ) : inv.status === 'ACCEPTED' ? (
                          <Badge variant="success">ACCEPTED</Badge>
                        ) : (
                          <Badge variant="outline">{inv.status}</Badge>
                        )}
                      </td>
                      <td className="py-3 px-6 align-middle font-sans text-xs text-ink-3">
                        {new Date(inv.expiresAt).toLocaleDateString()}
                      </td>
                      <td className="py-3 px-6 align-middle text-right">
                        {inv.status === 'PENDING' && (
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-7 text-xs text-destructive hover:bg-destructive/10"
                            onClick={() => void handleRevokeInvite(inv.id)}
                          >
                            Revoke
                          </Button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
        </div>
      )}

      {/* Remove Member Confirmation Dialog */}
      <ConfirmationDialog
        open={removeModalOpen}
        onOpenChange={setRemoveModalOpen}
        title={`Remove member ${removeTargetUser?.name ?? removeTargetUser?.email}?`}
        description="This user will immediately lose access to all projects, environments, and secrets in this workspace."
        confirmText="Remove Member"
        destructive
        onConfirm={handleRemoveMember}
      />

      {/* Transfer Ownership Confirmation Dialog */}
      <ConfirmationDialog
        open={transferModalOpen}
        onOpenChange={setTransferModalOpen}
        title={`Transfer Primary Ownership to ${transferTargetUser?.email}?`}
        description={`You will relinquish Owner status to ${transferTargetUser?.email} and become an Admin. Type TRANSFER to confirm this irreversible action.`}
        confirmText="Transfer Ownership"
        requiredConfirmation="TRANSFER"
        onConfirm={handleTransferOwnership}
      />
    </div>
  );
}
