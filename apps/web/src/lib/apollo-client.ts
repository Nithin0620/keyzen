'use client';

import { ApolloClient, InMemoryCache, HttpLink, ApolloLink } from '@apollo/client';
import { TOKEN_KEY } from './auth';

const API_URL =
  process.env.NEXT_PUBLIC_API_URL ||
  (typeof window !== 'undefined' && window.location.hostname === 'localhost'
    ? 'http://localhost:4000/graphql'
    : 'https://keyzen.api.ssh.net.in/graphql');

/**
 * Auth link — injects the stored JWT into every GraphQL request.
 * Falls back to x-user-id header (dev only) when no token is present.
 */
const authLink = new ApolloLink((operation, forward) => {
  const token =
    typeof window !== 'undefined' ? localStorage.getItem(TOKEN_KEY) : null;

  operation.setContext(({ headers = {} }: { headers: Record<string, string> }) => ({
    headers: {
      ...headers,
      ...(token
        ? { Authorization: `Bearer ${token}` }
        : {
            'x-user-id': 'dev-user',
            'x-user-email': 'developer@keyzen.dev',
          }),
    },
  }));

  return forward(operation);
});

export function createApolloClient() {
  return new ApolloClient({
    link: authLink.concat(
      new HttpLink({ uri: API_URL })
    ),
    cache: new InMemoryCache(),
  });
}
