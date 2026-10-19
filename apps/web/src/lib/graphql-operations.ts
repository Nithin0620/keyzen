import { gql } from '@apollo/client';

export const GET_DASHBOARD_DATA = gql`
  query GetDashboardData {
    organizations {
      id
      name
      slug
      projects {
        id
        orgId
        name
        slug
        description
        createdAt
        environments {
          id
          name
          slug
          secretCount
        }
      }
    }
  }
`;

export const CREATE_PROJECT = gql`
  mutation CreateProject($orgId: ID!, $name: String!, $slug: String!, $description: String) {
    createProject(orgId: $orgId, name: $name, slug: $slug, description: $description) {
      id
      orgId
      name
      slug
      description
      createdAt
      environments {
        id
        name
        slug
        secretCount
      }
    }
  }
`;

export const GET_PROJECT_DETAILS = gql`
  query GetProjectDetails($projectSlug: String!, $orgSlug: String) {
    organizations {
      id
      name
      slug
      members {
        id
        userId
        email
        name
        role
        createdAt
      }
    }
    project(projectSlug: $projectSlug, orgSlug: $orgSlug) {
      id
      orgId
      name
      slug
      description
      createdAt
      environments {
        id
        name
        slug
        secretCount
      }
      secrets {
        id
        projectId
        name
        comment
        createdAt
        updatedAt
        hasValueInEnvs
      }
      serviceTokens {
        id
        name
        environmentId
        environmentName
        tokenPrefix
        createdBy
        lastUsedAt
        expiresAt
        createdAt
      }
    }
    auditLogs(limit: 50) {
      id
      actorType
      actorId
      actorName
      action
      metadata
      ipAddress
      createdAt
    }
  }
`;

export const CREATE_SECRET = gql`
  mutation CreateSecret($input: CreateSecretInput!) {
    createSecret(input: $input) {
      id
      projectId
      name
      comment
      hasValueInEnvs
      createdAt
      updatedAt
    }
  }
`;

export const UPDATE_SECRET_VALUE = gql`
  mutation UpdateSecretValue($input: UpdateSecretValueInput!) {
    updateSecretValue(input: $input) {
      id
      projectId
      name
      hasValueInEnvs
      updatedAt
    }
  }
`;

export const DELETE_SECRET = gql`
  mutation DeleteSecret($projectId: ID!, $secretName: String!) {
    deleteSecret(projectId: $projectId, secretName: $secretName)
  }
`;

export const REVEAL_SECRET = gql`
  query RevealSecret($projectId: ID!, $environmentSlug: String!, $secretName: String!) {
    revealSecret(projectId: $projectId, environmentSlug: $environmentSlug, secretName: $secretName) {
      id
      name
      environmentSlug
      value
      version
    }
  }
`;

export const CREATE_SERVICE_TOKEN = gql`
  mutation CreateServiceToken($input: CreateServiceTokenInput!) {
    createServiceToken(input: $input) {
      id
      name
      token
      tokenPrefix
      environmentSlug
      createdAt
    }
  }
`;

export const REVOKE_SERVICE_TOKEN = gql`
  mutation RevokeServiceToken($tokenId: ID!) {
    revokeServiceToken(tokenId: $tokenId)
  }
`;
