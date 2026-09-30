export const typeDefs = `#graphql
  enum MemberRole {
    OWNER
    ADMIN
    MEMBER
    VIEWER
  }

  type Organization {
    id: ID!
    name: String!
    slug: String!
    createdAt: String!
    projects: [Project!]!
    members: [OrgMember!]!
  }

  type OrgMember {
    id: ID!
    userId: String!
    email: String!
    name: String
    role: MemberRole!
    createdAt: String!
  }

  type Project {
    id: ID!
    orgId: ID!
    name: String!
    slug: String!
    description: String
    createdAt: String!
    environments: [Environment!]!
    secrets: [SecretMetadata!]!
    serviceTokens: [ServiceTokenSummary!]!
  }

  type Environment {
    id: ID!
    projectId: ID!
    name: String!
    slug: String!
    createdAt: String!
    secretCount: Int!
  }

  type SecretMetadata {
    id: ID!
    projectId: ID!
    name: String!
    comment: String
    createdAt: String!
    updatedAt: String!
    hasValueInEnvs: [String!]!
  }

  type RevealedSecret {
    id: ID!
    name: String!
    environmentSlug: String!
    value: String!
    version: Int!
  }

  type ServiceTokenSummary {
    id: ID!
    name: String!
    environmentId: ID!
    environmentName: String!
    tokenPrefix: String!
    createdBy: String!
    lastUsedAt: String
    expiresAt: String
    createdAt: String!
  }

  type CreatedServiceToken {
    id: ID!
    name: String!
    token: String!
    tokenPrefix: String!
    environmentSlug: String!
    createdAt: String!
  }

  type AuditLogEntry {
    id: ID!
    actorType: String!
    actorId: String!
    actorName: String
    action: String!
    metadata: String
    ipAddress: String
    createdAt: String!
  }

  type Query {
    organizations: [Organization!]!
    organization(slug: String!): Organization
    project(orgSlug: String!, projectSlug: String!): Project
    auditLogs(projectId: ID, limit: Int): [AuditLogEntry!]!
    revealSecret(projectId: ID!, environmentSlug: String!, secretName: String!): RevealedSecret!
  }

  input CreateSecretInput {
    projectId: ID!
    name: String!
    comment: String
    values: [EnvironmentSecretInput!]!
  }

  input EnvironmentSecretInput {
    environmentSlug: String!
    value: String!
  }

  input UpdateSecretValueInput {
    projectId: ID!
    secretName: String!
    environmentSlug: String!
    value: String!
  }

  input CreateServiceTokenInput {
    projectId: ID!
    environmentSlug: String!
    name: String!
    expiresInDays: Int
  }

  type Mutation {
    createOrganization(name: String!, slug: String!): Organization!
    createProject(orgId: ID!, name: String!, slug: String!, description: String): Project!
    createEnvironment(projectId: ID!, name: String!, slug: String!): Environment!
    
    createSecret(input: CreateSecretInput!): SecretMetadata!
    updateSecretValue(input: UpdateSecretValueInput!): SecretMetadata!
    deleteSecret(projectId: ID!, secretName: String!): Boolean!

    createServiceToken(input: CreateServiceTokenInput!): CreatedServiceToken!
    revokeServiceToken(tokenId: ID!): Boolean!
  }
`;
