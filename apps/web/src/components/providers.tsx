'use client';

import React, { useMemo } from 'react';
import { ApolloProvider } from '@apollo/client';
import { createApolloClient } from '../lib/apollo-client';
import { AuthProvider } from '../context/auth-context';

export function Providers({ children }: { children: React.ReactNode }) {
  const client = useMemo(() => createApolloClient(), []);

  return (
    <AuthProvider>
      <ApolloProvider client={client}>{children}</ApolloProvider>
    </AuthProvider>
  );
}
