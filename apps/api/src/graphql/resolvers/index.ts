import { GraphQLError } from 'graphql';
import {
  organizations,
  orgMembers,
  projects,
  environments,
  secrets,
  secretValues,
  serviceTokens,
  auditLogs,
  eq,
  and,
  desc,
  inArray,
  count,
} from '@keyzen/db';
import { generateServiceToken } from '@keyzen/crypto';
import { cryptoService } from '../../services/crypto-service';
import { GraphQLContext } from '../context';
import {
  requireAuth,
  requireOrgMembership,
  requireOrgMembershipBySlug,
  requireProjectMembership,
  requireProjectMembershipBySlug,
} from '../auth-guard';

export const resolvers = {
  Query: {
    organizations: async (_: unknown, __: unknown, ctx: GraphQLContext) => {
      const auth = requireAuth(ctx);
      return ctx.db
        .select({
          id: organizations.id,
          name: organizations.name,
          slug: organizations.slug,
          createdAt: organizations.createdAt,
          updatedAt: organizations.updatedAt,
        })
        .from(organizations)
        .innerJoin(orgMembers, eq(organizations.id, orgMembers.orgId))
        .where(eq(orgMembers.userId, auth.userId));
    },

    organization: async (_: unknown, { slug }: { slug: string }, ctx: GraphQLContext) => {
      const res = await requireOrgMembershipBySlug(ctx, slug, 'VIEWER');
      return res ? res.org : null;
    },

    project: async (
      _: unknown,
      { orgSlug, projectSlug }: { orgSlug?: string; projectSlug: string },
      ctx: GraphQLContext
    ) => {
      const auth = requireAuth(ctx);
      if (orgSlug) {
        const res = await requireProjectMembershipBySlug(ctx, orgSlug, projectSlug, 'VIEWER');
        return res ? res.project : null;
      }
      const userOrgs = await ctx.db
        .select({ orgId: orgMembers.orgId })
        .from(orgMembers)
        .where(eq(orgMembers.userId, auth.userId));

      const orgIds = userOrgs.map((o) => o.orgId);
      if (orgIds.length === 0) return null;

      const [proj] = await ctx.db
        .select()
        .from(projects)
        .where(and(inArray(projects.orgId, orgIds), eq(projects.slug, projectSlug)))
        .limit(1);

      return proj || null;
    },

    auditLogs: async (
      _: unknown,
      { projectId, limit = 50 }: { projectId?: string; limit?: number },
      ctx: GraphQLContext
    ) => {
      const auth = requireAuth(ctx);
      let query = ctx.db.select().from(auditLogs);

      if (projectId) {
        await requireProjectMembership(ctx, projectId, 'VIEWER');
        query = query.where(eq(auditLogs.projectId, projectId)) as typeof query;
      } else {
        const userOrgs = await ctx.db
          .select({ orgId: orgMembers.orgId })
          .from(orgMembers)
          .where(eq(orgMembers.userId, auth.userId));

        const orgIds = userOrgs.map((o) => o.orgId);
        if (orgIds.length === 0) {
          return [];
        }
        query = query.where(inArray(auditLogs.orgId, orgIds)) as typeof query;
      }

      const logs = await query.orderBy(desc(auditLogs.createdAt)).limit(limit);
      return logs.map((log) => ({
        ...log,
        createdAt: log.createdAt.toISOString(),
        metadata: log.metadata ? JSON.stringify(log.metadata) : null,
      }));
    },

    revealSecret: async (
      _: unknown,
      {
        projectId,
        environmentSlug,
        secretName,
      }: { projectId: string; environmentSlug: string; secretName: string },
      ctx: GraphQLContext
    ) => {
      const { project, auth } = await requireProjectMembership(ctx, projectId, 'VIEWER');

      // Find environment
      const [env] = await ctx.db
        .select()
        .from(environments)
        .where(and(eq(environments.projectId, projectId), eq(environments.slug, environmentSlug)))
        .limit(1);

      if (!env) {
        throw new GraphQLError(`Environment ${environmentSlug} not found in project`, {
          extensions: { code: 'NOT_FOUND' },
        });
      }

      // Find secret and value
      const [row] = await ctx.db
        .select({
          secretId: secrets.id,
          name: secrets.name,
          ciphertext: secretValues.ciphertext,
          iv: secretValues.iv,
          authTag: secretValues.authTag,
          version: secretValues.version,
        })
        .from(secrets)
        .innerJoin(
          secretValues,
          and(eq(secretValues.secretId, secrets.id), eq(secretValues.environmentId, env.id))
        )
        .where(and(eq(secrets.projectId, projectId), eq(secrets.name, secretName)))
        .limit(1);

      if (!row) {
        throw new GraphQLError(`Secret ${secretName} not found in ${environmentSlug}`, {
          extensions: { code: 'NOT_FOUND' },
        });
      }

      const decrypted = await cryptoService.decryptForProject(projectId, {
        ciphertext: row.ciphertext,
        iv: row.iv,
        authTag: row.authTag,
      });

      // Audit Log for secret reveal
      await ctx.db.insert(auditLogs).values({
        orgId: project.orgId,
        projectId,
        actorType: 'USER',
        actorId: auth.userId,
        actorName: auth.userEmail || 'developer',
        action: 'SECRET_REVEAL',
        metadata: { secretName, environment: environmentSlug },
        ipAddress: ctx.req?.ip,
        userAgent: ctx.req?.headers?.['user-agent'] as string | undefined,
      });

      return {
        id: row.secretId,
        name: row.name,
        environmentSlug,
        value: decrypted,
        version: row.version,
      };
    },
  },

  Organization: {
    createdAt: (parent: { createdAt: Date }) => parent.createdAt.toISOString(),
    projects: async (parent: { id: string }, _: unknown, ctx: GraphQLContext) => {
      await requireOrgMembership(ctx, parent.id, 'VIEWER');
      return ctx.db.select().from(projects).where(eq(projects.orgId, parent.id));
    },
    members: async (parent: { id: string }, _: unknown, ctx: GraphQLContext) => {
      await requireOrgMembership(ctx, parent.id, 'VIEWER');
      const members = await ctx.db.select().from(orgMembers).where(eq(orgMembers.orgId, parent.id));
      return members.map((m) => ({ ...m, createdAt: m.createdAt.toISOString() }));
    },
  },

  Project: {
    createdAt: (parent: { createdAt: Date }) => parent.createdAt.toISOString(),
    environments: async (parent: { id: string }, _: unknown, ctx: GraphQLContext) => {
      await requireProjectMembership(ctx, parent.id, 'VIEWER');
      return ctx.db.select().from(environments).where(eq(environments.projectId, parent.id));
    },
    secrets: async (parent: { id: string }, _: unknown, ctx: GraphQLContext) => {
      await requireProjectMembership(ctx, parent.id, 'VIEWER');
      return ctx.db.select().from(secrets).where(eq(secrets.projectId, parent.id));
    },
    serviceTokens: async (parent: { id: string }, _: unknown, ctx: GraphQLContext) => {
      await requireProjectMembership(ctx, parent.id, 'VIEWER');
      const tokens = await ctx.db
        .select({
          id: serviceTokens.id,
          name: serviceTokens.name,
          environmentId: serviceTokens.environmentId,
          environmentName: environments.name,
          tokenPrefix: serviceTokens.tokenPrefix,
          createdBy: serviceTokens.createdBy,
          lastUsedAt: serviceTokens.lastUsedAt,
          expiresAt: serviceTokens.expiresAt,
          createdAt: serviceTokens.createdAt,
        })
        .from(serviceTokens)
        .innerJoin(environments, eq(serviceTokens.environmentId, environments.id))
        .where(eq(serviceTokens.projectId, parent.id));

      return tokens.map((t) => ({
        ...t,
        lastUsedAt: t.lastUsedAt ? t.lastUsedAt.toISOString() : null,
        expiresAt: t.expiresAt ? t.expiresAt.toISOString() : null,
        createdAt: t.createdAt.toISOString(),
      }));
    },
  },

  Environment: {
    createdAt: (parent: { createdAt: Date }) => parent.createdAt.toISOString(),
    secretCount: async (parent: { id: string }, _: unknown, ctx: GraphQLContext) => {
      const [res] = await ctx.db
        .select({ count: count() })
        .from(secretValues)
        .where(eq(secretValues.environmentId, parent.id));
      return Number(res?.count || 0);
    },
  },

  SecretMetadata: {
    createdAt: (parent: { createdAt: Date }) => parent.createdAt.toISOString(),
    updatedAt: (parent: { updatedAt: Date }) => parent.updatedAt.toISOString(),
    hasValueInEnvs: async (parent: { id: string }, _: unknown, ctx: GraphQLContext) => {
      const envs = await ctx.db
        .select({ slug: environments.slug })
        .from(secretValues)
        .innerJoin(environments, eq(secretValues.environmentId, environments.id))
        .where(eq(secretValues.secretId, parent.id));
      return envs.map((e) => e.slug);
    },
  },

  Mutation: {
    createOrganization: async (
      _: unknown,
      { name, slug }: { name: string; slug: string },
      ctx: GraphQLContext
    ) => {
      const auth = requireAuth(ctx);
      const [org] = await ctx.db.insert(organizations).values({ name, slug }).returning();

      // Add current user as OWNER
      await ctx.db.insert(orgMembers).values({
        orgId: org.id,
        userId: auth.userId,
        email: auth.userEmail || 'admin@keyzen.dev',
        role: 'OWNER',
      });

      return org;
    },

    createProject: async (
      _: unknown,
      {
        orgId,
        name,
        slug,
        description,
      }: { orgId: string; name: string; slug: string; description?: string },
      ctx: GraphQLContext
    ) => {
      const { auth } = await requireOrgMembership(ctx, orgId, 'MEMBER');

      const [proj] = await ctx.db
        .insert(projects)
        .values({ orgId, name, slug, description })
        .returning();

      // Create default environments: dev, staging, prod
      await ctx.db.insert(environments).values([
        { projectId: proj.id, name: 'Development', slug: 'dev' },
        { projectId: proj.id, name: 'Staging', slug: 'staging' },
        { projectId: proj.id, name: 'Production', slug: 'prod' },
      ]);

      await ctx.db.insert(auditLogs).values({
        orgId,
        projectId: proj.id,
        actorType: 'USER',
        actorId: auth.userId,
        actorName: auth.userEmail || 'developer',
        action: 'PROJECT_CREATE',
        metadata: { name, slug },
        ipAddress: ctx.req?.ip,
        userAgent: ctx.req?.headers?.['user-agent'] as string | undefined,
      });

      return proj;
    },

    createEnvironment: async (
      _: unknown,
      { projectId, name, slug }: { projectId: string; name: string; slug: string },
      ctx: GraphQLContext
    ) => {
      const { project, auth } = await requireProjectMembership(ctx, projectId, 'MEMBER');

      const [env] = await ctx.db
        .insert(environments)
        .values({ projectId, name, slug })
        .returning();

      await ctx.db.insert(auditLogs).values({
        orgId: project.orgId,
        projectId: project.id,
        actorType: 'USER',
        actorId: auth.userId,
        actorName: auth.userEmail || 'developer',
        action: 'ENVIRONMENT_CREATE',
        metadata: { name, slug },
        ipAddress: ctx.req?.ip,
        userAgent: ctx.req?.headers?.['user-agent'] as string | undefined,
      });

      return env;
    },

    createSecret: async (
      _: unknown,
      {
        input,
      }: {
        input: {
          projectId: string;
          name: string;
          comment?: string;
          values: Array<{ environmentSlug: string; value: string }>;
        };
      },
      ctx: GraphQLContext
    ) => {
      const { project, auth } = await requireProjectMembership(ctx, input.projectId, 'MEMBER');

      // 1. Create Secret record
      const [secret] = await ctx.db
        .insert(secrets)
        .values({
          projectId: input.projectId,
          name: input.name,
          comment: input.comment,
        })
        .returning();

      // 2. Encrypt and insert values for each environment
      for (const envVal of input.values) {
        const [env] = await ctx.db
          .select()
          .from(environments)
          .where(
            and(
              eq(environments.projectId, input.projectId),
              eq(environments.slug, envVal.environmentSlug)
            )
          )
          .limit(1);

        if (env) {
          const encrypted = await cryptoService.encryptForProject(input.projectId, envVal.value);
          await ctx.db.insert(secretValues).values({
            secretId: secret.id,
            environmentId: env.id,
            ciphertext: encrypted.ciphertext,
            iv: encrypted.iv,
            authTag: encrypted.authTag,
            version: 1,
          });
        }
      }

      // 3. Log audit
      await ctx.db.insert(auditLogs).values({
        orgId: project.orgId,
        projectId: input.projectId,
        actorType: 'USER',
        actorId: auth.userId,
        actorName: auth.userEmail || 'developer',
        action: 'SECRET_CREATE',
        metadata: { secretName: input.name },
        ipAddress: ctx.req?.ip,
        userAgent: ctx.req?.headers?.['user-agent'] as string | undefined,
      });

      return secret;
    },

    updateSecretValue: async (
      _: unknown,
      {
        input,
      }: {
        input: {
          projectId: string;
          secretName: string;
          environmentSlug: string;
          value: string;
        };
      },
      ctx: GraphQLContext
    ) => {
      const { project, auth } = await requireProjectMembership(ctx, input.projectId, 'MEMBER');

      const [secret] = await ctx.db
        .select()
        .from(secrets)
        .where(and(eq(secrets.projectId, input.projectId), eq(secrets.name, input.secretName)))
        .limit(1);

      if (!secret) {
        throw new GraphQLError(`Secret ${input.secretName} not found`, {
          extensions: { code: 'NOT_FOUND' },
        });
      }

      const [env] = await ctx.db
        .select()
        .from(environments)
        .where(
          and(
            eq(environments.projectId, input.projectId),
            eq(environments.slug, input.environmentSlug)
          )
        )
        .limit(1);

      if (!env) {
        throw new GraphQLError(`Environment ${input.environmentSlug} not found`, {
          extensions: { code: 'NOT_FOUND' },
        });
      }

      const encrypted = await cryptoService.encryptForProject(input.projectId, input.value);

      // Check existing value version
      const [existingValue] = await ctx.db
        .select()
        .from(secretValues)
        .where(
          and(
            eq(secretValues.secretId, secret.id),
            eq(secretValues.environmentId, env.id)
          )
        )
        .limit(1);

      const nextVersion = existingValue ? existingValue.version + 1 : 1;

      if (existingValue) {
        await ctx.db
          .update(secretValues)
          .set({
            ciphertext: encrypted.ciphertext,
            iv: encrypted.iv,
            authTag: encrypted.authTag,
            version: nextVersion,
            updatedAt: new Date(),
          })
          .where(eq(secretValues.id, existingValue.id));
      } else {
        await ctx.db.insert(secretValues).values({
          secretId: secret.id,
          environmentId: env.id,
          ciphertext: encrypted.ciphertext,
          iv: encrypted.iv,
          authTag: encrypted.authTag,
          version: 1,
        });
      }

      await ctx.db
        .update(secrets)
        .set({ updatedAt: new Date() })
        .where(eq(secrets.id, secret.id));

      await ctx.db.insert(auditLogs).values({
        orgId: project.orgId,
        projectId: input.projectId,
        actorType: 'USER',
        actorId: auth.userId,
        actorName: auth.userEmail || 'developer',
        action: 'SECRET_UPDATE',
        metadata: { secretName: input.secretName, environment: input.environmentSlug, version: nextVersion },
        ipAddress: ctx.req?.ip,
        userAgent: ctx.req?.headers?.['user-agent'] as string | undefined,
      });

      return secret;
    },

    deleteSecret: async (
      _: unknown,
      { projectId, secretName }: { projectId: string; secretName: string },
      ctx: GraphQLContext
    ) => {
      const { project, auth } = await requireProjectMembership(ctx, projectId, 'MEMBER');

      const [secret] = await ctx.db
        .select()
        .from(secrets)
        .where(and(eq(secrets.projectId, projectId), eq(secrets.name, secretName)))
        .limit(1);

      if (!secret) return false;

      await ctx.db.delete(secrets).where(eq(secrets.id, secret.id));

      await ctx.db.insert(auditLogs).values({
        orgId: project.orgId,
        projectId,
        actorType: 'USER',
        actorId: auth.userId,
        actorName: auth.userEmail || 'developer',
        action: 'SECRET_DELETE',
        metadata: { secretName },
        ipAddress: ctx.req?.ip,
        userAgent: ctx.req?.headers?.['user-agent'] as string | undefined,
      });

      return true;
    },

    createServiceToken: async (
      _: unknown,
      {
        input,
      }: {
        input: {
          projectId: string;
          environmentSlug: string;
          name: string;
          expiresInDays?: number;
        };
      },
      ctx: GraphQLContext
    ) => {
      const { project, auth } = await requireProjectMembership(ctx, input.projectId, 'MEMBER');

      const [env] = await ctx.db
        .select()
        .from(environments)
        .where(
          and(
            eq(environments.projectId, input.projectId),
            eq(environments.slug, input.environmentSlug)
          )
        )
        .limit(1);

      if (!env) {
        throw new GraphQLError(`Environment ${input.environmentSlug} not found`, {
          extensions: { code: 'NOT_FOUND' },
        });
      }

      const { token, hash } = generateServiceToken(input.environmentSlug);
      const tokenPrefix = token.slice(0, 16) + '...';

      let expiresAt: Date | null = null;
      if (input.expiresInDays) {
        expiresAt = new Date(Date.now() + input.expiresInDays * 24 * 60 * 60 * 1000);
      }

      const [created] = await ctx.db
        .insert(serviceTokens)
        .values({
          projectId: input.projectId,
          environmentId: env.id,
          name: input.name,
          tokenHash: hash,
          tokenPrefix,
          createdBy: auth.userEmail || auth.userId,
          expiresAt,
        })
        .returning();

      await ctx.db.insert(auditLogs).values({
        orgId: project.orgId,
        projectId: input.projectId,
        actorType: 'USER',
        actorId: auth.userId,
        actorName: auth.userEmail || 'developer',
        action: 'SERVICE_TOKEN_CREATE',
        metadata: { tokenName: input.name, environment: input.environmentSlug },
        ipAddress: ctx.req?.ip,
        userAgent: ctx.req?.headers?.['user-agent'] as string | undefined,
      });

      return {
        id: created.id,
        name: created.name,
        token, // Returned ONCE upon creation!
        tokenPrefix,
        environmentSlug: input.environmentSlug,
        createdAt: created.createdAt.toISOString(),
      };
    },

    revokeServiceToken: async (
      _: unknown,
      { tokenId }: { tokenId: string },
      ctx: GraphQLContext
    ) => {
      const auth = requireAuth(ctx);

      const [foundToken] = await ctx.db
        .select({
          id: serviceTokens.id,
          name: serviceTokens.name,
          projectId: serviceTokens.projectId,
        })
        .from(serviceTokens)
        .where(eq(serviceTokens.id, tokenId))
        .limit(1);

      if (!foundToken) {
        return false;
      }

      const { project } = await requireProjectMembership(ctx, foundToken.projectId, 'MEMBER');

      await ctx.db.delete(serviceTokens).where(eq(serviceTokens.id, tokenId));

      await ctx.db.insert(auditLogs).values({
        orgId: project.orgId,
        projectId: project.id,
        actorType: 'USER',
        actorId: auth.userId,
        actorName: auth.userEmail || 'developer',
        action: 'SERVICE_TOKEN_REVOKE',
        metadata: { tokenId, tokenName: foundToken.name },
        ipAddress: ctx.req?.ip,
        userAgent: ctx.req?.headers?.['user-agent'] as string | undefined,
      });

      return true;
    },
  },
};
