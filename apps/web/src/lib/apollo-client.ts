'use client';

import { ApolloClient, InMemoryCache, HttpLink } from '@apollo/client';

const API_URL =
  process.env.NEXT_PUBLIC_API_URL ||
  (typeof window !== 'undefined' && window.location.hostname === 'localhost'
    ? 'http://localhost:4000/graphql'
    : 'https://keyzen.api.ssh.net.in/graphql');

export function createApolloClient() {
  return new ApolloClient({
    link: new HttpLink({
      uri: API_URL,
      headers: {
        'x-user-id': 'dev-user',
        'x-user-email': 'developer@keyzen.dev',
      },
    }),
    cache: new InMemoryCache(),
  });
}
