'use client';

import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useQuery } from '@tanstack/react-query';
import {
  permissions,
  projectMemberCreateSchema,
  type Permission,
  type ProjectRole,
} from '@aegis/shared';
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
import { Crown, Loader2, Shield, Trash2, UserPlus, XCircle } from 'lucide-react';

export interface ProjectMemberView {
  userId: string;
  email: string;
  role: ProjectRole;
  customPermissions: Permission[];
}

interface ProjectMemberForm {
  email: string;
  role: ProjectRole;
  customPermissions?: Permission[];
}

function PermissionPicker({
  selected,
  onChange,
}: {
  selected: Permission[];
  onChange: (permissions: Permission[]) => void;
}): React.ReactNode {
  const toggle = (permission: Permission): void => {
    onChange(
      selected.includes(permission)
        ? selected.filter((value) => value !== permission)
        : [...selected, permission]
    );
  };

  return (
    <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
      {permissions.map((permission) => (
        <label key={permission} className="flex items-center gap-2 font-mono text-xs text-ink-2">
          <input
            type="checkbox"
            checked={selected.includes(permission)}
            onChange={() => toggle(permission)}
            className="size-3.5"
          />
          {permission}
        </label>
      ))}
    </div>
  );
}

export function ProjectRbacPanel({
  workspaceId,
  projectId,
}: {
  workspaceId: string;
  projectId: string;
}): React.ReactNode {
  const { user } = useAuth();

  const [addOpen, setAddOpen] = useState(false);
  const [addError, setAddError] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);

  const [editingMember, setEditingMember] = useState<ProjectMemberView | null>(null);
  const [editRole, setEditRole] = useState<ProjectRole>('VIEWER');
  const [editPermissions, setEditPermissions] = useState<Permission[]>([]);
  const [editError, setEditError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const [removeTarget, setRemoveTarget] = useState<ProjectMemberView | null>(null);
  const [removing, setRemoving] = useState(false);

  const {
    data: members,
    isLoading,
    isError,
    refetch,
  } = useQuery({
    queryKey: ['project-members', workspaceId, projectId],
    queryFn: () =>
      apiClient.get<ProjectMemberView[]>(
        `/workspaces/${workspaceId}/projects/${projectId}/members`
      ),
  });

  const {
    register,
    handleSubmit,
    setValue,
    watch,
    reset,
    formState: { errors },
  } = useForm<ProjectMemberForm>({
    resolver: zodResolver(projectMemberCreateSchema),
    defaultValues: { email: '', role: 'VIEWER', customPermissions: [] },
  });

  const addPermissions = watch('customPermissions') ?? [];
  const ownMembership = members?.find((member) => member.userId === user?.id);
  const canManage =
    ownMembership?.role === 'OWNER' ||
    ownMembership?.role === 'ADMIN' ||
    Boolean(ownMembership?.customPermissions.includes('members.invite'));

  const handleAddMember = async (input: ProjectMemberForm): Promise<void> => {
    setAddError(null);
    setAdding(true);
    try {
      await apiClient.post(`/workspaces/${workspaceId}/projects/${projectId}/members`, {
        email: input.email,
        role: input.role,
        customPermissions: input.customPermissions ?? [],
      });
      reset({ email: '', role: 'VIEWER', customPermissions: [] });
      setAddOpen(false);
      await refetch();
    } catch (error: unknown) {
      setAddError(error instanceof Error ? error.message : 'Failed to add project member');
    } finally {
      setAdding(false);
    }
  };

  const openEdit = (member: ProjectMemberView): void => {
    setEditingMember(member);
    setEditRole(member.role);
    setEditPermissions(member.customPermissions ?? []);
    setEditError(null);
  };

  const handleSaveEdit = async (): Promise<void> => {
    if (!editingMember) return;
    setEditError(null);
    setSaving(true);
    try {
      await apiClient.patch(
        `/workspaces/${workspaceId}/projects/${projectId}/members/${editingMember.userId}`,
        { role: editRole, customPermissions: editPermissions }
      );
      setEditingMember(null);
      await refetch();
    } catch (error: unknown) {
      setEditError(error instanceof Error ? error.message : 'Failed to update project member');
    } finally {
      setSaving(false);
    }
  };

  const handleRemoveMember = async (): Promise<void> => {
    if (!removeTarget) return;
    setRemoving(true);
    try {
      await apiClient.delete(
        `/workspaces/${workspaceId}/projects/${projectId}/members/${removeTarget.userId}`
      );
      setRemoveTarget(null);
      await refetch();
    } finally {
      setRemoving(false);
    }
  };

  if (isLoading) {
    return <LoadingState message="Loading project access..." />;
  }

  if (isError || !members) {
    return (
      <ErrorState
        title="Could not load project members"
        description="You might not have access to this project."
        onRetry={() => void refetch()}
      />
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 border-b border-line/20 pb-6 sm:flex-row sm:items-center sm:justify-between">
        <div className="space-y-2">
          <div className="flex items-center gap-3">
            <h2 className="text-xl font-light tracking-tight text-ink">Project Access</h2>
            <Badge variant="live">PROJECT RBAC</Badge>
          </div>
          <p className="text-sm text-ink-2">
            Project access is explicit. Workspace roles do not grant access to this project.
          </p>
        </div>

        {canManage && (
          <Button variant="default" onClick={() => setAddOpen(true)}>
            <UserPlus className="mr-2 size-4" /> Add Member
          </Button>
        )}
      </div>

      {addOpen && canManage && (
        <Card className="border-peri/40 bg-violet-deep p-6 shadow-2xl">
          <div className="mb-4 flex items-center justify-between border-b border-line/20 pb-3">
            <div className="flex items-center gap-2">
              <UserPlus className="size-4 text-peri-2" />
              <h3 className="text-lg font-medium text-ink">Add Project Member</h3>
            </div>
            <Button variant="ghost" size="icon" onClick={() => setAddOpen(false)}>
              <XCircle className="size-4" />
            </Button>
          </div>
          <form onSubmit={handleSubmit(handleAddMember)} className="space-y-4">
            {addError && (
              <Alert variant="destructive">
                <AlertDescription>{addError}</AlertDescription>
              </Alert>
            )}

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="project-member-email" className="font-mono text-xs uppercase text-ink-3">
                  Workspace member email
                </Label>
                <Input
                  id="project-member-email"
                  type="email"
                  placeholder="teammate@company.com"
                  {...register('email')}
                  className="border-line bg-black/20 text-ink"
                />
                {errors.email && <p className="text-xs text-destructive">{errors.email.message}</p>}
              </div>

              <div className="space-y-2">
                <Label className="font-mono text-xs uppercase text-ink-3">Project role</Label>
                <Select
                  defaultValue="VIEWER"
                  onValueChange={(value) =>
                    setValue('role', value as ProjectRole, { shouldValidate: true })
                  }
                >
                  <SelectTrigger className="border-line bg-black/20 text-ink">
                    <SelectValue placeholder="Role" />
                  </SelectTrigger>
                  <SelectContent className="border-line/40 bg-popover text-ink">
                    <SelectItem value="VIEWER">VIEWER</SelectItem>
                    <SelectItem value="DEVELOPER">DEVELOPER</SelectItem>
                    <SelectItem value="ADMIN">ADMIN</SelectItem>
                    <SelectItem value="OWNER">OWNER</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-2">
              <Label className="font-mono text-xs uppercase text-ink-3">
                Additional permissions
              </Label>
              <PermissionPicker
                selected={addPermissions}
                onChange={(next) => setValue('customPermissions', next, { shouldValidate: true })}
              />
              <p className="text-xs text-ink-3">
                VIEWER has no access by default. Grant secrets.read explicitly if needed.
              </p>
            </div>

            <div className="flex justify-end gap-3 pt-2">
              <Button type="button" variant="ghost" onClick={() => setAddOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={adding}>
                {adding ? (
                  <>
                    <Loader2 className="mr-2 size-4 animate-spin" /> Adding...
                  </>
                ) : (
                  'Add Member'
                )}
              </Button>
            </div>
          </form>
        </Card>
      )}

      {editingMember && canManage && (
        <Card className="border-peri/40 bg-violet-deep p-6 shadow-2xl">
          <div className="mb-4 flex items-center justify-between border-b border-line/20 pb-3">
            <div className="flex items-center gap-2">
              <Shield className="size-4 text-peri-2" />
              <h3 className="text-lg font-medium text-ink">Edit access for {editingMember.email}</h3>
            </div>
            <Button variant="ghost" size="icon" onClick={() => setEditingMember(null)}>
              <XCircle className="size-4" />
            </Button>
          </div>
          <div className="space-y-4">
            {editError && (
              <Alert variant="destructive">
                <AlertDescription>{editError}</AlertDescription>
              </Alert>
            )}

            <div className="space-y-2">
              <Label className="font-mono text-xs uppercase text-ink-3">Project role</Label>
              <Select value={editRole} onValueChange={(value) => setEditRole(value as ProjectRole)}>
                <SelectTrigger className="w-48 border-line bg-black/20 text-ink">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="border-line/40 bg-popover text-ink">
                  <SelectItem value="VIEWER">VIEWER</SelectItem>
                  <SelectItem value="DEVELOPER">DEVELOPER</SelectItem>
                  <SelectItem value="ADMIN">ADMIN</SelectItem>
                  <SelectItem value="OWNER">OWNER</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label className="font-mono text-xs uppercase text-ink-3">
                Additional permissions
              </Label>
              <PermissionPicker selected={editPermissions} onChange={setEditPermissions} />
            </div>

            <div className="flex justify-end gap-3 pt-2">
              <Button type="button" variant="ghost" onClick={() => setEditingMember(null)}>
                Cancel
              </Button>
              <Button type="button" onClick={() => void handleSaveEdit()} disabled={saving}>
                {saving ? (
                  <>
                    <Loader2 className="mr-2 size-4 animate-spin" /> Saving...
                  </>
                ) : (
                  'Save Access'
                )}
              </Button>
            </div>
          </div>
        </Card>
      )}

      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-medium text-ink">Project Members</h3>
          <span className="font-mono text-xs text-ink-3">{members.length} members</span>
        </div>

        <Card className="overflow-hidden border-line/40 shadow-2xl">
          <div className="overflow-x-auto">
            <table className="w-full text-left font-mono text-xs">
              <thead className="border-b border-line/20 bg-black/40 text-[11px] tracking-wider uppercase text-ink-3">
                <tr>
                  <th className="px-6 py-3 font-medium">User</th>
                  <th className="px-6 py-3 font-medium">Project Role</th>
                  <th className="px-6 py-3 font-medium">Extra Permissions</th>
                  <th className="px-6 py-3 text-right font-medium">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line/10">
                {members.map((member) => {
                  const isCurrentUser = member.userId === user?.id;
                  const isOwner = member.role === 'OWNER';
                  const editable = canManage && !isOwner && !isCurrentUser;

                  return (
                    <tr key={member.userId} className="transition-colors hover:bg-white/[0.02]">
                      <td className="px-6 py-4 align-middle font-sans">
                        <div className="flex items-center gap-3">
                          <div className="flex size-8 items-center justify-center rounded-full border border-peri/30 bg-peri/20 font-mono text-xs font-semibold text-peri-2">
                            {member.email[0]?.toUpperCase() ?? '?'}
                          </div>
                          <div>
                            <div className="flex items-center gap-2">
                              <span className="font-medium text-ink">{member.email}</span>
                              {isCurrentUser && (
                                <Badge variant="outline" className="font-mono text-[9px]">
                                  YOU
                                </Badge>
                              )}
                            </div>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4 align-middle">
                        {isOwner ? (
                          <div className="flex items-center gap-1.5 font-semibold text-warning">
                            <Crown className="size-3.5" /> OWNER
                          </div>
                        ) : (
                          <Badge variant="secondary">{member.role}</Badge>
                        )}
                      </td>
                      <td className="px-6 py-4 align-middle text-ink-3">
                        {member.customPermissions.length > 0
                          ? member.customPermissions.join(', ')
                          : '—'}
                      </td>
                      <td className="px-6 py-4 align-middle text-right">
                        {editable && (
                          <div className="flex justify-end gap-2">
                            <Button variant="ghost" size="sm" onClick={() => openEdit(member)}>
                              Edit access
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              className="text-destructive hover:bg-destructive/10"
                              onClick={() => setRemoveTarget(member)}
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

      <ConfirmationDialog
        open={Boolean(removeTarget)}
        onOpenChange={(open) => {
          if (!open) setRemoveTarget(null);
        }}
        title={`Remove ${removeTarget?.email ?? 'member'} from this project?`}
        description="They will immediately lose access to this project's secrets."
        confirmText={removing ? 'Removing...' : 'Remove Member'}
        onConfirm={() => void handleRemoveMember()}
      />
    </div>
  );
}
