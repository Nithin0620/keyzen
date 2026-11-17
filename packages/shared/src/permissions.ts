export const workspaceRoles = ['OWNER', 'ADMIN', 'MEMBER', 'VIEWER'] as const;
export const projectRoles = ['OWNER', 'ADMIN', 'DEVELOPER', 'VIEWER'] as const;

export const permissions = [
  'secrets.read',
  'secrets.create',
  'secrets.update',
  'secrets.delete',
  'secrets.export',
  'environments.manage',
  'members.invite',
  'credentials.manage',
  'audit.read',
  'billing.manage',
] as const;

export type WorkspaceRole = (typeof workspaceRoles)[number];
export type ProjectRole = (typeof projectRoles)[number];
export type Permission = (typeof permissions)[number];

const all = [...permissions] as const;

export const workspaceRolePermissions: Record<WorkspaceRole, readonly Permission[]> = {
  OWNER: all,
  ADMIN: all.filter((permission) => permission !== 'billing.manage'),
  MEMBER: ['secrets.read', 'secrets.create', 'secrets.update'],
  VIEWER: [],
};

export const projectRolePermissions: Record<ProjectRole, readonly Permission[]> = {
  OWNER: all,
  ADMIN: all.filter((permission) => permission !== 'billing.manage'),
  DEVELOPER: ['secrets.read', 'secrets.create', 'secrets.update', 'environments.manage'],
  VIEWER: [],
};
