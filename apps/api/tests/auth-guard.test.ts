import { describe, it, expect } from 'vitest';
import {
  hasSufficientRole,
  requireAuth,
  requireOrgMembership,
  requireProjectMembership,
} from '../src/graphql/auth-guard';
import { GraphQLContext } from '../src/graphql/context';

describe('GraphQL Authorization Guards', () => {
  describe('hasSufficientRole', () => {
    it('should correctly evaluate OWNER permissions', () => {
      expect(hasSufficientRole('OWNER', 'VIEWER')).toBe(true);
      expect(hasSufficientRole('OWNER', 'MEMBER')).toBe(true);
      expect(hasSufficientRole('OWNER', 'ADMIN')).toBe(true);
      expect(hasSufficientRole('OWNER', 'OWNER')).toBe(true);
    });

    it('should correctly evaluate ADMIN permissions', () => {
      expect(hasSufficientRole('ADMIN', 'VIEWER')).toBe(true);
      expect(hasSufficientRole('ADMIN', 'MEMBER')).toBe(true);
      expect(hasSufficientRole('ADMIN', 'ADMIN')).toBe(true);
      expect(hasSufficientRole('ADMIN', 'OWNER')).toBe(false);
    });

    it('should correctly evaluate MEMBER permissions', () => {
      expect(hasSufficientRole('MEMBER', 'VIEWER')).toBe(true);
      expect(hasSufficientRole('MEMBER', 'MEMBER')).toBe(true);
      expect(hasSufficientRole('MEMBER', 'ADMIN')).toBe(false);
      expect(hasSufficientRole('MEMBER', 'OWNER')).toBe(false);
    });

    it('should correctly evaluate VIEWER permissions', () => {
      expect(hasSufficientRole('VIEWER', 'VIEWER')).toBe(true);
      expect(hasSufficientRole('VIEWER', 'MEMBER')).toBe(false);
      expect(hasSufficientRole('VIEWER', 'ADMIN')).toBe(false);
      expect(hasSufficientRole('VIEWER', 'OWNER')).toBe(false);
    });

    it('should reject unknown roles', () => {
      expect(hasSufficientRole('GUEST', 'VIEWER')).toBe(false);
    });
  });

  describe('requireAuth', () => {
    it('should throw UNAUTHENTICATED error when context is ANONYMOUS', () => {
      const ctx = {
        auth: { type: 'ANONYMOUS' },
      } as unknown as GraphQLContext;

      expect(() => requireAuth(ctx)).toThrowError(/Unauthorized: Authentication required/);
    });

    it('should throw UNAUTHENTICATED error when userId is missing', () => {
      const ctx = {
        auth: { type: 'USER' },
      } as unknown as GraphQLContext;

      expect(() => requireAuth(ctx)).toThrowError(/Unauthorized: Authentication required/);
    });

    it('should return userId and userEmail when user is authenticated', () => {
      const ctx = {
        auth: {
          type: 'USER',
          userId: 'user-123',
          userEmail: 'alice@example.com',
        },
      } as unknown as GraphQLContext;

      const result = requireAuth(ctx);
      expect(result.userId).toBe('user-123');
      expect(result.userEmail).toBe('alice@example.com');
    });
  });

  describe('requireOrgMembership', () => {
    it('should throw FORBIDDEN if user is not in org_members', async () => {
      const mockDb = {
        select: () => ({
          from: () => ({
            where: () => ({
              limit: async () => [],
            }),
          }),
        }),
      };

      const ctx = {
        auth: { type: 'USER', userId: 'user-123' },
        db: mockDb,
      } as unknown as GraphQLContext;

      await expect(requireOrgMembership(ctx, 'org-1', 'VIEWER')).rejects.toThrowError(
        /Forbidden: You are not a member of this organization/
      );
    });

    it('should throw FORBIDDEN if user role is insufficient', async () => {
      const mockDb = {
        select: () => ({
          from: () => ({
            where: () => ({
              limit: async () => [{ orgId: 'org-1', userId: 'user-123', role: 'VIEWER' }],
            }),
          }),
        }),
      };

      const ctx = {
        auth: { type: 'USER', userId: 'user-123' },
        db: mockDb,
      } as unknown as GraphQLContext;

      await expect(requireOrgMembership(ctx, 'org-1', 'MEMBER')).rejects.toThrowError(
        /Forbidden: Action requires at least MEMBER role/
      );
    });

    it('should succeed if user has required role', async () => {
      const memberRecord = { orgId: 'org-1', userId: 'user-123', role: 'MEMBER' };
      const mockDb = {
        select: () => ({
          from: () => ({
            where: () => ({
              limit: async () => [memberRecord],
            }),
          }),
        }),
      };

      const ctx = {
        auth: { type: 'USER', userId: 'user-123' },
        db: mockDb,
      } as unknown as GraphQLContext;

      const res = await requireOrgMembership(ctx, 'org-1', 'MEMBER');
      expect(res.member).toEqual(memberRecord);
    });
  });

  describe('requireProjectMembership', () => {
    it('should throw NOT_FOUND if project does not exist', async () => {
      const mockDb = {
        select: () => ({
          from: () => ({
            where: () => ({
              limit: async () => [],
            }),
          }),
        }),
      };

      const ctx = {
        auth: { type: 'USER', userId: 'user-123' },
        db: mockDb,
      } as unknown as GraphQLContext;

      await expect(requireProjectMembership(ctx, 'proj-1', 'VIEWER')).rejects.toThrowError(
        /Project not found: proj-1/
      );
    });

    it('should throw FORBIDDEN if user is not a member of the project org', async () => {
      let callCount = 0;
      const mockDb = {
        select: () => ({
          from: () => ({
            where: () => ({
              limit: async () => {
                callCount++;
                if (callCount === 1) {
                  return [{ id: 'proj-1', orgId: 'org-1' }];
                }
                return []; // not a member
              },
            }),
          }),
        }),
      };

      const ctx = {
        auth: { type: 'USER', userId: 'user-123' },
        db: mockDb,
      } as unknown as GraphQLContext;

      await expect(requireProjectMembership(ctx, 'proj-1', 'VIEWER')).rejects.toThrowError(
        /Forbidden: You do not have access to this project/
      );
    });
  });
});
