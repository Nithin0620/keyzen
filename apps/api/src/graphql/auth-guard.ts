import { GraphQLError } from 'graphql';
import {
  organizations,
  orgMembers,
  projects,
  eq,
  and,
} from '@keyzen/db';
import { GraphQLContext } from './context';

export type OrgRole = 'OWNER' | 'ADMIN' | 'MEMBER' | 'VIEWER';

const ROLE_HIERARCHY: Record<OrgRole, number> = {
  OWNER: 4,
  ADMIN: 3,
  MEMBER: 2,
  VIEWER: 1,
};

export function hasSufficientRole(userRole: string, requiredRole: OrgRole = 'VIEWER'): boolean {
  const userLevel = ROLE_HIERARCHY[userRole as OrgRole] ?? 0;
  const requiredLevel = ROLE_HIERARCHY[requiredRole] ?? 0;
  return userLevel >= requiredLevel;
}

export function requireAuth(ctx: GraphQLContext): { userId: string; userEmail?: string } {
  if (ctx.auth.type !== 'USER' || !ctx.auth.userId) {
    throw new GraphQLError('Unauthorized: Authentication required', {
      extensions: { code: 'UNAUTHENTICATED' },
    });
  }
  return {
    userId: ctx.auth.userId,
    userEmail: ctx.auth.userEmail,
  };
}

export async function requireOrgMembership(
  ctx: GraphQLContext,
  orgId: string,
  minRole: OrgRole = 'VIEWER'
) {
  const auth = requireAuth(ctx);

  const [member] = await ctx.db
    .select()
    .from(orgMembers)
    .where(and(eq(orgMembers.orgId, orgId), eq(orgMembers.userId, auth.userId)))
    .limit(1);

  if (!member) {
    throw new GraphQLError('Forbidden: You are not a member of this organization', {
      extensions: { code: 'FORBIDDEN' },
    });
  }

  if (!hasSufficientRole(member.role, minRole)) {
    throw new GraphQLError(`Forbidden: Action requires at least ${minRole} role`, {
      extensions: { code: 'FORBIDDEN' },
    });
  }

  return { member, auth };
}

export async function requireOrgMembershipBySlug(
  ctx: GraphQLContext,
  orgSlug: string,
  minRole: OrgRole = 'VIEWER'
) {
  const auth = requireAuth(ctx);

  const [org] = await ctx.db
    .select()
    .from(organizations)
    .where(eq(organizations.slug, orgSlug))
    .limit(1);

  if (!org) {
    return null;
  }

  const [member] = await ctx.db
    .select()
    .from(orgMembers)
    .where(and(eq(orgMembers.orgId, org.id), eq(orgMembers.userId, auth.userId)))
    .limit(1);

  if (!member) {
    throw new GraphQLError('Forbidden: You are not a member of this organization', {
      extensions: { code: 'FORBIDDEN' },
    });
  }

  if (!hasSufficientRole(member.role, minRole)) {
    throw new GraphQLError(`Forbidden: Action requires at least ${minRole} role`, {
      extensions: { code: 'FORBIDDEN' },
    });
  }

  return { org, member, auth };
}

export async function requireProjectMembership(
  ctx: GraphQLContext,
  projectId: string,
  minRole: OrgRole = 'VIEWER'
) {
  const auth = requireAuth(ctx);

  const [project] = await ctx.db
    .select()
    .from(projects)
    .where(eq(projects.id, projectId))
    .limit(1);

  if (!project) {
    throw new GraphQLError(`Project not found: ${projectId}`, {
      extensions: { code: 'NOT_FOUND' },
    });
  }

  const [member] = await ctx.db
    .select()
    .from(orgMembers)
    .where(and(eq(orgMembers.orgId, project.orgId), eq(orgMembers.userId, auth.userId)))
    .limit(1);

  if (!member) {
    throw new GraphQLError('Forbidden: You do not have access to this project', {
      extensions: { code: 'FORBIDDEN' },
    });
  }

  if (!hasSufficientRole(member.role, minRole)) {
    throw new GraphQLError(`Forbidden: Action requires at least ${minRole} role`, {
      extensions: { code: 'FORBIDDEN' },
    });
  }

  return { project, member, auth };
}

export async function requireProjectMembershipBySlug(
  ctx: GraphQLContext,
  orgSlug: string,
  projectSlug: string,
  minRole: OrgRole = 'VIEWER'
) {
  const auth = requireAuth(ctx);

  const [org] = await ctx.db
    .select()
    .from(organizations)
    .where(eq(organizations.slug, orgSlug))
    .limit(1);

  if (!org) {
    return null;
  }

  const [member] = await ctx.db
    .select()
    .from(orgMembers)
    .where(and(eq(orgMembers.orgId, org.id), eq(orgMembers.userId, auth.userId)))
    .limit(1);

  if (!member) {
    throw new GraphQLError('Forbidden: You are not a member of this organization', {
      extensions: { code: 'FORBIDDEN' },
    });
  }

  if (!hasSufficientRole(member.role, minRole)) {
    throw new GraphQLError(`Forbidden: Action requires at least ${minRole} role`, {
      extensions: { code: 'FORBIDDEN' },
    });
  }

  const [project] = await ctx.db
    .select({
      id: projects.id,
      orgId: projects.orgId,
      name: projects.name,
      slug: projects.slug,
      description: projects.description,
      createdAt: projects.createdAt,
    })
    .from(projects)
    .where(and(eq(projects.orgId, org.id), eq(projects.slug, projectSlug)))
    .limit(1);

  if (!project) {
    return null;
  }

  return { org, project, member, auth };
}
